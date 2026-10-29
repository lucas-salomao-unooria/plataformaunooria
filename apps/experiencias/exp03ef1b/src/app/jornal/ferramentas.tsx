import { ButtonUjn } from "@edu/ui/ds-unoojornal";
import type { FerramentaPublica } from "../../lib/tipos";
import { E6 } from "../../lib/textos";

/**
 * As três ferramentas do caso novo (E6-ALU-01): "Filtrar por campo", "Olhar
 * as fotos", "Comparar fontes" — ferramentas do JORNAL, então `ButtonUjn`.
 * O retorno é o NEUTRO que a api manda (não é gabarito). O quadro em volta é
 * (b) COMPENSAÇÃO — sem par no DS: fio e recuo com tokens `--ujn-*`
 * (`.quadro-jornal`).
 */
export function FerramentasDoCaso({
  tema,
  ferramentas,
  usada,
  aoUsar,
}: {
  tema: string;
  ferramentas: readonly FerramentaPublica[];
  usada: FerramentaPublica | null;
  aoUsar: (f: FerramentaPublica) => void;
}) {
  return (
    <section className="quadro-jornal ferramentas" aria-label={E6.ferramentas}>
      <h2 className="ferramentas__tema">{tema}</h2>
      <div className="ferramentas__botoes">
        {ferramentas.map((f) => (
          <ButtonUjn
            key={f.id}
            variant={usada?.id === f.id ? "primary" : "secondary"}
            size="lg"
            aria-pressed={usada?.id === f.id}
            onClick={() => aoUsar(f)}
            className="alvo-64"
          >
            {f.rotulo}
          </ButtonUjn>
        ))}
      </div>
      <p className="ferramentas__retorno" aria-live="polite">
        {usada ? <span>{usada.retorno}</span> : null}
        {usada?.aviso ? <strong>{usada.aviso}</strong> : null}
      </p>
    </section>
  );
}
