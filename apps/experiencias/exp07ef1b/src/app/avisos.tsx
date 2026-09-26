import { AlertBox } from "@edu/ui/ds";
import { BottomSheet, ButtonInsta } from "@edu/ui/ds-insta";
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
 * A tarja de rede é região VIVA (`role="status"`) e não bloqueia: a criança
 * continua lendo o feed enquanto a chamada se repete. A de sessão é modal,
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
  if (!aviso) return null;

  if (voz === "escola") {
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

  if (aviso === "rede") {
    return (
      <p className="aviso-de-conexao" role="status">
        {GLOBAL.offline}
      </p>
    );
  }

  return (
    <BottomSheet open modal title={GLOBAL.sessaoExpirada} onOpenChange={() => undefined}>
      <ButtonInsta variant="primary" size="lg" block onClick={aoRevalidar}>
        {GLOBAL.revalidar}
      </ButtonInsta>
    </BottomSheet>
  );
}
