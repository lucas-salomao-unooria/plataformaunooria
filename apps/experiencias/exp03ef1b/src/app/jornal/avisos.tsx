import { Toast } from "@edu/ui/ds-unoojornal";
import { GLOBAL } from "../../lib/textos";

/**
 * E3-SIS-02 — o aviso NÃO bloqueante de sem sinal, na voz do jornal
 * ("Sem sinal. Anotações salvas na mesa."), no topo, com "Reconectar". A
 * região viva do `Toast` existe sempre (o leitor de tela anuncia). Não fecha
 * sozinho: some quando a chamada repetida passa.
 */
export function AvisoDeConexao({ aviso, aoReconectar }: { aviso: "rede" | "sessao" | null; aoReconectar: () => void }) {
  return (
    <Toast
      open={aviso !== null}
      position="top"
      duration={0}
      showClose={false}
      icon={aviso === "sessao" ? "lock" : "signal"}
      message={aviso === "sessao" ? GLOBAL.sessao : GLOBAL.semSinal}
      actionLabel={GLOBAL.reconectar}
      onAction={aoReconectar}
    />
  );
}
