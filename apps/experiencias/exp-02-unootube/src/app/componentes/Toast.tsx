import { Snackbar } from "@edu/ui/ds-unootube";

import type { Aparencia } from "../../lib/tema";

interface Props {
  mensagem: string;
  cheio: boolean;
  aparencia: Aparencia;
  aoAbrirPlaylist: () => void;
}

/**
 * Aviso transitório do app — o `Snackbar` da seção Unootube (0.1.17).
 *
 * Era uma das compensações locais desta experiência: a seção não publicava
 * toast e o `Snackbar` da plataforma não cabia, porque este aviso fala de
 * DENTRO da ficção ("Vídeo salvo!"), antes da revelação. Agora o clone tem o
 * seu, e a caixa à mão morreu junto com o CSS que a pintava.
 *
 * `duration={0}` porque quem conta o tempo é o orquestrador — ele distingue o
 * aviso curto do longo (o de playlist cheia fica mais tempo e traz ação).
 */
export function Toast({ mensagem, cheio, aparencia, aoAbrirPlaylist }: Props) {
  return (
    <Snackbar
      open
      floating
      duration={0}
      theme={aparencia === "escuro" ? "dark" : "light"}
      message={mensagem}
      actionLabel={cheio ? "Abrir playlist" : undefined}
      onAction={cheio ? aoAbrirPlaylist : undefined}
    />
  );
}
