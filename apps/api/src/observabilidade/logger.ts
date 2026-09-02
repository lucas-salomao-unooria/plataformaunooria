import pino, { type Logger, type LoggerOptions } from "pino";
import { contextoAtual } from "../tenancy/tenancy-context";
import { redigirObjeto, redigirTexto } from "./redaction";

/**
 * O logger da api — pino em JSON, com os nomes que o Cloud Logging entende.
 *
 * O `stdout` do Cloud Run já é o transporte: uma linha JSON vira `jsonPayload`
 * e três campos viram metadado de primeira classe — `severity`,
 * `logging.googleapis.com/trace` e `logging.googleapis.com/spanId`. Uma linha
 * `ERROR` com `stack_trace` é agrupada pelo Error Reporting sem mais nada.
 *
 * Duas coisas que NÃO se faz aqui, de propósito:
 *  - log de requisição (`autoLogging`): o Cloud Run grava um por requisição,
 *    com método, rota, status, latência e trace. Duplicar dobra o sinal mais
 *    volumoso para acrescentar zero.
 *  - `escola_id` fora do contexto: quem escreve o log não passa escola; ela
 *    vem do `mixin`, do AsyncLocalStorage da requisição.
 */
export const NIVEIS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
export type Nivel = (typeof NIVEIS)[number];

const SEVERIDADE: Record<string, string> = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
};

export interface OpcoesDoLogger {
  nivel: Nivel;
  /** Projeto do contrato: monta `projects/{id}/traces/{traceId}`. Vazio = sem correlação (dev). */
  gcpProjectId?: string;
  servico: string;
  versao: string;
  /** `json` (Cloud Run, testes) ou `pretty` (dev no terminal). */
  formato: "json" | "pretty";
}

/**
 * Cópia do erro com `message` e `stack` redigidos, preservando o protótipo —
 * `instanceof Error` continua verdadeiro e o `type` que o pino grava continua
 * sendo a classe real (`PrismaClientKnownRequestError`, não "Object").
 */
function redigirErro(err: Error): Error {
  const copia = Object.create(Object.getPrototypeOf(err) as object) as Error & Record<string, unknown>;
  for (const chave of Object.getOwnPropertyNames(err)) {
    copia[chave] = (err as unknown as Record<string, unknown>)[chave];
  }
  copia.message = redigirTexto(err.message);
  if (typeof err.stack === "string") copia.stack = redigirTexto(err.stack);
  return copia;
}

export function criarOpcoesDoPino(o: OpcoesDoLogger): LoggerOptions {
  const opcoes: LoggerOptions = {
    level: o.nivel,
    messageKey: "message",
    // RFC 3339 em `time`, que o Cloud Logging lê como timestamp da entrada; o
    // epoch em ms do default não é reconhecido e a linha ganha a hora de ingestão.
    timestamp: pino.stdTimeFunctions.isoTime,
    // Sem pid/hostname (o Cloud Run já sabe a instância). `serviceContext` é o
    // que o Error Reporting usa para separar api de hub e revisão de revisão.
    base: { serviceContext: { service: o.servico, version: o.versao } },
    formatters: {
      // Roda ANTES dos serializers do pino (medido): `err` ainda é o Error.
      // Não se serializa aqui — o serializer padrão faria de novo e o `type`
      // viraria "Object". Só se redige a cópia e se copia a stack para
      // `stack_trace`, o nome que o Error Reporting agrupa por assinatura.
      log: (obj) => {
        const redigido = redigirObjeto(obj) as Record<string, unknown>;
        if (redigido.err instanceof Error) {
          const err = redigirErro(redigido.err);
          redigido.err = err;
          if (typeof err.stack === "string" && redigido.stack_trace === undefined) {
            redigido.stack_trace = err.stack;
          }
        }
        return redigido;
      },
    },
    // Contexto da requisição em TODA linha, sem quem escreve lembrar dele.
    mixin: (_obj, _nivel, logger) => {
      const c = contextoAtual();
      if (!c) return {};
      const bindings = logger.bindings() as { requestId?: string };
      return {
        requestId: bindings.requestId ? undefined : c.requestId,
        escolaId: c.escolaId,
        perfil: c.perfil,
        "logging.googleapis.com/trace":
          o.gcpProjectId && c.traceId ? `projects/${o.gcpProjectId}/traces/${c.traceId}` : undefined,
        "logging.googleapis.com/spanId": c.spanId,
        "logging.googleapis.com/trace_sampled": c.traceId ? c.amostrado : undefined,
      };
    },
    hooks: {
      // A mensagem não passa pelo `formatters.log`; este é o único lugar onde
      // um texto livre (`Token rejeitado: ...`) pode ser redigido.
      logMethod(args, metodo) {
        const redigidos = args.map((a) => (typeof a === "string" ? redigirTexto(a) : a));
        return metodo.apply(this, redigidos as Parameters<typeof metodo>);
      },
    },
  };

  if (o.formato === "json") {
    // `level` numérico → `severity` textual. Só no JSON: o pino-pretty precisa
    // do `level` original para colorir.
    opcoes.formatters = { ...opcoes.formatters, level: (rotulo) => ({ severity: SEVERIDADE[rotulo] ?? "DEFAULT" }) };
  } else {
    opcoes.transport = {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,serviceContext", messageKey: "message" },
    };
  }
  return opcoes;
}

/**
 * Opções lidas do AMBIENTE cru. O Zod do ConfigModule valida os mesmos nomes
 * na subida; aqui não dá para esperá-lo, porque o logger raiz nasce na
 * importação (antes do Nest) e é usado pelo `main.ts` e pelo `otel.ts`.
 */
export function opcoesDoAmbiente(env: NodeJS.ProcessEnv = process.env): OpcoesDoLogger {
  const nivel = (NIVEIS as readonly string[]).includes(env.LOG_LEVEL ?? "") ? (env.LOG_LEVEL as Nivel) : "info";
  const emTerminal = env.NODE_ENV !== "production" && env.NODE_ENV !== "test" && env.LOG_FORMATO !== "json";
  return {
    nivel,
    gcpProjectId: env.GCP_PROJECT_ID || undefined,
    servico: "api",
    // `K_REVISION` é a revisão do Cloud Run — é o que o Error Reporting mostra
    // como "erro novo nesta versão".
    versao: env.K_REVISION ?? "dev",
    formato: emTerminal ? "pretty" : "json",
  };
}

/** O logger raiz. Módulos com DI preferem `Logger`/`PinoLogger` do nestjs-pino; este é para fora do container. */
export const logger: Logger = pino(criarOpcoesDoPino(opcoesDoAmbiente()));
