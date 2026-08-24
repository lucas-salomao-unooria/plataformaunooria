export interface AiRequest { system: string; user: string; maxTokens?: number }
export interface AiResult { texto: string; tokensUsados: number }
export interface AiProvider { generate(req: AiRequest): Promise<AiResult> }
