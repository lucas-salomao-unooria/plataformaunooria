"use client";

import { PositiveNegativeBarChart } from "@edu/ui/ds";

/**
 * Os dois eixos do circumplexo de Schwartz, em barra divergente.
 *
 * ## Por que o `PositiveNegativeBarChart` do DS serve aqui
 *
 * O repositório de origem escrevia esta barra À MÃO, com o argumento de que o
 * componente do DS normalizaria cada eixo pelo próprio valor — e aí um 0,10
 * pareceria tão forte quanto um 0,80. **Isso deixou de ser verdade na 0.1.11**:
 * a altura da barra é `(val / 100) * 110`, escala FIXA em ±100 nos dois lados,
 * com a linha do zero no centro do plot. É exatamente o que estes eixos pedem.
 * Por isso o componente entra, em vez de mais SVG à mão.
 *
 * Os valores chegam de −1 a +1 e vão ×100 para a escala do componente; os
 * rótulos do eixo Y são sobrescritos para mostrar a unidade real.
 *
 * ## O eixo NULO não é zero
 *
 * Eixo com um polo não observado é **indefinido**, não neutro. Ele não vira
 * barra: some do gráfico e é dito com todas as letras embaixo. Desenhar zero ali
 * afirmaria equilíbrio entre dois polos, quando um deles nunca foi medido.
 */
export function EixosDoCircumplexo({
  aberturaVsConservacao,
  transcendenciaVsAutopromocao,
}: {
  aberturaVsConservacao: number | null;
  transcendenciaVsAutopromocao: number | null;
}) {
  const eixos = [
    {
      chave: "ac",
      rotulo: "Abertura × Conservação",
      valor: aberturaVsConservacao,
      positivo: "Abertura à mudança",
      negativo: "Conservação",
    },
    {
      chave: "ta",
      rotulo: "Transcendência × Autopromoção",
      valor: transcendenciaVsAutopromocao,
      positivo: "Autotranscendência",
      negativo: "Autopromoção",
    },
  ];

  const comValor = eixos.filter(
    (e): e is typeof e & { valor: number } => typeof e.valor === "number",
  );
  const indefinidos = eixos.filter((e) => e.valor === null);

  return (
    <div className="flex flex-col gap-3">
      {comValor.length > 0 ? (
        <PositiveNegativeBarChart
          title="Eixos do circumplexo"
          subtitle="escala fixa de −1,00 a +1,00 · acima da linha = o primeiro polo, abaixo = o segundo"
          data={comValor.map((e) => ({
            label: e.rotulo,
            positiveValues: e.valor > 0 ? [Math.round(e.valor * 100)] : [],
            negativeValues: e.valor < 0 ? [Math.round(Math.abs(e.valor) * 100)] : [],
          }))}
          yAxisLabels={["+1,00", "+0,50", "0", "−0,50", "−1,00"]}
          height={240}
        />
      ) : null}

      <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-unooria-neutral-700">
        {comValor.map((e) => (
          <li key={e.chave}>
            <strong>{e.rotulo}:</strong>{" "}
            {e.valor === 0
              ? "os dois polos apareceram na mesma medida."
              : `inclina para ${e.valor > 0 ? e.positivo : e.negativo} (${Math.abs(e.valor)
                  .toFixed(2)
                  .replace(".", ",")} de 1,00).`}
          </li>
        ))}
        {indefinidos.map((e) => (
          <li key={e.chave} className="text-unooria-neutral-500">
            <strong>{e.rotulo}:</strong> indefinido nesta partida — um dos dois lados não foi
            observado. Eixo com polo não observado não é zero.
          </li>
        ))}
      </ul>
    </div>
  );
}
