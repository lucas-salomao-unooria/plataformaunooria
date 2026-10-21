import { Metricas, rotuloDeFinishReason } from "../observabilidade/metricas";
import { estimarFala, type AtribuicaoDoConsumo, type ModalidadeDeIa, type RegistrarConsumo } from "./consumo-de-ia";
import {
  ErroDeGeracao,
  type AiConversaRequest,
  type AiFluxoEvento,
  type AiFluxoRequest,
  type AiImagemOpcoes,
  type AiJsonRequest,
  type AiProvider,
  type AiRequest,
  type AiResult,
  type AiSpeechRequest,
} from "./provider";

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
 *
 * Desde a ADR-161 ele também REGISTRA o consumo de cada chamada para o painel
 * de custos (`registrar`, opcional: os testes de métrica não o passam). Uma
 * linha por chamada, no fim dela, com o que foi PAGO — inclusive quando ela
 * falhou depois de o vendor cobrar (a tentativa rejeitada pelo `validar`, a
 * imagem que não veio).
 */
export interface ModelosDoMedidor {
  padrao: string;
  longo: string;
  imagem: string;
  voz: string;
}

export type OperacaoDeIa =
  | "generate"
  | "generateJson"
  | "generateImage"
  | "generateSpeech"
  | "conversar"
  | "conversarEmFluxo";
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
    private readonly registrar?: RegistrarConsumo,
  ) {}

  /** Uma linha no registro de consumo. Sem registrador (teste de métrica), nada. */
  private consumo(
    operacao: OperacaoDeIa,
    modelo: string,
    modalidade: ModalidadeDeIa,
    ok: boolean,
    pago: { entrada: number; saida: number; imagens?: number; segundos?: number; estimado?: boolean },
    atribuicao?: AtribuicaoDoConsumo,
  ): void {
    this.registrar?.({
      operacao,
      modelo,
      modalidade,
      ok,
      tokensEntrada: pago.entrada,
      tokensSaida: pago.saida,
      imagens: pago.imagens,
      segundos: pago.segundos,
      estimado: pago.estimado,
      ...(atribuicao ? { atribuicao } : {}),
    });
  }

  private modeloDe(familia: AiRequest["modelo"]): string {
    return familia === "longo" ? this.modelos.longo : this.modelos.padrao;
  }

  generate(req: AiRequest): Promise<AiResult> {
    return this.medir("generate", this.modeloDe(req.modelo), () => this.real.generate(req), true);
  }

  generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    // `generateJson` devolve `T`, não `AiResult`: os tokens só chegam pelo
    // `aoUsarTokens`, chamado uma vez por tentativa (inclusive as rejeitadas por
    // `validar`, que foram pagas). O decorator se encaixa nele sem tirar o
    // callback de quem chamou (a quota) e sem mudar a interface do provider.
    const modelo = this.modeloDe(req.modelo);
    // Soma das TENTATIVAS: cada uma foi paga, inclusive as que `validar` recusou.
    const pago = { entrada: 0, saida: 0 };
    const comMedicao: AiJsonRequest<T> = {
      ...req,
      aoUsarTokens: (tokens, divisao) => {
        if (tokens > 0) this.metricas.iaTokens.add(tokens, { modelo, direcao: "total" });
        somar(pago, tokens, divisao);
        req.aoUsarTokens?.(tokens, divisao);
      },
    };
    return this.medir("generateJson", modelo, () => this.real.generateJson(comMedicao), false, (ok) =>
      this.consumo("generateJson", modelo, "texto", ok, pago),
    );
  }

  generateImage(prompt: string, opcoes?: AiImagemOpcoes): Promise<Buffer> {
    const modelo = this.modelos.imagem;
    const pago = { entrada: 0, saida: 0 };
    let imagens = 0;
    const comMedicao: AiImagemOpcoes = {
      ...opcoes,
      aoUsarTokens: (tokens, divisao) => {
        somar(pago, tokens, divisao);
        opcoes?.aoUsarTokens?.(tokens, divisao);
      },
    };
    return this.medir(
      "generateImage",
      modelo,
      async () => {
        const imagem = await this.real.generateImage(prompt, comMedicao);
        imagens = 1;
        return imagem;
      },
      false,
      (ok) => this.consumo("generateImage", modelo, "imagem", ok, { ...pago, imagens }, opcoes?.atribuicao),
    );
  }

  /**
   * A Cloud TTS não devolve contagem nenhuma: o consumo é ESTIMADO pelo tamanho
   * do roteiro e do MP3 (`estimarFala`). Falha não registra token — sem áudio,
   * a conta de saída não tem de onde sair, e a Google não cobra síntese recusada.
   */
  generateSpeech(req: AiSpeechRequest): Promise<Buffer> {
    const modelo = this.modelos.voz;
    let fala = { tokensEntrada: 0, tokensSaida: 0, segundos: 0 };
    return this.medir(
      "generateSpeech",
      modelo,
      async () => {
        const audio = await this.real.generateSpeech(req);
        const roteiro = [req.texto ?? "", ...(req.turnos ?? []).map((t) => t.texto), req.direcao ?? ""].join(" ");
        fala = estimarFala(Buffer.byteLength(roteiro, "utf8"), audio.length);
        return audio;
      },
      false,
      (ok) =>
        this.consumo("generateSpeech", modelo, "audio", ok, {
          entrada: fala.tokensEntrada,
          saida: fala.tokensSaida,
          segundos: fala.segundos,
          estimado: true,
        }),
    );
  }

  conversar(req: AiConversaRequest): Promise<AiResult> {
    return this.medir("conversar", this.modelos.padrao, () => this.real.conversar(req), true);
  }

  /**
   * O fluxo é medido do primeiro pedido ao `fim`: a latência é a da resposta
   * INTEIRA (a do primeiro pedaço é o que a pessoa sente, mas é o total que o
   * vendor cobra e que o painel compara com as outras operações). Os tokens
   * saem do `fim`, que traz o acumulado.
   */
  async *conversarEmFluxo(req: AiFluxoRequest): AsyncGenerator<AiFluxoEvento> {
    const modelo = this.modelos.padrao;
    const inicio = performance.now();
    let registrou = false;
    try {
      for await (const evento of this.real.conversarEmFluxo(req)) {
        if (evento.tipo === "fim") {
          this.metricas.iaLatencia.record(performance.now() - inicio, { modelo, operacao: "conversarEmFluxo", resultado: "ok" });
          this.registrarResultado(evento.resultado, modelo, "conversarEmFluxo");
          registrou = true;
        }
        yield evento;
      }
    } catch (erro) {
      this.metricas.iaLatencia.record(performance.now() - inicio, {
        modelo,
        operacao: "conversarEmFluxo",
        resultado: classificarFalha(erro),
      });
      // Quem lia foi embora (abort) ou o transporte caiu: o vendor não mandou
      // o `fim`, então não há contagem — registra a chamada, sem tokens.
      if (!registrou) this.consumo("conversarEmFluxo", modelo, "texto", false, { entrada: 0, saida: 0 });
      throw erro;
    }
  }

  /**
   * `devolveResultado`: a operação devolve `AiResult`, e o consumo sai dele.
   * Senão quem chama passa `aoTerminar`, que sabe o que foi pago.
   */
  private async medir<T>(
    operacao: OperacaoDeIa,
    modelo: string,
    fn: () => Promise<T>,
    devolveResultado: boolean,
    aoTerminar?: (ok: boolean) => void,
  ): Promise<T> {
    const inicio = performance.now();
    try {
      const r = await fn();
      this.metricas.iaLatencia.record(performance.now() - inicio, { modelo, operacao, resultado: "ok" });
      if (devolveResultado) this.registrarResultado(r as unknown as AiResult, modelo, operacao);
      aoTerminar?.(true);
      return r;
    } catch (erro) {
      this.metricas.iaLatencia.record(performance.now() - inicio, { modelo, operacao, resultado: classificarFalha(erro) });
      if (devolveResultado) this.consumo(operacao, modelo, "texto", false, { entrada: 0, saida: 0 });
      aoTerminar?.(false);
      throw erro;
    }
  }

  private registrarResultado(r: AiResult, modelo: string, operacao: OperacaoDeIa): void {
    if (!r || typeof r !== "object") return;
    const entrada = r.tokensEntrada ?? 0;
    // Saída = total − entrada: inclui o raciocínio, que a tarifa de saída cobra.
    this.consumo(operacao, modelo, "texto", true, {
      entrada,
      saida: Math.max(0, (r.tokensUsados ?? 0) - entrada),
    });
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

/** Acumula uma tentativa. Sem divisão do vendor, o total inteiro conta como SAÍDA (a tarifa mais cara: falha para o lado do custo). */
function somar(pago: { entrada: number; saida: number }, tokens: number, divisao?: { entrada: number; saida: number }): void {
  if (divisao) {
    pago.entrada += divisao.entrada;
    pago.saida += divisao.saida;
  } else if (tokens > 0) {
    pago.saida += tokens;
  }
}
