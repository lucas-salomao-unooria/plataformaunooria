import { CABECALHO, E4, NINA, ROTULO_DO_VALOR } from "../../lib/textos";
import type { Desfecho, ReportagemPublica } from "../../lib/tipos";
import { enderecoDaImagem } from "../comum/midia";
import { AcaoDoJornal } from "../jornal/acoes";
import { Cabecalho } from "../jornal/cabecalho";
import { CartaoDaReportagem } from "../jornal/reportagem";
import { PainelDeAviso } from "../mecanica/aviso";
import { FalaDaNina } from "../mecanica/nina";
import { Casca } from "./casca";

/**
 * E4-ALU-04 (sucesso) e E4-ALU-05 (erro explicado) — o desfecho que o
 * SERVIDOR decidiu no Concluir. Os dois com "Continuar", nunca "Tentar de
 * novo" (spec §7.6): no erro, a explicação acolhedora e a prévia das três
 * notícias completas, com o telão tracejado "Pátio (correto)".
 */
export function TelaDoDesfecho({
  desfecho,
  reportagens,
  ocupado,
  aoContinuar,
}: {
  desfecho: Desfecho;
  reportagens: readonly ReportagemPublica[];
  ocupado: boolean;
  aoContinuar: () => void;
}) {
  const sucesso = desfecho === "sucesso";
  return (
    <Casca
      topo={<Cabecalho direita={sucesso ? CABECALHO.fichaCorrigida : undefined} destaque={sucesso} />}
      acoes={
        <AcaoDoJornal desabilitado={ocupado} aoTocar={aoContinuar}>
          {E4.continuar}
        </AcaoDoJornal>
      }
    >
      <FalaDaNina fala={sucesso ? NINA.sucesso : NINA.erro} />
      {sucesso ? null : <PainelDeAviso titulo={E4.previa} texto={E4.previaApoio} />}
      <div className={`grade-de-tres${sucesso ? " grade-de-tres--alta" : ""}`}>
        {reportagens.map((r) => {
          const telao = r.suporte === "telao";
          return (
            <CartaoDaReportagem
              key={r.id}
              imagem={enderecoDaImagem(r.imagem, r.suporte)}
              alt={r.imagem.alt}
              kicker={r.kicker}
              manchete={r.manchete}
              lugar={telao && !sucesso ? E4.correto : ROTULO_DO_VALOR.patio}
              selo={telao && sucesso ? E4.recuperada : undefined}
              moldura={sucesso ? "forte" : telao ? "tracejada" : undefined}
            />
          );
        })}
      </div>
    </Casca>
  );
}
