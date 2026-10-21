# exp04ef1b — Jornal da Escola: A Edição de Bento

4º ano EF, unidade 1 (Entre Redes). A dupla é editora do jornal da escola: escolhe
3 de 8 notícias de meios diferentes — marcando "✓ Confio / ✗ Não confio" nas
pistas que abre —, publica a 1ª edição, vê o que ela causou nos leitores (depois
que o professor libera o resultado), MONTA a Chave do Editor quando o professor
libera a revisão, republica, compara as duas edições, testa a Chave em duas
matérias novas e, por fim, decide sozinha o que faz com um boato. ~50 min.

**3.0.0 — Canal A puro (ADR-168):** toda habilidade é medida por AÇÃO. As
perguntas de múltipla escolha P1/P2 saíram (nenhuma rota de `/evidencias`); a
Chave é montada num envio só, sem correção. A doutrina da pasta está no `AGENTS.md`.

## Rodar

```bash
pnpm --filter @edu/exp04ef1b dev     # :5174, strictPort
# no hub: /exp/exp04ef1b  (ou /dev-embed?src=http://localhost:5174)
pnpm --filter @edu/exp04ef1b typecheck lint test build
```

Precisa de: a missão LIBERADA na turma do estudante (`liberacoes`, ADR-69), o
produto `entre-redes` ligado no painel da Unooria (ADR-87) e o módulo
`apps/api/src/jornal-escola` de pé. Sem pacote homologado, a turma roda o banco
padrão (a api o cria no primeiro `GET sessao`).

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake, primeira leitura (`GET sessao`), 403 | `src/bootstrap.tsx` |
| A máquina de telas, o polling, as ações | `src/app/jornal-app.tsx` |
| A redação (mesa, gaveta, página, Chave, simulação, leitores…) | `src/app/redacao/` |
| As peças de outra seção do DS (o post, a mensagem) | `src/app/pecas/` |
| O boato (a transferência) e as telas da escola | `src/app/escola/` |
| O contrato espelhado, `EXP_ID`, `EXP_VERSION` | `src/lib/tipos.ts` |
| `Meio` → `NewsMedium`, ícones | `src/lib/meios.ts` |
| As rotas (sempre pelo SDK) e a repetição | `src/lib/api.ts`, `src/app/conexao.ts` |
| Telemetria | `src/lib/telemetria.ts` |
| Copy que a TELA escreve | `src/lib/textos.ts` |
| Regras e rotas do servidor | `apps/api/src/jornal-escola/` |

## Telemetria (PRD §13)

Só ids (`n1`…`n8`, a posição na mesa) e números — nenhum texto, nome ou e-mail.

| ID | Verbo | Objeto | Quando | `resultado` / `contexto` |
|---|---|---|---|---|
| EVT-U01 | `attempted` | `missao:iniciar` | a primeira tela, depois do `GET sessao` | `{ retomada }` / `{ etapa }` |
| EVT-U02 | `progressed` | `etapa:entrar` | a cada etapa nova (E1…E6, EREV) | `{ etapa }` / `{ pedagogical_role }` |
| EVT-001 | `interacted` | `noticia:inspecionar` | toque num chip de pista | `{ tipo, abertas }` / `{ noticia_id, fase }` |
| EVT-002 | `scored` | `edicao:publicar` | o latch de cada edição, confirmado pela api | `{ edicao }` / `{ slots }` |
| — | `progressed` | `resultado:ver` | o resultado chegou (depois do portão) | `{ verificadas, percentual }` / `{ etapa }` |
| EVT-005 | `interacted` | `pista:julgar` | "✓ Confio" / "✗ Não confio" numa pista da mesa (1ª edição) | `{ tipo, novo }` / `{ noticia_id, fase: 1 }` — **sem o veredito** |
| EVT-003 | `interacted` | `chave:montar` | a Chave montada e enviada (um envio) | `{ enviada: true }` / `{ etapa: "E5" }` — **sem blocos nem lados** |
| EVT-006 | `interacted` | `simulacao:enviar` | as duas matérias da simulação decididas | `{ pistas_s1, pistas_s2 }` / `{ etapa: "ESIM" }` — **sem vereditos nem decisões** |
| EVT-004 | `interacted` | `transferencia:decidir` | a decisão diante do boato | `{ pistas_abertas }` / `{ etapa: "E6" }` — **sem a decisão** |
| EVT-U03 | `completed` | `exp04ef1b` | `concluir()` | `{ tempo_total_s }` (desde o `iniciadaEm` da sessão) / `{ versao }` |
| EVT-U04 | `interacted` | `aviso:inatividade` | 90 s sem toque numa tela em que a criança age | `{ segundos_sem_acao }` / `{ etapa }` |
| EVT-U05 | `attempted` | `erro:exibir` | um aviso apareceu: sem sinal, 429, sessão, rodada nova ou imagem | `{ codigo }` / `{ etapa }` |

