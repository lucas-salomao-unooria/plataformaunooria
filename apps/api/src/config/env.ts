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
  VERTEX_PROJECT_ID: z.string().optional(),
  VERTEX_LOCATION: z.string().default("southamerica-east1"),
  VERTEX_MODEL: z.string().default("gemini-2.0-flash"),
  AI_DAILY_TOKEN_QUOTA_PER_ALUNO: z.coerce.number().int().positive().default(20000),

  VERTEX_IMAGE_MODEL: z.string().default("gemini-2.0-flash-exp"),

  // Imagens geradas: local (dev, servido pela api em /assets) | gcs (bucket
  // {contrato}-assets atrás da CDN — docs/INFRA.md).
  ASSETS_DRIVER: z.enum(["local", "gcs"]).default("local"),
  ASSETS_BUCKET: z.string().optional(),
  ASSETS_PUBLIC_URL: z.string().url().optional(),
  ASSETS_LOCAL_DIR: z.string().optional(),

  // Chave de serviço da ponte do Ato 1 (`POST /perfis/importar`, chamada pelo
  // jogo externo). Ausente = rota desligada (503), não aberta.
  PERFIL_IMPORT_TOKEN: z.string().optional(),

  TELEMETRIA_TOPIC: z.string().optional().default(""),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  PORT: z.coerce.number().int().default(3001),
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
