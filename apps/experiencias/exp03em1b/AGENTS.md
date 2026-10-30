# apps/experiencias/exp03em1b — O Porta-Voz dos Dados (3ª série EM, unidade 1)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp03em1b` · 3EM (unidade 1) · `telemetria, progresso, ia, avaliacao` · **sem `permissoes`** (não há campo de escrever) · 375×812 |
| Dev | `pnpm --filter @edu/exp03em1b dev` → :5190 · hub `/exp/exp03em1b` · sem hub: `?fixture=<passo>` (abaixo) |
| DS | `unoochat` (`@edu/ui/ds-unoochat`, tema claro) no mensageiro; `unooria` (`@edu/ui/ds`) no laudo (E5) e na conclusão |
| api | módulo `porta-voz-dos-dados` (`apps/api/src/porta-voz-dos-dados/AGENTS.md`), ADR-198 |

O estudante, Porta-Voz Oficial de Dados da escola, recebe do Assistente de
Dados (bot determinístico, sem IA na aula) a planilha 95 → 94 → 92 → 88, abre
(ou não) a nota técnica, vê as prévias das duas escalas, compõe o boletim
(origem 0 ou 80 e três camadas) e o publica no grupo da cidade. O grupo reage
pelo ramo da escala dele, a Escola Santos Dumont publica a mesma planilha com a
escala oposta, o professor pausa as telas e libera a retomada; vêm a errata
(ou não), o laudo com a régua do eixo e a perícia dos dois cartões eleitorais.

## A fronteira das seções é "quem fala"

- **O mensageiro** (`unoochat`): a lista, o chat do Assistente, o compositor
  (`BottomSheet`), o grupo, a pausa e a perícia (`telas/*` menos `Laudo` e
  `Conclusao`).
- **A escola** (`unooria`): o laudo (E5) e a conclusão. A rolagem ali é o
  `ScrollBar` do DS; no clone, a barra do sistema.
- `GraficoDoBoletim` e `TabelaDoBoletim` são DESENHO (conteúdo), não controle:
  não importam ponte e pintam com `--grafico-*`, que cada seção define com os
  próprios tokens (`globals.css`). É o MESMO gráfico na prévia da E2, na prévia
  ao vivo, no post, no espelho, nos cartões e no laudo.
- `src/contrato.test.ts` prende a ponte de cada tela.

## O que não é óbvio

- **O passo é do servidor; a CONVERSA aberta é da tela** (`App.tsx#vista`):
  lista, Assistente ou grupo, com a seta de voltar do app. Sem gesto (F5),
  `regras.ts#vistaPadrao`; depois de publicar, o grupo. Quem estava no grupo
  quando a turma foi liberada fica nele, com "Abrir mensagem do Assistente de
  Dados" — e é o mesmo caminho de quem publica DEPOIS da retomada (decisão 7):
  vê a sequência do conflito e segue para a oferta da errata.
- **O compositor começa SEM escala** (decisão 5): publicar fica desabilitado
  até a origem do eixo; as camadas são opcionais. São QUATRO desde a 1.1.0
  (ADR-203): as três corretas e a projeção, incorreta de propósito, na ordem
  que o servidor manda (`conteudo.camadas.ordem`, embaralhada por estudante).
  A tela não sabe qual é a errada — não escreva nada que a distinga. A errata recarrega a 1ª
  publicação INTEIRA. A confirmação (`Dialog`) é que chama a api.
- **O feed chega em sequência só na aba que publicou** (`Grupo#animar`): as
  reações com "digitando…", o post espelho ~10 s depois da publicação
  (`RITMO_DO_FEED`), o conflito e o Coordenador. F5 desenha tudo. A errata entra
  ABAIXO do original. Depois da errata publicada, o grupo a mostra antes do
  laudo ("Prosseguir para o Laudo de Auditoria").
- **A pausa no grupo é o rodapé** (`AdminOnlyNotice` com o texto da
  Coordenação): a rolagem fica livre para o debate. Em qualquer outra tela é
  camada (`Pausa.tsx`) com a tela `inert`. O polling de 3 s é o próprio
  `GET sessao`.
