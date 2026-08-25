"use client";
import { useEffect, useRef } from "react";
import { ExpParaHubSchema, PROTOCOL_VERSION } from "@edu/sdk";

/**
 * Host do iframe — o lado do hub no protocolo v1:
 *  - responde ao handshake da SDK (exp:ready → hub:init), rejeitando major
 *    de protocolo diferente com erro visível;
 *  - renova token de verdade (exp:token-expirando → GET /api/exp-token →
 *    hub:token);
 *  - emite hub:pause/hub:resume quando a PÁGINA DO HUB perde visibilidade ou
 *    foco — esconder um iframe não dispara visibilitychange nele, e sem isso
 *    o cronômetro de dwell da experiência correria com o aluno de costas
 *    (lição do projeto origem);
 *  - valida TUDO que recebe com Zod (regra: Zod em todo postMessage) e
 *    entrega exp:concluir / exp:estado tipados aos callbacks.
 *
 * REGRA: targetOrigin sempre explícito (origin da CDN), nunca "*".
 */
export function ExpFrame(props: {
  src: string;
  expOrigin: string;
  token: string;
  aluno: { id: string; nome: string; serie: string; turmaId: string; escolaId: string };
  apiUrl: string;
  config?: Record<string, unknown>;
  onConcluir?: (payload: { score?: number; dados?: Record<string, unknown> }) => void;
  onEstado?: (estado: Record<string, unknown>) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Callbacks/props mutáveis via ref: o listener registra UMA vez (o array de
  // deps com `props` re-registrava a cada render no scaffold original).
  const atual = useRef(props);
  atual.current = props;

  useEffect(() => {
    function post(msg: Record<string, unknown>) {
      frame.current?.contentWindow?.postMessage(msg, atual.current.expOrigin);
    }

    async function onMsg(ev: MessageEvent) {
      if (ev.origin !== atual.current.expOrigin) return;
      const parsed = ExpParaHubSchema.safeParse(ev.data);
      if (!parsed.success) {
        console.warn("[hub] mensagem da experiência descartada (schema):", (ev.data as { type?: string })?.type);
        return;
      }
      const msg = parsed.data;

      if (msg.type === "exp:ready") {
        if (Math.trunc(msg.protocolVersion) !== PROTOCOL_VERSION) {
          console.error(
            `[hub] protocolo incompatível: experiência v${msg.protocolVersion}, hub v${PROTOCOL_VERSION}`,
          );
          return; // sem hub:init — a experiência expira e mostra o erro dela
        }
        post({
          type: "hub:init",
          protocolVersion: PROTOCOL_VERSION,
          token: atual.current.token,
          aluno: atual.current.aluno,
          apiUrl: atual.current.apiUrl,
          config: atual.current.config ?? {},
        });
      }

      if (msg.type === "exp:token-expirando") {
        try {
          const r = await fetch("/api/exp-token");
          if (!r.ok) throw new Error(String(r.status));
          const { token } = (await r.json()) as { token: string };
          post({ type: "hub:token", token });
        } catch {
          console.error("[hub] falha ao renovar token da experiência");
        }
      }

      if (msg.type === "exp:concluir") atual.current.onConcluir?.(msg.payload);
      if (msg.type === "exp:estado") atual.current.onEstado?.(msg.estado);
    }

    // Visibilidade/foco da página do hub → pause/resume na experiência.
    // `blur` cobre trocar de janela/aplicativo, que o visibilitychange não vê.
    const aoTrocarVisibilidade = () =>
      post({ type: document.visibilityState === "hidden" ? "hub:pause" : "hub:resume" });
    const aoPerderFoco = () => post({ type: "hub:pause" });
    const aoGanharFoco = () => {
      if (document.visibilityState !== "hidden") post({ type: "hub:resume" });
    };

    // `onMsg` é async (renova token); o void marca o descarte deliberado da
    // promise — ela já trata os próprios erros.
    const onMsgVoid = (ev: MessageEvent) => void onMsg(ev);
    window.addEventListener("message", onMsgVoid);
    document.addEventListener("visibilitychange", aoTrocarVisibilidade);
    window.addEventListener("blur", aoPerderFoco);
    window.addEventListener("focus", aoGanharFoco);
    return () => {
      window.removeEventListener("message", onMsgVoid);
      document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
      window.removeEventListener("blur", aoPerderFoco);
      window.removeEventListener("focus", aoGanharFoco);
    };
  }, []);

  return (
    <iframe
      ref={frame}
      src={props.src}
      title="experiencia"
      style={{ border: 0, width: "100%", height: "100%", display: "block" }}
      // Cross-origin em produção (CDN): sem allow-same-origin a origin do
      // iframe vira "null" e a validação de origin quebra dos dois lados.
      // `allow-modals`: sem ele o navegador IGNORA `confirm()`/`alert()` do
      // iframe em silêncio (devolve false) — a exp-90 confirma exclusão e
      // restauração assim. Ferramenta 1ª parte; não abre nada além disso.
      sandbox="allow-scripts allow-same-origin allow-modals"
      // `autoplay`: a Permissions-Policy tem default 'self' — sem delegar,
      // um <video muted autoplay> cross-origin rejeita play() em silêncio.
      allow="autoplay; fullscreen; clipboard-write"
    />
  );
}
