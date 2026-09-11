"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertBox } from "@edu/ui/ds";
import { ExpParaHubSchema, PROTOCOL_VERSION } from "@edu/sdk";
import { CLARITY_PROJECT_ID } from "@/lib/clarity";

/**
 * Host do iframe — o lado do hub no protocolo v1:
 *  - responde ao handshake da SDK (exp:ready → hub:init), rejeitando major
 *    de protocolo diferente com erro visível;
 *  - renova token de verdade (exp:token-expirando → GET /api/exp-token →
 *    hub:token) e, quando aquela rota responde 401/403, PARA a missão com uma
 *    tela que pede login — antes isso era um `console.error` e a criança
 *    seguia trabalhando no vazio até o token vencer (ADR-96);
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
  /** `exp:erro`: a experiência quebrou; o hub troca a tela. O registro é da SDK → api. */
  onErro?: (erro: { mensagem: string; hash: string }) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Callbacks/props mutáveis via ref: o listener registra UMA vez (o array de
  // deps com `props` re-registrava a cada render no scaffold original).
  const atual = useRef(props);
  atual.current = props;

  /**
   * A sessão do HUB morreu (ADR-96). Não é a experiência que quebrou, então
   * não é `exp:erro`: o aparelho está inteiro e o que falta é a pessoa entrar
   * de novo. Enquanto isso, a missão PARA — é o contrário do que acontecia
   * antes, quando a criança continuava respondendo e nada era gravado.
   */
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  /* `reload` e não um link para `/login`: quem decide para onde vai quem está
     sem sessão é o middleware, e o `?next=` que ele monta é dele. Um caminho
     escrito aqui seria a segunda regra de roteamento de login. */
  const entrarDeNovo = useCallback(() => window.location.reload(), []);

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
          registrarHandshake("protocolo-incompativel", msg.protocolVersion);
          return; // sem hub:init — a experiência expira e mostra o erro dela
        }
        // O exp:ready é reenviado até o hub responder; só o PRIMEIRO conta.
        if (!handshakeRegistrado) {
          handshakeRegistrado = true;
          registrarHandshake("ok", msg.protocolVersion);
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
          /*
           * 401/403 é a SESSÃO, não a rede: o cookie do hub venceu (401) ou a
           * senha provisória prendeu a pessoa (403). Nenhuma tentativa futura
           * vai passar, então avisar é a única coisa útil — e `hub:pause` para
           * os cronômetros da experiência antes de a tela trocar, para o dwell
           * não continuar contando uma atenção que ninguém está dando.
           */
          if (r.status === 401 || r.status === 403) {
            post({ type: "hub:pause" });
            setSessaoExpirada(true);
            return;
          }
          if (!r.ok) throw new Error(String(r.status));
          const { token } = (await r.json()) as { token: string };
          post({ type: "hub:token", token });
        } catch {
          /*
           * Falha TRANSITÓRIA (rede, 5xx): o token atual ainda vale alguns
           * minutos e a SDK pede de novo em 10. Alarmar aqui trocaria um
           * engasgo de rede por uma missão interrompida.
           */
          console.error("[hub] falha ao renovar token da experiência");
        }
      }

      if (msg.type === "exp:concluir") atual.current.onConcluir?.(msg.payload);
      if (msg.type === "exp:estado") atual.current.onEstado?.(msg.estado);
      if (msg.type === "exp:erro") atual.current.onErro?.({ mensagem: msg.mensagem, hash: msg.hash });
    }

    /**
     * Métrica da PONTE (cap. 17): quantos handshakes fecharam e quantos
     * morreram por protocolo. Vai por `sendBeacon` a uma rota do hub que loga
     * uma linha com `codigo=ponte.handshake` — é dela que sai a métrica de log
     * "handshakes por resultado". Falhar aqui não pode afetar a experiência.
     */
    let handshakeRegistrado = false;
    function registrarHandshake(resultado: "ok" | "protocolo-incompativel", protocolo: number) {
      try {
        const expId = String(atual.current.config?.expId ?? "");
        navigator.sendBeacon?.(
          "/api/ponte",
          new Blob([JSON.stringify({ resultado, protocolo, expId })], { type: "application/json" }),
        );
      } catch {
        /* diagnóstico, nunca bloqueante */
      }
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

  /*
   * SUBSTITUI o iframe em vez de cobri-lo, e isso é medida de risco: o iframe
   * ocupa `height: 100%` em quatro layouts diferentes (`/exp/:expId`,
   * `/dev-embed` e as três telas de professor com `.tela-cheia`), e uma
   * sobreposição exigiria um contêiner posicionado novo em cada um. Um `<div>`
   * a mais na cadeia do flex é justamente onde o percentual deixa de ser
   * *definite* e o iframe volta aos 150px padrão (packages/ui/AGENTS.md).
   * Trocando o elemento no MESMO lugar da árvore, o layout não muda.
   *
   * E fica no `ExpFrame`, não no `ExpHost`, pelo mesmo motivo do
   * `clarityProjectId`: é o único ponto por onde TODO embed passa. No `ExpHost`
   * as três telas de professor ficariam de fora, e um professor dentro do
   * gerador de plano por duas horas cai no mesmo buraco.
   */
  if (sessaoExpirada) {
    return (
      <div
        data-testid="sessao-expirada"
        style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", padding: 24 }}
      >
        <AlertBox
          theme="light"
          variant="warning"
          device="auto"
          title="Sua sessão expirou"
          description={
            <>
              Você ficou um tempo sem usar a plataforma, e saímos da sua conta por segurança. O que
              você já enviou está salvo. Entre de novo para continuar.
            </>
          }
          primaryAction={{ label: "Entrar de novo", onClick: entrarDeNovo }}
        />
      </div>
    );
  }

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
    /**
     * `allow-downloads` para quem declarou (exp-90 e exp-92, as ferramentas do
     * professor que exportam `.doc`).
     *
     * Sem este token o navegador BLOQUEIA todo download iniciado de dentro do
     * iframe — e o bloqueio é MUDO: nada acontece na tela, nada aparece no
     * `console` (o Chrome o registra no painel Issues, que ninguém abre), e o
     * `a.click()` do código volta como se tivesse funcionado. O professor
     * clicava em "Baixar .doc" e concluía que o produto estava quebrado.
     * MEDIDO em 2026-09-07: dois iframes com o mesmo blob, um com o token e
     * outro sem — só o primeiro escreveu arquivo na pasta de downloads.
     *
     * Por experiência, e não default, pelo mesmo motivo do `forms` e do
     * `pointer-lock`: entregar arquivo ao computador de quem está usando é
     * capacidade de quem declarou. Nenhuma experiência de ESTUDANTE a declara,
     * e a lista de permissões do manifesto é a única porta.
     */
    ...(props.permissoes?.includes("downloads") ? ["allow-downloads"] : []),
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
