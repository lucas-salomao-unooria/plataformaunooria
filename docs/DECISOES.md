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
9. **Gabarito e estado de missão server-side, por experiência** (exp-02
   UnooTube, 2026-08-24) — `factual` (a resposta) nunca vai ao bundle; a api
   corrige e devolve inscritos/fontes (regra 3). Não há módulo genérico de
   avaliação: cada experiência com lógica de domínio ganha um módulo próprio
   (`apps/api/src/<slug>/`), como `motor/` para a exp-01. Decisões da missão:
   ranking com colegas FICTÍCIOS (distribuição desenhada para a lição; sem
   pontuação de menores reais — LGPD), URLs das fontes como TEXTO (sandbox do
   iframe bloqueia popups; aluno não sai da plataforma), salvos CONGELADOS após
   "adicionar credibilidade" (o score já foi reportado — nota e estado não
   divergem; reiniciar descongela), aluno roteado pela SÉRIE
   (`4EF → exp-02-unootube`, mapa estático até o manifesto ser a fonte).
10. **Check-in de bem-estar do professor: DASS-21 fixo, IA só no entorno,
   dado que só o professor lê** (exp-91, 2026-08-25). O instrumento entra
   verbatim (versão brasileira de Vignola & Tucci 2014) em microdoses de 3
   itens/dia — engajamento vem de custar < 1 min, não de reescrever perguntas.
   A IA gera abertura, pergunta aberta e acolhimento, atrás de guardrails
   (`regras.validarTextoDaIa`) com fallback fixo, e nunca vê pontuação, nome ou
   escola. Correção server-side ao 7º check-in. Item sentinela (17/21 ≥ 2) ou
   termo de risco ⇒ mensagem fixa de apoio (CVV 188) sem IA. Por ser dado de
   saúde (LGPD art. 11), **não há visão de gestor nem agregado por escola**:
   RLS + posse por professor, e o próprio professor apaga tudo
   (`DELETE /bemestar/dados`). Uma visão agregada/anonimizada para a rede é
   decisão futura, com DPA e k-anonimato — não sai de um `GROUP BY`.
