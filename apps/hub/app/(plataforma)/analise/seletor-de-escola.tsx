'use client';

import { useRouter } from 'next/navigation';

import { Card } from '@edu/ui/ds';
import { EscolhaDeEscola } from '@/components/escolha-de-escola';

/**
 * Escolha da escola — peça NOVA no porte, não existia no origem.
 *
 * Lá o `analista` lia o banco inteiro. Aqui quem entra é `gestor_contrato`, a
 * única exceção cross-escola da regra 1, e ele viaja com `escolaId` VAZIO no
 * token: a api exige `?escolaId=` nas rotas de análise de produto
 * (`apps/api/src/analise/analise.controller.ts`). A escola vive na URL, o que
 * torna a comparação entre turmas um link compartilhável. Desde a H03.4.2 ela
 * é escolhida numa lista com busca (`components/escolha-de-escola.tsx`), e não
 * mais digitada pelo código interno.
 */
export function SeletorDeEscola({ escolaId }: { escolaId: string }) {
  const router = useRouter();

  return (
    <Card variant="elevated">
      <EscolhaDeEscola
        id="escola"
        valor={escolaId}
        aoEscolher={(alvo) => router.push(alvo ? `/analise?escolaId=${encodeURIComponent(alvo)}` : '/analise')}
      />
    </Card>
  );
}
