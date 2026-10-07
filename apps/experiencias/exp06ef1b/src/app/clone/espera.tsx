import { IconUnv } from "@edu/ui/ds-unoovista";
import { ESPERA } from "../../lib/textos";

/**
 * E4-ALU-01 — a plenária: o PICO da missão. **Exatamente três elementos**, e
 * nenhum a mais (a direção da jornada conta: o pico tem densidade menor que
 * todas as telas vizinhas):
 *
 * 1. o brasão da comissão (o selo do app, grande);
 * 2. a ordem da comissão — olhar para a projeção da sala;
 * 3. o pulso "Aguardando deliberação da mesa...".
 *
 * Sem barra do topo, sem abas, sem feed: tudo recua, porque o que importa
 * agora está na lousa (a dispersão de votos da turma). Nenhum botão leva de
 * volta — o voto está lacrado, e quem tira a criança daqui é o polling de 3 s
 * do gate, quando a professora libera a Galeria Oculta.
 *
 * O pulso é só opacidade, e para com `prefers-reduced-motion`.
 *
 * **A segunda espera** (`daRodada`, 2026-10-07) usa a mesma moldura de três
 * elementos: a revisão foi para a ata, e a comissão vai abrir a rodada de
 * desvio quando o professor der o sinal. Mesma tela de propósito — a criança já
 * conhece a espera, e o que muda é só a frase.
 */
export function Espera({ daRodada = false }: { daRodada?: boolean }) {
  return (
    <div className="tela plenaria" data-espera={daRodada ? "desvio" : "plenaria"}>
      <IconUnv name="verified" size={72} tone="link" title={ESPERA.brasao} className="plenaria__brasao" />
      <p className="plenaria__ordem" role="status">
        {daRodada ? ESPERA.novaRodada : ESPERA.plenaria}
      </p>
      <p className="plenaria__pulso" aria-hidden="true">
        {daRodada ? ESPERA.preparando : ESPERA.mesa}
      </p>
    </div>
  );
}
