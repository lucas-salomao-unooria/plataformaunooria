# exp-03-unoogpt — a Missão Tempestade

Clone de assistente de IA em que o aluno decide, **sob incerteza e com o relógio
correndo**, onde alocar 2 equipes de resgate entre 4 bairros de Serra do Sauá
antes de uma tempestade. Porte do projeto `gpturia`.

**2ª série do Ensino Médio · Unidade 1** do Entre Redes. Porta dev: **5178**.

> O propósito **não é acertar a alocação**. É experimentar que perguntas
> melhores e dados melhores produzem respostas melhores — e que nenhuma delas
> produz a resposta certa.

## A regra de ouro

**A Lacuna de cada fonte nunca cruza a fronteira do iframe.** Cada um dos 8
conjuntos de dados distorce a cidade de um jeito (o satélite vê telhado e não vê
morador; o cadastro está velho), e essa distorção é o **material do debate do
professor** — não uma tela.

Consequência prática: **não há revelação no software**. A exp-02 troca da seção
do clone para a da plataforma na virada da missão; aqui não existe virada, e por
isso esta experiência é 100% da seção `chatgpt` e não importa `unooria.css`
nenhum. A marca institucional entra só como chrome do hub, acima do iframe.

O que isso proíbe no bundle, verificado por `grep` no `dist/`: `instrucao`
(o viés), `pSevero`/`expostosSevero`/`fracaoVulneravel` (os parâmetros ocultos),
`CAPACIDADE_DA_EQUIPE`/`JANELA_CONFORTAVEL`/`EFICIENCIA_MINIMA` (a calibragem) e
o prompt de sistema.

## O que é server-side (regra 3)

| Rota | Quando | Por quê |
|---|---|---|
| `GET /unoogpt/sessao` | ao abrir | estado, mapa, conversa e relógio numa resposta. Cria a partida na 1ª visita |
| `GET /unoogpt/relogio` | polling ~5s | a **largada é do professor**: o aluno não tem o que enviar para descobrir que já pode falar |
| `POST /unoogpt/pergunta` | cada turno | o Cientista. **45s de timeout** (`postLento`): o default do SDK é 10s e cortaria a resposta em geração |
| `PUT /unoogpt/conjuntos` | painel | carregar fontes. Acumulam em camadas |
| `POST /unoogpt/alocacao` | mapa/painel | destino + justificativa. O porquê é **portão de servidor** |
| `POST /unoogpt/simular` | enviar | a tempestade. Idempotente por tentativa |
| `GET /unoogpt/resultado` | desfecho | faixa, trilha, o que sobrou, o que nunca foi consultado |
| `POST /unoogpt/contrafactual` | "e se…" | **não grava e não debita** |
| `POST /unoogpt/reiniciar` | recomeçar | abre tentativa **nova** — não apaga a conversa |

Nenhuma rota leva id de sessão: a identidade é `(escola, aluno)` e vem do token.

## Três contas que o cliente NÃO faz

Saíram para a api no porte, e o motivo é o mesmo nas três — um bundle capaz de
computá-las deixaria o aluno antecipar o desfecho antes de enviar:

1. **o minuto da cidade** (com o pivô que impede a chuva de rebobinar quando o
   professor soma +2 min) — chega pronto em `EstadoDoRelogio`;
2. **a projeção das rotas** (`Projecao`) — "chega com N de sobra";
3. **o alcance de cada equipe** por bairro (`BairroPublico.alcance`), com o
   `aperto` já resolvido: era a constante `JANELA_CONFORTAVEL` no cliente.

O único cálculo local é a contagem regressiva em segundos, ancorada em
`relogio.agora` (a hora do **servidor** — o relógio do laboratório atrasa).

## Ponto cego é ausência, não zero

`BairroPublico.estimativa === null` significa "nenhuma fonte carregada cobre este
bairro". **A tela nunca pode escrever "0 pessoas em risco" aí** — a verdade é
"não sabemos". É a mesma distinção que separa `zero` de `none` no relatório do
professor, e o defeito existia no projeto de origem (corrigido em
`regras/camadas.ts` da api).

## Telemetria

