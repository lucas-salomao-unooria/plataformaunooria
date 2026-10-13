import { GoogleAuth } from "google-auth-library";
import { Agent, fetch as fetchDoUndici } from "undici";
import type {
  AiConversaRequest,
  AiFluxoEvento,
  AiFluxoRequest,
  AiImagemOpcoes,
  AiJsonRequest,
  AiJsonSchema,
  AiProvider,
  DivisaoDeTokens,
  AiRequest,
  AiResult,
  AiSpeechRequest,
  AiTimbre,
} from "./provider";
import { ErroDeGeracao } from "./provider";

/**
 * O `fetch` do Node (undici) tem `headersTimeout` de 300 s por padrão. Em
 * `generateContent` NÃO-streaming os headers só chegam quando a geração
 * termina — um plano anual de 20–30k tokens leva minutos e estourava no meio.
 * O dispatcher próprio sobe o teto para 15 min só nas chamadas ao Vertex.
 * Evolução, se passar disso: `streamGenerateContent?alt=sse` acumulando chunks.
 *
 * O `fetch` é o DO UNDICI, não o global do Node — e isso não é estilo. O fetch
 * global usa o undici EMBUTIDO na runtime (`process.versions.undici`), que é
 * outro pacote: em Node 26.7 é o 8.x, enquanto a api instala o 6.x. Passar um
 * `Agent` de um para o `fetch` do outro morre com `invalid onError method`, que
 * o Node embrulha como um `fetch failed` sem nenhuma pista — e derrubava TODA
 * chamada de IA (medido em 2026-08-29). Vindos do mesmo pacote, `Agent` e
 * `fetch` concordam por construção, e o próximo bump de Node não reabre isto.
 */
const TIMEOUT_MS = 15 * 60_000;
const dispatcher = new Agent({ headersTimeout: TIMEOUT_MS, bodyTimeout: TIMEOUT_MS });

/**
 * Credencial por ADC (Application Default Credentials) — a MESMA cadeia nos
 * três ambientes, resolvida pela google-auth-library nesta ordem:
 *
 *   1. `GOOGLE_APPLICATION_CREDENTIALS` (o compose de dev monta o ADC do host);
 *   2. o arquivo do `gcloud auth application-default login` (dev na máquina);
 *   3. o metadata server (Cloud Run) — que era o ÚNICO caminho aqui antes.
 *
 * Trocar o metadata server por isto é o que faz o Vertex funcionar fora do
 * Cloud Run: `metadata.google.internal` não resolve no macOS nem no container,
 * então em dev toda chamada de IA morria e a api ficava presa no MockProvider.
 * A instância é única no módulo porque a lib cacheia o token e o renova sozinha.
 */
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

/** Catálogo por região, MEDIDO no projeto do contrato: o `gemini-3.6-flash` só
 *  responde em `global` (404 em southamerica-east1, us-east1 e us-central1), e a
 *  família 2.0 saiu do catálogo. Daí o par default 3.6-flash + `global`.
 *  Em imagem valem `gemini-3.1-flash-image`, `gemini-2.5-flash-image` (o Nano
 *  Banana) e `gemini-3-pro-image`; não existe 3.x flash-image fora do 3.1. */
const MODELO_PADRAO = "gemini-3.6-flash";
const LOCALIZACAO_PADRAO = "global";
const MODELO_IMAGEM_PADRAO = "gemini-3.1-flash-image";

/**
 * Proporção pedida ao modelo de imagem. NÃO é enfeite: o `AssetsService`
 * normaliza tudo para 1080×1350 com `fit: "cover"`, e o 3.1-flash-image, sem
 * `imageConfig`, devolve 1408×768 (paisagem) — o corte jogaria fora mais da
 * METADE da largura, com a composição do modelo decidida para outro formato.
 * Com 4:5 ele devolve 928×1152 e o corte vira só um ajuste de escala.
 * MEDIDO: o modelo aceita 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9 e 21:9,
 * TODAS pelo mesmo custo em tokens — se uma experiência futura precisar de
 * outro formato, o caminho é um parâmetro em `generateImage`, não um recorte
 * depois. `imageSize: "1K"` dá 928×1152; "2K" daria 1856×2304 por ~50% mais
 * tokens, resolução que o card de 1080 não aproveita.
 */
export const PROPORCAO_IMAGEM = "4:5";
const TAMANHO_IMAGEM = "1K";

