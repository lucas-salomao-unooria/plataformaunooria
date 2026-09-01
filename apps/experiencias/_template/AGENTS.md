# apps/experiencias/_template — o esqueleto, cru de propósito

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias` (o passo a passo de
"como criar uma experiência nova" está lá).

`pnpm new:exp exp-NN-slug` copia esta pasta e ajusta os nomes. **Não é para ser
usada direto** e não entra em nenhum deploy.

**Ele é cru porque o que falta aqui, o DS traz.** Botão, campo, diálogo, ícone:
vêm do `@unooria/design-system` pela ponte do `@edu/ui`, na seção que a
experiência imita. Acrescentar componente de UI a este template é criar um
padrão local que 48 experiências vão copiar — e que nunca mais sai.

O que pode mudar aqui: a fiação que TODA experiência precisa (handshake do SDK,
`experiencia.json`, config do Vite, scripts do `package.json`). Mudou? A próxima
experiência nasce com a mudança, mas as que já existem **não** — elas foram
copiadas, não linkadas. Mudança de fiação que precisa valer para todas é
mudança no `@edu/sdk`.
