# apps/experiencias/exp02em1b — O Efeito Amplificador (2ª série EM, unidade 1)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp02em1b` · 2EM (unidade 1) · `telemetria, ia` · `permissoes: ["forms"]` · 375×812 |
| Dev | `pnpm --filter @edu/exp02em1b dev` → :5178 · hub `/exp/exp02em1b` |
| DS | três seções: `unooria` (`@edu/ui/ds`), `unooriaai` (`@edu/ui/ds-unooriaai`), `unoovista` (`@edu/ui/ds-unoovista`) |
| api | módulo `efeito-amplificador` (`apps/api/src/efeito-amplificador/AGENTS.md`) |
| Versões | 2.x é esta missão (ADR-181); a Missão Tempestade (1.x) é `exp02em1b-v0` |

O estudante pede o post ao UnooriaAI, audita o rascunho, publica no Unoovista
(o latch), vive a madrugada no feed e, depois do debate, aponta nos bastidores
os dois indicadores da retenção. **Sem etapa de transferência e sem Canal B**
(decisão do PO, 2026-10-22): a última tela é a conclusão.

## A fronteira das seções é "quem fala"

- **A escola** (`unooria`, `.escola`): a abertura (a pauta do grêmio) e a
  conclusão. É a única tela antes do clone — o disfarce começa no "Iniciar Campanha".
- **O UnooriaAI** (`unooriaai`, `.uai-*`): do primeiro prompt ao "Publicar no
  Unoovista". Em 375 px a Prévia é a OUTRA vista, não painel lateral.
- **O Unoovista** (`unoovista`, `.unv-*`): o relógio, o feed (tema ESCURO no
  contêiner: são 02h30) e os bastidores (claro). `src/contrato.test.ts` prende
  que cada tela importa só a ponte da sua seção.

## O que não é óbvio

- **O UnooriaAI é a conversa HÍBRIDA da api (ADR-181).** A IA entende e
  redige, o servidor decide o que muda no post, e a árvore de intenções
  responde quando a IA falha. A tela manda o texto e desenha o que volta: não
  reescreva a resposta no cliente. `api.mensagem` tem teto de 45 s (o padrão
  do SDK, 10 s, cortaria a resposta que vinha), e o balão do estudante entra
  na hora com o "Escrevendo…" do UnooriaAI — um `ChatBubble` do DS, sem
  componente novo.
- **O gabarito não desce, e o teste cobra.** O comentário vem sem a categoria
  de saúde, o indicador sem `comprova`, o parágrafo sem o nó; o conteúdo do
  banco (instituto, colega) também não pode aparecer no código.
- **A abertura do chat é a fala do PO** (`textos.abertura`, da api, com o tema
  do pacote), antes das pílulas.
- **O relógio toca uma vez por aba**, na transição conversa → feed; um F5 no
  feed vai direto a ele.
- **O passo vem do servidor.** Na Etapa 5 a tela chama `POST /explicar`
  sozinha: é o que FECHA o feed e marca o que não foi feito. O polling do gate
  (3 s) relê a sessão quando passo, pausa ou preparo mudam; a pausa do
  professor é uma camada por cima de qualquer tela.
- **A versão vive em três lugares** (`versao.test.ts`); a 2.0.0 começa longe
  da 1.x para o caminho do bucket nunca encostar no da Tempestade.
