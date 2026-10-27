import type { ReactNode } from "react";
import { InlineHint, LogoUnv, TopBar } from "@edu/ui/ds-unoovista";
import { TEXTOS } from "../lib/textos";

/**
 * O cromo do Unoovista em toda tela da missão: a barra superior com o
 * logotipo. A faixa "SEM SINAL NA RÁDIO" (one-pager §8) é
 * o `InlineHint` de atrito, sob a barra — discreta, sem cobrir a tela.
 *
 * `withStatusBarInset={false}`: dentro do iframe não há barra de status do
 * aparelho para reservar — quem desenha o aparelho é o hub (como na exp08ef1b).
 */
export function Casca({
  semSinal,
  children,
  rodape,
}: {
  semSinal: boolean;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="casca">
      <TopBar withStatusBarInset={false} title={<LogoUnv height={24} title="Unoovista" />} />
      {semSinal ? (
        <InlineHint tone="friction" announce className="casca__sem-sinal">
          {TEXTOS.erros.semSinal}
        </InlineHint>
      ) : null}
      <main className="casca__conteudo">{children}</main>
      {rodape ? <div className="casca__rodape">{rodape}</div> : null}
    </div>
  );
}