Os afastamentos do PRD: nenhum evento leva a ESCOLHA que vale nível — o veredito
de uma pista, o lado de um cartão, os blocos da Chave, a decisão de publicar ou de
repassar (cruzada com o gabarito, cada uma é o nível — segredo de servidor, como o
`opcao_id` que o antigo EVT-004 já não levava) —, e EVT-002 não leva `verificadas`
(a tela não sabe na hora do latch; o número vai no `resultado:ver`). `ESIM` é a
etapa da simulação, que o PRD original não tinha. Onde cada medida é LIDA: as
colunas de `exp04ef1b_sessoes` e o painel do professor
(`/jornal-escola/turmas/:turmaId/painel`). Saiu o `transferencia:responder` (P1/P2)
e o `algoritmo:ordenar` (a tentativa da Chave).

## A copy ESCRITA AQUI (para o PO revisar)

O que o sheet (`design/06-copy-strings-revisada.md`) não tinha, marcado em
`src/lib/textos.ts`:

- o nome "Bento" sobre o balão; "Abrindo a pista…";
- a linha do modal de publicar: "A 1ª edição vai para os leitores da escola e
  não pode mais ser trocada." (onde o sheet tinha a pergunta de motivo);
- "Enviar resposta" (motivo); "Aguardando o professor liberar a mesa de
  revisão..." (a espera da revisão, criada pelos dois portões);
- **3.0.0, a mesa:** "Você confia nesta pista?" (o nome do par de botões),
  "Marcado: ✓ Confio" / "Marcado: ✗ Não confio";
- **3.0.0, o Montador da Chave:** a fala do Bento ("Uma notícia bonita pode
  enganar. Monte a sua Chave do Editor: escolha três blocos, diga quando a pista
  passa ou falha e o que fazer se ela falhar." — a do sheet prometia "destravar",
  e a Chave não é corrigida), "N de 3 vagas preenchidas", "X escolhido. Toque
  numa vaga para colocar.", "Blocos periciais", "Adicionar na próxima vaga",
  "Colocar aqui" (e o nome acessível "Colocar X na vaga N"), "Nº passo", o cartão
  com o exemplo ("texto (ex.: exemplo)"), "Onde usar estes passos?", "Escolha os
  três blocos e marque todas as opções para terminar a Chave.", "Enviar a Chave do
  Editor?", "Enviar a Chave" / "Voltar e conferir", "Chave do Editor montada! A
  mesa de revisão está aberta.", "Abrir a Mesa de Revisão";
- **3.0.0, a simulação:** "Teste da Chave do Editor", "Use a sua Chave nas duas
  matérias novas e decida se cada uma vai para o jornal.", "Sua Chave do Editor",
  "Se falhar: …", "Combinado: …", "Matéria N de 2", "Marque se você confia nesta
  pista para seguir.", "Registrando o teste…", "Para pensar" (sobre a frase de
  referência da api), "Continuar";
- **3.0.0, o boato:** "Chegou uma mensagem" (o título — o do sheet, "Desafio
  Individual de Checagem", pedia para verificar, e a tela é neutra), "O que você
  faz com esta mensagem?" (o nome do par de botões), "Daqui a pouco, a turma vai
  conversar sobre esta mensagem com a professora." (**o PO decide**: o resto da
  copy diz "o professor");
- os marcadores das vagas: "Fonte sem confirmação", "Fato que já passou",
  "Ninguém assina", "Matéria verificada"; "Chave do Editor" no selo da revisão;
- "Comunidade da escola" (o balão de `erev.reacao.comunidade_grata`), "1ª
  edição" / "2ª edição";
- E6: "Encaminhada" (o selo do balão);
- os avisos do 429 ("A gráfica está com muitos pedidos agora…") e do
  `rodada-mudou` ("O professor atualizou a mesa de notícias…");
- "Tentar novamente", "Não deu para abrir a redação agora." e a tela de missão
  não liberada.

As vagas vazias juntam o nome do PRD e `e2.rotulo.cartao_vaga`: "Manchete
Principal — Vaga Disponível".

