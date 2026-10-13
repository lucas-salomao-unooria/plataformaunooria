# exp02em1b — a Missão Tempestade

Clone de assistente de IA em que o estudante decide, **sob incerteza e com o relógio
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

Consequência prática: **não há revelação no software**. A exp04ef1b troca da seção
do clone para a da plataforma na virada da missão; aqui não existe virada, e por
isso esta experiência é 100% da seção `unooriaai` (desde a 1.3.0, ADR-138; até
a 1.2.7 era a `chatgpt`) e não importa `unooria.css` nenhum. A marca
institucional entra só como chrome do hub, acima do iframe. O app disfarçado se
chama **UnooriaAI**; o código continua `unoogpt`.

O que isso proíbe no bundle, verificado por `grep` no `dist/`: `instrucao`
(o viés), `pSevero`/`expostosSevero`/`fracaoVulneravel` (os parâmetros ocultos),
`CAPACIDADE_DA_EQUIPE`/`JANELA_CONFORTAVEL`/`EFICIENCIA_MINIMA` (a calibragem) e
o prompt de sistema.

## O que é server-side (regra 3)

| Rota | Quando | Por quê |
|---|---|---|
| `GET /unoogpt/sessao` | ao abrir | estado, mapa, conversa e relógio numa resposta. Cria a partida na 1ª visita |
| `GET /unoogpt/relogio` | polling ~5s | a **largada é do professor**: o estudante não tem o que enviar para descobrir que já pode falar |
| `POST /unoogpt/pergunta` | cada turno | o Cientista. **45s de timeout** (`postLento`): o default do SDK é 10s e cortaria a resposta em geração |
| `PUT /unoogpt/conjuntos` | painel | carregar fontes. Acumulam em camadas |
| `POST /unoogpt/alocacao` | mapa/painel | destino + justificativa. O porquê é **portão de servidor** |
| `POST /unoogpt/simular` | enviar | a tempestade. Idempotente por tentativa |
| `GET /unoogpt/resultado` | desfecho | faixa, trilha, o que sobrou, o que nunca foi consultado |
| `POST /unoogpt/contrafactual` | "e se…" | **não grava e não debita** |
| `POST /unoogpt/reiniciar` | recomeçar | abre tentativa **nova** — não apaga a conversa. Corpo `{ origem }` (`investigacao` \| `resultado`): qual botão, gravado no marco `recomeco` da tentativa que fecha |

Nenhuma rota leva id de sessão: a identidade é `(escola, estudante)` e vem do token.

## Três contas que o cliente NÃO faz

Saíram para a api no porte, e o motivo é o mesmo nas três — um bundle capaz de
computá-las deixaria o estudante antecipar o desfecho antes de enviar:

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

Canal **analítico** (SDK → batch → Pub/Sub). O **texto do estudante nunca entra**:
a conversa é caixa livre escrita por menor de idade, e o que sobe é contagem.
A trilha pedagógica é outra coisa — `exp02em1b_marcos`, gravada pela api, lida pelo
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

`node scripts/walkthrough-estudante-unoogpt.mjs <pasta>` depende destes seletores.
Mudar um deles é mudar o teste.

| O que | Seletor / texto |
|---|---|
| iframe no hub | `iframe[data-experiencia]` (o `title` é o nome da missão, para o leitor de tela — ADR-162) |
| briefing | texto `Não dá para atender todos` |
| botão de começar | `button` com `Começar` |
| cronômetro parado | texto `Aguardando o professor` |
| cronômetro correndo | texto `Para investigar` |
| campo de fala | **`form input`** — o `Composer` do DS é um `<form>` com `input`, não `textarea` |
| contador de perguntas | texto `Perguntas:` |
| bairro no mapa | `[data-bairro="<slug>"]` |
| bairro COM dado | `[data-bairro][data-com-dado="true"]` — deve ser 0 antes de carregar fonte |
| zerar a turma (professor) | `[data-zerar-turma]` |
| linha do estudante (professor) | `[data-estudante="<usuario>"]` (ou `[data-estudante="<usuario>"]`) |