Canal **analítico** (SDK → batch → Pub/Sub). O **texto do aluno nunca entra**:
a conversa é caixa livre escrita por menor de idade, e o que sobe é contagem.
A trilha pedagógica é outra coisa — `exp_03_marcos`, gravada pela api, lida pelo
professor.

| verbo | objeto | resultado |
|---|---|---|
| `attempted` | `briefing`, `recomeco` | `tentativa` |
| `progressed` | `investigacao` | `tentativa` |
| `interacted` | `turno` | `debitou`, `comCartao`, `perguntasGastas` |
| `interacted` | `fontes` | `carregadas` |
| `interacted` | `alocacao` | `equipe`, `comJustificativa` |
| `scored` | `desfecho` | `salvas`, `fontesUsadas` |

`exp.concluir()` vai **sem `score`**: a missão não dá nota, e um número faria o
hub exibir pontuação que o instrumento se recusa a produzir.

## Contrato com o smoke visual

`node scripts/walkthrough-aluno-unoogpt.mjs <pasta>` depende destes seletores.
Mudar um deles é mudar o teste.

| O que | Seletor / texto |
|---|---|
| iframe no hub | `iframe[title="experiencia"]` |
| briefing | texto `Não dá para atender todos` |
| botão de começar | `button` com `Entrar na sala` |
| cronômetro parado | texto `Aguardando o professor` |
| campo de fala | `form textarea` (o `Composer`) |
| bolha do aluno | `[class*="gpt-chat-bubble"][data-role="user"]` |
| bolha do Cientista | `[class*="gpt-chat-bubble"][data-role="assistant"]` |
| contador de perguntas | texto `Perguntas:` |
| bairro no mapa | `[data-bairro="ribeirinha"]` |
| painel de decisão | texto `Por que aqui?` |
| faixa do resultado | `[data-faixa]` |

## Decisões

- **Tailwind 3 veio junto**, com o config de apelidos do origem (zero cor
  literal — só `var(--gpt-*)`). As ~15 telas foram medidas em playtest com estas
  classes; reescrevê-las em CSS à mão arriscaria a medida sem ganho. Precedente:
  `exp-01-instanooria`. Componente de interface continua vindo do pacote.
- **Sem `viewport` no manifesto**: a missão é de laboratório, desktop, com a
  conversa em 2/3 e o mapa em 1/3. Preenche o iframe, sem casca de aparelho.
- **Tema fixo em claro.** A exp-02 deixa o aluno escolher; aqui o desenho foi
  calibrado no claro e não há escolha a fazer.
- **As duas folhas do DS são obrigatórias** na 0.1.17: `chatgpt.css` (tokens e
  componentes) e `fonts/chatgpt.css` (o `@font-face` da Inter com os `.woff2` do
  pacote). Sem a segunda o texto cai na fonte do sistema. Isto **dispensa** o
  `next/font` que o projeto de origem precisava usar.
- **O mapa SVG e os 8 ícones de fonte são arte de produto**, em `src/app/arte/` —
  exceção declarada ao "não inventar componente", como o canvas 3D da exp-70.

## Lacunas do pacote (pedidos ao `storybook-unooria`)

Marcadas como `(b) COMPENSAÇÃO` em `src/estilos/globals.css`:

1. a seção `chatgpt` não publica **indicador de carregamento**, e um turno leva
   de 10 a 30s. Sem sinal de vida o aluno reenvia a pergunta — que é o que o
   orçamento de 3 perguntas não perdoa;
2. `ChatBubble` não aceita conteúdo em **bloco** abaixo da fala, e é ali que o
   cartão de leitura precisa aparecer (solto na coluna ele perde o dono).

## Rodar

```bash
pnpm --filter @edu/exp-03-unoogpt dev     # :5178 → hub /exp/exp-03-unoogpt
pnpm --filter @edu/exp-03-unoogpt test    # Vitest da lógica de tela
```

Com `AI_PROVIDER=mock` a missão abre e o laço de ferramenta roda, mas o mock não
conhece os slugs do domínio: carregue fontes pelo painel de decisão. Para o
Cientista de verdade, `AI_PROVIDER=vertex` com o ADC montado.
