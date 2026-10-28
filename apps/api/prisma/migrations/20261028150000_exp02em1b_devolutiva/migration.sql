-- exp02em1b 2.2.0 (ADR-192): a devolutiva da conclusão, gerada uma vez por sessão.
-- Só estrutura (ADD COLUMN, nulo): nenhuma linha muda, então a RLS FORÇADA da
-- tabela não atrapalha — o NO FORCE/FORCE é para migração que mexe em DADO.
ALTER TABLE "exp02em1b_sessoes" ADD COLUMN "devolutiva" JSONB;
