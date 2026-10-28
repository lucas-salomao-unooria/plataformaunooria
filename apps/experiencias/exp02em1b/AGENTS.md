# apps/experiencias/exp02em1b — O Efeito Amplificador (2ª série EM, unidade 1)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp02em1b` · 2EM (unidade 1) · `telemetria, progresso, ia, avaliacao` · `permissoes: ["forms"]` · 375×812 |
| Dev | `pnpm --filter @edu/exp02em1b dev` → :5178 · hub `/exp/exp02em1b` |
| DS | duas seções de clone: `unooriaai` (`@edu/ui/ds-unooriaai`, E1–E3) e `unoovista` (`@edu/ui/ds-unoovista`, E3-SIS-01 a E6) |
| api | módulo `efeito-amplificador` (`apps/api/src/efeito-amplificador/AGENTS.md`) |
| Versões | 2.x é esta missão (ADR-181); a 2.1.0 é a revisão do PO (ADR-191); a 2.2.0 traz a IA sem mexer na régua (ADR-192); a 2.3.0 põe a IA para ler o chat primeiro (ADR-193); a Missão Tempestade (1.x) é `exp02em1b-v0` |

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

- **A IA da aula mora no servidor, e perde em silêncio (ADR-192).** O chat
  manda a mensagem a um classificador de IA (teto de 5 s), que lê primeiro;
  a árvore de intenções é a reserva e responde sozinha as três sugestões e o
  "sim" da oferta (ADR-193). A devolutiva tem teto de 7 s. A tela
  manda o texto e desenha o que volta — por isso toda rota usa o timeout
  PADRÃO do SDK (10 s), e o teste reprova `timeoutMs` em `lib/api.ts`. Da
  mensagem só sai o TAMANHO para a telemetria; o `prompt_tipo` do EVT-001 é
  classificado no servidor.
- **O feed é o do post DESTE estudante.** Os comentários que amplificam (a conta
  anônima, o engajamento) chegam no texto da variante da manchete e do trecho
  que viralizou; a escolha é do servidor e a tela não sabe que existe variante.
- **A devolutiva** (E6, `CartaoDaDevolutiva` em `Conclusao.tsx`) pede
  `POST /devolutiva` uma vez ao abrir a conclusão: "preparando", "pronta" (os
  quatro blocos, `data-devolutiva`/`data-habilidade` são contrato da e2e) ou
  "falhou", com "Tentar de novo". Sem nível nem nota na tela.
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
| título do `TopBar` em `nowrap` numa caixa `flex` (a reticência não aparece: corta no meio da palavra) | E5-ALU-01 (o título longo da api) | `.unv-tela .unv-top-bar__title` quebra linha |
| `unooriaai` sem faixa de aviso | E2-SIS-01 (`FaixaDeConexao.tsx`) | leiaute `.uai-faixa` + `Icon` do DS |
| `unooriaai` sem cartão de rádio | E3-ALU-01 | `Tag` do DS (estado `selected`) com `role="radio"` e quebra de linha |
| `Modal` da `unooriaai` sem teto de altura | E3-ALU-01 | `.uai-fechamento` com `max-height` e rolagem |

## Textos fora do 06

`lib/textos.ts` marca cada um: `[PROTÓTIPO]` (está no HTML aprovado e não no
06: "Solicitar revisão", os subtítulos dos motivos e das chaves, "Encaminhar
para:", a autoria de Nico, "Enquanto a turma conclui...", "Apresentado por Alex
e Sam · 3:30 min") e `[PROPOSTA]` (em nenhum dos dois — validar com o PO: o
banner do aviso para fonte e ofensivo, o estado da chave, o selo do fim, a
legenda do gráfico, a linha do podcast em aula, a alça da transcrição e o
cartão da devolutiva; os títulos e o modelo da devolutiva estão na api,
`regras/devolutiva.ts`).
