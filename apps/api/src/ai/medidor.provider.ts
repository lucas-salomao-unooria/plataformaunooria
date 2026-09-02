import { Metricas, rotuloDeFinishReason } from "../observabilidade/metricas";
import { ErroDeGeracao, type AiConversaRequest, type AiJsonRequest, type AiProvider, type AiRequest, type AiResult } from "./provider";

/**
 * Decorator do `AiProvider` que MEDE cada chamada (cap. 17): latência por
 * modelo/operação/resultado, tokens por direção, `finishReason`, voltas e
 * tentativas. Envolve o provider real na factory do `AiModule`, então nenhum
 * consumidor (planos, bemestar, unoogpt, geração, motor) sabe que ele existe
 * — e o `VertexProvider` continua sem medir nem logar, como o mock.
 *
 * O rótulo `modelo` é o da ENV (`padrao`/`longo`/`imagem` → nome do modelo),
 * não o que o vendor devolveu: conjunto fechado de 2–3 valores, cardinalidade
 * sob controle.
 */
export interface ModelosDoMedidor {
  padrao: string;
  longo: string;
  imagem: string;
}

export type OperacaoDeIa = "generate" | "generateJson" | "generateImage" | "conversar";
export type ResultadoDeIa = "ok" | "erro-provider" | "timeout" | "erro";

export function classificarFalha(erro: unknown): ResultadoDeIa {
  if (erro instanceof Error) {
    if (erro.name === "AbortError" || erro.name === "TimeoutError" || /timeout/i.test(erro.message)) return "timeout";
    if (erro instanceof ErroDeGeracao) return "erro-provider";
  }
  return "erro";
}

export class MedidorDeProvider implements AiProvider {
  constructor(
    private readonly real: AiProvider,
    private readonly metricas: Metricas,
    private readonly modelos: ModelosDoMedidor,
  ) {}

  private modeloDe(familia: AiRequest["modelo"]): string {
    return familia === "longo" ? this.modelos.longo : this.modelos.padrao;
  }

  generate(req: AiRequest): Promise<AiResult> {
    return this.medir("generate", this.modeloDe(req.modelo), () => this.real.generate(req), true);
  }

  generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    return this.medir("generateJson", this.modelos.padrao, () => this.real.generateJson(req), false);
  }

  generateImage(prompt: string): Promise<Buffer> {
    return this.medir("generateImage", this.modelos.imagem, () => this.real.generateImage(prompt), false);
  }

  conversar(req: AiConversaRequest): Promise<AiResult> {
    return this.medir("conversar", this.modelos.padrao, () => this.real.conversar(req), true);
  }

  private async medir<T>(operacao: OperacaoDeIa, modelo: string, fn: () => Promise<T>, devolveResultado: boolean): Promise<T> {
    const inicio = performance.now();
    try {
      const r = await fn();
      this.metricas.iaLatencia.record(performance.now() - inicio, { modelo, operacao, resultado: "ok" });
      if (devolveResultado) this.registrar(r as unknown as AiResult, modelo, operacao);
      return r;
    } catch (erro) {
      this.metricas.iaLatencia.record(performance.now() - inicio, { modelo, operacao, resultado: classificarFalha(erro) });
      throw erro;
    }
  }

  private registrar(r: AiResult, modelo: string, operacao: OperacaoDeIa): void {
    if (!r || typeof r !== "object") return;
    if (typeof r.tokensUsados === "number" && r.tokensUsados > 0) {
      this.metricas.iaTokens.add(r.tokensUsados, { modelo, direcao: "total" });
    }
    if (typeof r.tokensEntrada === "number" && r.tokensEntrada > 0) {
      this.metricas.iaTokens.add(r.tokensEntrada, { modelo, direcao: "entrada" });
    }
    if (typeof r.tokensSaida === "number" && r.tokensSaida > 0) {
      this.metricas.iaTokens.add(r.tokensSaida, { modelo, direcao: "saida" });
    }
    this.metricas.iaRespostas.add(1, { modelo, operacao, finishReason: rotuloDeFinishReason(r.finishReason) });
    if (typeof r.voltas === "number") this.metricas.iaVoltas.record(r.voltas, { modelo });
    if (typeof r.tentativas === "number") this.metricas.iaTentativas.record(r.tentativas, { modelo, operacao });
  }
}
