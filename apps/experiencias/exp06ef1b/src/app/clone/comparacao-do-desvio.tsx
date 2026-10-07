import { BadgeUnv, ListItem } from "@edu/ui/ds-unoovista";
import { DESVIO } from "../../lib/textos";
import type { Categoria, Desvio } from "../../lib/tipos";

/**
 * O fim da RODADA DE DESVIO: quantas publicações de cada área o feed do júri
 * trouxe, e quantas esta rodada trouxe. É o EFEITO, na voz da comissão — a
 * regra que o produziu não aparece aqui (quem a nomeia é a cadeia, a seguir), e
 * a api nem a manda (`DesvioSchema.comparacao` só tem contagens).
 *
 * `ListItem` do DS (a linha) e `BadgeUnv` (o número desta rodada): nada aqui
 * desenha controle, e a linha não é clicável.
 */
export function ComparacaoDoDesvio({
  comparacao,
  categorias,
}: {
  comparacao: NonNullable<Desvio["comparacao"]>;
  categorias: readonly Categoria[];
}) {
  const nome = new Map(categorias.map((c) => [c.area, c.nome]));
  return (
    <section className="comparacao-do-desvio" aria-label={DESVIO.grupoDaComparacao} data-comparacao="desvio">
      <p className="comparacao-do-desvio__titulo">{DESVIO.comparacaoTitulo}</p>
      {comparacao.map((c) => (
        <ListItem
          key={c.area}
          className="comparacao-do-desvio__linha"
          data-area={c.area}
          title={nome.get(c.area) ?? c.area}
          subtitle={DESVIO.noFeed(c.noFeed)}
          trailing={
            <BadgeUnv variant={c.noDesvio > 0 ? "counter" : "neutral"} wrap>
              {DESVIO.nestaRodada(c.noDesvio)}
            </BadgeUnv>
          }
        />
      ))}
    </section>
  );
}
