# apps/experiencias/exp02em1b-v0 — a Missão Tempestade, versão anterior (ADR-180)

**Esta é a VERSÃO ANTERIOR da missão da 2ª série do EM, unidade 1.** Em
2026-10-22 a missão foi reformulada (O Efeito Amplificador) e a nova tomou o
código `exp02em1b`; esta ficou com `exp02em1b-v0`. Ela NÃO foi desligada: o
módulo `unoogpt` continua servido, a disponibilidade, as liberações e os dados
seguem. Só saiu do catálogo — da trilha do professor, da grade da sala e da lista
do estudante (`ehVersaoAnterior`, derivado do sufixo). Mexeu aqui? Suba a versão
nos três lugares, como em qualquer experiência: o bucket é `exp02em1b-v0/<versão>`.

## A missão que nunca sai do disfarce

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp02em1b-v0` · 2EM (unidade 1) · `telemetria, ia` · `permissoes: ["forms"]` |
| Dev | `pnpm --filter @edu/exp02em1b-v0 dev` → :5186 · hub `/exp/exp02em1b-v0` |
| DS | `@edu/ui/ds-unooriaai` **na experiência inteira** (desde a 1.3.0, ADR-138; até a 1.2.7 era `ds-chatgpt`), e o `MessageBubble` do `unoochat` numa peça só (ADR-173) |
| api | módulo `unoogpt` — trilha pedagógica em `exp02em1b_v0_marcos`, o Canal A em `exp02em1b_v0_tarefas` |
| e2e | `scripts/e2e/estudante/04-unoogpt.mjs` |

**Ela não tem revelação no software.** Por isso nunca troca para a seção da
plataforma: não existe momento em que a escola passa a falar dentro da tela. Um
componente de `@edu/ui/ds` aqui é sempre erro.

## A seção é `unooriaai`, e ela não tem cor primitiva

O app disfarçado é o **UnooriaAI** (no `<title>` e no `nome` do manifesto); o
código continua `unoogpt` — módulo da api, rotas, tabela, suíte e2e e
componentes do hub —, porque renomear identificador não muda nada que o
estudante vê. A seção é cópia estrutural da `chatgpt` com a identidade da
Unooria (ADR-138), e três diferenças morderam a troca:

- **Não há primitiva** (`--uai-color-*` não existe). As duas Equipes saem de
  token SEMÂNTICO: Alfa = `--uai-status-info`, Bravo = `--uai-bg-brand`
  (`uai-equipe-alfa`/`uai-equipe-bravo` no Tailwind). Token semântico troca de
  degrau com o tema, então onde a ficha da equipe aparece sobre o painel ESCURO
  do briefing ela leva `data-uai-theme="light"` — senão o par do briefing não é
  o par do mapa.
- **A escada translúcida é mais forte**: `fill-2/4/8/10` são 5/10/20/30%, contra
  2/4/8/10% na `chatgpt`. A chuva do briefing desceu para `fill-2`; o resto
  ficou no mesmo nome de degrau.
- **O `Icon` é ligadura** e não há `gptGlyphs`: a seta de avançar e a de
  recolher a trilha são `<Icon name="arrowForward">` (a de recolher, com
  `rotate`). Sem `fonts/unooriaai.css` a tela escreve o nome do ícone.

## O Canal A (1.5.0, ADR-172): registro, "E se…" e fechamento

Não há mais pergunta de múltipla escolha (o Canal B saiu, e com ele
`perguntas.tsx` e a memória de F5 no `sessionStorage`). As tarefas são do
servidor (`apps/api/src/unoogpt/canal-a.service.ts`), e a tela só mostra o que
ele montou e manda ids de escolha fechada — nunca o nível, nunca o gabarito:

- **A ligação da Saúde** (`componentes/saude.tsx`) aparece quando a api a
  oferece (`sessao.ofertaSaude`: o primeiro destino, ou `POST /saude/abrir` ao
  abrir a decisão). A decisão espera ela fechar: dois `Modal` de uma vez
  prendem o foco. Fechar sem responder é "Agora não" (registrado, sem marca).
- **"Enviar equipes" é `POST /mandar`, e abre o REGISTRO DA OPERAÇÃO**
  (`componentes/registro.tsx`), sem relógio, com as equipes andando no mapa.
  O resultado só vem depois dele (a api responde `registro-pendente`). A
  conversa não manda: quando o Cientista confirma, o turno traz `abrirEnvio`
  e a decisão abre.
- **O "E se…" pareado** (`componentes/e-se.tsx`): duas comparações de 20
  tempestades. A faixa de quadradinhos é COMPENSAÇÃO declarada
  (`.faixa-de-tempestades`, só token `--uai-*`), com a lista tempestade a
  tempestade para leitor de tela, sem a contagem pronta. O "E se…" livre
  continua, e compara MÉDIA com MÉDIA nas mesmas tempestades.
- **O fechamento** (`componentes/fechamento.tsx`) aparece quando o professor o
  abre (o polling do relógio no Resultado lê `fechamentoAberto`), e com ele o
  "Tentar de novo" some.
- **Os cartões** usam o `ChoicePoll` da seção (`componentes/escolhas.tsx`): o
  voto é definitivo no toque, e o cartão vai inteiro quando a última pergunta
  é escolhida; falhou, reabre.

## Clone dentro de clone: o balão do `unoochat` (ADR-173)

O pedido pelo WhatsApp do fechamento é o `MessageBubble` da seção `unoochat`
(`app/pecas/mensagem-do-voluntario.tsx`), e SÓ ele: a ADR-173 estende a
ADR-117 para "peça de outra plataforma dentro de um clone", com os mesmos
limites — sem barra, abas nem fundo do app. `main.tsx` importa
`unoochat.css` e `fonts/unoochat.css` só por isso; o contêiner
`.peca-unoochat` (`estilos/globals.css`) prende os tokens `--unc-*` e o tema
claro (`data-unc-theme`). Sem hora nem tiques. `src/canal-a.test.tsx` cobra
que só a peça importa a ponte `ds-unoochat`.

## O timeout padrão do SDK está errado nesta experiência

Um turno do Cientista passa por até 6 voltas de ferramenta e leva de 10 a 30
segundos; o default do SDK é 10s. `src/lib/api.ts` declara o próprio teto — sem
ele o estudante vê falha no meio de uma resposta que estava chegando.

## Dois canais que não são o mesmo

Telemetria **analítica** (SDK → batch → `telemetria_eventos`) mede o uso.
A trilha **pedagógica** é `exp02em1b_v0_marcos`, gravada pela api. Não misture: o que
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

O `Modal` da seção `unooriaai` (herdado da `chatgpt`, conferido na 0.2.11) mantém `onClose` nas dependências do **mesmo**
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
