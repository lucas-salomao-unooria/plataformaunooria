import { Icon } from "@edu/ui/ds-whatsapp";
import type { Materia } from "../../lib/tipos";

/**
 * O par que sustenta o Aha: o print que circulou e a reportagem íntegra.
 *
 * **Os dois são o MESMO componente**, com recortes diferentes — e é isso que
 * torna o par casado por construção. Manchete, marca do portal, data e
 * tipografia não podem divergir entre eles: se divergirem, a criança compara
 * duas páginas parecidas em vez de descobrir que uma é pedaço da outra.
 *
 * **Layout em HTML, foto por IA.** Modelo de imagem erra texto longo, e o
 * parágrafo suprimido precisa ser legível, selecionável por leitor de tela e
 * com contraste medido. A foto — a única parte que a IA faz bem — é a cena; e
 * a do print é literalmente um recorte da foto da reportagem, feito no
 * servidor com a mesma matemática que qualquer pessoa faria com o dedo.
 */

function Foto({ url, alt, className }: { url: string | null; alt: string; className: string }) {
  // Sem mídia preparada, ilustração procedural — nunca uma caixa vazia, que o
  // estudante lê como "quebrou" e não como "não tem".
  if (!url) return <div className="sem-foto">foto da praça · imagem indisponível</div>;
  return <img src={url} alt={alt} className={className} />;
}

/** O print encaminhado, como ele aparece dentro do balão do grupo. */
export function PrintDoGrupo({
  materia,
  url,
  aoTocar,
}: {
  materia: Materia;
  url: string | null;
  aoTocar: () => void;
}) {
  return (
    <button
      type="button"
      className="print"
      onClick={aoTocar}
      aria-label="Abrir a matéria completa"
      style={{ padding: 0, border: "1px solid var(--wa-color-surface-elevated)", background: "none", cursor: "pointer", display: "block" }}
    >
      <Foto url={url} alt="Viatura da polícia e movimento na praça" className="print__foto" />
      <div className="print__manchete">
        <div className="print__marca">Gazeta Regional</div>
        {materia.manchetePrint}
      </div>
    </button>
  );
}

/**
 * A reportagem íntegra, em tela cheia.
 *
 * O trecho suprimido vai isolado e em alto contraste, sem nenhum texto
 * explicativo ao lado — não-negociável de ofício. A comparação tem de ser
 * autoevidente: é a criança que percebe o corte, não uma legenda que o aponta.
 */
export function ReportagemCompleta({
  materia,
  url,
  aoFechar,
}: {
  materia: Materia;
  url: string | null;
  aoFechar: () => void;
}) {
  return (
    <div className="app" style={{ background: "#fbfbf7" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          background: "var(--wa-color-surface-appbar)",
        }}
      >
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          style={{ border: 0, background: "none", color: "var(--wa-color-text-appbar)", cursor: "pointer", display: "grid", placeItems: "center" }}
        >
          <Icon name="back" tone="appbar" size="md" />
        </button>
        <span style={{ fontSize: 12, color: "var(--wa-color-text-appbar)", fontFamily: "var(--wa-font-sans)" }}>
          {materia.fonte}
        </span>
      </div>

      <div className="app__corpo">
        <article className="jornal">
          <div className="jornal__marca">Gazeta Regional</div>
          <div className="jornal__meta">{materia.fonte}</div>
          <h1 className="jornal__titulo">{materia.titulo}</h1>
          <Foto
            url={url}
            alt="A praça durante a feira cultural, com a viatura orientando o trânsito ao lado"
            className="jornal__foto"
          />
          <p className="jornal__paragrafo">{materia.paragrafoExibido}</p>
          <p className="jornal__suprimido">{materia.paragrafoSuprimido}</p>
        </article>
      </div>
    </div>
  );
}
