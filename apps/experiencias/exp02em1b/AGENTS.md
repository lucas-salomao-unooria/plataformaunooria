# apps/experiencias/exp-03-unoogpt — a missão que nunca sai do disfarce

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp-03-unoogpt` · 2EM (unidade 1) · `telemetria, ia` · `permissoes: ["forms"]` |
| Dev | `pnpm --filter @edu/exp-03-unoogpt dev` → :5178 · hub `/exp/exp-03-unoogpt` |
| DS | `@edu/ui/ds-chatgpt` **na experiência inteira** |
| api | módulo `unoogpt` — trilha pedagógica em `exp_03_marcos` |
| e2e | `scripts/e2e/estudante/04-unoogpt.mjs` |

**Ela não tem revelação no software.** Por isso nunca troca para a seção da
plataforma: não existe momento em que a escola passa a falar dentro da tela. Um
componente de `@edu/ui/ds` aqui é sempre erro.

## O timeout padrão do SDK está errado nesta experiência

Um turno do Cientista passa por até 6 voltas de ferramenta e leva de 10 a 30
segundos; o default do SDK é 10s. `src/lib/api.ts` declara o próprio teto — sem
ele o estudante vê falha no meio de uma resposta que estava chegando.

## Dois canais que não são o mesmo

Telemetria **analítica** (SDK → batch → `telemetria_eventos`) mede o uso.
A trilha **pedagógica** é `exp_03_marcos`, gravada pela api. Não misture: o que
vale nota nunca vem do canal que o cliente preenche.

E o corte de PII é por design: `fontesCarregadas` registra **quantas** fontes,
nunca as palavras com que o estudante pediu.

O que o professor pede sobre TEMPO (quando falou, com quanto relógio carregou
fonte, se estourou ao confirmar, qual botão de recomeço) entra pela trilha, não
pela telemetria — e o marco leva o relógio **recalculado no instante**
(`relogioAgora` na api), nunca `sessoes.minutos_gastos`: aquele é o retrato do
último turno, e um turno leva 10–30 s (ADR-64). O único dado do recomeço que só
o cliente sabe é a `origem` (lixeira da Investigação ou "Tentar de novo" do
Resultado), e ela vai no corpo do `POST /unoogpt/reiniciar`.

## Erro tem status, e cada status tem uma frase

O SDK lança `Error("API POST /x → 409")` sem corpo. A tela escolhe o texto pelo
STATUS (409 = regra do jogo, 429 = quota/rate limit), sem refazer o pedido e sem
expor detalhe interno.

## Handler passado a um `Modal` do DS TEM que ser estável

O `Modal` da seção `chatgpt` mantém `onClose` nas dependências do **mesmo**
`useEffect` que faz o foco inicial e restaura o foco anterior. Toda vez que a
identidade de `onClose` muda, o React roda cleanup + efeito: o foco sai do
modal (para quem o abriu) e volta para o **primeiro focável**, que é o botão de
fechar.

Isso já custou um bug que não parecia de React: com `onFechar={() => setDecidindo(false)}`
inline e o relógio da turma correndo, o modal de decisão roubava o foco a cada
tick. O estudante clicava no `<select>` da justificativa e o popup nativo fechava
sozinho — perder o foco fecha um `<select>` aberto —, e um Enter reflexo nesse
instante fechava o modal. Nada aparecia no log: os POSTs que saíam voltavam 201.

Por isso os handlers de fechar são `useCallback` em `unoogpt-app.tsx`. Ao passar
qualquer função para um componente do DS que a use como dependência de efeito,
estabilize antes. **A correção definitiva é no `storybook-unooria`** — separar o
efeito de foco do de teclado, como o `Modal` da seção `unooria` já faz.

## Polling não pode renderizar mais que uma vez por segundo

`useContagem` amostra de 500 em 500 ms, mas `segundosRestantes` devolve
**inteiro** (`Math.ceil`): sem isso o float de milissegundo nunca era igual ao
anterior, o `useState` nunca fazia bail-out e a missão inteira redesenhava 2×/s
— o que acionava o defeito do `Modal` acima. `src/lib/relogio.test.ts` guarda
esse contrato, e ele é de RENDER, não de aritmética.

Ação que chama a api trava por `ocupado` **no controle**, não só no handler:
`/unoogpt/alocacao` é por equipe, então uma escolha manda dois POSTs, e um duplo
clique manda quatro — o segundo par com o estado que o primeiro ainda não gravou.

## O campo do Composer limpa na hora, e o rascunho volta em falha

`onPerguntar` põe a fala do estudante na conversa ANTES de ir ao servidor, e o
turno leva de 10 a 30 segundos. Limpar o campo só depois do `await` deixava a
mesma pergunta visível nos dois lugares a consulta inteira — o estudante lia
como "não enviou", apagava e mandava de novo.

Limpar cedo sozinho não serve: uma versão anterior fazia isso e falha de rede
levava junto a pergunta recém-escrita, com o cronômetro correndo. As duas metades
precisam existir — limpa na hora, e devolve o rascunho se não entrou, **só se o
campo continuar vazio** (o `Composer` não é desabilitado durante a consulta, de
propósito, então pode haver texto novo ali).
