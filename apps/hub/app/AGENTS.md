# apps/hub/app — os layouts de área

Complementa o `AGENTS.md` de `apps/hub`, que vence em conflito. **Área nova
precisa de layout novo, e layout novo desenha a trilha.**

## A trilha é do LAYOUT da área, nunca da página (2026-09-07)

**Nenhuma página do hub desenha o próprio breadcrumb.** Quem desenha é o layout
da área, com `<TrilhaDaRota papel={...} />` (`components/trilha.tsx`), e os itens
saem de um registro de rotas — `NOS`, em `lib/trilha.ts`, com o padrão da rota
como chave (`/professor/entre-redes/[ano]/[unidade]`, igual à pasta em `app/`).

Era por página, e o resultado foi o que o dono do produto viu: 22 telas com
trilha e 15 sem — cinco na própria área do professor, as 7 de `/admin`, as 2 de
`/analise` e o hub do estudante. Ninguém decidiu isso. A trilha era
responsabilidade da página, e responsabilidade de página se esquece; a barra
lateral de `/admin` era a razão de ninguém notar, porque ela cobre a navegação
de primeiro nível e esconde a falta do segundo.

**Rota nova = uma linha em `NOS`, e nada na página.** Esquecer a linha não apaga
a trilha: a rota não registrada cai num rótulo humanizado do segmento
(`plano-de-ensino` → "Plano de ensino"), que é um defeito visível e barato de
corrigir. O que não pode acontecer nunca é a trilha desaparecer, e o desenho
tira essa possibilidade da mesa.

**A página só PUBLICA nome próprio, com `RotuloDaTrilha`** — o título da
atividade, o nome da turma, o nome do estudante: o que uma tabela de rotas não
tem como saber. Sem publicação o item fica no rótulo de domínio do registro
("Atividade", "Turma", "Estudante"), **nunca no id do endereço**. `para=` ajusta
um ANTEPASSADO (é como `/professor/atividades/:id/analise` nomeia a atividade
acima dela) e `href=` corrige o endereço quando ele carrega query
(`/analise?escolaId=`). O custo é um quadro: o HTML do servidor traz o rótulo
genérico e a hidratação troca pelo nome — inevitável, porque o layout renderiza
ANTES da página e não tem como perguntar nada a ela.

**O `ProvedorDaTrilha` não pode renderizar DOM.** Em `/professor/**` a altura das
três telas de embed vem de `main:has(> .tela-cheia)`: um elemento a mais ali
quebra o seletor de filho direto e devolve a barra de rolagem parada que a seção
`.tela-cheia` deste arquivo existe para explicar.

**A largura da coluna é do layout, não da página.** Em `/admin` eram 1080px em
quatro telas e 1180px em duas, em `/analise` 5xl e 6xl — sem razão registrada em
nenhum dos casos. Com a trilha no layout, largura por página faz o breadcrumb
nascer 50–64px à esquerda do texto. **Mas a largura da coluna não é do HEADER**:
ele ancora na janela, e o porquê está em "A marca ancora na JANELA".

**Duas exceções declaradas, e só elas.** `aPaginaDesenha: true` nas rotas de guia
da aula, porque `components/guia/guia-da-aula.tsx` renderiza a trilha por dentro
— some quando ele deixar de receber a prop `trilha`. E a home de cada papel
(`homeDoPapel`) não leva trilha: um item só, que é a própria página, é ruído.
Tela sem sessão (`/login`, `/trocar-senha`), aparelho em tela cheia com `voltar`
no header (`/exp/:expId`), superfície pública (`/`, `/privacidade`, `/termos`) e
ferramenta de dev ficam fora porque não estão dentro de layout de área nenhum —
**área nova precisa de layout novo, e layout novo desenha `TrilhaDaRota`**; sem
isso a área nasce como `/admin` nasceu.

