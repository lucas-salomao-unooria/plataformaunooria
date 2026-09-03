# packages — o que o hub e as experiências consomem por workspace

Complementa o `AGENTS.md` da raiz. Cada pacote tem o seu `AGENTS.md`, e é lá que
está o detalhe:

| Pacote | O que é | Doutrina |
|---|---|---|
| `@edu/sdk` | a única porta da experiência para fora: handshake, token, chamada de api, telemetria | `sdk/AGENTS.md` |
| `@edu/ui` | as cinco pontes para as seções do `@unooria/design-system` | `ui/AGENTS.md` |
| `@edu/conteudo-exp-01` | a copy da revelação, lida pela exp-01 E pelo guia do professor | `conteudo-exp-01/AGENTS.md` |

Comum aos três: **TypeScript puro, sem dependência pesada**, consumidos por
`workspace:*` e nunca publicados no npm. O que é publicado e vem de fora é o
`@unooria/design-system` — e a única forma de consumi-lo é pela ponte do
`@edu/ui`, na seção certa (ver a regra de ouro na raiz).

Pacote novo aqui exige justificativa: código compartilhado por **dois ou mais**
consumidores. Um consumidor só = o código mora nele.

**Exceção declarada: o logger.** `apps/api/src/observabilidade/logger.ts` e
`apps/hub/lib/log.ts` são a MESMA função (`criarOpcoesDoPino`, redaction,
severity) copiada, não um `@edu/log`. Dois consumidores é o mínimo da regra
acima, mas o pacote custaria uma dependência de runtime (`pino`) que a SDK — o
terceiro consumidor natural — não pode carregar para o navegador, e a api
precisa do logger ANTES do Nest (na importação), o que um pacote de workspace
transpilado pelo Next complica. Mudou a forma da linha de log? **Muda nos
dois, no mesmo commit.**
