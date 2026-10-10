import { IconUnv } from "@edu/ui/ds-unoovista";
import { E3 } from "../../lib/textos";
import { Cabecalho } from "./cabecalho";

/**
 * E3-ALU-02 — o voto lacrado e a espera (`lacrada`, `E3_LATCH_ESPERA`): o
 * carimbo com o protocolo e a linha da comissão, e nada mais. Sem abas, sem
 * feed: o voto está lacrado, e o que importa agora está na lousa (a dispersão
 * de votos da turma). Nenhum botão leva de volta — quem tira a criança daqui é
 * o polling de 3 s do gate, quando o professor libera a auditoria.
 *
 * O protocolo é ficção estável (`regras.ts#protocoloDoVoto`): o mesmo num F5.
 * O pulso é só opacidade, e para com `prefers-reduced-motion`.
 */
export function Espera({ protocolo }: { protocolo: string | null }) {
  return (
    <div className="tela">
      <Cabecalho />
      <div className="plenaria">
        <IconUnv name="lock" size={72} tone="link" title={E3.brasao} className="plenaria__brasao" />
        {protocolo && <h1 className="plenaria__carimbo">{E3.carimbo(protocolo)}</h1>}
        <p className="plenaria__ordem plenaria__pulso" role="status">
          {E3.espera}
        </p>
      </div>
    </div>
  );
}