Vêm do desenho do plenário pedagógico (não são ESCRITA AQUI, mas são novas na
3.0.0): "✓ Confio" / "✗ Não confio", "Escolhi porque chamou atenção" / "Escolhi
porque conferi as pistas" (o motivo), "Combinem antes de tocar.", "A pista
passa" / "A pista falha", "Se esta pista falhar:", "Não publico" / "Olho a
próxima pista", "Usar estes passos em TODAS as notícias" / "Só na primeira
notícia", "Pronto", "Depois de enviar, a Chave não muda.", "Testar a minha Chave",
"Publicar" / "Não publicar", "Repassar para o grupo" / "Não repassar".

## Testes

- `src/versao.test.ts` — versão nos três lugares, manifesto no vocabulário
  fechado, e os valores do spec (porta, `viewport`, `forms`, capabilities).
- `src/lib/espelho.test.ts` — LÊ `vocabulario.ts` e `regras/passos.ts` da api como
  texto e compara as listas (com `simulacao` nos passos e nos pedidos); o
  vocabulário do Canal A (vereditos, lados, "se falhar", repetição, decisões),
  que no bundle é SÓ tipo, pelos `Record` de rótulos de `textos.ts`; `LAYOUTS` =
  `NEWSPAPER_LAYOUTS` do DS; os seis blocos da Chave têm ícone; cada meio tem
  `NewsMedium` e peça.
- `src/lib/textos.test.ts` — lê `TERMOS_PROIBIDOS_NA_TELA` de `invariantes.ts` e
  reprova a moldura que carimba notícia ou rotula criança; cobra as duas decisões
  (motivo fora do modal, síntese única), a ausência da copy de P1/P2, a Chave
  sem promessa de encaixe certo e a tela do boato sem pedido de verificação.
- `src/lib/regras.test.ts` — as vagas, o Montador (vaga escolhida, devolver,
  lado pela posição CANÔNICA, o "Pronto" só com tudo escolhido, a memória), a
  simulação (marcação obrigatória, ordem livre, a decisão fecha), as pistas do
  boato antes da decisão, o `gateMudou`.
- `src/lib/api.test.ts` — a repetição por status, e que `lib/api.ts` não tem
  rota de `/evidencias` e tem as quatro rotas novas.
- `src/app/fluxo.test.tsx` — RENDERIZA a missão (jsdom + DS) contra
  `src/teste/api-falsa.ts`: o fluxo inteiro (o julgamento só na mesa e o veredito
  que vale é o da resposta; "Pronto" desabilitado até completar e um envio só; a
  simulação exige marcar para avançar e envia na ordem em que ela abriu; o boato
  registra as pistas abertas antes da decisão; nenhuma chamada a `/evidencias`),
  o F5 em cada degrau (julgamento, Chave em montagem, simulação e boato
  inclusos) e o 403.

O `jsdom` está declarado em `devDependencies` (`^30.0.1`, a mesma do `@edu/sdk`):
o lockfile sobe junto com o `pnpm install` da raiz.

## O `dist/` não leva gabarito, prompt, a Chave nem P1/P2

```bash
cd apps/experiencias/exp04ef1b && pnpm build
g() { find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -print0 | xargs -0 grep "$@"; }
g -l -E "publicavel|explicacao|consequencia|gabarito|descricaoImagem"   # vazio
g -l -E "systemInstruction|responseSchema|Você é um|generateJson"       # vazio (prompt)
g -l -E "BLOCOS_ISCA|BLOCOS_VALIDOS|iscas|LADO_CERTO|CARTOES_DA_CHAVE"   # vazio (a Chave)
g -l -E "Você comprovou|Você começou a identificar|Manchete da notícia"   # vazio
g -l -E "/evidencias|perguntas/|alternativaId|Desafio Individual|enunciado" # vazio (P1/P2)
g -oh -E '.{40}"(aprova|reprova)".{30}'
# só dois: o guarda da memória (`=== "aprova" || === "reprova"`) e o do
# onChange do RadioGroup. Fora deles, `aprova:` aparece uma vez, como CHAVE do
# Record de rótulos ("A pista passa" / "A pista falha"). Nenhuma lista
# `["aprova","reprova"]` e nada ligando o `indice` de um cartão a um lado.
g -oh -E ".{30}pilarEmFalta.{30}"   # só o `mapaDeMarcadores` lendo o campo do GET revisao
g -l sourceMappingURL                                                    # vazio
```
