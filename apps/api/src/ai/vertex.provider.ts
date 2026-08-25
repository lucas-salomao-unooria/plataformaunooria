import { GoogleAuth } from "google-auth-library";
import { Agent } from "undici";
import type { AiJsonRequest, AiJsonSchema, AiProvider, AiRequest, AiResult } from "./provider";
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
 *  família 2.0 saiu do catálogo. Daí o par default 3.6-flash + `global`. */
const MODELO_PADRAO = "gemini-3.6-flash";
const LOCALIZACAO_PADRAO = "global";
const MODELO_IMAGEM_PADRAO = "gemini-2.5-flash-image";

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

type RespostaGenerate = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
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
        generationConfig: { responseModalities: ["IMAGE"] },
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
  };
}
