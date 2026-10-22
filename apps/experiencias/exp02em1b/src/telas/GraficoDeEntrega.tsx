/**
 * A curva de entrega do post por faixa de horário — a MESMA para toda a turma
 * (o incentivo é da rede, não do texto). Barras em CSS sobre os tokens do
 * Unoovista: o DS da seção não publica gráfico (compensação declarada), e o
 * número de cada barra vai em texto para leitor de tela.
 */
export function GraficoDeEntrega({
  entrega,
  titulo,
  destaque,
}: {
  entrega: { faixa: string; percentual: number }[];
  titulo: string;
  destaque?: string;
}) {
  const maior = Math.max(1, ...entrega.map((e) => e.percentual));
  return (
    <figure className="grafico">
      <figcaption className="grafico__titulo">{titulo}</figcaption>
      <ul className="grafico__barras">
        {entrega.map((e) => (
          <li key={e.faixa} className={`grafico__linha${destaque === e.faixa || e.percentual === maior ? " grafico__linha--pico" : ""}`}>
            <span className="grafico__faixa">{e.faixa}</span>
            <span className="grafico__trilho" aria-hidden="true">
              <span className="grafico__barra" style={{ width: `${(e.percentual / maior) * 100}%` }} />
            </span>
            <span className="grafico__valor">{e.percentual}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
