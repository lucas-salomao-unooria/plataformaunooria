import { z } from "zod";

export const PROTOCOL_VERSION = 1;

export const AlunoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  serie: z.string(),          // ex: "6EF", "2EM"
  turmaId: z.string(),
  escolaId: z.string(),
});
export type Aluno = z.infer<typeof AlunoSchema>;

export const HubInitSchema = z.object({
  type: z.literal("hub:init"),
  protocolVersion: z.number(),
  token: z.string(),
  aluno: AlunoSchema,
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
]);
export type ExpParaHub = z.infer<typeof ExpParaHubSchema>;

export interface TelemetryEvent {
  verbo: "attempted" | "interacted" | "completed" | "scored" | "progressed" | (string & {});
  objeto: string;
  resultado?: Record<string, unknown>;
  contexto?: Record<string, unknown>;
}

export interface ExperienciaHandle {
  aluno: Aluno;
  config: Record<string, unknown>;
  api: {
    get<T = unknown>(path: string): Promise<T>;
    post<T = unknown>(path: string, body?: unknown): Promise<T>;
    /** Aditivos (exp-90): salvar/renomear/excluir. Sem retry — só GET reenvia. */
    put<T = unknown>(path: string, body?: unknown): Promise<T>;
    patch<T = unknown>(path: string, body?: unknown): Promise<T>;
    delete<T = unknown>(path: string): Promise<T>;
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
}
