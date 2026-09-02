"use client";
import { TelaDeErro } from "@/components/tela-de-erro";

/**
 * Fronteira do próprio layout raiz. Substitui o `<html>` inteiro quando o
 * erro acontece nele — por isso precisa desenhar `html`/`body`, e por isso a
 * `TelaDeErro` carrega o CSS do DS por conta própria.
 */
export default function ErroGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>
        <TelaDeErro digest={error.digest} aoTentarDeNovo={reset} />
      </body>
    </html>
  );
}
