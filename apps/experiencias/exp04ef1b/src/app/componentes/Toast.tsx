import { Snackbar } from "@edu/ui/ds-unootube";

import type { Aparencia } from "../../lib/tema";

interface Props {
  mensagem: string;
  aparencia: Aparencia;
}

/**
 * Aviso transitório do app — o `Snackbar` da seção Unootube (0.1.17).
 *
 * Era uma das compensações locais desta experiência: a seção não publicava
 * toast e o `Snackbar` da plataforma não cabia, porque este aviso fala de
 * DENTRO da ficção ("Vídeo salvo!"), antes da revelação. Agora o clone tem o
 * seu, e a caixa à mão morreu junto com o CSS que a pintava.
 *
 * `duration={0}` porque quem conta o tempo é o orquestrador.
 *
 * O aviso longo COM AÇÃO ("playlist cheia" + "Abrir playlist") não existe mais:
 * bater no teto de 3 abre o `DialogoLimite`, onde a troca acontece. Um toast
 * que some em 5 s não era lugar para uma decisão.
 */
export function Toast({ mensagem, aparencia }: Props) {
  return (
    <Snackbar
      open
      floating
      duration={0}
      theme={aparencia === "escuro" ? "dark" : "light"}
      message={mensagem}
    />
  );
}
