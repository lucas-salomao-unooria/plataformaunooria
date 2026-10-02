import { Agent, fetch as fetchDoUndici } from "undici";
import { z } from "zod";
import { ErroDoAvatar, type AvatarAoVivoPort, type PedidoDeSessao, type SessaoDeAvatar } from "./avatar-ao-vivo.port";

/**
 * O cliente do LiveAvatar (HeyGen) — a ÚNICA peça da api que conhece o vendor
 * do avatar. Fala só com a API de sessões; a conversa em si passa pelo nosso
 * endpoint de LLM (`ajuda/ajuda-llm.controller.ts`), que o vendor chama.
 *
 * `fetch` e `Agent` do MESMO pacote `undici` (ver `vertex.provider.ts`): mistura
 * com o `fetch` global morre como `fetch failed` sem pista.
 *
 * O que foi MEDIDO no spike da ADR-132 (sandbox, 2026-10-02) e que a doc do
 * vendor não diz está em `ajuda/AGENTS.md`.
 */

/** O avatar de testes do vendor: o ÚNICO que o sandbox aceita (sessões de ~1 min, sem crédito). */
export const AVATAR_DO_SANDBOX = "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a";

/** Abrir a sessão é o passo que a pessoa espera olhando um vídeo preto. */
const TIMEOUT_MS = 10_000;
const dispatcher = new Agent({ headersTimeout: TIMEOUT_MS, bodyTimeout: TIMEOUT_MS });

export interface ConfigDoLiveAvatar {
  apiKey?: string;
  apiUrl: string;
  avatarId: string;
  voiceId?: string;
  contextId?: string;
  llmConfigId?: string;
  sandbox: boolean;
}

const RespostaDoTokenSchema = z.object({
  data: z.object({ session_id: z.string().min(1), session_token: z.string().min(1) }),
});

/** Monta o corpo do `POST /v1/sessions/token`. Puro — o teste confere o que vai ao vendor. */
export function corpoDoToken(config: ConfigDoLiveAvatar, pedido: PedidoDeSessao): Record<string, unknown> {
  return {
    mode: "FULL",
    // O sandbox só aceita o avatar dele; mandar o nosso devolve erro.
    avatar_id: config.sandbox ? AVATAR_DO_SANDBOX : config.avatarId,
    is_sandbox: config.sandbox,
    interactivity_type: "CONVERSATIONAL",
    // O sandbox fecha a sala em ~1 min de qualquer jeito (medido no spike).
    max_session_duration: config.sandbox ? Math.min(pedido.duracaoMaximaS, 60) : pedido.duracaoMaximaS,
    // O LLM é o NOSSO: sem isto o vendor responderia com o LLM padrão dele.
    llm_configuration_id: config.llmConfigId,
    avatar_persona: {
      // Sem contexto o avatar fica MUDO, sem erro nenhum (a armadilha nº 1 do vendor).
      context_id: config.contextId,
      language: "pt",
      ...(config.voiceId && !config.sandbox ? { voice_id: config.voiceId } : {}),
    },
    dynamic_variables: pedido.variaveis,
  };
}

export class LiveAvatarClient implements AvatarAoVivoPort {
  constructor(private readonly config: ConfigDoLiveAvatar) {}

  get ligado(): boolean {
    return Boolean(this.config.apiKey && this.config.contextId && this.config.llmConfigId);
  }

  private async chamar(caminho: string, corpo: unknown): Promise<unknown> {
    if (!this.config.apiKey) throw new ErroDoAvatar("LiveAvatar sem chave configurada");
    const res = await fetchDoUndici(`${this.config.apiUrl}${caminho}`, {
      method: "POST",
      headers: { "x-api-key": this.config.apiKey, "content-type": "application/json" },
      body: JSON.stringify(corpo),
      dispatcher,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // O corpo de erro do vendor não tem dado de pessoa, mas vai cortado: é
      // diagnóstico, não conteúdo.
      throw new ErroDoAvatar(`LiveAvatar respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
    }
    return res.json();
  }

  async criarSessao(pedido: PedidoDeSessao): Promise<SessaoDeAvatar> {
    const bruto = await this.chamar("/v1/sessions/token", corpoDoToken(this.config, pedido));
    const lido = RespostaDoTokenSchema.safeParse(bruto);
    if (!lido.success) throw new ErroDoAvatar("LiveAvatar devolveu um token de sessão em formato inesperado");
    return { sessaoId: lido.data.data.session_id, tokenDaSessao: lido.data.data.session_token };
  }

  async encerrarSessao(sessaoId: string): Promise<void> {
    try {
      await this.chamar("/v1/sessions/stop", { session_id: sessaoId, reason: "USER_CLOSED" });
    } catch (erro) {
      // Sessão que o vendor já encerrou (teto, ociosidade, o próprio navegador)
      // responde 4xx — e isso é o estado desejado, não falha.
      if (erro instanceof ErroDoAvatar && erro.status !== undefined && erro.status < 500) return;
      throw erro;
    }
  }
}

/** A porta quando a stack não tem a chave: tudo recusa, e a rota responde 503. */
export class AvatarDesligado implements AvatarAoVivoPort {
  readonly ligado = false;
  async criarSessao(): Promise<SessaoDeAvatar> {
    throw new ErroDoAvatar("Ajuda com avatar desligada nesta stack");
  }
  async encerrarSessao(): Promise<void> {}
}

export function criarAvatarAoVivo(config: ConfigDoLiveAvatar): AvatarAoVivoPort {
  const cliente = new LiveAvatarClient(config);
  return cliente.ligado ? cliente : new AvatarDesligado();
}
