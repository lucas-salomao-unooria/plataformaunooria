# packages — o que o hub e as experiências consomem por workspace

Complementa o `AGENTS.md` da raiz. Cada pacote tem o seu `AGENTS.md` (e o
`ui` tem mais um, na subpasta `styles/`), e é lá que está o detalhe:

| Pacote | O que é | Doutrina |
|---|---|---|
| `@edu/sdk` | a única porta da experiência para fora: handshake, token, chamada de api, telemetria | `sdk/AGENTS.md` |
| `@edu/ui` | as seis pontes para as seções do `@unooria/design-system` | `ui/AGENTS.md` |
| `@edu/ui` — `styles/` | as compensações da seção `unooria` que o hub aplica sobre o DS (`plataforma.css`: tabela rolável, `.tela-cheia`, `ScrollBar`, `Button`) | `ui/styles/AGENTS.md` |

Comum aos dois: **TypeScript puro, sem dependência pesada**, consumidos por
`workspace:*` e nunca publicados no npm. O que é publicado e vem de fora é o
`@unooria/design-system` — e a única forma de consumi-lo é pela ponte do
`@edu/ui`, na seção certa (ver a regra de ouro na raiz).

Pacote novo aqui exige justificativa: código compartilhado por **dois ou mais**
consumidores. Um consumidor só = o código mora nele.

**Exceção declarada: a copy da revelação da exp08ef1b.** Ela é lida pela
experiência E pelo guia do professor — dois consumidores, o mínimo da regra
acima —, e por isso FOI um pacote (`@edu/conteudo-exp08ef1b`) até 2026-09-09.
Hoje são duas cópias gêmeas: `apps/experiencias/exp08ef1b/src/lib/copy-da-revelacao.ts`
e `apps/hub/lib/insta/copy-da-revelacao.ts`. A decisão é do dono do produto: a
copy está fechada e não haverá revisão dela, então o pacote cobrava o custo de
existir sem ter o que proteger. **O que segura a igualdade agora é o cabeçalho
dos dois arquivos, e nada mais** — nem typecheck, nem lint, nem teste. Mexeu numa,
mexa na outra, no mesmo commit. Se a copy voltar a ser editada, o pacote volta.

**Exceção declarada: o logger.** `apps/api/src/observabilidade/logger.ts` e
`apps/hub/lib/log.ts` são a MESMA função (`criarOpcoesDoPino`, redaction,
severity) copiada, não um `@edu/log`. Dois consumidores é o mínimo da regra
acima, mas o pacote custaria uma dependência de runtime (`pino`) que a SDK — o
terceiro consumidor natural — não pode carregar para o navegador, e a api
precisa do logger ANTES do Nest (na importação), o que um pacote de workspace
transpilado pelo Next complica. Mudou a forma da linha de log? **Muda nos
dois, no mesmo commit.**
