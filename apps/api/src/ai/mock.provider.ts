import type { AiProvider, AiRequest, AiResult } from "./provider";
export class MockProvider implements AiProvider {
  async generate(req: AiRequest): Promise<AiResult> {
    return { texto: `[mock] resposta para: ${req.user.slice(0, 80)}`, tokensUsados: 42 };
  }
}
