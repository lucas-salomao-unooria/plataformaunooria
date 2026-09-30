# apps/hub/app/exp — o embed da experiência

Complementa o `AGENTS.md` de `apps/hub`, que vence em conflito. O contrato
`postMessage` está em `apps/experiencias/AGENTS.md`.

## Embed de experiência

A montagem (token, manifesto, dev server, origin) é uma só: `montarEmbed`, em
`lib/embed-experiencia.ts`, usada por `/exp/[expId]`, `/dev-embed`,
`/professor/plano-de-aula`, `/professor/plano-de-ensino` e
`/professor/bem-estar`.

**A origem do bundle é do AMBIENTE; o manifesto diz o que a experiência
declara.** Não derive um do outro: `emDev = !manifesto && !emProducao` —
"tabela vazia logo é dev" — quebrou quando o seed passou a popular
`experiencias` (ADR-69), e hoje é `emDev = !emProducao`. Sem
`NEXT_PUBLIC_CDN_EXP_URL`, a URL versionada cai no default `localhost:5173`, o
dev server da exp08ef1b, que responde a qualquer caminho com a SPA dele: TODA
missão abre o Instanooria, o handshake completa e o boot dá 403 — nada diz
"endereço errado".

## Prefixo fora da allowlist do BFF dá 404, e a tela some inteira

Toda chamada client-side do hub passa por `app/api/plataforma/[...path]/route.ts`,
e `PREFIXOS_PERMITIDOS` decide o que ele repassa. **Prefixo ausente = 404**, com
uma linha `codigo: bff-prefixo-recusado` no log — enquanto método ausente dá
**405**. Os dois sintomas chegam como "o botão não faz nada".

O que faz o 404 enganar é que a mesma rota funciona pelo servidor: a tela de
resultados é Server Component e usa `apiDoServidor`, que vai direto na api. Ela
CARREGA, com os dados certos, e só as ações do professor morrem. Na exp08ef4b
(2026-09-11) isso derrubou o preparo, os dois botões do debate e o "zerar turma"
de uma vez, sem nenhum erro visível na tela.

**Experiência nova com tela client-side de professor = uma linha na allowlist,
com o comentário dizendo por que aquela tela não passa por `apiDoServidor`.**
