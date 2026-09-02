"use client";
import { useEffect } from "react";
import { TelaDeErro } from "@/components/tela-de-erro";
import { instalarCapturaDoHub } from "@/lib/erros-do-hub";

/**
 * Fronteira de erro de TODA página abaixo do layout raiz (a landing, o login,
 * `(plataforma)/**` e `/exp/**`). Antes não existia: um `throw` num server
 * component mostrava a tela padrão do Next, sem código nenhum para a pessoa
 * relatar. O registro do erro é do `onRequestError` em `instrumentation.ts`.
 */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Erro de render no CLIENTE não passa pelo `onRequestError` do servidor:
  // reporta pelo mesmo caminho do `window.onerror` (dedupe, teto por sessão).
  useEffect(() => instalarCapturaDoHub().reportar(error), [error]);
  return <TelaDeErro digest={error.digest} aoTentarDeNovo={reset} />;
}
