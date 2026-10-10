import { BadgeUnv, IconUnv, TopBar } from "@edu/ui/ds-unoovista";
import { CONTAS, E2 } from "../../lib/textos";

/**
 * A barra do topo do Unoovista em toda tela do clone (E2-ALU-01): a marca
 * "Unoovista" e, à direita, o crachá fixo `@jurado_oficial` — o `BadgeUnv` com
 * o selo de conta oficial, texto e ícone (a marca não depende só do glifo).
 *
 * `withStatusBarInset={false}`: o aparelho é do hub e não desenha status bar.
 */
export function Cabecalho() {
  return (
    <TopBar
      title={E2.marca}
      withStatusBarInset={false}
      trailing={
        <BadgeUnv variant="neutral" className="cabecalho__cracha">
          <IconUnv name="verified" size="sm" tone="link" /> {CONTAS.jurado}
        </BadgeUnv>
      }
    />
  );
}
