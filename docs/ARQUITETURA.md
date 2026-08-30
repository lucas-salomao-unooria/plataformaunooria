# Arquitetura — Plataforma Unooria

## Visão por contrato (estado/município)
```
Estudantes ──HTTPS──> Cloud CDN ──┬─> Cloud Storage (bundles das experiências, assets)
                              └─> Load Balancer ─┬─> Cloud Run: hub (Next.js, min=2)
                                                 └─> Cloud Run: api (NestJS, min=3)
                                                        │            │
                                     Cloud SQL Postgres HA + réplica │
                                     (PgBouncer/pooler obrigatório)  │
                                                        Pub/Sub (telemetria)
                                                            └─> Cloud Run worker → Postgres/BigQuery
WSO2 Identity Server (externo, compartilhado entre contratos) ──OIDC──> hub/api
Vertex AI (Gemini) <── api/src/ai (provider plugável, quota por estudante)
```

## Tenancy
- Nível 1 — contrato: stack GCP inteira separada (Terraform module por contrato).
- Nível 2 — escola: `escola_id` em toda tabela de dados + Postgres RLS.
- Nível 3 — turma/estudante: autorização na api via claims do JWT.
- JWT (WSO2) carrega: `sub` (estudanteId), `escola_id`, `turma_id`, `perfil`
  (estudante|professor|gestor|admin-contrato). API valida assinatura via JWKS.

## Fluxo de uma experiência
1. Estudante loga no hub (OIDC WSO2) → sessão.
2. Hub abre `https://cdn.../exp/{expId}/{versao}/index.html` em iframe.
3. Handshake postMessage (ver CLAUDE.md) entrega token+contexto à experiência.
4. Experiência usa SDK: telemetria em lote, saves, chamadas `/ai/*`.
5. `exp:concluir` → hub registra progresso → boletim/relatórios.

## Picos (8h da manhã)
- CDN absorve carga de bundles/assets (o grosso do tráfego).
- Cloud Run min-instances elimina cold start; concurrency 80 na api.
- Pooler de conexões evita estouro do Postgres com autoscaling.
- Teste de carga k6 obrigatório antes de novembro: 4k logins + abertura em 10min.

## O que fica de fora (decisão consciente)
GKE, AlloyDB, microserviços por experiência, multi-região. Reavaliar apenas
com gargalo medido.
