# O que NÃO fazer

A lista completa, com o custo de cada uma. Complementa o `AGENTS.md` da raiz,
que vence em conflito — e que carrega a versão curta desta lista.

## O que NÃO fazer

- Não criar novos serviços Cloud Run sem necessidade demonstrada (a api absorve).
- Não adicionar Redis/filas/libs de estado sem gargalo medido (exceção: Pub/Sub
  de telemetria, que já é decisão tomada).
- Não usar localStorage para token. Não usar `targetOrigin: "*"`.
- Não escrever migração que remova `escola_id` ou afrouxe RLS.
- Não chamar provedores de IA fora de `apps/api/src/ai`.
- Não rodar Snyk (CLI ou MCP): a varredura é do CI. Ver "Ferramentas externas".
- Não escrever conteúdo em `CLAUDE.md`: ele é o ponteiro `@AGENTS.md` de uma linha.
- Não escrever componente de UI local (nem em `packages/ui`, nem na experiência)
  quando a seção do DS já tem: o lugar do componente novo é o `storybook-unooria`.
- **Não escrever interface sem antes procurar no DS** (o procedimento de três
  passos está em "Design System"). Não achou? Pedido no `storybook-unooria` +
  compensação local marcada — nunca um componente local silencioso.
- Não resolver na mão o que o DS já resolve: rolagem é `ScrollBar`, não
  `overflow` num `<div>`; diálogo é `Modal`; aba é `Tabs`; seleção é
  `Selection`, não `<select>`; menu do avatar é `HeaderMenu`.
- **Não escrever breadcrumb numa página do hub, e não deixar página sem ele.**
  A trilha é do LAYOUT da área, montada de um registro de rotas — rota nova é
  uma linha no registro (`apps/hub/lib/trilha.ts`) e nada na página. Era por
  página, e o resultado foi 22 telas com trilha e 15 sem, nenhuma por decisão
  (ADR-77). A regra inteira, com as duas exceções declaradas, está em
  `apps/hub/AGENTS.md`; **área nova precisa de layout novo, e layout novo
  desenha a trilha** — sem isso a área nasce sem trilha, como `/admin` nasceu.
- **Não escrever texto de interface em inglês, e não traduzir o nome do clone.**
  A regra das três zonas está em "O idioma da interface" (ADR-91): `Shorts` e
  `feed` ficam porque é assim que o app real se chama em português; `card de
  pausa`, `modal` e `popup` saem porque são jargão nosso vazado para o guia do
  professor. `fake news`, `cyberbullying` e `print` ficam por decisão registrada
  — não "corrija" nenhum deles.
- **Não formatar data na mão** (ADR-98). `toLocaleDateString`,
  `toLocaleTimeString`, `toLocaleString` sobre uma data e `Intl.DateTimeFormat`
  sem `timeZone` usam o fuso de QUEM EXECUTA — e no hub o contêiner está em UTC
  e a professora em `America/Sao_Paulo`. Entre 21h e a meia-noite os dois lados
  renderizam DIAS diferentes, o React chama isso de "hydration failed",
  regenera a árvore e engole o clique. Use `data`, `dataCurta`, `dataHora`,
  `dataCurtaHora`, `hora`, `horaComSegundos` e `diaDaPlataforma`, do `@edu/sdk`
  (na api, `src/comum/fuso.ts`). Número não tem fuso:
  `n.toLocaleString("pt-BR")` para milhar continua livre.
- **Não cravar o fuso em lugar nenhum, nem ler `FUSO_DA_PLATAFORMA` na mão**
  (ADR-99). O valor é do DEPLOY: uma env só, com o mesmo nome na api e no hub,
  ausente = `America/Sao_Paulo`. Quem responde qual é ele são
  `fusoDaPlataforma()` do `@edu/sdk` e o de `apps/api/src/comum/fuso.ts` — eles
  resolvem a cascata (runtime → env → `<meta name="unooria-fuso">` → padrão) que
  faz o valor chegar ao servidor, ao navegador e ao bundle da experiência.
  `process.env.FUSO_DA_PLATAFORMA` lido direto numa tela funciona no servidor e
  volta `undefined` no navegador, que é o defeito da ADR-98 de volta pela porta
  dos fundos. **Fuso novo para a experiência entra pelo `config` do `hub:init`**
  (chave `CHAVE_DO_FUSO`), nunca por campo de topo: campo de topo muda a FORMA
  do handshake e obriga a subir `PROTOCOL_VERSION`.
- Não misturar seções do DS: componente/token da plataforma dentro do clone de uma
  experiência (ou o contrário) quebra a fidelidade que a experiência mede.
- Não travar a versão do DS: `^0.1.x` não sobe minor — atualizar de propósito.
- Não commitar assets binários pesados (>2MB): vão para o bucket, referenciados por URL.
