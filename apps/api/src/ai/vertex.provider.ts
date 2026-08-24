import type { AiJsonRequest, AiJsonSchema, AiProvider, AiRequest, AiResult } from "./provider";
import { ErroDeGeracao } from "./provider";

/** Provider Vertex/Gemini. Único arquivo que conhece o vendor.
 *  Trocar de provedor = novo arquivo implementando AiProvider + env AI_PROVIDER. */
export class VertexProvider implements AiProvider {
  private async accessToken(): Promise<string> {
    // Em Cloud Run, usar ADC (metadata server) para o access token:
    const tokenRes = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" } },
    );
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    return access_token;
  }

  private endpoint(modelo?: string): string {
    const project = process.env.VERTEX_PROJECT_ID;
    const location = process.env.VERTEX_LOCATION ?? "southamerica-east1";
    const model = modelo ?? process.env.VERTEX_MODEL ?? "gemini-2.0-flash";
    return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  }

  async generate(req: AiRequest): Promise<AiResult> {
    const res = await fetch(this.endpoint(), {
      method: "POST",
      headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig: { maxOutputTokens: req.maxTokens ?? 512 },
      }),
    });
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { totalTokenCount?: number };
    };
    return {
      texto: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      tokensUsados: data.usageMetadata?.totalTokenCount ?? 0,
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
            },
          }),
        });
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
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
    const modelo = process.env.VERTEX_IMAGE_MODEL ?? "gemini-2.0-flash-exp";
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
