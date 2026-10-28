# apps/experiencias/exp02em1b — O Efeito Amplificador (2ª série EM, unidade 1)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp02em1b` · 2EM (unidade 1) · `telemetria, progresso, ia, avaliacao` · `permissoes: ["forms"]` · 375×812 |
| Dev | `pnpm --filter @edu/exp02em1b dev` → :5178 · hub `/exp/exp02em1b` |
| DS | duas seções de clone: `unooriaai` (`@edu/ui/ds-unooriaai`, E1–E3) e `unoovista` (`@edu/ui/ds-unoovista`, E3-SIS-01 a E6) |
| api | módulo `efeito-amplificador` (`apps/api/src/efeito-amplificador/AGENTS.md`) |
| Versões | 2.x é esta missão (ADR-181); a 2.1.0 é a revisão do PO (ADR-191); a Missão Tempestade (1.x) é `exp02em1b-v0` |

O estudante abre a pauta do grêmio no UnooriaAI, pede o rascunho, audita a
prévia, escolhe a manchete e publica no Unoovista (o latch), vive a madrugada
no feed — aviso de cuidado, Configuração da Publicação, Central de Apoio — e,
depois do debate, aponta nos bastidores os indicadores da retenção. Fora desta
versão, por decisão do PO: a transferência da Etapa 6 e o Canal B.

## A fronteira das seções é "quem fala"

- **O UnooriaAI** (`unooriaai`, `.uai-*`): a pauta (E1), o chat e a prévia
  (E2) e a janela da manchete (E3). Desde a 2.1.0 não há tela da escola: a
  missão abre e fecha dentro dos apps, e a `unooria.css` saiu do `main.tsx`.
- **O Unoovista** (`unoovista`, `.unv-*`): o relógio, o feed (tema ESCURO no
  contêiner: são 02h30), a pausa, os bastidores e o fim (claros).
- `src/contrato.test.ts` prende que cada tela importa UMA ponte, a dela, e
  que nenhuma importa `@edu/ui/ds`.

## O que não é óbvio

- **Sem IA na aula (ADR-191).** O chat responde pela árvore de intenções do
  servidor; a tela manda o texto e desenha o que volta. Por isso toda rota usa
  o timeout PADRÃO do SDK — o teto de 45 s da 2.0.x morreu com a IA, e o teste
  reprova `timeoutMs` em `lib/api.ts`. Da mensagem só sai o TAMANHO para a
  telemetria; o `prompt_tipo` do EVT-001 é classificado no servidor.
- **O TC-10 é do HUB, fora do aparelho.** Em toda tela da Etapa 4 (o feed, as
  folhas, o diálogo, o relato e a pausa por cima dele) o App publica
  `enviarEstado({ instrucao })` com o `{ antes, destaque, depois }` que a api
  manda; em qualquer outra, `enviarEstado({})` a retira. Só publica quando muda
  (o polling não a repete), e o relógio, que já tem o passo `feed`, ainda não é
  o feed. A regra é pura (`lib/regras.ts#estadoParaOHub`) e testada.
- **O gabarito não desce, e o teste cobra.** O comentário vem sem a categoria,
  o parágrafo sem o nó; o conteúdo do banco padrão (instituto, colega, autora)
  também não pode aparecer no código.
- **A prévia não trava nada.** Os avisos de pendência são os da api
  (`previa.pendencias`); "Exportar para o Unoovista" aparece depois de "Aprovar
  Prévia", e a régua mede o PUBLICAR, não a aprovação.
- **O relógio toca uma vez por aba**, na transição conversa → feed; um F5 no
  feed vai direto a ele. Com `prefers-reduced-motion`, corta para o último marco.
- **O passo vem do servidor.** Na Etapa 5 a tela chama `POST /explicar`
  sozinha: é o que FECHA o feed. A espera ativa (E5-ALU-02) é estado local do
  "Avançar"; um F5 volta aos cartões. A pausa do professor é uma camada por
  cima de qualquer tela, e o que está embaixo fica `inert`.
- **O podcast é do professor.** O fim mostra o cartão e a transcrição
  (`textos.podcast`, da api), sem player: o áudio toca em aula, no hub.
- **A versão vive em três lugares** (`versao.test.ts`).

## Lacunas do DS (compensações marcadas no código)

| Lacuna | Onde | O que a compensação faz |
|---|---|---|
| `unoovista` sem Switch/Toggle | E4-ALU-04 (`Feed.tsx#Chave`) | `Chip` do DS com `role="switch"` + `aria-checked`, rótulo "Ativado/Desativado" ([PROPOSTA]). O `Toggle` da `unooriaai` NÃO entra: é outra seção |
| `unoovista` sem rádio | E4-ALU-02, E4-ALU-03 (`Feed.tsx#GrupoDeRadio`) | linhas `ListItem` com `role="radio"`, setas, glifo `check` na escolhida |
| `unoovista` sem gráfico | E5-ALU-02 (`GraficoDeEntrega.tsx`) | barras em CSS sobre `--unv-*` (o `BarChart` é da `unooria`) |
| `unoovista` sem glifo de pausa, relógio e áudio | E4-SIS-01, E3-SIS-01, E6 | `lock`, `activity` (ligadura `history`) e `comment` |
| `unoovista` sem cartão selecionável | E5-ALU-01 | `ListItem` com `aria-pressed`, borda do token e `check` |
| `ListItem` de altura fixa e `nowrap` | comentários, opções | `.unv-item-longo` (só altura e quebra) |
| `unooriaai` sem faixa de aviso | E2-SIS-01 (`FaixaDeConexao.tsx`) | leiaute `.uai-faixa` + `Icon` do DS |
| `unooriaai` sem cartão de rádio | E3-ALU-01 | `Tag` do DS (estado `selected`) com `role="radio"` e quebra de linha |
| `Modal` da `unooriaai` sem teto de altura | E3-ALU-01 | `.uai-fechamento` com `max-height` e rolagem |

## Textos fora do 06

`lib/textos.ts` marca cada um: `[PROTÓTIPO]` (está no HTML aprovado e não no
06: "Solicitar revisão", os subtítulos dos motivos e das chaves, "Encaminhar
para:", a autoria de Nico, "Enquanto a turma conclui...", "Apresentado por Alex
e Sam · 3:30 min") e `[PROPOSTA]` (em nenhum dos dois — validar com o PO: o
banner do aviso para fonte e ofensivo, o estado da chave, o selo do fim, a
legenda do gráfico, a linha do podcast em aula e a alça da transcrição).
