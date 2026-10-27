# apps/experiencias/exp01em1b — O Assistente Invisível (1ª série EM, unidade 1)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp01em1b` · 1EM (unidade 1) · `telemetria, progresso` (sem `ia`) · `permissoes: ["forms"]` · 375×812 · produto `entre-redes` |
| Dev | `pnpm --filter @edu/exp01em1b dev` → **:5188** (`strictPort`) · hub `/exp/exp01em1b` ou `/dev-embed?src=http://localhost:5188` |
| DS | DUAS seções: `unooria` (`@edu/ui/ds`, a escola) e `unooriaai` (`@edu/ui/ds-unooriaai`, o assistente testado) |
| api | módulo `assistente-invisivel` (`apps/api/src/assistente-invisivel/`, prefixo `/assistente-invisivel`, tabelas `exp01em1b_*`, ADR-185) |
| Versão | `1.0.3` nos três lugares (`public/experiencia.json`, `package.json`, `EXP_VERSION` em `src/lib/tipos.ts`) |
| Copy | o Figma `9QyrVdEBJZkOS64ZauPfmk` (63 telas), literal em `src/lib/textos.ts` |

A comissão estudantil testa o UnooriaAI com três colegas (Lucas, Beatriz,
Thiago — todos pediram a Trilha Avançada): aposta (o LATCH 1), vê a bateria de
testes no chat, é confrontada com a própria aposta, abre as fichas de auditoria
(horário 23h45 e sinal instável viraram inferência), classifica os dados,
decompõe o algoritmo (opcional), troca os critérios e reteste, e publica a
página de transparência com o comunicado (o LATCH 2).

## O que quebra se você não souber

- **O passo vem do SERVIDOR** (`regras/passos.ts` da api). A tela só escolhe
  quem o desenha (`App.tsx#escolherTela`). As travas do professor não mudam o
  passo: o servidor manda `aguardandoProfessor` e o despachante põe a camada
  de espera (`componentes/Janelas.tsx#Espera`, um `Modal` do DS) por cima. A
  aposta travada esperando "Liberar Início da Simulação" é a própria E3
  "travada", não camada. Nenhum estado local segura tela: marcar passos do
  algoritmo não resolve o painel, só "Pular Etapa" (`/algoritmo/concluir`).
- **O polling de 3 s** (`GET /assistente-invisivel/gate`) relê a sessão quando
  passo, fase, preparo, espera ou rodada mudam, e atualiza o medidor.
- **A fronteira das seções é "quem fala"**: a escola é `unooria`; a bateria de
  testes (`telas/Simulacao.tsx`) é `unooriaai` inteira; as PEÇAS do assistente
  dentro de telas da escola (a prévia da E2, o efeito do reteste na E5) moram em
  `componentes/PecasDoAssistente.tsx`, o único outro arquivo que importa a
  ponte do clone (ADR-117/173). `src/contrato.test.ts` prende uma ponte por
  arquivo e a seção de cada tela.
- **O gabarito não desce, e o teste cobra**: nada de coluna certa dos cartões,
  passos dispensáveis, critérios equitativos ou opção certa dos blocos. O
  rótulo "(Inferência dispensável)/(Essencial)" é o do ESTUDANTE, e "Otimização:
  de 5 para N" é 5 − marcados. O "(Ação enviesada)" do Figma (passo 4
  marcado) vem do SERVIDOR em `estado.algoritmo.enviesados`, só para passo já
  marcado — o bundle não sabe qual é, e o `contrato.test.ts` recusa amarrar o
  4 ao rótulo.
- **As conversas são roteirizadas** (`lib/roteiro.ts`), a partir do pacote que o
  professor curou: sem IA na tela do estudante, sem texto livre.
- **Fila de envio em MEMÓRIA** (`lib/fila.ts`), nunca `localStorage`: rede caída
  (janela "Módulo de Homologação Offline") e 401 (janela "Sessão escolar
  pausada") seguram a jogada até passar. "Entrar Novamente" tenta de novo
  AGORA: quem renova o token é o SDK (`exp:token-expirando` a cada 10 min) — a
  experiência não tem como pedir um token na hora (lacuna do SDK).

## Telemetria (`lib/telemetria.ts`)

`attempted missao:iniciar` · `progressed etapa:entrar {passo}` · `interacted
aviso:inatividade {passo}` (aposta, critérios, comunicado) · `attempted
erro:exibir {codigo: sem-sinal | sessao-expirada}` · `completed
missao:concluida`. Nenhuma resposta do estudante sai por aqui: a evidência é
gravada pela api, na rota de cada gesto.

## Componentes do DS que fecharam as lacunas (0.2.22)

As cinco compensações da 1.0.0 saíram na 1.0.1, com o DS 0.2.22
(storybook-unnoria #25): o `Collapse` fechado já é `inert` (desde a 0.2.20); o
cartão selecionado é `PuzzleBlock selected`; a vaga da coluna é o próprio
`PuzzleTrack` com `onSlotActivate` (o nome dela é "Colocar em …", o mesmo que
a e2e procura) e `slotsDisabled` enquanto nada está selecionado; o selo é o
`Certificate`; o separador de sessão do chat é o `SessionDivider` do UnooriaAI.
Não há compensação local nesta experiência.

Na 1.0.2, com o DS 0.2.23 (storybook-unnoria #26), a vaga vazia passou a
mostrar o TEXTO, como o Figma desenha (`showEmptySlotLabel`): "[Solte o
cartão aqui]" enquanto nenhum cartão está escolhido, e "Colocar em Dados
Fornecidos/Observados" com um escolhido — e o texto à vista é o próprio nome
do botão. A linha de `status` do andaime saiu: repetia o que a vaga já diz.

Na 1.0.3 (ADR-189, decisão do Lucas em 2026-10-27), a E6-ALU-02 perdeu o card
do caso de mercado que o Figma desenhava: depois do
certificado vêm só a síntese e o desafio extra. O caso também saiu do roteiro
do professor (api, painel e guia da aula). Não o recoloque.

Copy que o Figma não deu e a tela precisou: "Concluir Classificação" (o fim da
E5-ALU-01), "Colocar em Dados Fornecidos/Observados", "Novo teste no UnooriaAI"
(o título do efeito do reteste).
