-- Permissões de iframe por experiência (manifesto).
--
-- O `ExpFrame` do hub é um só para todas as experiências, e o sandbox dele era
-- fixo. A exp-70 (Vila do Lume) é um jogo 3D em primeira pessoa e precisa de
-- pointer lock, que num iframe com sandbox exige o token `allow-pointer-lock`.
--
-- `fullscreen` não entra na lista: o atributo `allow` do frame já o delega a
-- todas as experiências. Valor de manifesto que não muda comportamento nenhum
-- é pior que valor nenhum.
--
-- Isto entra POR EXPERIÊNCIA, e não como default do frame, porque prender o
-- ponteiro do aluno é capacidade que só quem declarou deve ter: um bundle
-- qualquer com essa permissão captura o mouse e a criança não sabe como sair.
--
-- Default `{}` = nenhuma permissão, que é o que toda experiência existente
-- tinha implicitamente. O CHECK fecha a lista: valor novo aqui é decisão
-- consciente, não string digitada errada no CI.

ALTER TABLE "experiencias"
  ADD COLUMN "permissoes" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "experiencias"
  ADD CONSTRAINT "ck_experiencias_permissoes"
  CHECK ("permissoes" <@ ARRAY['pointer-lock']::TEXT[]);
