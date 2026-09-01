# packages/conteudo-exp-01 — a copy da revelação, fonte única

Complementa o `AGENTS.md` da raiz.

As sete telas que derrubam o disfarce do Instanooria moram aqui, e não dentro da
experiência, porque **duas pessoas leem o mesmo texto**: o estudante, na exp-01
(`src/app/componentes/revelacao.tsx`), e o professor, no guia da aula do hub
(`/professor/entre-redes/[ano]/[unidade]/guia`). Por muito tempo o professor era
o único que NÃO lia a peça antes de conduzir a conversa mais importante das duas
aulas.

**Não copie o texto para o outro lado.** Duas cópias, nada obrigando as duas a
concordarem, e a primeira revisão de copy faz o guia mentir em silêncio.

**Não passe pela api.** A revelação abre no meio da aula e rede instável em
escola é regra, não exceção: texto que depende de `fetch` é texto que pode não
aparecer. Ele viaja no bundle.

Mudou a copy? Sobe a `versao` do `public/experiencia.json` da exp-01 (e o
`version` do `package.json` junto) — o hub serve o guia da versão publicada.
