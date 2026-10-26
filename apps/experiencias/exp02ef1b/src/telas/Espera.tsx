import { IconUnv } from "@edu/ui/ds-unoovista";
import { Dupla } from "../componentes/Personagem";
import { ROTULOS } from "../lib/textos";

/**
 * Sem pacote no ar (`preparada: false`): a missão nasce vazia até o professor
 * escolher a atividade (banco padrão, pacote pronto ou a cena da IA). A
 * criança vê o estúdio da Rádio e o cadeado; o polling de 3 s do gate a tira
 * daqui sozinho quando o professor põe a atividade no ar.
 */
export function Espera() {
  return (
    <section className="espera" aria-live="polite">
      <IconUnv name="lock" size="lg" tone="secondary" />
      <p className="espera__titulo">{ROTULOS.semAtividade}</p>
      <Dupla />
    </section>
  );
}
