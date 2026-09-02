"use client";
import { instalarCapturaDeErros, type ErroDeCliente } from "@edu/sdk";

/**
 * Captura de erro de CLIENTE do hub (ADR-58), reaproveitando a função da SDK:
 * mesmo dedupe, mesmo teto por sessão. A diferença é o caminho — o client do
 * hub não tem bearer, então posta pelo BFF (`/api/plataforma/observabilidade/
 * erros-cliente`), que assina o token da sessão. Sem sessão (landing, login) o
 * BFF responde 401 e o erro fica só no console: aceito, é a superfície pública.
 *
 * `NEXT_PUBLIC_HUB_VERSAO` é o SHA do build, inlinado (ARG do Dockerfile) — a
 * "versão" pela qual o Error Reporting agrupa os erros do hub no navegador.
 */
export const HUB_VERSAO = process.env.NEXT_PUBLIC_HUB_VERSAO ?? "dev";

function sessaoDoNavegador(): string {
  try {
    const chave = "unooria.sessao-obs";
    const atual = sessionStorage.getItem(chave);
    if (atual) return atual;
    const nova = crypto.randomUUID();
    sessionStorage.setItem(chave, nova);
    return nova;
  } catch {
    return crypto.randomUUID();
  }
}

export async function enviarErroDoHub(erro: ErroDeCliente): Promise<unknown> {
  return fetch("/api/plataforma/observabilidade/erros-cliente", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(erro),
    keepalive: true,
  });
}

const registro = globalThis as { __capturaDoHub?: ReturnType<typeof instalarCapturaDeErros> };

/** Idempotente: o Next avalia `instrumentation-client.ts` uma vez, mas o HMR em dev pode reavaliar. */
export function instalarCapturaDoHub(): ReturnType<typeof instalarCapturaDeErros> {
  if (registro.__capturaDoHub) return registro.__capturaDoHub;
  registro.__capturaDoHub = instalarCapturaDeErros({
    expId: "hub",
    versao: HUB_VERSAO,
    sessaoId: sessaoDoNavegador(),
    enviar: enviarErroDoHub,
  });
  return registro.__capturaDoHub;
}
