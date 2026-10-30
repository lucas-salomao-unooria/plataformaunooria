-- exp03em1b v2 (ADR-203): a 4ª camada do compositor, INCORRETA de propósito
-- (a projeção que a nota técnica desmente). Publicação anterior à v2 não a
-- tinha: nasce desligada, e a régua lê o mesmo que lia.
ALTER TABLE "exp03em1b_publicacoes" ADD COLUMN "projecao" BOOLEAN NOT NULL DEFAULT false;
