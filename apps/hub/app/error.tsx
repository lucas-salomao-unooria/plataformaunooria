"use client";
import { TelaDeErro } from "@/components/tela-de-erro";

/**
 * Fronteira de erro de TODA página abaixo do layout raiz (a landing, o login,
 * `(plataforma)/**` e `/exp/**`). Antes não existia: um `throw` num server
 * component mostrava a tela padrão do Next, sem código nenhum para a pessoa
 * relatar. O registro do erro é do `onRequestError` em `instrumentation.ts`.
 */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <TelaDeErro digest={error.digest} aoTentarDeNovo={reset} />;
}
