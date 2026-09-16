# apps/api/src/bemestar — check-in de bem-estar (exp-91)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Check-in de bem-estar (exp-91, `apps/api/src/bemestar`)
Ferramenta do professor: o **DASS-21** (Lovibond & Lovibond 1995; versão
brasileira Vignola & Tucci 2014; domínio público) em **microdoses** — 3 frases
por dia, 7 check-ins fecham os 21 itens, um texto livre opcional. Decisões:
- **Os 21 itens são fixos e verbatim** (`catalogo.ts`). A IA NUNCA reescreve
  um item: reformular quebra a validação psicométrica e as faixas de corte.
  O que a IA gera é o entorno — abertura do dia, pergunta aberta, acolhimento
  ao texto — e cada texto passa por `regras.validarTextoDaIa` (sem vocabulário
  clínico, ordens, promessas, gestão, links, tamanho). Barrado, sem saldo ou
  sem provider ⇒ texto fixo do catálogo; o check-in nunca deixa de abrir.
  A IA nunca recebe nome, escola, pontuação ou faixa (só dia da semana, mês,
  nº do check-in e o texto livre, delimitado como conteúdo).
- **Correção server-side** (regra 3): ao 7º check-in a api soma por subescala
  (×2) e classifica pelas faixas publicadas. `pontuar`/`faixaDe` em `regras.ts`.
- **Sinal de apoio**: item 17 ou 21 ≥ 2, ou termo de risco no texto ⇒ mensagem
  FIXA de apoio (CVV 188, SAMU 192, CAPS/UBS) e a IA não é chamada.
- **Dado sensível (LGPD art. 11)**: `bem_estar_ciclos`/`bem_estar_checkins`
  com RLS + posse por `professor_id` em toda query; **nenhuma rota de gestor
  ou agregado** — só o professor lê, e `DELETE /bemestar/dados` apaga tudo.
  Texto livre nunca vai a log nem à telemetria (só contagens).
- 1 check-in por dia (`dia` no fuso da plataforma — `fusoDaPlataforma()` de
  `comum/fuso.ts`, env `FUSO_DA_PLATAFORMA`, ADR-99); ciclo expira em 21 dias
  sem fechar. `GET /bemestar/resumo` é leve (sem IA) — é o que o card do hub lê.
