# ADRs (resumo das decisões e porquês)

1. **Experiências como bundles estáticos, não serviços** — CDN absorve pico,
   custo ~zero, rollback por versão de path. Estático = entrega do código;
   interação/coleta contínua acontece via API.
2. **Monorepo único (pnpm + Turborepo)** — SDK consumida por 48 apps; mudança
   na SDK testa tudo no mesmo PR; CI builda só o que mudou. Repos separados só
   se houver estúdio externo produzindo experiência.
3. **Auth via OIDC genérico (WSO2 IS)** — WSO2 é exigência do cliente/estratégia
   multi-contrato. App não conhece WSO2: conhece OIDC. Troca de IdP = config.
4. **1 stack por contrato; escolas por RLS** — isolamento contratual forte sem
   virar operador de 100 infra-escolas. Terraform module `contrato` replica.
5. **Cloud SQL HA (não AlloyDB)** — robustez vem de HA+PITR+pooler, não do
   AlloyDB; ambos Postgres, migração futura trivial se precisar.
6. **Pub/Sub para telemetria desde o início** — 4k simultâneos × evento/10s
   sufocaria o transacional. Resto da app fala Postgres direto.
7. **IA atrás de gateway na própria api** — chave e prompt de sistema no server,
   quota/dia por aluno, cache, provider plugável (Vertex default). Pré-gerar em
   lote sempre que a pedagogia permitir.
8. **JWT curto + memória no iframe** — roubo mitigado por HTTPS, expiração 1h,
   escopo mínimo, rate limit; validação de nota é server-side de qualquer forma.
