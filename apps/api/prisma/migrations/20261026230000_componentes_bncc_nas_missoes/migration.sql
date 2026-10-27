-- O componente curricular do recorte do professor cobre a BNCC da série da
-- missão, mais Computação (o complemento de 2022), como a exp02ef1b já faz
-- (`20261026210000_exp02ef1b_prototipo`). O padrão é
-- `src/curriculo/componentes.ts#componentesDoAno(serie)`.
--
-- SÓ ACRESCENTA: nenhum valor que já existia sai do CHECK. Há linhas gravadas
-- com eles (`letramento-digital` e `lingua-inglesa` no 5º ano,
-- `projeto-interdisciplinar` no 6º, `interdisciplinar` na 2ª série), e um CHECK
-- mais estreito quebraria esta migração em qualquer banco com dado. A ordem é a
-- do vocabulário no código, que as suítes comparam com estes textos.

-- exp05ef1b, Quem mandou isso? (5º ano): + Computação.
ALTER TABLE "exp05ef1b_pacotes" DROP CONSTRAINT IF EXISTS "exp05ef1b_pacotes_disciplina_check";
ALTER TABLE "exp05ef1b_pacotes"
  ADD CONSTRAINT "exp05ef1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'arte', 'educacao-fisica', 'matematica', 'ciencias', 'geografia', 'historia', 'ensino-religioso', 'computacao', 'lingua-inglesa', 'letramento-digital'));

-- exp06ef1b, Júri Estadual (6º ano): + Ensino Religioso e Computação.
ALTER TABLE "exp06ef1b_pacotes" DROP CONSTRAINT IF EXISTS "exp06ef1b_pacotes_disciplina_check";
ALTER TABLE "exp06ef1b_pacotes"
  ADD CONSTRAINT "exp06ef1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'arte', 'educacao-fisica', 'lingua-inglesa', 'matematica', 'ciencias', 'geografia', 'historia', 'ensino-religioso', 'computacao', 'projeto-interdisciplinar'));

-- exp02em1b, O Efeito Amplificador (2ª série EM): a Formação Geral Básica
-- inteira (LDB art. 35-D) + Computação. Os slugs são os do catálogo sem o
-- sufixo `-em`, porque `lingua-portuguesa`, `biologia` e `historia` já estavam
-- gravados assim.
ALTER TABLE "exp02em1b_pacotes" DROP CONSTRAINT IF EXISTS "exp02em1b_pacotes_disciplina_check";
ALTER TABLE "exp02em1b_pacotes"
  ADD CONSTRAINT "exp02em1b_pacotes_disciplina_check"
    CHECK ("disciplina" IN ('lingua-portuguesa', 'lingua-inglesa', 'arte', 'educacao-fisica', 'matematica', 'biologia', 'fisica', 'quimica', 'filosofia', 'geografia', 'historia', 'sociologia', 'computacao', 'interdisciplinar'));
