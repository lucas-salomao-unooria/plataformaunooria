export interface AiRequest { system: string; user: string; maxTokens?: number }
export interface AiResult { texto: string; tokensUsados: number }

/**
 * Schema de resposta estruturada NEUTRO de vendor (subconjunto de JSON Schema:
 * object/array/string/number/boolean). Cada provider traduz para o formato do
 * seu modelo — nenhum módulo fora de `src/ai` conhece o vendor.
 */
export interface AiJsonSchema {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, AiJsonSchema>;
  items?: AiJsonSchema;
  required?: string[];
  enum?: string[];
}

export interface AiJsonRequest<T> {
  prompt: string;
  system?: string;
  responseSchema: AiJsonSchema;
  /** Valida e normaliza a saída; lançar erro faz a tentativa ser regerada. */
  validar: (bruto: unknown) => T;
  temperatura?: number;
  tentativas?: number;
}

export class ErroDeGeracao extends Error {
  constructor(
    message: string,
    readonly detalhe?: string,
  ) {
    super(message);
    this.name = "ErroDeGeracao";
  }
}

/** Token de injeção do provider (registrado no AiModule por AI_PROVIDER env). */
export const AI_PROVIDER = "AI_PROVIDER";

export interface AiProvider {
  generate(req: AiRequest): Promise<AiResult>;
  /** Saída JSON estruturada com retry + reforço do erro anterior no prompt. */
  generateJson<T>(req: AiJsonRequest<T>): Promise<T>;
  /** Geração de imagem: devolve os bytes originais (jpeg/png) do modelo.
   *  Falha → quem chama cai no fallback procedural (imageStatus "fallback"). */
  generateImage(prompt: string): Promise<Buffer>;
}
