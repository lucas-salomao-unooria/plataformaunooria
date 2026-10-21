import { AlertBox } from "@edu/ui/ds";
import { BottomSheetUnv, ButtonUnv, SnackbarUnv } from "@edu/ui/ds-unoovista";
import { ESCOLA, GLOBAL } from "../lib/textos";
import type { AvisoDeConexao } from "./conexao";

/**
 * Os dois estados diegéticos globais — sem conexão e sessão expirada —, na voz
 * de QUEM ESTÁ FALANDO na tela em que eles acendem.
 *
 * - **No clone** (quase a missão inteira): a tarja "Sem conexão com a rede…
 *   Reconectando ao grêmio..." e, para a sessão, a folha modal do app com
 *   "Revalidar acesso". Nenhum "erro 401", nenhum "falha na API".
 * - **Na escola** (a reflexão e as telas finais): a mesma coisa pelo `AlertBox`
 *   da plataforma. A frase do clone fala de "marcações de posts" e do grêmio,
 *   que não existem ali — e a seção do clone dentro da tela da escola seria a
 *   mistura que a regra de ouro proíbe.
 *
 * A tarja de rede é o `Snackbar` do clone (DS 0.2.7): região VIVA sempre
 * montada — por isso ela não sai do `if` como a folha —, fora do fluxo e sem
 * bloquear, e a criança continua lendo o feed enquanto a chamada se repete. A de sessão é modal,
 * porque nada do que ela tocar vai funcionar até o token novo chegar — mas ela
 * não se fecha por ESC nem pelo véu: fechar sem revalidar deixaria a tela
 * aceitando toques que não vão a lugar nenhum.
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
