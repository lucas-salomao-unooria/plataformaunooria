-- `forms` entra no vocabulário de `experiencias.permissoes`.
--
-- O CHECK nasceu em `20260826120000_permissoes_de_iframe` aceitando só
-- `pointer-lock`, que era a única permissão existente. A exp-03 acrescentou
-- `forms` — ao manifesto, ao Zod da api e ao `ExpFrame` — mas a migration
-- ficou para trás, e o vocabulário passou a divergir entre aplicação e banco.
--
-- POR QUE ISSO SÓ APARECEU EM PRODUÇÃO: em dev o hub não lê a tabela
-- `experiencias`; sem manifesto ele cai no dev server do Vite (a rota lê o
-- `public/experiencia.json` servido ao lado do bundle). O CHECK nunca era
-- exercitado localmente. O sintoma foi `PUT /experiencias/exp-03-unoogpt`
-- devolvendo 500 no CI, com o motivo só visível no log da api.
--
-- `tests/permissoes-de-iframe.spec.ts` passa a comparar este vocabulário com o
-- do Zod, para a divergência falhar no teste e não num deploy.
ALTER TABLE "experiencias" DROP CONSTRAINT IF EXISTS "ck_experiencias_permissoes";

ALTER TABLE "experiencias"
  ADD CONSTRAINT "ck_experiencias_permissoes"
  CHECK ("permissoes" <@ ARRAY['pointer-lock', 'forms']::TEXT[]);
