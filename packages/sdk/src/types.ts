import { z } from "zod";

export const PROTOCOL_VERSION = 2;

export const EstudanteSchema = z.object({
  id: z.string(),
  nome: z.string(),
  serie: z.string(),          // ex: "6EF", "2EM"
  turmaId: z.string(),
  escolaId: z.string(),
});
export type Estudante = z.infer<typeof EstudanteSchema>;

export const HubInitSchema = z.object({
  type: z.literal("hub:init"),
  protocolVersion: z.number(),
  token: z.string(),
  estudante: EstudanteSchema,
  apiUrl: z.string().url(),
  config: z.record(z.unknown()).default({}),
});
export type HubInit = z.infer<typeof HubInitSchema>;

/**
 * Mensagens PÓS-init, validadas com Zod dos DOIS lados (regra do CLAUDE.md:
 * Zod em todo postMessage recebido). Uniões discriminadas — mensagem que não
 * casa é descartada com aviso, nunca despachada crua.
 *
 * Tudo aqui é ADITIVO ao protocolo v1: hub antigo ignora mensagem que não
 * conhece; experiência antiga nunca recebe as novas sem pedir.
 */
export const HubParaExpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hub:token"), token: z.string() }),
  z.object({ type: z.literal("hub:pause") }),
  z.object({ type: z.literal("hub:resume") }),
]);
export type HubParaExp = z.infer<typeof HubParaExpSchema>;

export const ExpConcluirPayloadSchema = z.object({
  score: z.number().optional(),
  dados: z.record(z.unknown()).optional(),
});

export const ExpParaHubSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("exp:ready"), protocolVersion: z.number() }),
  z.object({ type: z.literal("exp:concluir"), payload: ExpConcluirPayloadSchema.default({}) }),
  z.object({ type: z.literal("exp:token-expirando") }),
  /** Estado de alto nível para o "chrome" opcional do hub (ex.: moldura dos
   *  posts perdidos). O hub NÃO interpreta domínio — só repassa a quem plugou. */
  z.object({ type: z.literal("exp:estado"), estado: z.record(z.unknown()) }),
  /**
   * Erro não tratado dentro da experiência (ADR-58). Só para o hub TROCAR A
   * TELA ("algo deu errado", recarregar); o registro do erro não passa por
   * aqui — a SDK o manda direto à api. `mensagem` curta e sem texto de
   * estudante (é a mensagem da exceção); `hash` é o dedupe. Aditivo: hub
   * antigo descarta com o aviso de schema, sem subir PROTOCOL_VERSION.
   */
  z.object({ type: z.literal("exp:erro"), mensagem: z.string().max(256), hash: z.string().max(16) }),
]);
export type ExpParaHub = z.infer<typeof ExpParaHubSchema>;

export interface TelemetryEvent {
  verbo: "attempted" | "interacted" | "completed" | "scored" | "progressed" | (string & {});
  objeto: string;
  resultado?: Record<string, unknown>;
  contexto?: Record<string, unknown>;
}

/**
 * Opções de UMA chamada à api. Aditivo: quem não passa nada mantém o
 * comportamento de sempre.
 *
 * `timeoutMs` existe porque o teto de 10 s do SDK é certo para leitura de
 * catálogo e ERRADO para rota que espera um modelo de linguagem: um turno de
 * conversa com ferramentas leva de dez a trinta segundos, e o `AbortController`
 * cortava a resposta que já estava sendo gerada — o estudante via "não consegui
 * responder" enquanto a api tinha respondido. Subir o default para todo mundo
 * seria pior: uma api travada deixaria toda experiência pendurada meio minuto.
 */
export interface OpcoesDeChamada {
  timeoutMs?: number;
}

export interface ExperienciaHandle {
  estudante: Estudante;
  config: Record<string, unknown>;
  api: {
    get<T = unknown>(path: string, opcoes?: OpcoesDeChamada): Promise<T>;
    post<T = unknown>(path: string, body?: unknown, opcoes?: OpcoesDeChamada): Promise<T>;
    /** Aditivos (exp-90): salvar/renomear/excluir. Sem retry — só GET reenvia. */
    put<T = unknown>(path: string, body?: unknown, opcoes?: OpcoesDeChamada): Promise<T>;
    patch<T = unknown>(path: string, body?: unknown, opcoes?: OpcoesDeChamada): Promise<T>;
    delete<T = unknown>(path: string, opcoes?: OpcoesDeChamada): Promise<T>;
  };
  ai: { gerar(input: { atividade: string; mensagem: string }): Promise<{ texto: string }> };
  track(verbo: TelemetryEvent["verbo"], objeto: string, dados?: Omit<TelemetryEvent, "verbo" | "objeto">): void;
  progresso: {
    salvar(dados: Record<string, unknown>): Promise<void>;
    carregar<T = Record<string, unknown>>(): Promise<T | null>;
  };
  concluir(payload?: { score?: number; dados?: Record<string, unknown> }): void;
  on(evento: "pause" | "resume", cb: () => void): void;
  /** Publica estado de alto nível para o chrome opcional do hub (exp:estado). */
  enviarEstado(estado: Record<string, unknown>): void;
  /**
   * Reporta um erro que a experiência TRATOU mas quer registrar (o `catch` que
   * mostra "não deu para abrir agora"). Mesmo caminho do `window.onerror`:
   * dedupe, teto por sessão, `POST /observabilidade/erros-cliente`.
   */
  reportarErro(erro: unknown): void;
}