/**
 * A síntese de fala NÃO fica no aiplatform: ela é a Cloud Text-to-Speech
 * (`texttospeech.googleapis.com`), com os mesmos modelos Gemini por trás e o
 * MESMO ADC. Por isso não passa por `endpointVertex` — o host, o caminho e o
 * corpo são outros, e forçá-los no mesmo helper misturaria dois contratos.
 *
 * A API precisa estar habilitada no projeto (`gcloud services enable
 * texttospeech.googleapis.com`); sem isso a resposta é 403 e a mídia cai no
 * fallback de transcrição, que é o comportamento seguro.
 */
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const MODELO_VOZ_PADRAO = "gemini-2.5-flash-tts";
const IDIOMA_PADRAO = "pt-BR";

/**
 * Tetos do `text:synthesize`, em BYTES (não em caracteres — acento conta 2).
 * O texto e a direção somam 8.000, com 4.000 para cada um. Acima disso a API
 * responde 400, e o roteiro precisa ser quebrado em faixas pelo domínio.
 */
export const TTS_LIMITE_TEXTO = 4_000;
export const TTS_LIMITE_DIRECAO = 4_000;

/**
 * O mapa entre o timbre do domínio e o catálogo de vozes do vendor — a ÚNICA
 * tradução, e a razão de `AiTimbre` existir: uma experiência pede "idosa
 * assustada", não "Gacrux".
 *
 * As vozes do Gemini-TTS não são marcadas por idade; o que as separa é o
 * caráter do timbre. A escolha abaixo é a que soou mais próxima de cada faixa
 * em pt-BR, e é ajustável sem tocar em nenhum roteiro.
 */
const VOZ_DO_TIMBRE: Record<AiTimbre, string> = {
  "jovem-feminino": "Leda",
  "jovem-masculino": "Puck",
  "adulto-feminino": "Aoede",
  "adulto-masculino": "Charon",
  "idoso-feminino": "Gacrux",
  "idoso-masculino": "Iapetus",
};

/**
 * `global` não tem host regional (`https://aiplatform.googleapis.com`) — é a
 * única forma de alcançar modelo que a região não publica, e por isso virou o
 * default: o gemini-3.6-flash não existe em nenhuma região testada. Pôr uma
 * região na env volta ao host com prefixo. Exportado para teste.
 */
export function endpointVertex(alvo: { project?: string; location: string; model: string }): string {
  const host =
    alvo.location === "global" ? "aiplatform.googleapis.com" : `${alvo.location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${alvo.project}/locations/${alvo.location}/publishers/google/models/${alvo.model}:generateContent`;
}

/** O mesmo endereço, no método que devolve aos pedaços (`alt=sse`: uma linha
 *  `data:` por pedaço, cada uma um `GenerateContentResponse` inteiro). */
export function endpointVertexEmFluxo(alvo: { project?: string; location: string; model: string }): string {
  return endpointVertex(alvo).replace(/:generateContent$/, ":streamGenerateContent?alt=sse");
}

/**
 * Lê um corpo SSE do Vertex e devolve cada `data:` já como objeto. Puro sobre
 * o iterável de bytes — exportado para o teste não precisar de rede.
 *
 * Decide por LINHA (como o cliente do Agent Engine): um pedaço de rede pode
 * cortar uma linha no meio, então o resto fica no buffer até a próxima quebra.
 * Linha que não é JSON é descartada — um pedaço ilegível não derruba a fala.
 */
export async function* lerSseDoVertex(corpo: AsyncIterable<Uint8Array>): AsyncGenerator<RespostaGenerate> {
  const decodificador = new TextDecoder();
  let resto = "";
  const deLinha = (linha: string): RespostaGenerate | null => {
    const limpa = linha.trim();
    if (!limpa.startsWith("data:")) return null;
    try {
      return JSON.parse(limpa.slice(5).trim()) as RespostaGenerate;
    } catch {
      return null;
    }
  };
  for await (const pedaco of corpo) {
    resto += decodificador.decode(pedaco, { stream: true });
    const linhas = resto.split("\n");
    resto = linhas.pop() ?? "";
    for (const linha of linhas) {
      const dado = deLinha(linha);
      if (dado) yield dado;
    }
  }
  resto += decodificador.decode();
  const ultima = deLinha(resto);
  if (ultima) yield ultima;
}

