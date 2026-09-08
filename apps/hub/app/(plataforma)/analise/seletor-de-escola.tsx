'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, TextField } from '@edu/ui/ds';

/**
 * Escolha da escola — peça NOVA no porte, não existia no origem.
 *
 * Lá o `analista` lia o banco inteiro. Aqui quem entra é `gestor_contrato`, a
 * única exceção cross-escola da regra 1, e ele viaja com `escolaId` VAZIO no
 * token: a api exige `?escolaId=` nas rotas de análise de produto
 * (`apps/api/src/analise/analise.controller.ts`). Mesma solução da gestão de
 * usuários — o id da escola é digitado —, com a diferença de que aqui ele vive
 * na URL, o que torna a comparação entre turmas um link compartilhável.
 */
export function SeletorDeEscola({ escolaId }: { escolaId: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(escolaId);

  return (
    <Card variant="elevated">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          const alvo = valor.trim();
          router.push(alvo ? `/analise?escolaId=${encodeURIComponent(alvo)}` : '/analise');
        }}
      >
        <div className="w-[320px] max-w-full">
          <TextField
            id="escola"
            label="Escola (id)"
            value={valor}
            onChange={(evento) => setValor(evento.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Abrir
        </Button>
      </form>
    </Card>
  );
}
