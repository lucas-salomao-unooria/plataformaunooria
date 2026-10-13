/**
 * A PORTA do agente de IA do professor — o que o resto da api sabe dele.
 *
 * Contrato das quatro pontas: `docs/regras/agente-professor.md`. Só
 * `agent-engine.client.ts` conhece o Vertex AI Agent Engine; o módulo
 * `src/agente-professor` fala com esta interface e com nada mais. É o mesmo
 * desenho do `AiProvider` (nenhum vendor fora de `src/ai`), com uma diferença:
 * aqui o modelo, as ferramentas e a instrução moram NO AGENTE (Python/ADK), e a
 * api só conduz a sessão — por isso é uma porta própria, e não um método a mais
 * no `AiProvider`.
 */

/** Token de injeção do Nest. Símbolo, e não classe: a porta é uma interface. */
export const AGENTE_PROFESSOR = Symbol("AGENTE_PROFESSOR");

/**
 * Um `Event` do ADK, NORMALIZADO.
 *
 * O ADK serializa o evento em snake_case (`model_dump`) e o Agent Engine às
 * vezes devolve camelCase (a representação REST das sessões). Quem lê este tipo
 * não precisa saber qual dos dois chegou — o cliente aceita os dois.
 */
export interface EventoAgente {
  /** `user` para o professor; o nome do agente (ou de um subagente) no resto. */
  autor: string;
  /** `partial=true` do ADK em modo SSE: pedaço de texto de uma resposta em curso. */
  parcial: boolean;
  /** Os textos das `parts`, SEM as partes de raciocínio (`thought: true`). */
  textos: string[];
  chamadasDeFerramenta: Array<{ nome: string; args: Record<string, unknown> }>;
  respostasDeFerramenta: Array<{ nome: string; resposta: unknown }>;
  /** `actions.state_delta` — é por aqui que chega o `titulo_conversa`. */
  estadoDelta?: Record<string, unknown>;
  /** `usage_metadata.total_token_count`. Só vale nos NÃO parciais (ver regras). */
  tokens?: number;
  /** `usage_metadata.prompt_token_count` — a entrada; a saída é `tokens` menos ela (ADR-161). */
  tokensEntrada?: number;
  /** `model_version` do ADK: o modelo que respondeu este evento, quando o engine o informa. */
  modelo?: string;
  fimDeTurno?: boolean;
  /** `error_code`/`error_message` do ADK: o agente falhou no meio do turno. */
  erro?: { codigo: string; mensagem?: string };
}

export interface SessaoAgente {
  sessaoId: string;
  estado: Record<string, unknown>;
  eventos: EventoAgente[];
}

export interface AgenteProfessorPort {
  /** Qual implementação está valendo — vai ao log, nunca à tela. */
  readonly modo: ModoDoAgente;
  /**
   * Cria a sessão com o estado inicial. `expiraEm` é pedido ao engine; se ele
   * recusar o campo, a sessão nasce com o TTL padrão dele (365 dias) — ver o
   * cliente.
   */
  criarSessao(usuarioId: string, estado: Record<string, unknown>, expiraEm?: Date): Promise<{ sessaoId: string }>;
  /** Lança `SessaoInexistente` quando o engine não a conhece. */
  lerSessao(usuarioId: string, sessaoId: string): Promise<SessaoAgente>;
  /** Idempotente: sessão que já não existe NÃO é erro. */
  apagarSessao(usuarioId: string, sessaoId: string): Promise<void>;
  /**
   * Empurra a expiração da sessão. Só existe no modo `agent-engine`: o `:query`
   * do ADK não tem método de atualizar sessão, então é a API NATIVA de sessões
   * (`PATCH .../sessions/{id}?updateMask=expireTime`) — que exige permissão
   * além de `reasoningEngines.query` na SA da api.
   */
  renovarSessao?(sessaoId: string, expiraEm: Date): Promise<void>;
  /** Um turno. O `signal` aborta a cadeia até o Vertex (professor fechou o painel). */
  enviar(usuarioId: string, sessaoId: string, texto: string, signal: AbortSignal): AsyncIterable<EventoAgente>;
}

export const MODOS_DO_AGENTE = ["agent-engine", "local", "mock", "desligado"] as const;
export type ModoDoAgente = (typeof MODOS_DO_AGENTE)[number];

/**
 * O resource name do engine — `projects/<p>/locations/<r>/reasoningEngines/<id>`.
 * Aqui, e não no cliente, porque o Zod do boot (`config/env.ts`) o usa: importar
 * o cliente de lá carregaria o ADC e o undici só para validar uma string.
 */
export const ENGINE_RE = /^projects\/[^/]+\/locations\/([^/]+)\/reasoningEngines\/[^/]+$/;

/**
 * O agente não respondeu (modo `desligado`, credencial, 5xx, rede). Vira
 * `AGENTE_INDISPONIVEL` para o professor. `detalhe` é para o log — nunca carrega
 * texto do professor nem do agente, só status e o começo do corpo de erro.
 */
export class AgenteIndisponivel extends Error {
  readonly codigo = "AGENTE_INDISPONIVEL";
  constructor(
    mensagem: string,
    readonly detalhe?: string,
    readonly status?: number,
  ) {
    super(mensagem);
    this.name = "AgenteIndisponivel";
  }
}

/** O engine não conhece esta sessão (apagada, expirada ou de outro engine). */
export class SessaoInexistente extends Error {
  constructor(readonly sessaoId: string) {
    super("sessão inexistente no agente");
    this.name = "SessaoInexistente";
  }
}

/**
 * O modelo do agente quando o evento não diz qual (`model_version` ausente).
 * ESPELHA o padrão de `apps/agente-professor/agente_professor/config.py`
 * (`modelo`): o painel de custos precisa de um modelo para achar o preço.
 */
export const MODELO_PADRAO_DO_AGENTE = "gemini-3.7-flash";