**Rótulo é português com acento e vocabulário de domínio** (`estudante`, `turma`,
`missão`), o nome do produto quando a rota é um produto ("Gerador de Plano de
Aula"), e o último item nunca é link. Colapso, separador, tamanho e tema são
props do `Breadcrumb` do DS — não se resolve nada disso na mão.

**A lógica mora em `lib/trilha.ts`, e o motivo é o teste.** O `vitest.config.ts`
do hub só varre `lib/**/*.test.ts`; enquanto o registro vivia no componente ele
não tinha rede nenhuma. E o modo de falha dele é silencioso: `rotuloDaUnidade`
ESPELHA `rotuloDaMissao` de `lib/entre-redes/catalogo.ts` de propósito (o
catálogo é pesado e este módulo é client), então mudar o formato do slug do ano
faz a trilha cair em "Missão" sem erro nenhum. Mexeu no slug, mexa nos dois — e
`lib/trilha.test.ts` prende os dois formatos.

## Trocar de escola REMONTA o miolo da área (ADR-85, 2026-09-09)

**O layout de cada área envolve `{children}` em `<EscopoDaEscola>`**
(`components/escopo-da-escola.tsx`) — um `Fragment` com `key` na escola ativa.
Quando a escola muda, o React desmonta a subárvore e monta outra: estado zerado,
efeitos refeitos, iframe recarregado.

`router.refresh()` sozinho **não** faz isso. Ele re-renderiza só os Server
Components; um Client Component já montado não remonta, os `useEffect` dele não
re-disparam (as dependências não mudaram), um `useState(propDoServidor)` não
reinicializa e um `<iframe>` não recarrega. O comentário do seletor dizia "as
telas são Server Components e leem a escola da sessão" — verdade em
`/professor/**`, falso em `/admin/**` e nas três telas de embed. Medido em
2026-09-09 com um gestor lotado em duas unidades:

| tela | antes da correção |
|---|---|
| `/admin/usuarios` | cabeçalho na escola nova, tabela com as 49 pessoas da antiga (as 1004 da nova só com F5) |
| `/admin/turmas` | 27 turmas da outra unidade |
| `/admin/turmas/[id]`, `/admin/importar` | idem, presas em `useState`/deps que não mudam |
| `/professor/plano-de-aula`, `/plano-de-ensino`, `/bem-estar`, `/exp/:expId` | hub já emitia token de `escola-demo-2`, iframe seguia com o de `escola-demo` |

O último é o grave: numa tela de embed o token viaja UMA vez, no `hub:init` que
responde ao `exp:ready`. Sem remontar o aparelho não é tela velha — é **escrita
na escola errada**, e a RLS não barra porque o token é legítimo, só é o da
escola de antes. Nas telas de admin a RLS salva: a ação vai com o token novo, a
api não acha a linha e a pessoa vê um erro genérico.

**É do LAYOUT da área, nunca da página** — a mesma razão da trilha, logo acima:
página nova nasce escopada sem escrever uma linha. As quatro telas quebradas
eram quatro esquecimentos independentes do mesmo detalhe. **Área nova precisa de
layout novo, e layout novo envolve o miolo em `EscopoDaEscola`**; sem isso a área
nasce com o defeito que esta seção existe para não deixar voltar.

**Envolve o miolo, não o cabeçalho**: o `HeaderPlataforma` hospeda o próprio
seletor, e remontá-lo tiraria o foco do teclado de quem acabou de trocar. E é
`Fragment`, não `<div>`: um elemento a mais quebraria o `main:has(> .tela-cheia)`
e devolveria a barra de rolagem parada das telas de embed.

**O F5 mascarava tudo, inclusive no teste.** A suíte
`gestor_escola/02-quem-trabalha-em-duas-escolas` trocava a escola e fazia `goto`
em seguida — provava que o *token* mudava e nunca olhava a tela onde a troca
aconteceu. Ela agora tem os dois passos que faltavam: rebuscar a lista **na
mesma tela** e remontar o aparelho da experiência (marca-se o `<iframe>` e
confere-se se a marca sobreviveu).
