-- `downloads` entra no vocabulário de `experiencias.permissoes`.
--
-- As ferramentas do professor (exp-90 e exp-92) exportam o plano como `.doc`,
-- e o download nasce DENTRO do iframe. Num iframe com `sandbox`, o navegador
-- bloqueia todo download sem o token `allow-downloads` — e o bloqueio é MUDO:
-- nada na tela, nada no console (o Chrome o registra no painel Issues), e o
-- `a.click()` do bundle volta como se tivesse funcionado. O professor clicava
-- em "Baixar .doc" e concluía que o produto estava quebrado.
--
-- MEDIDO em 2026-09-07: dois iframes com o mesmo blob e o mesmo código, um com
-- o token e outro sem. Só o primeiro escreveu arquivo na pasta de downloads.
--
-- Mesma disciplina do `forms` (20260828210000): o vocabulário vive em três
-- lugares — este CHECK, o `PERMISSOES_DE_IFRAME` do Zod e o `ExpFrame` do hub —
-- e `tests/permissoes-de-iframe.spec.ts` falha se o CHECK e o Zod divergirem.
-- Sem essa trava, a divergência só aparece no CI, como 500 no
-- `PUT /experiencias/:expId`, porque em dev o hub cai no manifesto do bundle
-- quando a tabela está vazia e nunca encosta no CHECK.
ALTER TABLE "experiencias" DROP CONSTRAINT IF EXISTS "ck_experiencias_permissoes";

ALTER TABLE "experiencias"
  ADD CONSTRAINT "ck_experiencias_permissoes"
  CHECK ("permissoes" <@ ARRAY['pointer-lock', 'forms', 'downloads']::TEXT[]);
