import { z } from "zod";

/**
 * Validação de env com Zod no BOOT (regra do CLAUDE.md: Zod em todo input
 * externo, env incluído). Variável errada derruba o processo na subida,
 * não em runtime no meio de uma requisição.
 */
export const EnvSchema = z.object({
  DATABASE_URL: z.string().startsWith("postgresql://"),

  // Emissor dos tokens que a api aceita. A api não sabe quem é o emissor: só
  // valida issuer/audience/assinatura. Para apontar ao WSO2 local, ver wso2/README.md
  // — o issuer é tenant-qualified (.../t/{contrato}/oauth2/token) e deve ser
  // copiado LITERAL do discovery, nunca montado por concatenação.
  OIDC_ISSUER: z.string().min(1),
  OIDC_JWKS_URI: z.string().url(),
  OIDC_AUDIENCE: z.string().min(1).default("plataforma-api"),

  AI_PROVIDER: z.enum(["vertex", "mock"]).default("vertex"),
  // Obrigatório quando o provider é `vertex` (superRefine abaixo): sem projeto
  // a URL vira `.../projects/undefined/...` e o erro só aparece na 1ª geração.
  VERTEX_PROJECT_ID: z.string().optional(),
  // `global` é o default porque o gemini-3.6-flash SÓ existe lá: medido no
  // projeto do contrato, ele dá 404 em southamerica-east1, us-east1 e
  // us-central1. Pôr uma região aqui volta ao host regional — e ao catálogo
  // dela (southamerica-east1 tem a família 2.5, não a 3.x nem a 2.0).
  VERTEX_LOCATION: z.string().default("global"),
  VERTEX_MODEL: z.string().default("gemini-3.6-flash"),
  // Modelo de SAÍDA LONGA (`AiRequest.modelo: "longo"`): planos anuais passam
  // de 8k tokens de saída. Hoje é o mesmo modelo do dia a dia; a env separada
  // existe para trocar um sem tocar no outro.
  VERTEX_MODEL_LONGO: z.string().default("gemini-3.6-flash"),
  /**
   * 300k: uma partida completa da exp-03 custa ~77k tokens MEDIDOS (ver
   * `unoogpt/regras/defaults.ts`), e "Recomeçar" abre partida nova — o teto
   * cabe ~4 partidas. O valor anterior, 20000, era dimensionado para o tutor da
   * exp-01 e recusava o 4o turno da missão com "a sala de operações fechou".
   */
  AI_DAILY_TOKEN_QUOTA_PER_ALUNO: z.coerce.number().int().positive().default(300_000),
  // Professor gera planos cujo PROMPT sozinho tem ~220k tokens (currículo +
  // material didático); 2M/dia ≈ 6–9 planos. Regra 5 do CLAUDE.md, por perfil.
  AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR: z.coerce.number().int().positive().default(2_000_000),

  // Arte da exp-01. O `gemini-2.0-flash-exp` que era o default aqui não existe
  // mais no catálogo (404 na região E em global), então toda geração caía no
  // fallback procedural. Responde hoje: `gemini-3.1-flash-image` (default),
  // `gemini-2.5-flash-image` e `gemini-3-pro-image`. Quem trocar precisa
  // conferir a proporção devolvida — ver PROPORCAO_IMAGEM no vertex.provider.
  VERTEX_IMAGE_MODEL: z.string().default("gemini-3.1-flash-image"),

  // Tokens de RACIOCÍNIO (famílias 2.5 e 3.x), que saem do `maxOutputTokens`.
  // 0 = desligado (paridade com o app origem, que usava Claude sem thinking e
  // é o que garante que o plano anual caiba no teto de saída); -1 = dinâmico.
  VERTEX_THINKING_BUDGET: z.coerce.number().int().min(-1).default(0),

  // Imagens geradas: local (dev, servido pela api em /assets) | gcs (bucket
  // {contrato}-assets atrás da CDN — docs/INFRA.md).
  ASSETS_DRIVER: z.enum(["local", "gcs"]).default("local"),
  ASSETS_BUCKET: z.string().optional(),
  ASSETS_PUBLIC_URL: z.string().url().optional(),
  ASSETS_LOCAL_DIR: z.string().optional(),

  // Chave de serviço da ponte do Ato 1 (`POST /perfis/importar`, chamada pelo
  // jogo externo). Ausente = rota desligada (503), não aberta.
  /**
   * Pimenta do hash de CPF. O CPF do estudante é a chave IMUTÁVEL de identidade
   * na rede (é o que o padrão nacional do MEC adota), e por isso nunca é
   * guardado em claro: o banco tem `HMAC-SHA256(cpf, CPF_PEPPER)`.
   *
   * A pimenta é do CONTRATO e não muda: trocá-la invalida todos os hashes e a
   * plataforma deixa de reconhecer as pessoas que já cadastrou. Ausente, a
   * coluna `cpf` da importação é RECUSADA com mensagem explícita — nunca aceita
   * e guardada de outro jeito (regra de falhar fechado).
   */
  CPF_PEPPER: z.string().min(16).optional(),
  PERFIL_IMPORT_TOKEN: z.string().optional(),

  // Planos de aula (exp-90): conteúdo autoral do professor, em bucket PRIVADO
  // `{contrato}-planos` (docs/INFRA.md) — nunca no de assets, que é público.
  // Em dev, `local` grava em `storage-privado/` (fora do static de /assets).
  PLANOS_DRIVER: z.enum(["local", "gcs"]).default("local"),
  PLANOS_BUCKET: z.string().optional(),
  PLANOS_LOCAL_DIR: z.string().optional(),
  // Chave de serviço da importação das referências curriculares
  // (`POST /planos/referencias`, chamada pelo script local). Ausente = 503.
  PLANOS_IMPORT_TOKEN: z.string().optional(),

  TELEMETRIA_TOPIC: z.string().optional().default(""),
  // Tranca do `POST /telemetry/ingest` (push do Pub/Sub): a SA que assina o
  // push e a audience configurada na subscription. Ausentes = rota fechada,
  // nunca aberta — ver `pubsub-push.guard.ts`. Em dev não há Pub/Sub.
  TELEMETRIA_PUSH_SA: z.string().optional(),
  TELEMETRIA_PUSH_AUDIENCE: z.string().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176"),
  PORT: z.coerce.number().int().default(3001),
}).superRefine((env, ctx) => {
  if (env.AI_PROVIDER === "vertex" && !env.VERTEX_PROJECT_ID) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["VERTEX_PROJECT_ID"],
      message:
        "obrigatório com AI_PROVIDER=vertex (em dev, use AI_PROVIDER=mock para subir sem GCP)",
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;

export function validarEnv(config: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const erros = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${erros}`);
  }
  return parsed.data;
}
