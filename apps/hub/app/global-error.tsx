"use client";
import { useEffect } from "react";
import { TelaDeErro } from "@/components/tela-de-erro";
import { instalarCapturaDoHub } from "@/lib/erros-do-hub";

/**
 * Fronteira do próprio layout raiz. Substitui o `<html>` inteiro quando o
 * erro acontece nele — por isso precisa desenhar `html`/`body`, e por isso a
 * `TelaDeErro` carrega o CSS do DS por conta própria.
 */
export default function ErroGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => instalarCapturaDoHub().reportar(error), [error]);
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>
        <TelaDeErro digest={error.digest} aoTentarDeNovo={reset} />
      </body>
    </html>
  );
}
