# exp-90-plano-de-aula — Gerador de Plano de Aula

Ferramenta do **professor** (`publico: "professor"` no manifesto), embedada pelo
hub em `/professor/plano-de-aula`. Porte do app `planodeaula` (Next.js, serviço
Cloud Run separado) para experiência Vite + `@edu/sdk`.

- **Auth**: nenhuma aqui. O hub autentica, assina o token e entrega por
  `hub:init`; a api impõe `@Roles("professor")`. Plugar o WSO2 não toca nesta pasta.
- **IA**: `POST /planos` (api) → `AiProvider.generate({ modelo: "longo" })` →
  Vertex Gemini. Nenhum prompt nem chave neste bundle.
- **Persistência**: `apps/api/src/planos` — metadados no Postgres (RLS por
  escola, posse por professor), conteúdo em object storage privado
  (`gerado.md` imutável + `atual.html` do editor).
- **Exportação**: `.doc` (HTML com namespaces do Word) gerado no cliente
  (`src/lib/exportar-doc.ts`).

## Telemetria

| verbo | objeto | quando |
|---|---|---|
| `attempted` | `plano` | pediu a geração (contexto: disciplina, serie) |
| `completed` | `plano` | salvou o plano pela primeira vez |
| `interacted` | `exportar-doc` · `restaurar-original` · `excluir-plano` | ação correspondente |

## Dev

```bash
pnpm --filter @edu/exp-90-plano-de-aula dev     # :5175
# hub: http://localhost:3000/professor/plano-de-aula  (login: uma linha prof.* de credenciais-demo.csv)
# referências de demonstração: pnpm --filter @edu/api seed:demo
# referências reais: PLANOS_IMPORT_TOKEN=... node scripts/importar-referencias-plano.mjs <docs-referencia>
```
