import { Body, Controller, Headers, HttpCode, HttpException, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { TIPO_ERRO_REPORTADO } from "./filtro-de-excecao";
import { classificarDispositivo } from "./dispositivo";
import { logger } from "./logger";
import { Metricas } from "./metricas";
import { normalizarRota } from "./normalizar-rota";
import { ProxyOtlpService } from "./otlp-proxy.service";
import { redigirTexto } from "./redaction";
import {
  CotaExcedidaSchema,
  ErroClienteSchema,
  LIMITE_SPANS_POR_LOTE,
  OtlpTracesSchema,
  SemCorpoSchema,
  VitalSchema,
} from "./contrato-de-rotas";

/** Teto do corpo do lote OTLP: 64 spans com 24 atributos de 256 chars cabem folgado. */
export const TETO_DO_LOTE_OTLP_BYTES = 256 * 1024;
export const ERROS_DE_CLIENTE_POR_MINUTO = 5;
export const VITAIS_POR_MINUTO = 60;

/**
 * Os sinais do navegador entram por aqui (ADR-58) — nunca por SDK de terceiro
 * dentro do bundle. A api já tem o token, a escola e a redaction; o que sai
 * daqui para o Google carrega identificador opaco, nunca nome ou texto.
 */
@Controller("observabilidade")
@UseGuards(OidcGuard)
export class ObservabilidadeController {
  constructor(
    private readonly metricas: Metricas,
    private readonly proxy: ProxyOtlpService,
  ) {}

  private cotaOu429(chave: string, limite: number): void {
    const cota = rateLimit(chave, limite, 60_000);
    if (cota.ok) return;
    throw new HttpException({ codigo: "cota-excedida", retryAfterSeconds: cota.retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
  }

  @Post("erros-cliente")
  @HttpCode(204)
  @Contrato({
    resumo: "Registra um erro não capturado do navegador (experiência ou hub).",
    descricao:
      "A SDK captura `window.onerror`/`unhandledrejection` (dedupe por hash, no máximo 5 por sessão) e manda para cá. A api redige `mensagem` e `stack`, acrescenta `escola_id` e o id opaco do estudante a partir do TOKEN e emite UMA linha `ERROR` no formato que o Error Reporting agrupa, com `serviceContext.service = expId` e `version = versao` — é assim que um erro vira \"novo na versão X\". Nenhum SDK de terceiro entra no bundle (ADR-58).",
    corpo: ErroClienteSchema,
    resposta: SemCorpoSchema,
    notas: [
      "Cota de 5 por minuto por (escola, usuário): acima, **429** `{ codigo: \"cota-excedida\" }` e um contador, sem linha de log — um laço de erro no cliente não pode virar inundação.",
      "`url` sem query string nem fragmento (`.refine`): é neles que mora id, token e texto.",
      "`traceId`/`spanId` opcionais ligam o erro ao trace do navegador quando o OpenTelemetry Web está ligado.",
    ],
  })
  errosCliente(@Body() body: unknown, @Req() req: { auth: AuthClaims; headers: Record<string, unknown> }) {
    const chave = `erro-cliente:${req.auth.escolaId}:${req.auth.usuarioId}`;
    const cota = rateLimit(chave, ERROS_DE_CLIENTE_POR_MINUTO, 60_000);
    if (!cota.ok) {
      this.metricas.errosDeClienteRecusados.add(1, { motivo: "cota", superficie: "autenticado" });
      throw new HttpException({ codigo: "cota-excedida", retryAfterSeconds: cota.retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
    }
    // `safeParse`, e não `parse`: o corpo recusado precisa CONTAR. Sem este
    // contador, um `versao` grande demais recusou todo erro do hub por seis
    // dias e o único vestígio foi uma linha `corpo-invalido` no log.
    const lido = ErroClienteSchema.safeParse(body);
    if (!lido.success) {
      this.metricas.errosDeClienteRecusados.add(1, { motivo: "invalido", superficie: "autenticado" });
      throw new HttpException({ codigo: "corpo-invalido", problemas: lido.error.issues.map((i) => `${i.path.join(".")}: ${i.code}`).join("; ") }, HttpStatus.BAD_REQUEST);
    }
    const erro = lido.data;
    const superficie = erro.expId === "hub" ? "hub" : "exp";
    const dispositivo = classificarDispositivo(
      typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string) : erro.userAgent,
    );
    this.metricas.errosDeClienteRecebidos.add(1, { superficie });
    const mensagem = redigirTexto(erro.mensagem);
    const stack = erro.stack ? redigirTexto(erro.stack) : undefined;
    logger.error(
      {
        "@type": TIPO_ERRO_REPORTADO,
        serviceContext: { service: erro.expId, version: erro.versao },
        codigo: "erro-cliente",
        expId: erro.expId,
        versao: erro.versao,
        url: redigirTexto(erro.url),
        userAgent: erro.userAgent,
        sessaoId: erro.sessaoId,
        /**
         * `usuarioId`, não `estudanteId`: a mesma linha registra erro de
         * professor e de gestor, e o nome antigo dizia que todo erro era de
         * criança. É o id opaco do token — nunca nome, login ou e-mail.
         */
        usuarioId: req.auth.usuarioId,
        autenticado: true,
        perfilDoToken: req.auth.perfil,
        navegador: dispositivo.navegador,
        so: dispositivo.so,
        tipoDeDispositivo: dispositivo.tipo,
        ...(erro.dispositivo ? { dispositivo: erro.dispositivo } : {}),
        ...(erro.traceId ? { traceIdDoNavegador: erro.traceId, spanIdDoNavegador: erro.spanId } : {}),
        // `stack_trace` é o que o Error Reporting agrupa; sem stack, a mensagem serve de assinatura.
        stack_trace: stack ?? mensagem,
      },
      stack ? `${mensagem}\n${stack}` : mensagem,
    );
  }

  @Post("vitals")
  @HttpCode(204)
  @Contrato({
    resumo: "Recebe um Web Vital (LCP, INP, CLS, TTFB) do hub ou de uma experiência.",
    descricao:
      "Amostrado a 10% no cliente, sem identificador de pessoa no corpo. A api normaliza `rota` para um conjunto fechado (`/professor/:secao`, `exp04ef1b`…, senão `outra`) e registra num histograma OpenTelemetry por `superficie`, `rota` e `perfil` (do token). É o único sinal de que \"a plataforma está lenta na escola X\" que não depende de alguém reclamar — e nunca vira log.",
    corpo: VitalSchema,
    resposta: SemCorpoSchema,
    notas: ["Cota de 60 por minuto por (escola, usuário): acima, **429**.", "`valor` acima de 10 minutos é recusado (relógio, não lentidão)."],
  })
  vitals(@Body() body: unknown, @Req() req: { auth: AuthClaims; headers: Record<string, unknown> }) {
    this.cotaOu429(`vitals:${req.auth.escolaId}:${req.auth.usuarioId}`, VITAIS_POR_MINUTO);
    const lido = VitalSchema.safeParse(body);
    if (!lido.success) {
      this.metricas.vitaisRecusados.add(1, { motivo: "invalido", superficie: "autenticado" });
      throw new HttpException({ codigo: "corpo-invalido" }, HttpStatus.BAD_REQUEST);
    }
    const vital = lido.data;
    this.metricas.vital(vital.nome).record(vital.valor, {
      superficie: vital.superficie,
      rota: normalizarRota(vital.rota, vital.superficie),
      perfil: req.auth.perfil,
      /**
       * O ÚNICO rótulo de dispositivo que vira métrica, e é de propósito.
       * `navegador` e `so` ficam no log do erro: com eles aqui, seriam
       * 2 superfícies x ~20 rotas x 5 perfis x 6 navegadores x 3 tipos = 3.600
       * combinações por histograma, e histograma multiplica por bucket. Com só
       * o tipo são 600, e é ele que responde "está lento no celular?".
       */
      tipo_dispositivo: classificarDispositivo(
        typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string) : undefined,
      ).tipo,
    });
  }

  @Post("v1/traces")
  @HttpCode(204)
  @Contrato({
    resumo: "Ingestão OTLP/JSON dos spans que a SDK exporta do navegador.",
    descricao:
      "O OpenTelemetry Web da experiência exporta para cá, com o token da plataforma; o navegador nunca fala com o Cloud Trace. A api valida o lote (Zod fechado: ≤ 64 spans, atributos por allowlist, URLs sem query), SUBSTITUI o `resource` pelo `service.name`/`service.version` validados e reexporta para a Telemetry API do Google com a credencial da própria api. Sem `GCP_PROJECT_ID` (dev) o lote é contado e descartado.",
    corpo: OtlpTracesSchema,
    resposta: SemCorpoSchema,
    notas: [
      `Cota de ${ProxyOtlpService.LOTES_POR_MINUTO} lotes por minuto por (escola, usuário) e teto de ${TETO_DO_LOTE_OTLP_BYTES / 1024} KB por corpo (**413**); acima da cota, **429**.`,
      `Lote com 0 ou mais de ${LIMITE_SPANS_POR_LOTE} spans é descartado (contado em \`spans_descartados{motivo=tamanho}\`).`,
      "Chaves fora do subconjunto (links, traceState, flags) são removidas, não recusadas.",
    ],
  })
  async traces(
    @Body() body: unknown,
    @Req() req: { auth: AuthClaims },
    @Headers("content-length") contentLength?: string,
  ) {
    if (Number(contentLength ?? 0) > TETO_DO_LOTE_OTLP_BYTES) {
      this.metricas.spansDescartados.add(1, { motivo: "tamanho" });
      throw new HttpException({ codigo: "lote-grande-demais" }, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const lote = OtlpTracesSchema.parse(body);
    const resultado = await this.proxy.receber(lote, `${req.auth.escolaId}:${req.auth.usuarioId}`);
    if (resultado === "cota") {
      throw new HttpException(CotaExcedidaSchema.parse({ codigo: "cota-excedida", retryAfterSeconds: 60 }), HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
