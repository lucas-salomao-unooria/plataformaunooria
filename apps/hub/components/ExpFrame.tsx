"use client";
import { useEffect, useRef } from "react";
import { ExpParaHubSchema, PROTOCOL_VERSION } from "@edu/sdk";
import { CLARITY_PROJECT_ID } from "@/lib/clarity";

/**
 * Host do iframe — o lado do hub no protocolo v1:
 *  - responde ao handshake da SDK (exp:ready → hub:init), rejeitando major
 *    de protocolo diferente com erro visível;
 *  - renova token de verdade (exp:token-expirando → GET /api/exp-token →
 *    hub:token);
 *  - emite hub:pause/hub:resume quando a PÁGINA DO HUB perde visibilidade ou
 *    foco — esconder um iframe não dispara visibilitychange nele, e sem isso
 *    o cronômetro de dwell da experiência correria com o estudante de costas
 *    (lição do projeto origem). O foco indo para DENTRO do próprio iframe é a
 *    exceção, e está explicada em `aoPerderFoco`;
 *  - valida TUDO que recebe com Zod (regra: Zod em todo postMessage) e
 *    entrega exp:concluir / exp:estado tipados aos callbacks.
 *
 * REGRA: targetOrigin sempre explícito (origin da CDN), nunca "*".
 */
export function ExpFrame(props: {
  src: string;
  expOrigin: string;
  token: string;
  estudante?: { id: string; nome: string; serie: string; turmaId: string; escolaId: string };
  apiUrl: string;
  config?: Record<string, unknown>;
  /**
   * Permissões de iframe declaradas no manifesto DESTA experiência. Hoje só
   * `pointer-lock` e `forms`. Ausente = nenhuma, que é o comportamento que todas as
   * experiências tinham antes deste campo existir.
   */
  permissoes?: readonly string[];
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
        const estudantePayload = atual.current.estudante;
        post({
          type: "hub:init",
          protocolVersion: PROTOCOL_VERSION,
          token: atual.current.token,
          estudante: estudantePayload,
          apiUrl: atual.current.apiUrl,
          /*
           * `clarityProjectId` entra AQUI, e não em `montarEmbed`, porque este
           * é o único ponto por onde todo embed passa — `/exp/[expId]`,
           * `/dev-embed`, `/professor/plano-de-aula` e `/professor/bem-estar`
           * chegam nos quatro por caminhos diferentes, e um deles esquecido
           * seria uma experiência sem Clarity que ninguém notaria (ADR-60).
           *
           * Quem chama pode sobrescrever: o spread de `config` vem depois.
           */
          config: { clarityProjectId: CLARITY_PROJECT_ID, ...atual.current.config },
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
    /*
     * `blur` da janela do hub NÃO é sempre o estudante saindo: clicar em qualquer
     * lugar DENTRO do iframe move o foco para a experiência, e o navegador
     * dispara `blur` no documento de cima. Como o `focus` correspondente nunca
     * volta enquanto ele continua ali, um `hub:pause` aqui é definitivo — na
     * exp-02 o vídeo parava no primeiro toque em "Salvar" e não voltava mais.
     *
     * Quando o foco foi para a NOSSA experiência, `document.activeElement` é o
     * próprio `<iframe>`. Esse caso não é perda de visibilidade nenhuma.
     */
    const aoPerderFoco = () => {
      if (document.activeElement === frame.current) return;
      post({ type: "hub:pause" });
    };
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

  /**
   * O sandbox é o MESMO para todas as experiências, exceto o que o manifesto
   * pedir. `allow-pointer-lock` só entra para quem declarou (exp-70, o jogo 3D
   * em primeira pessoa): num iframe com sandbox, `requestPointerLock()` é
   * ignorado sem esse token — e dá-lo a todas as experiências significaria que
   * qualquer bundle pode capturar o mouse do estudante.
   *
   * `fullscreen` não é gateado aqui: o `allow` abaixo já o delega a todas.
   */
  const sandbox = [
    "allow-scripts",
    // Cross-origin em produção (CDN): sem allow-same-origin a origin do
    // iframe vira "null" e a validação de origin quebra dos dois lados.
    "allow-same-origin",
    // `allow-modals`: sem ele o navegador IGNORA `confirm()`/`alert()` do
    // iframe em silêncio (devolve false) — a exp-90 confirma exclusão e
    // restauração assim. Ferramenta 1ª parte; não abre nada além disso.
    "allow-modals",
    ...(props.permissoes?.includes("pointer-lock") ? ["allow-pointer-lock"] : []),
    /**
     * `allow-forms` só para quem declarou (exp-03, a Missão Tempestade).
     *
     * O `Composer` do design system é um `<form>`, e num iframe com sandbox sem
     * este token o navegador BLOQUEIA o submit — o estudante digita a pergunta,
     * aperta Enter e nada acontece. O sintoma engana: a conversa parece viva,
     * porque a mensagem de abertura do agente já está na tela, e o único rastro
     * é um aviso no console sobre "form's frame is sandboxed".
     *
     * Por experiência, e não default, pelo mesmo motivo do pointer-lock:
     * permitir submit de formulário é capacidade de quem declarou. Uma
     * experiência que não tem formulário não tem por que poder enviar um.
     */
    ...(props.permissoes?.includes("forms") ? ["allow-forms"] : []),
  ].join(" ");

  return (
    <iframe
      ref={frame}
      src={props.src}
      title="experiencia"
      style={{ border: 0, width: "100%", height: "100%", display: "block" }}
      sandbox={sandbox}
      // `autoplay`: a Permissions-Policy tem default 'self' — sem delegar,
      // um <video muted autoplay> cross-origin rejeita play() em silêncio.
      allow="autoplay; fullscreen; clipboard-write"
    />
  );
}
