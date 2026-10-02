import { AlertBox } from "@edu/ui/ds";
import { BottomSheetUnv, ButtonUnv, SnackbarUnv } from "@edu/ui/ds-unoovista";
import { ESCOLA, GLOBAL } from "../lib/textos";
import type { AvisoDeConexao } from "./conexao";

/**
 * Os dois estados diegéticos globais — sem conexão e credencial expirada —, na
 * voz de QUEM ESTÁ FALANDO na tela em que eles acendem. Molde:
 * `exp07ef1b/src/app/avisos.tsx`.
 *
 * - **No clone** (quase a missão inteira): a tarja "Tentando reconectar aos
 *   servidores da Mostra Estadual..." e, para a sessão, a folha modal do app com
 *   "Revalidar credencial". Nenhum "erro 401", nenhum "falha na API".
 * - **Na escola** (os pacotes e a cadeia): a mesma coisa pelo `AlertBox` da
 *   plataforma, com copy própria — a do clone fala da comissão, que não está
 *   falando ali, e a seção do clone dentro da tela da escola seria a mistura que
 *   a regra de ouro proíbe.
 *
 * A tarja de rede é o `Snackbar` do clone: região VIVA sempre montada (o leitor
 * de tela anuncia), fora do fluxo e sem bloquear. A de sessão é modal, e não se
 * fecha por ESC nem pelo véu: fechar sem revalidar deixaria a tela aceitando
 * toques que não vão a lugar nenhum.
 */
export function Avisos({
  aviso,
  voz,
  aoRevalidar,
}: {
  aviso: AvisoDeConexao;
  voz: "clone" | "escola";
  aoRevalidar: () => void;
}) {
  if (voz === "escola") {
    if (!aviso) return null;
    return (
      <div className="aviso-da-escola">
        <AlertBox
          variant="warning"
          theme="light"
          device="mobile"
          title={aviso === "rede" ? ESCOLA.offline : ESCOLA.sessao}
          primaryAction={{ label: ESCOLA.tentarNovamente, onClick: aoRevalidar }}
        />
      </div>
    );
  }

  return (
    <>
      <SnackbarUnv open={aviso === "rede"} message={GLOBAL.offline} />
      {aviso === "sessao" ? (
        <BottomSheetUnv open modal title={GLOBAL.sessaoExpirada} onOpenChange={() => undefined}>
          <ButtonUnv variant="primary" size="lg" block onClick={aoRevalidar}>
            {GLOBAL.revalidar}
          </ButtonUnv>
        </BottomSheetUnv>
      ) : null}
    </>
  );
}
