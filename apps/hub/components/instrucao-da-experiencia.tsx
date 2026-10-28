"use client";

import { Card, ScrollBar } from "@edu/ui/ds";
import type { InstrucaoDaExperiencia } from "@/lib/instrucao-da-experiencia";

/**
 * A instrução FORA do aparelho (`exp:estado { instrucao }`, contrato em
 * `lib/instrucao-da-experiencia.ts`): um aside ao lado do `DispositivoFrame` —
 * à direita, com 340px, em tela larga; acima do aparelho, em tela estreita.
 *
 * Carregada por dynamic import no `ExpHost`, como a `MolduraPerdidos`: o que
 * a experiência manda não precisa viajar no chunk da casca.
 *
 * É chrome do HUB (fora do iframe), então vale o DS da plataforma: `Card` e
 * `ScrollBar` (o texto é longo e, em tela estreita, não pode empurrar o
 * aparelho para fora). O destaque é só NEGRITO (`<strong>`): o marca-texto
 * amarelo de antes confundia o estudante (pedido do Lucas, 2026-10-28), e
 * negrito não pede compensação nenhuma do DS.
 */
export function InstrucaoDaExperiencia({ instrucao }: { instrucao: InstrucaoDaExperiencia }) {
  return (
    <aside
      aria-label="Instrução da missão"
      data-testid="instrucao-da-experiencia"
      className="flex min-h-0 shrink-0 flex-col px-4 pt-4 lg:w-[340px] lg:py-4 lg:pl-0 lg:pr-4"
    >
      <ScrollBar orientation="vertical" autoHide className="max-h-[35vh] lg:max-h-full">
        <Card variant="outlined">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            {instrucao.antes}
            {instrucao.destaque ? (
              <strong className="font-bold text-unooria-neutral-950">{instrucao.destaque}</strong>
            ) : null}
            {instrucao.depois}
          </p>
        </Card>
      </ScrollBar>
    </aside>
  );
}