/**
 * Os modelos 2.5 e 3.x "pensam" por padrão E os tokens de raciocínio saem do
 * `maxOutputTokens` — medido também no 3.6-flash, que gastou 521 tokens de
 * pensamento numa resposta de três frases. MEDIDO no gemini-2.5-flash: com
 * pensamento dinâmico o
 * modelo gastou o teto inteiro pensando e devolveu texto VAZIO com
 * `finishReason: MAX_TOKENS` — que na app-90 vira "o plano ficou grande demais"
 * sem nenhum plano. O app origem (Claude via OpenRouter) não tinha essa etapa,
 * então `0` (desligado) é o valor de PARIDADE e o default aqui.
 * `VERTEX_THINKING_BUDGET=-1` volta ao pensamento dinâmico; `>0` põe teto.
 */
export function thinkingConfig(): Record<string, unknown> {
  const bruto = process.env.VERTEX_THINKING_BUDGET;
  const budget = bruto === undefined || bruto.trim() === "" ? 0 : Number(bruto);
  if (!Number.isInteger(budget) || budget < -1) return { thinkingConfig: { thinkingBudget: 0 } };
  return { thinkingConfig: { thinkingBudget: budget } };
}

/**
 * Uma parte do turno do modelo. `thought: true` marca raciocínio — que NÃO é
 * fala: incluí-lo faria o pensamento do modelo aparecer na tela do estudante.
 */
type ParteVertex = {
  text?: string;
  thought?: boolean;
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: { name?: string; response: Record<string, unknown> };
};

type ConteudoVertex = { role?: string; parts?: ParteVertex[] };

export type RespostaGenerate = {
  candidates?: Array<{
    content?: ConteudoVertex;
    finishReason?: string;
  }>;
  usageMetadata?: UsoDoVertex;
};

type UsoDoVertex = {
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
};

/**
 * Entrada e saída COBRADAS. A saída é o total menos a entrada, e não o
 * `candidatesTokenCount`: o raciocínio (`thoughtsTokenCount`) fica fora deste,
 * e a Vertex o cobra na tarifa de saída. Sem `usageMetadata`, nada a dividir.
 */
export function divisaoDoUso(uso: UsoDoVertex | undefined): DivisaoDeTokens | undefined {
  if (!uso || typeof uso.totalTokenCount !== "number") return undefined;
  const entrada = uso.promptTokenCount ?? 0;
  return { entrada, saida: Math.max(0, uso.totalTokenCount - entrada) };
}

/** Provider Vertex/Gemini. Único arquivo que conhece o vendor.
 *  Trocar de provedor = novo arquivo implementando AiProvider + env AI_PROVIDER. */
export class VertexProvider implements AiProvider {
  private async accessToken(): Promise<string> {
    try {
      const token = await auth.getAccessToken();
      if (!token) throw new Error("a credencial resolvida não devolveu access token");
      return token;
    } catch (erro) {
      throw new ErroDeGeracao(
        "Sem credencial do Google Cloud para falar com o Vertex.",
        `${erro instanceof Error ? erro.message : erro}. Em dev: 'gcloud auth application-default login'. ` +
          "Em container: monte o ADC e aponte GOOGLE_APPLICATION_CREDENTIALS. " +
          "Em Cloud Run: nada a fazer (a SA do serviço é a credencial) — confira se ela tem roles/aiplatform.user.",
      );
    }
  }

  private endpoint(modelo?: string): string {
    const project = process.env.VERTEX_PROJECT_ID;
    const location = process.env.VERTEX_LOCATION ?? LOCALIZACAO_PADRAO;
    const model = modelo ?? process.env.VERTEX_MODEL ?? MODELO_PADRAO;
    return endpointVertex({ project, location, model });
  }

  /** `longo` → modelo com saída grande: o plano anual passa de 8k tokens de
   *  saída, teto de modelos menores. Hoje `longo` e `padrao` são o mesmo
   *  modelo; a env separada existe para trocar um sem mexer no outro. */
  private modeloPara(familia: AiRequest["modelo"]): string | undefined {
    if (familia === "longo") return process.env.VERTEX_MODEL_LONGO ?? MODELO_PADRAO;
    return undefined;
  }

