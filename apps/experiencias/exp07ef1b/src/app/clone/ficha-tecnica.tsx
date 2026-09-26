import { BadgeInsta, BottomSheet } from "@edu/ui/ds-insta";
import { telemetria } from "../../lib/telemetria";
import { FICHA } from "../../lib/textos-da-ficha";
import type { Equilibrio, FichaDoPost, Lente } from "../../lib/tipos";

const LENTES: Lente[] = ["institucional", "comunitario", "estatistico"];

/**
 * A "Ficha Técnica da Curadoria" sobre o Story (E4-ALU-02) — a revelação.
 *
 * Chega por `React.lazy` (`mural.tsx`): este arquivo, e a copy dele, só descem
 * quando a professora acende as fichas.
 *
 * A folha é NÃO modal (`BottomSheet` com `modal={false}`, 45% da altura): o
 * Story continua tocável por baixo, e a criança pode trocar de post e de
 * publicação com a ficha aberta — a ficha acompanha o post atual. Ela nasce
 * ABERTA (é o acendimento remoto que a jornada descreve) e pode ser recolhida.
 */
export default function FichaTecnica({
  aberta,
  ficha,
  minha,
  par,
  rotuloDaMinha,
  rotuloDoPar,
  aoMudar,
}: {
  aberta: boolean;
  ficha: FichaDoPost | null;
  minha: Equilibrio | null;
  par: Equilibrio | null;
  rotuloDaMinha: string;
  rotuloDoPar: string;
  aoMudar: (aberta: boolean) => void;
}) {
  return (
    <BottomSheet
      modal={false}
      theme="dark"
      open={aberta}
      onOpenChange={(nova) => {
        aoMudar(nova);
        telemetria.mexeuNaFicha(nova);
      }}
      maxHeight="45%"
      collapsedLabel={FICHA.verDetalhes}
      title={FICHA.titulo}
    >
      <div className="ficha">
        {ficha && (
          <div className="ficha__tags">
            <BadgeInsta variant="neutral" theme="dark">
              {FICHA.fonte(ficha.fonte)}
            </BadgeInsta>
            <BadgeInsta variant="neutral" theme="dark">
              {FICHA.angulo(ficha.angulo)}
            </BadgeInsta>
          </div>
        )}
        <h2 className="ficha__titulo">{FICHA.equilibrio}</h2>
        <BarrasDoEquilibrio rotulo={rotuloDaMinha} equilibrio={minha} />
        <BarrasDoEquilibrio rotulo={rotuloDoPar} equilibrio={par} />
        <p className="ficha__espera">{FICHA.esperaEtapa5}</p>
      </div>
    </BottomSheet>
  );
}

/**
 * O "Equilíbrio editorial da seleção" de uma tríade, em três barras — o PRD
 * permite barras no lugar do radar, e barra se lê com o número ao lado, que é
 * o que a sala discute.
 *
 * NÃO é compensação de componente, e não virou pedido ao `storybook-unooria`:
 * o Instagram não desenha gráfico, e a ficha técnica é a extensão da ficção
 * que a missão acrescenta ao app (o mesmo argumento do mini-infográfico da
 * exp05ef1b). O `DataViz` da plataforma está fora: seria a seção `unooria`
 * dentro do clone. A leitura é por TEXTO ("Institucional 67%"); a barra é
 * redundância visual, escondida do leitor de tela.
 */
function BarrasDoEquilibrio({ rotulo, equilibrio }: { rotulo: string; equilibrio: Equilibrio | null }) {
  if (!equilibrio) return null;
  return (
    <div className="equilibrio">
      <p className="equilibrio__rotulo">{rotulo}</p>
      <ul className="equilibrio__lista">
        {LENTES.map((lente) => (
          <li key={lente} className="equilibrio__linha">
            <span className="equilibrio__nome">{FICHA.lentes[lente]}</span>
            <span className="equilibrio__trilha" aria-hidden="true">
              <span className="equilibrio__barra" style={{ width: `${Math.max(0, Math.min(100, equilibrio[lente]))}%` }} />
            </span>
            <span className="equilibrio__valor">{equilibrio[lente]}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