**Duas armadilhas que este roteiro já pagou**, e que valem para qualquer smoke
desta missão:

1. **O estado é server-side e sobrevive ao teste.** A segunda execução encontra
   o estudante já na investigação. Por isso o roteiro começa **zerando a turma** —
   e de graça isso cobre o caminho destrutivo.
2. **Esperar por texto do assistente é falso positivo.** A fala de abertura dele
   já está na tela desde o começo, e o cliente mostra a fala do ESTUDANTE
   otimistamente antes de a api responder. A asserção honesta é a conversa
   **sobreviver a um F5**, porque aí ela veio de `exp02em1b_mensagens`.

## Decisões

- **Tailwind 3 veio junto**, com o config de apelidos do origem (zero cor
  literal — só `var(--uai-*)`). As ~15 telas foram medidas em playtest com estas
  classes; reescrevê-las em CSS à mão arriscaria a medida sem ganho. Precedente:
  `exp08ef1b`. Componente de interface continua vindo do pacote.
- **Sem `viewport` no manifesto**: a missão é de laboratório, desktop, com a
  conversa em 2/3 e o mapa em 1/3. Preenche o iframe, sem casca de aparelho.
- **Tema fixo em claro.** A exp04ef1b deixa o estudante escolher; aqui o desenho foi
  calibrado no claro e não há escolha a fazer.
- **As duas folhas do DS são obrigatórias**: `unooriaai.css` (tokens e
  componentes) e `fonts/unooriaai.css` (o `@font-face` da Open Sans e do Material
  Symbols com os `.woff2` do pacote). Sem a segunda o texto cai na fonte do
  sistema e o `Icon`, que é ligadura, escreve o NOME do ícone no lugar dele.
- **As Equipes saem de token semântico** (Alfa = `--uai-status-info`, Bravo =
  `--uai-bg-brand`): a seção não publica cor primitiva.
- **O mapa SVG e os 8 ícones de fonte são arte de produto**, em `src/app/arte/` —
  exceção declarada ao "não inventar componente", como o canvas 3D da app-70.

## Lacunas do pacote (pedidos ao `storybook-unooria`)

Nenhuma compensação viva em `src/estilos/globals.css`. As duas da seção
`chatgpt` eram CSS morto quando a missão foi para a `unooriaai` e saíram com ela
(ADR-138): o indicador de carregamento já era o `Consultando` de
`painel-cientista.tsx` (três pontos com `animate-pulse` dentro do `ChatBubble`),
e o anexo em bloco abaixo da fala não tinha consumidor. Duas lacunas continuam
abertas e são contornadas sem CSS próprio:

1. a seção não publica **indicador de carregamento**, e um turno leva de 10 a
   30s — sem sinal de vida o estudante reenvia a pergunta;
2. a seção não publica **campo de seleção**: a Decisão usa o `<select>` nativo
   pintado com `--uai-*` (`decisao.tsx`).

## `allow-forms` no sandbox

O manifesto declara `"permissoes": ["forms"]`, e sem isso **a missão não
funciona**: o `Composer` do DS é um `<form>`, e num iframe com sandbox sem
`allow-forms` o navegador bloqueia o submit. O estudante digita, aperta Enter e nada
acontece.

O sintoma engana de propósito: a conversa parece viva (a fala de abertura do
agente está na tela) e o único rastro é um aviso de console sobre *"form's frame
is sandboxed"*. Foi assim que passou pelo typecheck, pelo lint e por uma primeira
versão do smoke.

É por experiência, não default, pelo mesmo motivo do `pointer-lock` da app-70:
permitir submit de formulário é capacidade de quem declarou.

## Rodar

```bash
pnpm --filter @edu/exp02em1b dev     # :5178 → hub /exp/exp02em1b
pnpm --filter @edu/exp02em1b test    # Vitest da lógica de tela
```

Com `AI_PROVIDER=mock` a missão abre e o laço de ferramenta roda, mas o mock não
conhece os slugs do domínio: carregue fontes pelo painel de decisão. Para o
Cientista de verdade, `AI_PROVIDER=vertex` com o ADC montado.
