"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type RefObject } from "react";

import { CONVERSA_VAZIA, ESPERA_DA_RESPOSTA_MS, reduzirConversa, type ConversaDaAjuda } from "@/lib/ajuda/conversa";
import { abrirSessao, encerrarSessao } from "@/lib/ajuda/transporte";

/**
 * A SESSÃO DE VÍDEO DA AJUDA (ADR-132), do clique em "Ajuda" ao fechar.
 *
 * O SDK do vendor (`@heygen/liveavatar-web-sdk`) é carregado SÓ aqui, por
 * `import()`: são ~1 MB de LiveKit que nenhuma outra tela precisa, e a pessoa
 * que nunca abre a Ajuda não paga por eles.
 *
 * **O microfone começa DESLIGADO.** Sem `voiceChat` na config, o SDK não pede
 * o microfone (lido no código dele, 0.0.19); a permissão só aparece quando a
 * pessoa aperta "Falar". Na sala de professores o microfone aberto ouviria a
 * conversa do lado — e pedir a permissão sem a pessoa ter escolhido a voz é
 * pedir mais do que ela pediu.
 *
 * **Uma geração por abertura**: o modo estrito do React monta, desmonta e monta
 * de novo em dev. A abertura que termina depois de a sua geração ter acabado
 * fecha a sala que acabou de abrir — senão ficaria uma sessão órfã cobrando.
 *
 * O token da sala vive só nesta closure (regra 4: nunca em `localStorage`).
 */

export type Fase = "abrindo" | "conectando" | "conversando" | "encerrada" | "erro";
export type EstadoDoMicrofone = "desligado" | "ligando" | "ligado" | "mudo" | "bloqueado";

/** O pedaço do SDK que este hook usa — a interface pública da 0.0.19. */
interface SessaoDoVendor {
  on(evento: string, cb: (dado: never) => void): unknown;
  start(): Promise<void>;
  stop(): Promise<void>;
  attach(elemento: HTMLMediaElement): void;
  message(texto: string): string;
  interrupt(): void;
  voiceChat: {
    state: string;
    isMuted: boolean;
    start(config?: Record<string, unknown>): Promise<void>;
    mute(): Promise<void>;
    unmute(): Promise<void>;
  };
}

interface EventoDeTexto {
  text?: string;
  source_event_id?: string | null;
}

export interface SessaoDaAjuda {
  fase: Fase;
  erro: { mensagem: string; podeRepetir: boolean } | null;
  conversa: ConversaDaAjuda;
  microfone: EstadoDoMicrofone;
  atendenteFalando: boolean;
  pessoaFalando: boolean;
  /** Segundos até o teto da sessão; `null` antes de conectar. */
  restanteS: number | null;
  tentarDeNovo(): void;
  enviar(texto: string): void;
  alternarMicrofone(): void;
  encerrar(): void;
}

const VIDEO_BLOQUEADO =
  "Não conseguimos conectar o vídeo do atendente. A rede da escola pode estar bloqueando a conexão. Tente de novo ou use outra rede.";