  async generate(req: AiRequest): Promise<AiResult> {
    const res = await fetchDoUndici(this.endpoint(this.modeloPara(req.modelo)), {
      method: "POST",
      headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 512,
          ...(req.temperatura !== undefined ? { temperature: req.temperatura } : {}),
          ...thinkingConfig(),
        },
      }),
      dispatcher,
    });
    if (!res.ok) {
      const corpo = (await res.text()).slice(0, 300);
      throw new ErroDeGeracao(`Vertex respondeu ${res.status}`, corpo);
    }
    const data = (await res.json()) as RespostaGenerate;
    const candidato = data.candidates?.[0];
    // Modelos 2.5 podem devolver vários `parts` (pensamento + texto): concatenar
    // todos em vez de ler só o primeiro.
    const texto = (candidato?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    // Sintoma silencioso do raciocínio ligado: MAX_TOKENS com zero texto. Sem
    // esta mensagem o erro vira "o plano ficou grande demais" e manda o
    // professor tentar de novo para sempre.
    const pensamento = data.usageMetadata?.thoughtsTokenCount ?? 0;
    if (!texto && candidato?.finishReason === "MAX_TOKENS" && pensamento > 0) {
      throw new ErroDeGeracao(
        "O modelo gastou todo o limite de saída pensando e não escreveu o texto.",
        `thoughtsTokenCount=${pensamento}. Baixe VERTEX_THINKING_BUDGET (0 = desligado) ou suba maxTokens.`,
      );
    }
    return {
      texto,
      tokensUsados: data.usageMetadata?.totalTokenCount ?? 0,
      tokensEntrada: data.usageMetadata?.promptTokenCount,
      tokensSaida: data.usageMetadata?.candidatesTokenCount,
      finishReason: candidato?.finishReason,
    };
  }

  /** Loop de retry com reforço do erro anterior — padrão herdado do projeto
   *  origem (lib/gemini/cliente.ts): validação que lança faz regerar. */
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    const tentativas = req.tentativas ?? 3;
    let ultimoErro = "";
    let ultimaFalhaHttp: ErroHttpDoVertex | undefined;

    for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
      const reforco = ultimoErro
        ? `\n\nA tentativa anterior foi rejeitada por: ${ultimoErro}. Corrija e devolva JSON válido.`
        : "";
      try {
        const res = await fetchDoUndici(this.endpoint(this.modeloPara(req.modelo)), {
          method: "POST",
          headers: {
            authorization: `Bearer ${await this.accessToken()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
            contents: [{ role: "user", parts: [{ text: req.prompt + reforco }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: paraSchemaVertex(req.responseSchema),
              temperature: req.temperatura ?? 1,
              ...(req.maxTokens !== undefined ? { maxOutputTokens: req.maxTokens } : {}),
              ...thinkingConfig(),
            },
          }),
          dispatcher,
        });
        // Sem esta checagem um 403/429 vira "resposta vazia": o corpo de erro
        // não traz `candidates`, o retry gasta as três tentativas e a causa
        // morre atrás de "Falha ao gerar conteúdo estruturado". `generate` já
        // checava; aqui faltava, e custou uma tarde de investigação.
        if (!res.ok) {
          throw new ErroHttpDoVertex(res.status, (await res.text()).slice(0, 300));
        }
        const data = (await res.json()) as RespostaGenerate;
        // ANTES de validar: uma tentativa rejeitada por `validar` foi cobrada
        // igual, e a quota conta o que foi pago, não o que serviu.
        req.aoUsarTokens?.(data.usageMetadata?.totalTokenCount ?? 0, divisaoDoUso(data.usageMetadata));
        const candidato = data.candidates?.[0];
        const texto = candidato?.content?.parts?.map((p) => p.text ?? "").join("").trim();
        // JSON truncado falha no `JSON.parse` com "Unexpected end of JSON
        // input", que não conta a quem lê que o teto de saída é o culpado.
        if (!texto && candidato?.finishReason === "MAX_TOKENS") {
          throw new Error("a resposta estourou o teto de saída (maxTokens) antes de fechar o JSON");
        }
        if (!texto) throw new Error("resposta vazia");
        return req.validar(JSON.parse(texto));
      } catch (erro) {
        // Falha de TRANSPORTE não é falha de conteúdo, e tratá-las igual foi o
        // que escondeu a causa: reforçar o prompt não conserta permissão nem
        // projeto errado. 4xx (menos 429) morre na primeira — repetir só adia
        // o erro; 429 e 5xx são passageiros e seguem no laço.
        if (erro instanceof ErroHttpDoVertex) {
          ultimaFalhaHttp = erro;
          if (erro.status !== 429 && erro.status < 500) throw erro;
        }
        ultimoErro = erro instanceof Error ? erro.message.slice(0, 300) : "erro desconhecido";
        if (tentativa === tentativas) {
          // O status é a informação acionável; a mensagem genérica só seria
          // ruído por cima dela.
          if (ultimaFalhaHttp) throw ultimaFalhaHttp;
          throw new ErroDeGeracao("Falha ao gerar conteúdo estruturado.", ultimoErro);
        }
        await new Promise((r) => setTimeout(r, 400 * tentativa));
      }
    }
    if (ultimaFalhaHttp) throw ultimaFalhaHttp;
    throw new ErroDeGeracao("Falha ao gerar conteúdo estruturado.", ultimoErro);
  }

  /**
   * Conversa multi-turno com ferramentas (`AiProvider.conversar`).
   *
   * Duas camadas, e a ordem importa:
   *   - `umaTentativa()` é o laço de FERRAMENTA — o modelo pede `usar_dados`, a
   *     api roda, o resultado volta, o modelo narra. Até `maxVoltas` idas.
   *   - `conversar()` é o laço de TENTATIVA — se a fala for recusada por
   *     `validar`, o motivo entra no prompt e ele tenta de novo sabendo por quê.
   *
   * O tempo todo `tokens` acumula, inclusive nas tentativas rejeitadas: foi
   * pago, e quem tem teto de custo por sessão precisa contar o que foi pago.
   */
  async conversar(req: AiConversaRequest): Promise<AiResult> {
    const maxVoltas = req.maxVoltas ?? 6;
    const tentativas = req.tentativas ?? 3;
    const declaracoes = req.ferramentas?.declaracoes ?? [];
    const tools =
      declaracoes.length > 0
        ? [
            {
              functionDeclarations: declaracoes.map((f) => ({
                name: f.nome,
                description: f.descricao,
                parameters: paraSchemaVertex(f.parametros),
              })),
            },
          ]
        : undefined;

    let tokens = 0;
    let tokensEntrada = 0;
    let tokensSaida = 0;

    const umaTentativa = async (reforco: string): Promise<{ texto: string; voltas: number; finishReason?: string }> => {
      // O histórico é remontado a cada tentativa: a tentativa anterior foi
      // REJEITADA, e deixar a fala recusada no contexto ensinaria o erro.
      const contents: ConteudoVertex[] = req.historico.map((m) => ({
        role: m.papel === "estudante" ? "user" : "model",
        parts: [{ text: m.texto }],
      }));

      for (let volta = 0; volta < maxVoltas; volta += 1) {
        const res = await fetchDoUndici(this.endpoint(), {
          method: "POST",
          headers: {
            authorization: `Bearer ${await this.accessToken()}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system + reforco }] },
            contents,
            ...(tools ? { tools } : {}),
            generationConfig: {
              maxOutputTokens: req.maxTokens ?? 3000,
              ...(req.temperatura !== undefined ? { temperature: req.temperatura } : {}),
              ...thinkingConfig(),
            },
          }),
          dispatcher,
        });
        if (!res.ok) {
          const corpo = (await res.text()).slice(0, 300);
          throw new ErroDeGeracao(`Vertex respondeu ${res.status}`, corpo);
        }
        const data = (await res.json()) as RespostaGenerate;
        tokens += data.usageMetadata?.totalTokenCount ?? 0;
        tokensEntrada += data.usageMetadata?.promptTokenCount ?? 0;
        tokensSaida += data.usageMetadata?.candidatesTokenCount ?? 0;

        const candidato = data.candidates?.[0];
        const partes = candidato?.content?.parts ?? [];
        /**
         * TODAS as chamadas da volta, não só a primeira.
         *
         * O modelo faz function calling PARALELO: um turno pode trazer várias
         * partes `functionCall` ("carrega o cadastro E roda o modelo"), e o
         * Vertex exige uma `functionResponse` para CADA uma — responder só a
         * primeira devolve 400 com "the number of function response parts is
         * equal to the number of function call parts". MEDIDO: acontece na
         * primeira volta de um turno em que o estudante pede fonte e leitura na
         * mesma frase.
         */
        const chamadas = partes.flatMap((parte) => (parte.functionCall ? [parte.functionCall] : []));

        if (chamadas.length === 0 || !req.ferramentas) {
          // A fala sai das partes, DESCARTANDO as de raciocínio: com pensamento
          // ligado, um turno com ferramenta trazia o texto só na parte de
          // `thought`, e ler tudo punha o raciocínio do modelo na tela.
          const texto = partes
            .filter((parte) => parte.thought !== true && typeof parte.text === "string")
            .map((parte) => parte.text)
            .join("");
          return { texto, voltas: volta, finishReason: candidato?.finishReason };
        }

        /**
         * Em SÉRIE, não em paralelo: o executor do domínio muda estado (carregar
         * fonte, registrar alocação), e `Promise.all` deixaria a ordem das
         * transições ao acaso. O modelo pediu as duas coisas; a ordem em que ele
         * as pediu é a ordem em que elas acontecem.
         */
        const respostas: ParteVertex[] = [];
        for (const chamada of chamadas) {
          const resultado = await req.ferramentas.executar(chamada.name ?? "", chamada.args ?? {});
          respostas.push({ functionResponse: { name: chamada.name, response: { resultado } } });
        }

        // O turno do modelo volta VERBATIM. Remontar `{ functionCall }` à mão
        // perde o `thoughtSignature` que veio junto e o Vertex recusa a
        // continuação com 400 — a ferramenta roda, mas a narrativa nunca chega.
        contents.push(
          candidato?.content ?? {
            role: "model",
            parts: chamadas.map((c) => ({ functionCall: c })),
          },
        );
        // UMA resposta por chamada, na mesma ordem: é o que o protocolo exige.
        contents.push({ role: "user", parts: respostas });
      }

      // Estourar as voltas não é resposta: é o modelo preso pedindo ferramenta
      // para sempre. Vira motivo de recusa, e a tentativa seguinte pode salvar.
      return { texto: "", voltas: maxVoltas, finishReason: "MAX_VOLTAS" };
    };

    let ultimoErro = "";
    for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
      const reforco = ultimoErro
        ? `\n\nSua resposta anterior foi rejeitada por: ${ultimoErro}. Corrija.` +
          (tentativa === tentativas
            ? " ÚLTIMA CHANCE: responda em UMA frase curta, SEM chamar ferramenta e SEM escrever" +
              " nome de ferramenta nem colchete de protocolo. " +
              (req.socorro ?? "Diga o que você precisaria consultar para responder.")
            : "")
        : "";

      const { texto, voltas, finishReason } = await umaTentativa(reforco);
      const motivos = [
        ...(req.validar?.(texto) ?? []),
        // Vazio passava por toda a validação — nenhum termo proibido, nenhum
        // número, tamanho zero — e só estourava depois, como erro seco.
        ...(texto.trim().length === 0 ? ["você não escreveu nada. Responda em uma frase curta"] : []),
        // Cortada no teto é cortada no meio de uma frase. Sem isto ela chegava
        // ao estudante assim, em silêncio.
        ...(finishReason === "MAX_TOKENS"
          ? ["sua resposta foi cortada por ser longa demais. Responda em bem menos palavras"]
          : []),
      ];

      if (motivos.length === 0) {
        return { texto, tokensUsados: tokens, tokensEntrada, tokensSaida, finishReason, voltas, tentativas: tentativa };
      }
      ultimoErro = motivos.join("; ").slice(0, 300);
      if (tentativa < tentativas) await new Promise((r) => setTimeout(r, 400 * tentativa));
    }

    throw new ErroDeGeracao("O modelo não respondeu de forma aceitável.", ultimoErro);
  }

  /**
   * Conversa sem ferramentas, aos pedaços (`AiProvider.conversarEmFluxo`).
   *
   * `streamGenerateContent?alt=sse` e não `generateContent`: quem lê é o avatar
   * da Ajuda, que começa a falar no primeiro pedaço e desiste se o primeiro
   * byte passar de 10 s (MEDIDO no spike da ADR-132). Esperar a resposta
   * inteira somaria o tempo de geração ao silêncio da pessoa.
   *
   * As partes de raciocínio (`thought: true`) ficam FORA da fala, como em
   * `conversar`. O uso de tokens chega no último pedaço (`usageMetadata`
   * acumulado) — por isso o total vem do maior valor visto, não da soma.
   */
  async *conversarEmFluxo(req: AiFluxoRequest): AsyncGenerator<AiFluxoEvento> {
    const project = process.env.VERTEX_PROJECT_ID;
    const location = process.env.VERTEX_LOCATION ?? LOCALIZACAO_PADRAO;
    const model = process.env.VERTEX_MODEL ?? MODELO_PADRAO;
    const res = await fetchDoUndici(endpointVertexEmFluxo({ project, location, model }), {
      method: "POST",
      headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.historico.map((m) => ({
          role: m.papel === "pessoa" ? "user" : "model",
          parts: [{ text: m.texto }],
        })),
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 1024,
          ...(req.temperatura !== undefined ? { temperature: req.temperatura } : {}),
          ...thinkingConfig(),
        },
      }),
      dispatcher,
      ...(req.sinal ? { signal: req.sinal } : {}),
    });
    if (!res.ok || !res.body) {
      const corpo = (await res.text()).slice(0, 300);
      throw new ErroDeGeracao(`Vertex respondeu ${res.status}`, corpo);
    }

    let tokens = 0;
    let tokensEntrada: number | undefined;
    let tokensSaida: number | undefined;
    let finishReason: string | undefined;
    let texto = "";
    for await (const dado of lerSseDoVertex(res.body)) {
      const candidato = dado.candidates?.[0];
      const pedaco = (candidato?.content?.parts ?? [])
        .filter((p) => p.thought !== true && typeof p.text === "string")
        .map((p) => p.text)
        .join("");
      if (pedaco) {
        texto += pedaco;
        yield { tipo: "texto", texto: pedaco };
      }
      if (candidato?.finishReason) finishReason = candidato.finishReason;
      const uso = dado.usageMetadata;
      if (uso?.totalTokenCount !== undefined) tokens = Math.max(tokens, uso.totalTokenCount);
      if (uso?.promptTokenCount !== undefined) tokensEntrada = uso.promptTokenCount;
      if (uso?.candidatesTokenCount !== undefined) tokensSaida = uso.candidatesTokenCount;
    }
    yield { tipo: "fim", resultado: { texto, tokensUsados: tokens, tokensEntrada, tokensSaida, finishReason } };
  }

  /** Imagem via modelo próprio (VERTEX_IMAGE_MODEL) com responseModalities —
   *  porte do `gerarImagemBytes` do origem para o endpoint Vertex/ADC. */
  async generateImage(prompt: string, opcoes?: AiImagemOpcoes): Promise<Buffer> {
    const modelo = process.env.VERTEX_IMAGE_MODEL ?? MODELO_IMAGEM_PADRAO;
    const proporcao = opcoes?.proporcao ?? PROPORCAO_IMAGEM;
    const res = await fetchDoUndici(this.endpoint(modelo), {
      method: "POST",
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: proporcao, imageSize: TAMANHO_IMAGEM },
        },
      }),
      dispatcher,
    });
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
      usageMetadata?: UsoDoVertex;
    };
    // Antes de conferir a imagem: resposta sem imagem foi cobrada igual.
    opcoes?.aoUsarTokens?.(data.usageMetadata?.totalTokenCount ?? 0, divisaoDoUso(data.usageMetadata));
    const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!inline?.data) throw new ErroDeGeracao("O modelo não devolveu imagem.");
    return Buffer.from(inline.data, "base64");
  }

  /**
   * Fala sintetizada pela Cloud Text-to-Speech, em MP3.
   *
   * **MP3 e não PCM** por uma razão operacional: não há ffmpeg neste
   * repositório (só o binário mínimo emprestado do Playwright, que não
   * converte áudio), e um WAV de 3m30 passaria de 10 MB. O `audioEncoding`
   * resolve na origem o que aqui sairia caro.
   *
   * **Um pedido por diálogo.** Quando há `turnos`, o modelo multi-falante
   * recebe a conversa inteira e ajusta pausa e entonação entre as vozes.
   * Sintetizar cada fala à parte e concatenar devolveria duas leituras em voz
   * alta, não um episódio de podcast.
   */
  async generateSpeech(req: AiSpeechRequest): Promise<Buffer> {
    const modelo = process.env.VERTEX_TTS_MODEL ?? MODELO_VOZ_PADRAO;
    const idioma = req.idioma ?? IDIOMA_PADRAO;

    if (!req.texto && (!req.turnos || req.turnos.length === 0)) {
      throw new ErroDeGeracao("Nada para falar: pedido sem texto e sem turnos.");
    }
    if (req.falantes.length === 0) {
      throw new ErroDeGeracao("Pedido de fala sem nenhum falante declarado.");
    }

    // Os tetos são em BYTES: em pt-BR cada acento conta 2, e medir por
    // `length` deixaria passar um roteiro que a API recusa com 400.
    const corpo = req.texto ?? req.turnos!.map((t) => t.texto).join(" ");
    const bytesDoTexto = Buffer.byteLength(corpo, "utf8");
    if (bytesDoTexto > TTS_LIMITE_TEXTO) {
      throw new ErroDeGeracao(
        "O roteiro é longo demais para uma síntese só.",
        `${bytesDoTexto} bytes, teto de ${TTS_LIMITE_TEXTO}. Quebre em faixas no domínio.`,
      );
    }
    if (req.direcao && Buffer.byteLength(req.direcao, "utf8") > TTS_LIMITE_DIRECAO) {
      throw new ErroDeGeracao("A direção de atuação é longa demais.");
    }

    const input: Record<string, unknown> = req.turnos
      ? { multiSpeakerMarkup: { turns: req.turnos.map((t) => ({ speaker: t.falante, text: t.texto })) } }
      : { text: req.texto };
    if (req.direcao) input.prompt = req.direcao;

    // Monólogo usa `voiceConfig`; diálogo usa `multiSpeakerVoiceConfig`. Mandar
    // o segundo com um falante só faz a API recusar o markup ausente.
    const voice: Record<string, unknown> = { languageCode: idioma, modelName: modelo };
    if (req.turnos) {
      voice.multiSpeakerVoiceConfig = {
        speakerVoiceConfigs: req.falantes.map((f) => ({
          speakerAlias: f.nome,
          speakerId: VOZ_DO_TIMBRE[f.timbre],
        })),
      };
    } else {
      voice.name = VOZ_DO_TIMBRE[req.falantes[0]!.timbre];
    }

    const res = await fetchDoUndici(TTS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        "content-type": "application/json",
        // MEDIDO, e é a diferença entre esta API e o aiplatform: com ADC de
        // USUÁRIO (o `gcloud auth application-default login` de quem
        // desenvolve), a Cloud TTS responde 403 PERMISSION_DENIED pedindo um
        // "quota project" — que a credencial de usuário não carrega. O
        // aiplatform não exige, então imagem funciona e voz não, e o erro não
        // diz nada sobre voz. O header resolve sem mexer no ADC da máquina de
        // ninguém; em Cloud Run a service account já traz o projeto, e mandá-lo
        // de novo é inofensivo.
        ...(process.env.VERTEX_PROJECT_ID
          ? { "x-goog-user-project": process.env.VERTEX_PROJECT_ID }
          : {}),
      },
      body: JSON.stringify({ input, voice, audioConfig: { audioEncoding: "MP3" } }),
      dispatcher,
    });

    if (!res.ok) {
      // O 403 mais comum aqui é a API não estar habilitada no projeto — dizer
      // isso poupa a caçada por permissão de service account.
      const detalhe = (await res.text()).slice(0, 400);
      throw new ErroDeGeracao(
        "A síntese de voz falhou.",
        `HTTP ${res.status}. ${detalhe}` +
          (res.status === 403
            ? " Confira: gcloud services enable texttospeech.googleapis.com"
            : ""),
      );
    }

    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) throw new ErroDeGeracao("A síntese de voz não devolveu áudio.");
    return Buffer.from(data.audioContent, "base64");
  }
}

/**
 * Resposta HTTP de erro do vendor. Existe para o laço de retry distinguir
 * "o modelo escreveu algo que não serve" (reforçar o prompt e tentar de novo)
 * de "a requisição não passou" — que nenhuma reescrita de prompt conserta, e
 * cujo STATUS é a única coisa que diz o que fazer a seguir.
 */
class ErroHttpDoVertex extends ErroDeGeracao {
  constructor(readonly status: number, corpo: string) {
    super(`Vertex respondeu ${status}`, corpo);
    this.name = "ErroHttpDoVertex";
  }
}

/** O responseSchema do Vertex usa tipos em MAIÚSCULAS (subconjunto OpenAPI). */
function paraSchemaVertex(schema: AiJsonSchema): Record<string, unknown> {
  return {
    type: schema.type.toUpperCase(),
    ...(schema.properties
      ? {
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([k, v]) => [k, paraSchemaVertex(v)]),
          ),
        }
      : {}),
    ...(schema.items ? { items: paraSchemaVertex(schema.items) } : {}),
    ...(schema.required ? { required: schema.required } : {}),
    ...(schema.enum ? { enum: schema.enum } : {}),
    ...(schema.description ? { description: schema.description } : {}),
  };
}
