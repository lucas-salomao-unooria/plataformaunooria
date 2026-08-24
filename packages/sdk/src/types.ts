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
  };
  ai: { gerar(input: { atividade: string; mensagem: string }): Promise<{ texto: string }> };
  track(verbo: TelemetryEvent["verbo"], objeto: string, dados?: Omit<TelemetryEvent, "verbo" | "objeto">): void;
  progresso: {
    salvar(dados: Record<string, unknown>): Promise<void>;
    carregar<T = Record<string, unknown>>(): Promise<T | null>;
  };
  concluir(payload?: { score?: number; dados?: Record<string, unknown> }): void;
  on(evento: "pause" | "resume", cb: () => void): void;
}
