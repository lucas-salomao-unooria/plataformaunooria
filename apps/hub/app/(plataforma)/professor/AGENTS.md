# apps/hub/app/(plataforma)/professor — a área do professor

Complementa o `AGENTS.md` de `apps/hub`, que vence em conflito.

## A sala de aula no hub (ADR-69)

`/estudante` lê `GET /salas/minhas` (`lib/salas.ts`): a turma e a grade do ano
dela, com o estado de cada missão. `null` (api fora do ar) e `[]` (sem turma) são
telas DIFERENTES — mandar a criança falar com a coordenação por causa de um 503 é
o pior conselho possível.

`/professor/turmas/[id]` é a SALA, com abas em `?aba=` (`missoes` | `estudantes`)
e o `Tabs` do DS em modo controlado — a URL é o estado, como o `?turmaId=` dos
resultados. O botão de liberar é client-side porque o professor aperta na FRENTE
DA SALA, e passa pelo BFF: **`PUT` precisou ser exportado lá** (`app/api/plataforma/[...path]/route.ts`),
e método que falta no BFF não dá 404 e sim **405**, sem linha no log — o sintoma
chega como "o botão não faz nada".

O caminho para conduzir a missão sai da sala, com a turma já na URL
(`lib/rotas-da-missao.ts` traduz `expId` → rota do professor; é o único lugar que
faz essa tradução). A trilha do Entre Redes continua por ano e virou catálogo,
com faixa dizendo que quem abre é a turma.

### UM caminho da sala para a missão, e ele leva à FICHA (ADR-100)

A sala tinha TRÊS links por missão — "Como funciona", "Guia da aula" e
"Conduzir com esta turma" — e o terceiro apontava direto para
`.../resultados`. Isso obrigava a SALA a saber o que cada missão oferece, e ela
não sabe: o Instanooria não tem tela de resultados (conduz-se pela atividade), o
Rastro do Boato não tem guia, e a próxima missão publicada terá outra
combinação. O 8º ano recebeu um 404 por causa disso (card de 2026-09-14; a tela
de erro do Next é texto branco em fundo branco, então nem dava para ler).

**Duas correções erradas antes da certa, e as duas estão presas em
`lib/rotas-da-missao.test.ts`:**

1. apontar para a tela de resultados → **link para 404**;
2. tirar o link de quem não tem essa tela → **link ausente**, que é pior de
   perceber: ninguém abre chamado por um link que não existe.

Hoje a sala faz UMA pergunta — "onde fica esta missão?" — e `rotaDeConducao`
responde sempre a ficha, com `?turmaId=`. Quem sabe o que a missão oferece é o
corpo dela, que já existe por missão. **Link novo na sala é quase sempre o
sintoma de que a ficha não está dando conta** — o lugar de resolver é lá.

**A ficha abre NA TURMA, e isso é o ponto.** O despachante
(`[ano]/[unidade]/page.tsx`) lê `?turmaId=`, resolve a turma com
`turmaDaConducao` e a repassa aos sete corpos; a Vila do Lume faz o mesmo na
rota própria. Com turma: a faixa de contexto diz qual é, `comTurma()` repõe o
parâmetro nos links de dentro (resultados, guia da Vila, nova atividade) e a
lista de atividades do Instanooria vem filtrada pela api (`?turmaId=`), não por
um `filter` na tela — as atividades das outras turmas do professor não são
ruído, são o convite a abrir o painel da turma errada. Sem turma (trilha do
Entre Redes, link salvo) tudo abre como sempre abriu, e as telas de destino
continuam oferecendo o próprio seletor.

**`turmaDaConducao` resolve pela lista de turmas DO PROFESSOR**, não por
`GET /turmas/:id`: um id de turma alheia simplesmente não está nela, então a
ficha não tem como nomear na tela uma turma que não é dele.

**A faixa de contexto é do DESPACHANTE, não dos corpos** — mesma razão da trilha
(ADR-77) e do `EscopoDaEscola` (ADR-85): são sete corpos, e sete cópias
divergem.

`/exp/[expId]` confere a liberação ANTES de montar o embed e responde 404 sem
ela. Só para estudante: professor e gestor não chegam nesta rota, e `/dev-embed`
segue sem porta (é bancada de desenvolvimento). A api recusaria de qualquer
jeito, mas aí o aparelho carregaria e quebraria por dentro, com o token já
assinado.

## O guia da aula (ADR-65)

