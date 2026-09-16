# apps/api/src/planos — plano de aula (exp-90)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Plano de aula (exp-90, `apps/api/src/planos`)
Ferramenta do professor: `POST /planos` (202) gera em background (claim atômico
em `exp_90_planos`, `marked` roda na api), o cliente faz polling em `GET /planos/:id`.
Conteúdo em object storage PRIVADO (`{contrato}-planos`; `PLANOS_DRIVER=local`
em dev → `storage-privado/`): `gerado.md` imutável + `atual.html` do editor
(sanitizado com allowlist). Referências curriculares = texto no Postgres
(`exp_90_referencias`, catálogo do contrato, sem RLS), importadas por
`scripts/importar-referencias-plano.mjs` com `PLANOS_IMPORT_TOKEN`.
O teto de saída é 64k tokens, não os 32k do app origem (que eram o limite do
Claude): com o material real (currículo da rede + as 4 unidades do ano, ~190k
tokens só de prompt) o gemini-2.5-flash é cortado em 32k e o professor recebe
"o plano ficou grande demais" sem plano nenhum.
