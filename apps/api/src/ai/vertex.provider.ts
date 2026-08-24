import type { AiProvider, AiRequest, AiResult } from "./provider";

/** Provider Vertex/Gemini. Único arquivo que conhece o vendor.
 *  Trocar de provedor = novo arquivo implementando AiProvider + env AI_PROVIDER. */
export class VertexProvider implements AiProvider {
  async generate(req: AiRequest): Promise<AiResult> {
    const project = process.env.VERTEX_PROJECT_ID;
    const location = process.env.VERTEX_LOCATION ?? "southamerica-east1";
    const model = process.env.VERTEX_MODEL ?? "gemini-2.0-flash";
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
    // Em Cloud Run, usar ADC (metadata server) para o access token:
    const tokenRes = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" } },
    );
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
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
}