- **Os marcos da EM13CO13 são do servidor** (`POST sessao/marco`): a tela diz
  quando abriu o chat, o anexo, o compositor, a perícia e quando o nudge de
  90 s da E2 apareceu; o horário é o da api.
- **Nada é gate avaliado**: avança sem abrir o anexo, publica sem camada, pula
  a errata e a perícia ("Avançar sem…" sempre visível). O parecer só fica
  desabilitado com um cartão sinalizado SEM motivo (a api exige).
- **O gabarito não desce, e o teste cobra**: os cartões chegam como peças; o
  conteúdo do banco padrão (moradores, escola rival) vem da api.
- **Sem podcast na tela do estudante** (decisão 1): é do professor.
- **A instrução ao lado do aparelho** (`exp:estado.instrucao`) muda por etapa,
  a pausa vence; publicada só quando muda (`regras.ts#estadoParaOHub`).
- **O eixo X do gráfico encurta o rótulo que não cabe** (`regras.ts#rotuloDoEixo`):
  o período vem da IA ("1º Quadrimestre"), e com quatro barras os nomes se
  sobrepunham (1.0.0). Cabe, fica inteiro; não cabe, vira a inicial com o
  número ("Q1"), como o "M1" do protótipo. O nome inteiro segue na tabela e
  na descrição do gráfico.
- **O lembrete de 90 s da E2 tem três textos** (`nudgeE2SemPrevias`,
  `nudgeE2`, `nudgeE2ComPrevia`), pelo que já estava na conversa quando ele
  chegou, e entra ANTES das prévias se elas ainda não existiam: o texto único
  mandava tocar "na escala acima" antes de as escalas aparecerem.
- **A versão vive em três lugares** (`versao.test.ts`).

## Desenvolvimento sem hub nem api: `?fixture=`

SÓ em `import.meta.env.DEV`: `?fixture=espera|abertura|dados|compositor|feed0|feed80|pausa|errata|errata-recente|laudo|pericia|concluida`
troca a api por uma falsa em memória (`lib/fixtures.ts`, que lê o catálogo da
api). `__portaVoz.gate("pausa" | "liberada")` no console mexe no gate;
`&nudge=2` encurta o nudge para 2 s; `&falha=grafico` força a E2-SIS-01. O
build troca `import.meta.env.DEV` por `false` e nada disso entra no `dist/`
(`contrato.test.ts` confere o bundle).

## Lacunas do DS (compensações marcadas no código)

| Lacuna | Onde | O que a compensação faz |
|---|---|---|
| Sem tabela no Unoochat | folha "Ver dados e fonte" (E6-ALU-02) | o relatório da Secretaria é uma `<table class="dados">` de CONTEÚDO, como no protótipo (a lista de `ListItem` da 1.0.0 quebrava cada dado em três linhas) |
| `MetricCard` com `max-width: 301px` | laudo (E5) | `.escola__pilha > .unooria-metric-card` sem teto |
| `MessageBubble.Document` põe os detalhes na linha do nome (detalhe longo some com o nome) | anexo (E2) | detalhes curtos ("PDF · 42 KB") e a procedência como legenda do balão |
| `ChatHeader` com `trailing` longo encurta o nome ("Assiste…") | chat e grupo | o chip mostra a forma curta do protótipo ("Publicações: 3/3"); a longa (TC-03/TC-09) vai no `aria-label` |

## Textos fora do 06

**A instrução ao lado do aparelho não manda** (ADR-203): onde a missão mede a
iniciativa (o anexo, as camadas, a errata, a perícia) o texto diz o que existe
e deixa a decisão com o estudante — "Inspecione a nota técnica" fazia o gesto
que a EM13CO13 queria observar.

`lib/textos.ts` marca `[PROTÓTIPO]` (do protótipo aprovado) e `[PROPOSTA]`
(validar com o PO): a confirmação do slot 2, os botões de navegação do grupo
(decisão 7 e depois da errata), a leitura viva da régua, a instrução do hub e
os nomes acessíveis.