Toda missão publicada tem guia em `/professor/.../guia`, e **missão nova nasce
com o guia dela** — `lib/entre-redes/guias/index.test.ts` recusa missão
publicada sem guia, com uma lista de exceções que exige razão escrita.

**O guia é DADO** (`lib/entre-redes/guias/<exp>.ts`, tipo `GuiaDaAula`)
renderizado por um componente único (`components/guia/`). Não escreva um guia
como página: a versão antiga era 447 linhas de JSX só do Instanooria, e a quinta
cópia dela seria o arquivo em que alguém esquece uma seção sem ninguém notar. A
ordem das seções é do renderizador, não do autor — é isso que faz a segunda
missão que o professor roda ter a informação no mesmo lugar da primeira.

**O que tem fonte viva NÃO vira texto no guia.** Entra por bloco vivo: um
`ReactNode` que a página da missão ancora ao fim de uma seção
(`blocos={{ debate: <... /> }}`). **Toda missão publicada tem o seu**: os
momentos e a revelação do Instanooria, os cartões da Vila por turma, a tabela
dos vieses do unooGPT, os vídeos do UnooTube com o gabarito, as intervenções do
Rastro do Boato e as respostas do Eco no Grupo — as quatro últimas por rota
`professor-only` da api (`/<slug>/professor/...`). O custo de copiar qualquer um
deles é o professor projetar para a turma uma mensagem que ninguém recebeu.

**Missão nova cujo conteúdo a turma LÊ na tela nasce com bloco vivo, não com a
descrição dele.** A prosa diverge e ninguém percebe: a do UnooTube dizia
"metade… a outra metade" quando a divisão real do catálogo é 11 e 10, e nenhum
título de vídeo aparecia — o professor não tinha como reconhecer o vídeo que a
criança de 9 anos citava pelo apelido do canal. Número que o guia mostra é
CALCULADO do catálogo (`resumo`, `pontuacao`), nunca digitado.

**Os links para o guia saem de `lib/rotas-da-missao.ts`**, nunca de
`` `${rota}/guia` `` montado na tela: é ele que sabe se a missão tem guia, e a
sala de aula mostra o link em toda turma × toda missão a partir dele. Uma
concatenação na mão vira link para 404 na primeira missão publicada sem guia.

**A folha de impressão é parte do guia**, em `components/guia/guia.css` — o
professor conduz a aula com o papel na mão enquanto o computador projeta a tela
da turma. Ela mira classes próprias (`.guia-bloco`, `.guia-fora-do-papel`),
nunca as do `@unooria/design-system`: nome interno de componente muda por versão
e ninguém imprime para conferir depois de subir o DS. Bloco novo no guia entra
com `guia-bloco` (e `guia-bloco--longo` se puder quebrar entre folhas).

**BNCC Computação: o texto da habilidade é verbatim do MEC**, e os códigos são
**por ano** (`EF04CO08`, `EF08CO11`) mais `EF15CO*` (1º–5º), `EF69CO*` (6º–9º) e
`EM13CO*`. `EF67CO`/`EF89CO` **não existem** — a analogia com as outras áreas já
produziu códigos inventados uma vez, e um teste guarda a forma.

## A ficha da missão é um DESPACHANTE, e o fallback dele é o Instanooria

`app/(plataforma)/professor/entre-redes/[ano]/[unidade]/page.tsx` escolhe o corpo
da ficha por `missao.expId`, e o `return` final — sem `if` nenhum — é
`<MissaoInstanooria>`. **Missão publicada sem ramo não quebra: ela mostra a ficha
de outra missão.** Com "Nova atividade", que grava em `exp08ef1b_activities` e a
missão nova nunca lê, e sem "Abrir a aula e os resultados", que é o único caminho
para o painel da turma.

Aconteceu duas vezes — a exp06ef2b e, em 2026-09-11, a exp08ef4b, com o aviso já
escrito em `missao-rastro-boato.tsx`, no arquivo ao lado. Comentário não é rede:
`lib/entre-redes/despachante-da-ficha.test.ts` lê o `page.tsx` e reprova toda
missão publicada com `expId` que não tenha ramo próprio, com uma lista de
exceções (`MISSOES_NO_FALLBACK`) que exige declarar por escrito quem usa o corpo
do Instanooria de propósito.

**Missão nova = ramo no despachante + `missao-<slug>.tsx`, no mesmo trabalho.**

## Equipes na missão (E13)