export function useSessaoDaAjuda(video: RefObject<HTMLVideoElement | null>): SessaoDaAjuda {
  const [fase, setFase] = useState<Fase>("abrindo");
  const [erro, setErro] = useState<SessaoDaAjuda["erro"]>(null);
  const [conversa, despachar] = useReducer(reduzirConversa, CONVERSA_VAZIA);
  const [microfone, setMicrofone] = useState<EstadoDoMicrofone>("desligado");
  const [atendenteFalando, setAtendenteFalando] = useState(false);
  const [pessoaFalando, setPessoaFalando] = useState(false);
  const [restanteS, setRestanteS] = useState<number | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const sessaoRef = useRef<SessaoDoVendor | null>(null);
  const idRef = useRef<string | null>(null);
  const prazoRef = useRef<number | null>(null);

  const fechar = useCallback(() => {
    const sessao = sessaoRef.current;
    sessaoRef.current = null;
    if (sessao) void sessao.stop().catch(() => undefined);
    if (idRef.current) encerrarSessao(idRef.current);
    idRef.current = null;
  }, []);

  /* A abertura: uma por geração (o `tentativa` é o "Tentar de novo"). */
  useEffect(() => {
    let viva = true;
    setFase("abrindo");
    setErro(null);
    setMicrofone("desligado");

    void (async () => {
      const abertura = await abrirSessao();
      if (!viva) {
        if (abertura.ok) encerrarSessao(abertura.sessao.id);
        return;
      }
      if (!abertura.ok) {
        setErro({ mensagem: abertura.mensagem, podeRepetir: abertura.podeRepetir });
        setFase("erro");
        return;
      }
      idRef.current = abertura.sessao.id;
      setFase("conectando");

      try {
        const sdk = await import("@heygen/liveavatar-web-sdk");
        if (!viva) {
          encerrarSessao(abertura.sessao.id);
          return;
        }
        const sessao = new sdk.LiveAvatarSession(abertura.sessao.tokenDaSessao, {
          autoKeepAlive: true,
        }) as unknown as SessaoDoVendor;
        sessaoRef.current = sessao;

        sessao.on(sdk.SessionEvent.SESSION_STREAM_READY, () => {
          if (video.current) sessao.attach(video.current);
        });
        sessao.on(sdk.SessionEvent.SESSION_DISCONNECTED, () => {
          if (!viva) return;
          setFase("encerrada");
          setAtendenteFalando(false);
          setPessoaFalando(false);
          if (idRef.current) encerrarSessao(idRef.current);
          idRef.current = null;
          sessaoRef.current = null;
        });
        sessao.on(sdk.AgentEventsEnum.USER_TRANSCRIPTION, (e: EventoDeTexto) =>
          despachar({ tipo: "pergunta-falada", texto: e.text ?? "", origem: e.source_event_id }),
        );
        sessao.on(sdk.AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK, (e: EventoDeTexto) =>
          despachar({ tipo: "resposta-pedaco", texto: e.text ?? "" }),
        );
        sessao.on(sdk.AgentEventsEnum.AVATAR_TRANSCRIPTION, (e: EventoDeTexto) =>
          despachar({ tipo: "resposta-inteira", texto: e.text ?? "" }),
        );
        sessao.on(sdk.AgentEventsEnum.AVATAR_SPEAK_STARTED, () => setAtendenteFalando(true));
        sessao.on(sdk.AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
          setAtendenteFalando(false);
          despachar({ tipo: "resposta-fim" });
        });
        sessao.on(sdk.AgentEventsEnum.USER_SPEAK_STARTED, () => setPessoaFalando(true));
        sessao.on(sdk.AgentEventsEnum.USER_SPEAK_ENDED, () => setPessoaFalando(false));

        await sessao.start();
        if (!viva) return;
        prazoRef.current = Date.now() + abertura.sessao.duracaoMaximaS * 1000;
        setRestanteS(abertura.sessao.duracaoMaximaS);
        setFase("conversando");
      } catch {
        if (!viva) return;
        // WebRTC bloqueado pela rede da escola é o caso típico: a api abriu, a sala não.
        fechar();
        setErro({ mensagem: VIDEO_BLOQUEADO, podeRepetir: true });
        setFase("erro");
      }
    })();

    return () => {
      viva = false;
      fechar();
    };
  }, [tentativa, fechar, video]);

  /* O relógio do teto: o vendor fecha a sala sozinho; aqui é só para a pessoa ver. */
  useEffect(() => {
    if (fase !== "conversando") return;
    const relogio = window.setInterval(() => {
      if (prazoRef.current) setRestanteS(Math.max(0, Math.round((prazoRef.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(relogio);
  }, [fase]);

  /* O vendor não avisa quando o nosso LLM falha (medido): sem pedaço de resposta, a tela avisa. */
  useEffect(() => {
    if (!conversa.aguardando) return;
    const espera = window.setTimeout(() => despachar({ tipo: "sem-resposta" }), ESPERA_DA_RESPOSTA_MS);
    return () => window.clearTimeout(espera);
  }, [conversa.aguardando, conversa.mensagens.length]);

  /* Fechar a aba no meio da conversa também encerra (o `keepalive` leva o aviso). */
  useEffect(() => {
    window.addEventListener("pagehide", fechar);
    return () => window.removeEventListener("pagehide", fechar);
  }, [fechar]);

  const enviar = useCallback(
    (texto: string) => {
      const sessao = sessaoRef.current;
      if (!sessao || !texto.trim()) return;
      // Pergunta nova corta a fala anterior: quem escreveu já não está ouvindo.
      if (atendenteFalando) sessao.interrupt();
      const id = sessao.message(texto.trim());
      despachar({ tipo: "pergunta-escrita", id, texto });
    },
    [atendenteFalando],
  );

  const alternarMicrofone = useCallback(() => {
    const sessao = sessaoRef.current;
    if (!sessao) return;
    void (async () => {
      try {
        if (sessao.voiceChat.state === "INACTIVE") {
          setMicrofone("ligando");
          await sessao.voiceChat.start({});
          setMicrofone("ligado");
        } else if (sessao.voiceChat.isMuted) {
          await sessao.voiceChat.unmute();
          setMicrofone("ligado");
        } else {
          await sessao.voiceChat.mute();
          setMicrofone("mudo");
        }
      } catch {
        // Permissão negada ou sem microfone: segue pelo chat.
        setMicrofone("bloqueado");
      }
    })();
  }, []);

  const encerrar = useCallback(() => {
    fechar();
    setFase("encerrada");
  }, [fechar]);

  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);

  return {
    fase,
    erro,
    conversa,
    microfone,
    atendenteFalando,
    pessoaFalando,
    restanteS,
    tentarDeNovo,
    enviar,
    alternarMicrofone,
    encerrar,
  };
}
