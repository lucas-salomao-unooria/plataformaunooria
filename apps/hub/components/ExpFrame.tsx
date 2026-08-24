"use client";
import { useEffect, useRef } from "react";

/**
 * Host do iframe: responde ao handshake da SDK (exp:ready → hub:init),
 * renova token (exp:token-expirando → hub:token) e recebe exp:concluir.
 * REGRA: targetOrigin sempre explícito (origin da CDN), nunca "*".
 */
export function ExpFrame(props: {
  src: string;
  expOrigin: string;
  token: string;
  aluno: { id: string; nome: string; serie: string; turmaId: string; escolaId: string };
  apiUrl: string;
  config?: Record<string, unknown>;
  onConcluir?: (payload: unknown) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.origin !== props.expOrigin) return;
      const type = (ev.data as { type?: string })?.type;
      const w = frame.current?.contentWindow;
      if (!w) return;
      if (type === "exp:ready") {
        w.postMessage(
          { type: "hub:init", protocolVersion: 1, token: props.token,
            aluno: props.aluno, apiUrl: props.apiUrl, config: props.config ?? {} },
          props.expOrigin,
        );
      }
      if (type === "exp:token-expirando") {
        // TODO: buscar token renovado da sessão (rota /api/token) antes de reenviar
        w.postMessage({ type: "hub:token", token: props.token }, props.expOrigin);
      }
      if (type === "exp:concluir") props.onConcluir?.((ev.data as { payload?: unknown }).payload);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [props]);

  return (
    <iframe ref={frame} src={props.src} title="experiencia"
      style={{ border: 0, width: "100%", height: "100vh" }}
      sandbox="allow-scripts allow-same-origin" allow="fullscreen" />
  );
}
