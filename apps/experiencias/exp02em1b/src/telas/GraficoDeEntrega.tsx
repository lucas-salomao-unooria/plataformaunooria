/**
 * As impressões do post por faixa de horário — a MESMA curva para toda a turma
 * (o incentivo é da rede, não do texto). COMPENSAÇÃO MARCADA: a seção
 * `unoovista` não publica gráfico (o `BarChart` do DS é da seção `unooria`, e a
 * plataforma não entra no clone). Barras em CSS sobre os tokens do Unoovista; o
 * número de cada barra vai em texto, para leitor de tela. O pico é a maior faixa.
 */
const NUMERO = new Intl.NumberFormat("pt-BR");

export function GraficoDeEntrega({ entrega, titulo }: { entrega: { faixa: string; impressoes: number }[]; titulo: string }) {
  const maior = Math.max(1, ...entrega.map((e) => e.impressoes));
  return (
    <figure className="grafico">
      <figcaption className="grafico__titulo">{titulo}</figcaption>
      <ul className="grafico__barras">
        {entrega.map((e) => (
          <li key={e.faixa} className={`grafico__linha${e.impressoes === maior ? " grafico__linha--pico" : ""}`}>
            <span className="grafico__faixa">{e.faixa}</span>
            <span className="grafico__trilho" aria-hidden="true">
              <span className="grafico__barra" style={{ width: `${(e.impressoes / maior) * 100}%` }} />
            </span>
            <span className="grafico__valor">{NUMERO.format(e.impressoes)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
