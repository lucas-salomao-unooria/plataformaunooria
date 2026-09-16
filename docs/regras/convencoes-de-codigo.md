---
paths:
  - "apps/**/*.{ts,tsx}"
  - "packages/**/*.{ts,tsx}"
  - "scripts/**/*.mjs"
---

# Convenções de código

Regra transversal da plataforma. Complementa o `AGENTS.md` da raiz, que vence
em conflito.

## Convenções de código

- TypeScript strict em tudo. Sem `any` (use `unknown` + narrow). **Uma exceção,
  registrada em ADR:** o jogo da exp-70 (`public/jogo/`, ~10k linhas de JS
  clássico com globais compartilhados, `three.min.js` vendorizado) fica como
  está — é um instrumento com distâncias e tempos calibrados, e o compilador não
  tem como saber que uma refatoração mudou a medida. `public/jogo/**` está nos
  `ignores` do ESLint. O shim (`src/`, TS strict) é a única porta: `window.VILA`.
  A rede que substitui o `tsc` ali é o smoke visual.
- Nomes de domínio em pt-BR (`estudante`, `escola`, `turma`, `experiencia`);
  termos técnicos em inglês (`provider`, `guard`, `batch`).
- Commits: `feat(exp-12): ...`, `fix(api): ...`, `chore(sdk): ...`.
- Zod para validar TODO input externo (body, query, postMessage recebido, env).
- Testes: mínimo = contratos (bridge, telemetria, guards de tenancy). Vitest
  no sdk/experiências, Jest no NestJS.
- UI: **não inventar componente**. Hub e experiências montam interface com
  `@unooria/design-system` (seção `unooria` para a plataforma, seção do clone
  para a experiência), sempre na última versão — ver "Design System" nesta página
  e a mecânica em `packages/ui/AGENTS.md`. O
  `_template` continua cru de propósito: o que ele NÃO traz, o DS traz.
- **Analytics de terceiro passa por `@edu/sdk`, nunca por snippet solto.** O
  Microsoft Clarity (ADR-60) tem UMA fonte — `packages/sdk/src/clarity.ts` —
  consumida pelo hub e pelas experiências; colar o `<script>` num `index.html`
  ou num layout cria a segunda cópia que ninguém atualiza junto. O id vem de
  `NEXT_PUBLIC_CLARITY_PROJECT_ID` e **ausente = desligado**, nas duas
  superfícies. O que sai para lá é id opaco e `verbo:objeto`; nome, e-mail e
  resposta de estudante NÃO — a regra 6 continua valendo dentro do Clarity.
- **Tabela de experiência leva o NÚMERO dela: `exp_NN_`.** `exp_70_sessoes`,
  `exp_02_sessoes`, `exp_91_checkins`. Tabela da PLATAFORMA — que serve a todas
  — fica **sem prefixo**: `escolas`, `lotacoes`, `turmas`, `matriculas`,
  `liberacoes`, `periodos_letivos`, `users`, `experiencias`, `progresso`,
  `telemetria_eventos`, `ia_uso_diario`. O motor (feed adaptativo,
  geração, dossiê) é da exp-01 e leva `exp_01_`. Tabela que é CONTRATO entre
  duas experiências carrega os DOIS números: `exp_01_exp_70_perfis_importados`
  (a exp-70 escreve, a exp-01 lê) — chamá-la de uma só mentiria sobre quem
  depende dela.
  **Um banco, um schema.** Nem banco por experiência (elas não são isoladas: o
  perfil da Vila alimenta a largada do Instanooria, e o Postgres não faz JOIN
  entre bancos; além disso um pool do Prisma por experiência estouraria o
  `max_connections`), nem schema por experiência (a única coisa que um schema
  daria além do prefixo é fronteira de `GRANT`, e existe UMA role de aplicação).
  Migração de referência: `20260827090000_tabelas_por_experiencia` — `RENAME`,
  nunca DROP/CREATE, e renomeando constraints, índices e políticas de RLS
  junto. Duas armadilhas registradas lá: `FOR ... IN SELECT` sobre o catálogo
  relê o que o próprio laço alterou, e `RENAME CONSTRAINT` renomeia também o
  índice que a sustenta — as duas produzem `exp_01_exp_01_..._pkey`.
- Lógica de domínio de uma experiência (gabarito, estado da missão, visão do
  professor) vive num módulo próprio da api, prefixo minúsculo igual ao slug:
  `apps/api/src/unootube/` ↔ `/unootube/*` (regra 3: o client nunca recebe o
  gabarito). Padrão: `catalogo.ts` (dados) + `regras.ts` (puro) + service com
  `comTenancy` + controllers por papel.
