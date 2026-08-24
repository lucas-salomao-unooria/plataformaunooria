import type { AiJsonRequest, AiProvider, AiRequest, AiResult } from "./provider";
import { ErroDeGeracao } from "./provider";

export class MockProvider implements AiProvider {
  async generate(req: AiRequest): Promise<AiResult> {
    return { texto: `[mock] resposta para: ${req.user.slice(0, 80)}`, tokensUsados: 42 };
  }

  /**
   * Falha fechada de propósito: o mock não sabe satisfazer um schema
   * arbitrário, e os consumidores de generateJson (reações ao vivo, geração)
   * já tratam erro como "nenhum conteúdo" — que é o comportamento seguro.
   * Testes que precisam de saída estruturada injetam um provider próprio.
   */
  async generateJson<T>(_req: AiJsonRequest<T>): Promise<T> {
    throw new ErroDeGeracao("[mock] generateJson sem implementação — nada será exibido.");
  }

  /** Falha fechada: em dev todo post nasce com arte procedural (fallback). */
  async generateImage(_prompt: string): Promise<Buffer> {
    throw new ErroDeGeracao("[mock] generateImage sem implementação — use o fallback procedural.");
  }
}
