import Link from "next/link";

import { Card } from "@edu/ui/ds";
import type { MissaoDoEstudante } from "@/lib/missoes-do-estudante";

/**
 * Cartão de missão no hub do estudante.
 *
 * Nada de "aula", "plano" ou "professor" aqui — e nada que entregue a virada
 * da missão: a copy vem de `missao.estudante` (ou `missao.aluno`) no catálogo, escrita para ser lida
 * ANTES de jogar.
 */
export function CartaoMissaoEstudante({ missao }: { missao: MissaoDoEstudante }) {
  return (
    <Link href={missao.rota} className="block h-full">
      <Card variant="interactive" interactive className="h-full">
        <div className="flex h-full flex-col gap-3">
          <h2 className="text-[18px] font-bold leading-tight text-unooria-neutral-950">
            {missao.titulo}
          </h2>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
            {missao.chamada}
          </p>
          <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-unooria-navy-900">
            Começar
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2.5 7h9" />
              <path d="M7.75 3.25 11.5 7l-3.75 3.75" />
            </svg>
          </span>
        </div>
      </Card>
    </Link>
  );
}

export const CartaoMissaoAluno = CartaoMissaoEstudante;
