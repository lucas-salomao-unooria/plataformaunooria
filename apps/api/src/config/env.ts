import { z } from "zod";
import { ENV_DO_FUSO, FUSO_PADRAO, fusoEhValido } from "../comum/fuso";
import { ENGINE_RE, MODOS_DO_AGENTE } from "../ai/agente-professor.port";

/**
 * Validação de env com Zod no BOOT (regra do CLAUDE.md: Zod em todo input
 * externo, env incluído). Variável errada derruba o processo na subida,
 * não em runtime no meio de uma requisição.
 */
/** A porta do `/docs` fica na internet, então a senha não pode ser de teclado. */
export const TAMANHO_MINIMO_DA_SENHA_DO_DOCS = 16;

export const EnvSchema = z.object({
  // Lido pela verificação do perfil portátil, que só aceita JWKS por http fora
  // de produção. Fica no schema em vez de `process.env` solto porque a regra da
  // casa é Zod em TODO input externo, env incluído.
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

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
  // A quota diária de IA por perfil NÃO é env desde a ADR-105: mora em
  // `ia_quotas`, semeada pela migration e editada pelo `admin` no painel da
  // Unooria. `AI_DAILY_TOKEN_QUOTA_PER_*` deixou de existir — uma env aqui seria
  // a segunda fonte de verdade, e a tela diria uma coisa enquanto o processo
  // aplica outra.

  // Arte da exp08ef1b. O `gemini-2.0-flash-exp` que era o default aqui não existe
  // mais no catálogo (404 na região E em global), então toda geração caía no
  // fallback procedural. Responde hoje: `gemini-3.1-flash-image` (default),
  // `gemini-2.5-flash-image` e `gemini-3-pro-image`. Quem trocar precisa
  // conferir a proporção devolvida — ver PROPORCAO_IMAGEM no vertex.provider.
  VERTEX_IMAGE_MODEL: z.string().default("gemini-3.1-flash-image"),

  // Voz (`generateSpeech`). Nenhuma missão sintetiza voz hoje: quem usava era o
  // Eco no Grupo, retirado pela ADR-113 — a capacidade fica no provider. Não é o
  // aiplatform: a síntese vem da Cloud Text-to-Speech, com os mesmos modelos
  // Gemini por trás e o MESMO ADC — e a API precisa estar habilitada no
  // projeto (`gcloud services enable texttospeech.googleapis.com`), senão a
  // resposta é 403 e a mídia cai no fallback de transcrição. Respondem hoje:
  // `gemini-2.5-flash-tts` (default), `gemini-2.5-pro-tts` e
  // `gemini-3.1-flash-tts-preview`.
  VERTEX_TTS_MODEL: z.string().default("gemini-2.5-flash-tts"),

  // Tokens de RACIOCÍNIO (famílias 2.5 e 3.x), que saem do `maxOutputTokens`.
  // 0 = desligado (paridade com o app origem, que usava Claude sem thinking e
  // é o que garante que o plano anual caiba no teto de saída); -1 = dinâmico.
  VERTEX_THINKING_BUDGET: z.coerce.number().int().min(-1).default(0),

  /**
   * O agente de IA do professor (`docs/regras/agente-professor.md`).
   *
   * `AGENTE_PROFESSOR_MODO`: `agent-engine` (Vertex AI Agent Engine, ADC) |
   * `local` (o shim de `apps/agente-professor`) | `mock` (enlatado, o da suíte
   * e2e) | `desligado`. **Ausente = `desligado`, em qualquer NODE_ENV** — e é
   * aqui que ele diverge do `AI_PROVIDER`, cujo padrão é `vertex` e derruba a
   * subida sem projeto. O `AI_PROVIDER` serve a produtos que JÁ existem em toda
   * stack; o agente depende de um engine que o Terraform de cada contrato
   * provisiona em momentos diferentes. Derrubar a api inteira por falta dele
   * tiraria do ar todos os produtos para proteger um; desligado, o produto
   * responde `AGENTE_INDISPONIVEL` e o resto segue. O `mock` também NÃO é o
   * padrão de teste: quem testa escolhe o modo explicitamente.
   *
   * `AGENTE_PROFESSOR_ENGINE`: o resource name COMPLETO
   * (`projects/<p>/locations/<r>/reasoningEngines/<id>`) — a região sai dele.
   * `AGENTE_PROFESSOR_URL_LOCAL`: a base do shim (ex.: `http://localhost:8080`).
   */
  AGENTE_PROFESSOR_MODO: z.enum(MODOS_DO_AGENTE).default("desligado"),
  AGENTE_PROFESSOR_ENGINE: z
    .string()
    .regex(ENGINE_RE, "resource name completo: projects/<p>/locations/<r>/reasoningEngines/<id>")
    .optional(),
  AGENTE_PROFESSOR_URL_LOCAL: z.string().url().optional(),

  // Imagens geradas: local (dev, servido pela api em /assets) | gcs (bucket
  // {contrato}-assets atrás da CDN — docs/INFRA.md).
  ASSETS_DRIVER: z.enum(["local", "gcs"]).default("local"),
  /**
   * De onde os bundles das experiências são servidos — o MESMO valor do
   * `NEXT_PUBLIC_CDN_EXP_URL` do hub, mas visto pela api.
   *
   * Serve a UMA coisa: conferir, com um HEAD, se a versão que o painel está
   * ativando existe no bucket antes de gravá-la. Apontar a rede inteira para
   * uma versão que não subiu é tela branca para todo mundo, e o erro só
   * apareceria quando a primeira criança abrisse a missão.
   *
   * AUSENTE = a conferência é PULADA, e a resposta diz isso (`conferida:
   * false`). É o caso de desenvolvimento, onde o hub serve a experiência do dev
   * server do Vite e não existe caminho versionado para conferir. Falhar aqui
   * por falta de env deixaria o painel inutilizável em dev.
   */
  CDN_EXP_URL: z.string().url().optional(),
  ASSETS_BUCKET: z.string().optional(),
  ASSETS_PUBLIC_URL: z.string().url().optional(),
  ASSETS_LOCAL_DIR: z.string().optional(),

  // Chave de serviço da ponte do Ato 1 (`POST /perfis/importar`, chamada pelo
  // jogo externo). Ausente = rota desligada (503), não aberta.
  PERFIL_IMPORT_TOKEN: z.string().optional(),

  // Planos de aula (app-90): conteúdo autoral do professor, em bucket PRIVADO
  // `{contrato}-planos` (docs/INFRA.md) — nunca no de assets, que é público.
  // Em dev, `local` grava em `storage-privado/` (fora do static de /assets).
  PLANOS_DRIVER: z.enum(["local", "gcs"]).default("local"),
  PLANOS_BUCKET: z.string().optional(),
  PLANOS_LOCAL_DIR: z.string().optional(),
  // Chave de serviço da importação das referências curriculares
  // (`POST /planos/referencias`, chamada pelo script local). Ausente = 503.
  PLANOS_IMPORT_TOKEN: z.string().optional(),

  // PERFIL PORTÁTIL: as origens https cujo JWKS esta instalação pode buscar para
  // conferir a assinatura de um documento que chegou de OUTRA rede. O
  // `emissor.hub` vem de dentro do arquivo, ou seja, de um desconhecido — sem
  // allowlist a api sairia buscando a URL que um arquivo mandou (SSRF).
  // Vazia = nenhuma verificação de rede acontece e todo documento entra marcado
  // `nao-verificada`. Degradar VISIVELMENTE é melhor que recusar o direito do
  // titular à portabilidade (LGPD art. 18 V).
  PORTABILIDADE_EMISSORES: z.string().optional(),

  TELEMETRIA_TOPIC: z.string().optional().default(""),
  // Tranca do `POST /telemetry/ingest` (push do Pub/Sub): a SA que assina o
  // push e a audience configurada na subscription. Ausentes = rota fechada,
  // nunca aberta — ver `pubsub-push.guard.ts`. Em dev não há Pub/Sub.
  TELEMETRIA_PUSH_SA: z.string().optional(),
  TELEMETRIA_PUSH_AUDIENCE: z.string().optional(),
  /**
   * Observabilidade (cap. 17 da documentação, ADR-57). Nenhuma é segredo.
   * `LOG_LEVEL`: nível mínimo do pino; `debug` liga o log de query do Prisma.
   * `GCP_PROJECT_ID`: monta `logging.googleapis.com/trace` como
   *   `projects/{id}/traces/{traceId}`. Vazio = log sem correlação (dev).
   * `OBS_TRACE_RATIO`: fração de requisições com spans exportados ao Cloud
   *   Trace (0,02 em produção). 0 = exportador desligado, o default de dev.
   * `OBS_DEBUG=1`: spans e métricas no console local, sem GCP.
   */
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  GCP_PROJECT_ID: z.string().optional(),
  OBS_TRACE_RATIO: z.coerce.number().min(0).max(1).default(0),
  OBS_DEBUG: z.enum(["0", "1"]).default("0"),
  /**
   * O FUSO da plataforma inteira (ADR-99). Ausente = `America/Sao_Paulo` —
   * nada quebra por falta da variável.
   *
   * **Validado no BOOT, e é o ponto da validação estar aqui.** Um typo
   * (`America/SaoPaulo`) não tem sintoma nenhum até alguém renderizar uma data,
   * dias depois do deploy, e aí o que aparece é uma exceção do `Intl` no meio de
   * uma requisição. Aqui ele derruba a subida, que é onde é barato consertar.
   *
   * A MESMA variável vai para o hub (que a escreve num `<meta>` para o
   * navegador) e, de lá, para as experiências pelo `hub:init`. O hub e o bundle
   * NÃO derrubam a tela por causa dela: caem no padrão com aviso no console.
   */
  [ENV_DO_FUSO]: z
    .string()
    .default(FUSO_PADRAO)
    .refine(fusoEhValido, {
      message:
        "não é um fuso IANA que o Intl aceite (ex.: America/Sao_Paulo, America/Manaus, America/Rio_Branco)",
    }),

  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176"),
  PORT: z.coerce.number().int().default(3001),

  /**
   * Credencial do `/docs` (Swagger). AUSENTES ⇒ a rota nem é montada: a api tem
   * domínio próprio no balanceador, e o que a porta protege é o mapa das rotas.
   * Ver `openapi/porta-do-docs.ts`.
   */
  SWAGGER_USUARIO: z.string().min(1).optional(),
  SWAGGER_SENHA: z.string().min(TAMANHO_MINIMO_DA_SENHA_DO_DOCS).optional(),
}).superRefine((env, ctx) => {
  if (env.AI_PROVIDER === "vertex" && !env.VERTEX_PROJECT_ID) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["VERTEX_PROJECT_ID"],
      message:
        "obrigatório com AI_PROVIDER=vertex (em dev, use AI_PROVIDER=mock para subir sem GCP)",
    });
  }

  // Modo escolhido sem o endereço dele: falha na SUBIDA, não no primeiro
  // "AGENTE_INDISPONIVEL" que um professor vê.
  if (env.AGENTE_PROFESSOR_MODO === "agent-engine" && !env.AGENTE_PROFESSOR_ENGINE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AGENTE_PROFESSOR_ENGINE"],
      message: "obrigatório com AGENTE_PROFESSOR_MODO=agent-engine",
    });
  }
  if (env.AGENTE_PROFESSOR_MODO === "local" && !env.AGENTE_PROFESSOR_URL_LOCAL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AGENTE_PROFESSOR_URL_LOCAL"],
      message: "obrigatório com AGENTE_PROFESSOR_MODO=local",
    });
  }
  // Em produção, resposta enlatada ou um shim sem autenticação seriam um
  // professor recebendo texto falso como se fosse o agente.
  if (env.NODE_ENV === "production" && (env.AGENTE_PROFESSOR_MODO === "mock" || env.AGENTE_PROFESSOR_MODO === "local")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AGENTE_PROFESSOR_MODO"],
      message: "mock e local não sobem em produção: use agent-engine ou desligado",
    });
  }

  // Meia credencial não é meia porta: é uma porta que não abre, com alguém
  // achando que configurou a documentação. Falha na SUBIDA, que é onde dá para
  // consertar, e não num 404 inexplicável depois do deploy.
  const usuario = Boolean(env.SWAGGER_USUARIO);
  const senha = Boolean(env.SWAGGER_SENHA);
  if (usuario !== senha) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [usuario ? "SWAGGER_SENHA" : "SWAGGER_USUARIO"],
      message: "as duas variáveis do /docs andam juntas: ou ambas, ou nenhuma",
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
