# apps/api/src/o-eco-no-grupo — O Eco no Grupo (exp07ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## O Eco no Grupo (exp07ef1b, `apps/api/src/o-eco-no-grupo`)

Missão de 7º ano conduzida pelo **relógio da turma**, em duas aulas. Quatro
tabelas (`exp07ef1b_sessoes`, `exp07ef1b_reflexoes`, `exp07ef1b_mensagens`,
`exp07ef1b_gates_turma`), gabarito só no `catalogo.ts`, e IA em três superfícies.

- **A etapa da turma é PISO e TETO** (`regras/passos.ts`, molde de
  `comum/insta/etapas.ts`). Piso porque quem chegou atrasado não fica para trás;
  teto só na etapa `debate`, que é o que "congelar as telas" quer dizer — e ali
  congela **todos**, não só quem já leu os cards. **Estudante sem turma
  (`etapa: null`) não tem gate**: uma criança fora de turma não pode ficar presa
  esperando uma aula que não existe.
- **O cliente nunca recebe a letra certa; ele recebe `desfecho`**
  (`checada | ruido | conflito`), calculado no servidor. A primeira versão
  deixava a tela decidir por `opcao === "B"`, e a resposta certa ia legível para
  o JS público (regra 3).
- **`POST /intervencao` recusa com `sem-inspecao` (409) quem não abriu a matéria
  completa.** É portão pedagógico, não validação: a missão existe para ensinar a
  conferir antes de repassar.
- **A cadência da cascata é do servidor** (`atrasoMs`: 2 s → 3 s → 2 s). A espera
  é o pico da missão; decidi-la no cliente a tornaria alterável pelo DevTools.
- **A conversa com Amara é o único texto livre de estudante do produto.** Só
  depois da decisão, teto de 3 turnos e 600 caracteres, sanitizador nos dois
  sentidos, e **fora de log, telemetria e painel** — o professor vê quantos
  turnos, nunca o quê (ADR-66).
- **A mídia é preparada pelo PROFESSOR**, uma vez, e cacheada no bucket
  (`midia.service.ts`, idempotente, com lock). `GET /midia` devolve `null` no
  que falta, e `null` é informação: o cliente cai na transcrição e na ilustração
  procedural em vez de esperar arquivo que não existe (ADR-67).
- **`praca-cerrada` é RECORTE de `praca-aberta`**, não uma segunda geração: o par
  print/matéria só funciona se a foto for a mesma. A janela do recorte tem de
  ter a **proporção do destino** — com proporção diferente, o `cover` recorta de
  novo e come o que importava. E a origem se lê pelo mesmo driver
  (`lerMidiaDeExperiencia`), nunca por HTTP: a URL pública aponta para outro
  processo e dá 404.
- **`[mock]` está deliberadamente FORA de `MARCAS_DO_PROMPT`** no sanitizador.
  Se entrasse, Amara ficaria muda em desenvolvimento com `AI_PROVIDER=mock`.