Quando a turma divide computadores, quem entra na missão representa a equipe. A
seção **"Equipes desta turma"** mora na FICHA, entra UMA vez pelo `corpo()` do
despachante (`components/equipes/equipes-da-ficha.tsx`, logo abaixo da faixa da
turma) e só aparece com `?turmaId=` e quando a api responde `permitida` — a
lista de missões com equipe é da api, não do hub. Os tipos e as regras puras
(mover, remover, o que impede salvar) estão em `lib/equipes.ts`, que o cliente
importa; as leituras server-side em `lib/equipes-servidor.ts` (`server-only`).

- **A plataforma sempre pergunta** "Sortear as equipes" ou "Eu separo", sem
  opção marcada; "Manter as equipes da última missão" só existe quando a turma
  tem equipes salvas em outra missão.
- **Só o `professor` escreve.** Gestor lê: cartões ou "Nenhuma equipe montada
  para esta turma." A api recusaria de qualquer jeito.
- **"Mostrar equipes" é uma janela do DS (`Modal` `full`), não uma rota**: uma
  página de tela cheia herdaria a trilha e o layout da área. Ela mostra o nome
  da equipe e o PRIMEIRO nome de cada estudante — nada de falta, desempenho ou
  "Sem equipe": é a tela que a sala inteira lê. Nome que empata na turma sobe só
  o que desempata (`rotulosCurtos`): a inicial do sobrenome, e o último
  sobrenome inteiro quando duas ainda ficam "Gabriela C." (a 4B do seed tem esse
  par, e a tela já as mostrou iguais em equipes diferentes).
- **A lista de presença e a edição NÃO vão dentro de `Collapse`**: fechado, ele
  deixa ~40 controles focáveis dentro de `aria-hidden`. Renderização condicional.
- **Na sala, as equipes são uma `Tag` ("N equipes prontas"), não um link**
  (ADR-100): montar e editar é na ficha, pelo mesmo "Conduzir com esta turma".
- **O estudante vê a própria equipe** numa faixa entre o header e o aparelho
  (`components/equipes/faixa-da-equipe.tsx`, `shrink-0`, uma linha), só com
  primeiros nomes e sem link.

Suíte: `professor/10-equipes-na-missao` (4B de ponta a ponta, terminando em
"Desfazer"; a faixa do estudante na 4A, com as equipes criadas e apagadas pelo
BFF; e a ficha da exp05ef1b na 5A, só leitura, com a seção).

## Evidência pedagógica (E14)

Por estudante, as habilidades da BNCC que ele demonstrou numa ATIVIDADE,
rodada a rodada. Tipos e regras puras em `lib/evidencias.ts`; leituras em
`lib/evidencias-servidor.ts`; confirmar e ajustar pelo BFF (`evidencias`). Quem
decide nível, cópia e o que conta é a api (`apps/api/src/evidencias/`).

- **O painel mora onde a missão tem a ATIVIDADE**: na tela da atividade do
  Instanooria (`atividades/[id]`, depois da revisão) e nos resultados da
  exp05ef1b, onde a atividade é o PACOTE aprovado (`atividadeId = pacoteId`,
  `key` no pacote para remontar quando outro é aprovado). Sem turma, sem painel.
- **Invisível sem ficha, de propósito**: `temFicha: false` não desenha nada, e
  hoje só a exp05ef1b tem ficha (ADR-118) — no Instanooria o bloco não aparece,
  e não é defeito: confira `temFicha` antes.
- **Ausência é "Não avaliado", nunca "Não atingiu".** A cópia da aula projetada
  chega "a revisar" e só conta depois de "Confirmar para a turma".
- **O perfil** é `turmas/[id]/estudantes/[estudanteId]`, pelo NOME na aba
  Estudantes; o relatório da Vila, antes destino da linha inteira, virou link ao
  lado (link dentro de link não existe). A trilha volta para `?aba=estudantes`.
- **Só o `professor` confirma e ajusta** (`podeEditar`); gestor lê, sem caixas,
  sem célula clicável, sem confirmar. O estudante nunca vê resultado.
- **Sem ranking nem ordem por nível.** Alfabética com a equipe junta
  (`ordenarPorEquipe`), nenhuma coluna `sortable`. A seleção é o `Checkbox` do
  DS numa coluna, não a `selectable` da `Table`: a dela diz "Selecionar linha
  N", e a linha é uma criança (lacuna a pedir no `storybook-unooria`).

Suíte: `professor/11-perfil-do-aluno` (4B, até o perfil vazio); o painel com
ficha é provado em `estudante/10-quem-mandou-isso` (o nível de cada habilidade
conferido contra a régua).
