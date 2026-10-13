"use client";

import { useCallback, useState } from "react";
import { PainelDeCustos } from "./painel-de-custos";
import { TabelaDePrecos } from "./tabela-de-precos";
import type { PainelDeCustos as Painel, PrecosDeIa } from "./tipos";

/**
 * A tela inteira de Custos de IA (ADR-161): o painel e a tabela de preços que
 * ele usa. Os dois moram juntos porque um preço gravado embaixo muda o custo
 * em cima — e a tela não pode mostrar a conta velha ao lado da tabela nova.
 */
export function TelaDeCustos({ painel, precos }: { painel: Painel; precos: PrecosDeIa | null }) {
  const [recalculos, setRecalculos] = useState(0);
  const aoGravar = useCallback(() => setRecalculos((n) => n + 1), []);
  return (
    <div className="flex flex-col gap-12">
      <PainelDeCustos inicial={painel} recalculos={recalculos} />
      {precos ? <TabelaDePrecos inicial={precos} aoGravar={aoGravar} /> : null}
    </div>
  );
}
