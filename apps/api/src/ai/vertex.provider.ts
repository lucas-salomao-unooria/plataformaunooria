import { GoogleAuth } from "google-auth-library";
import { Agent } from "undici";
import type {
  AiConversaRequest,
  AiJsonRequest,
  AiJsonSchema,
  AiProvider,
  AiRequest,
  AiResult,
} from "./provider";
import { ErroDeGeracao } from "./provider";

/**
 * O `fetch` do Node (undici) tem `headersTimeout` de 300 s por padrão. Em
 * `generateContent` NÃO-streaming os headers só chegam quando a geração
 * termina — um plano anual de 20–30k tokens leva minutos e estourava no meio.
 * O dispatcher próprio sobe o teto para 15 min só nas chamadas ao Vertex.
 * Evolução, se passar disso: `streamGenerateContent?alt=sse` acumulando chunks.
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

/**
 * Os modelos 2.5 e 3.x "pensam" por padrão E os tokens de raciocínio saem do
 * `maxOutputTokens` — medido também no 3.6-flash, que gastou 521 tokens de
 * pensamento numa resposta de três frases. MEDIDO no gemini-2.5-flash: com
 * pensamento dinâmico o
 * modelo gastou o teto inteiro pensando e devolveu texto VAZIO com
 * `finishReason: MAX_TOKENS` — que na exp-90 vira "o plano ficou grande demais"
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
 * fala: incluí-lo faria o pensamento do modelo aparecer na tela do aluno.
 */
type ParteVertex = {
  text?: string;
  thought?: boolean;
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: { name?: string; response: Record<string, unknown> };
};

type ConteudoVertex = { role?: string; parts?: ParteVertex[] };

type RespostaGenerate = {
  candidates?: Array<{
    content?: ConteudoVertex;
    finishReason?: string;
  }>;
  usageMetadata?: { totalTokenCount?: number; thoughtsTokenCount?: number };
};

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
    const res = await fetch(this.endpoint(this.modeloPara(req.modelo)), {
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
      // `dispatcher` é extensão do undici, fora do tipo padrão de RequestInit.
      ...({ dispatcher } as Record<string, unknown>),
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
      finishReason: candidato?.finishReason,
    };
  }

  /** Loop de retry com reforço do erro anterior — padrão herdado do projeto
   *  origem (lib/gemini/cliente.ts): validação que lança faz regerar. */
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    const tentativas = req.tentativas ?? 3;
    let ultimoErro = "";

    for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
      const reforco = ultimoErro
        ? `\n\nA tentativa anterior foi rejeitada por: ${ultimoErro}. Corrija e devolva JSON válido.`
        : "";
      try {
        const res = await fetch(this.endpoint(), {
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
              ...thinkingConfig(),
            },
          }),
          ...({ dispatcher } as Record<string, unknown>),
        });
        const data = (await res.json()) as RespostaGenerate;
        const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
        if (!texto) throw new Error("resposta vazia");
        return req.validar(JSON.parse(texto));
      } catch (erro) {
        ultimoErro = erro instanceof Error ? erro.message.slice(0, 300) : "erro desconhecido";
        if (tentativa === tentativas) {
          throw new ErroDeGeracao("Falha ao gerar conteúdo estruturado.", ultimoErro);
        }
        await new Promise((r) => setTimeout(r, 400 * tentativa));
      }
    }
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

    const umaTentativa = async (reforco: string): Promise<{ texto: string; voltas: number; finishReason?: string }> => {
      // O histórico é remontado a cada tentativa: a tentativa anterior foi
      // REJEITADA, e deixar a fala recusada no contexto ensinaria o erro.
      const contents: ConteudoVertex[] = req.historico.map((m) => ({
        role: m.papel === "aluno" ? "user" : "model",
        parts: [{ text: m.texto }],
      }));

      for (let volta = 0; volta < maxVoltas; volta += 1) {
        const res = await fetch(this.endpoint(), {
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
          ...({ dispatcher } as Record<string, unknown>),
        });
        if (!res.ok) {
          const corpo = (await res.text()).slice(0, 300);
          throw new ErroDeGeracao(`Vertex respondeu ${res.status}`, corpo);
        }
        const data = (await res.json()) as RespostaGenerate;
        tokens += data.usageMetadata?.totalTokenCount ?? 0;

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
         * primeira volta de um turno em que o aluno pede fonte e leitura na
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
        // ao aluno assim, em silêncio.
        ...(finishReason === "MAX_TOKENS"
          ? ["sua resposta foi cortada por ser longa demais. Responda em bem menos palavras"]
          : []),
      ];

      if (motivos.length === 0) {
        return { texto, tokensUsados: tokens, finishReason, voltas, tentativas: tentativa };
      }
      ultimoErro = motivos.join("; ").slice(0, 300);
      if (tentativa < tentativas) await new Promise((r) => setTimeout(r, 400 * tentativa));
    }

    throw new ErroDeGeracao("O modelo não respondeu de forma aceitável.", ultimoErro);
  }

  /** Imagem via modelo próprio (VERTEX_IMAGE_MODEL) com responseModalities —
   *  porte do `gerarImagemBytes` do origem para o endpoint Vertex/ADC. */
  async generateImage(prompt: string): Promise<Buffer> {
    const modelo = process.env.VERTEX_IMAGE_MODEL ?? MODELO_IMAGEM_PADRAO;
    const res = await fetch(this.endpoint(modelo), {
      method: "POST",
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: PROPORCAO_IMAGEM, imageSize: TAMANHO_IMAGEM },
        },
      }),
      ...({ dispatcher } as Record<string, unknown>),
    });
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
    };
    const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!inline?.data) throw new ErroDeGeracao("O modelo não devolveu imagem.");
    return Buffer.from(inline.data, "base64");
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
