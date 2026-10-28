import { E5, NINA } from "../../lib/textos";
import { Cabecalho } from "../jornal/cabecalho";
import { AcaoDaMissao } from "../mecanica/acoes";
import { PainelCentral } from "../mecanica/painel-central";
import { Casca } from "./casca";

/** E5-ALU-00 — a ponte da Nina (fala literal do sheet) para a rotina automática. */
export function TelaDaPonte({ ocupado, aoContinuar }: { ocupado: boolean; aoContinuar: () => void }) {
  return (
    <Casca topo={<Cabecalho />} corpo="casca__corpo--centro">
      <PainelCentral
        comNina
        titulo={NINA.ponte}
        texto={NINA.ponteApoio}
        acao={
          <AcaoDaMissao ocupado={ocupado} aoTocar={aoContinuar}>
            {E5.continuar}
          </AcaoDaMissao>
        }
      />
    </Casca>
  );
}
