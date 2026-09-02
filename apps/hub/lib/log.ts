import "server-only";
import pino, { type Logger, type LoggerOptions } from "pino";
import { lerTrace } from "./trace-da-requisicao";

/**
 * O logger do hub (lado servidor): pino em JSON com os nomes que o Cloud
 * Logging entende — `severity`, `message`, `time` RFC 3339, `serviceContext` e
 * `logging.googleapis.com/trace`.
 *
 * É uma CÓPIA deliberada do `criarOpcoesDoPino` da api
 * (`apps/api/src/observabilidade/logger.ts`), sem o mixin do AsyncLocalStorage:
 * o Next não expõe um contexto por requisição estável em todos os runtimes,
 * então o contexto entra por `logDaRequisicao(headers)`, que devolve um
 * `child` com `requestId`/trace lidos dos cabeçalhos. Um pacote `@edu/log`
 * para dois consumidores não se paga (packages/AGENTS.md). Mudou a forma da
 * linha? Muda nos dois.
 *
 * O que NÃO se faz aqui, de propósito: log de requisição (o Cloud Run já
 * grava um) e qualquer campo com nome, e-mail ou texto digitado — a redaction
 * por chave apaga, e a regra 6 continua valendo.
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

export const CHAVES_REDIGIDAS: ReadonlySet<string> = new Set([
  "authorization", "cookie", "set-cookie", "token", "senha", "password", "passwordhash",
  "cpf", "username", "email", "nome", "texto", "mensagem", "transcricao", "observacao",
]);
export const MARCA = "[redigido]";
const PROFUNDIDADE_MAXIMA = 8;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/g;
const QUERY_STRING = /\?[^\s"']+/g;

export function redigirTexto(texto: string): string {
  return texto
    .replace(BEARER, `Bearer ${MARCA}`)
    .replace(EMAIL, MARCA)
    .replace(CPF, MARCA)
    .replace(QUERY_STRING, `?${MARCA}`);
}

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  if (valor === null || typeof valor !== "object") return false;
  const proto = Object.getPrototypeOf(valor);
  return proto === Object.prototype || proto === null;
}

export function redigirObjeto<T>(valor: T, profundidade = 0): T {
  if (profundidade > PROFUNDIDADE_MAXIMA) return "[profundo]" as unknown as T;
  if (typeof valor === "string") return redigirTexto(valor) as unknown as T;
  if (Array.isArray(valor)) return valor.map((item) => redigirObjeto(item, profundidade + 1)) as unknown as T;
  if (!ehObjetoSimples(valor)) return valor;
  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor)) {
    saida[chave] = CHAVES_REDIGIDAS.has(chave.toLowerCase()) ? MARCA : redigirObjeto(v, profundidade + 1);
  }
  return saida as T;
}

/** Cópia do erro com `message`/`stack` redigidos, preservando o protótipo (o `type` do pino continua a classe real). */
function redigirErro(err: Error): Error {
  const copia = Object.create(Object.getPrototypeOf(err) as object) as Error & Record<string, unknown>;
  for (const chave of Object.getOwnPropertyNames(err)) {
    copia[chave] = (err as unknown as Record<string, unknown>)[chave];
  }
  copia.message = redigirTexto(err.message);
  if (typeof err.stack === "string") copia.stack = redigirTexto(err.stack);
  return copia;
}

export interface OpcoesDoLogger {
  nivel: Nivel;
  gcpProjectId?: string;
  servico: string;
  versao: string;
  formato: "json" | "pretty";
}

export function criarOpcoesDoPino(o: OpcoesDoLogger): LoggerOptions {
  const opcoes: LoggerOptions = {
    level: o.nivel,
    messageKey: "message",
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { serviceContext: { service: o.servico, version: o.versao } },
    formatters: {
      // Roda ANTES dos serializers do pino: `err` ainda é o Error. Não se
      // serializa aqui (o serializer padrão faria de novo e o `type` viraria
      // "Object"); só se redige a cópia e se copia a stack para `stack_trace`.
      log: (obj) => {
        const redigido = redigirObjeto(obj) as Record<string, unknown>;
        if (redigido.err instanceof Error) {
          const err = redigirErro(redigido.err);
          redigido.err = err;
          if (typeof err.stack === "string" && redigido.stack_trace === undefined) redigido.stack_trace = err.stack;
        }
        return redigido;
      },
    },
    hooks: {
      logMethod(args, metodo) {
        const redigidos = args.map((a) => (typeof a === "string" ? redigirTexto(a) : a));
        return metodo.apply(this, redigidos as Parameters<typeof metodo>);
      },
    },
  };
  if (o.formato === "json") {
    opcoes.formatters = { ...opcoes.formatters, level: (rotulo) => ({ severity: SEVERIDADE[rotulo] ?? "DEFAULT" }) };
  } else {
    opcoes.transport = {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,serviceContext", messageKey: "message" },
    };
  }
  return opcoes;
}

export function opcoesDoAmbiente(env: Record<string, string | undefined> = process.env): OpcoesDoLogger {
  const nivel = (NIVEIS as readonly string[]).includes(env.LOG_LEVEL ?? "") ? (env.LOG_LEVEL as Nivel) : "info";
  const emTerminal = env.NODE_ENV !== "production" && env.NODE_ENV !== "test" && env.LOG_FORMATO !== "json";
  return {
    nivel,
    gcpProjectId: env.GCP_PROJECT_ID || undefined,
    servico: "hub",
    versao: env.K_REVISION ?? "dev",
    formato: emTerminal ? "pretty" : "json",
  };
}

/**
 * O logger raiz. Em `globalThis` porque o Next avalia módulos mais de uma vez
 * em dev (HMR) e cada avaliação abriria um transporte `pino-pretty` novo.
 */
const registro = globalThis as { __logHub?: Logger };
export const log: Logger = registro.__logHub ?? (registro.__logHub = pino(criarOpcoesDoPino(opcoesDoAmbiente())));

type Cabecalhos = Record<string, string | string[] | undefined>;

/** `Headers` (fetch/Next) → objeto simples. `forEach` porque `entries()` exige a lib `dom.iterable`. */
export function cabecalhosComoObjeto(cabecalhos: Headers | Cabecalhos): Cabecalhos {
  if (!(cabecalhos instanceof Headers)) return cabecalhos;
  const plano: Record<string, string> = {};
  cabecalhos.forEach((valor, chave) => {
    plano[chave] = valor;
  });
  return plano;
}

/** Campos de correlação para os cabeçalhos de UMA requisição — o que a api tira do AsyncLocalStorage. */
export function contextoDaRequisicao(
  cabecalhos: Headers | Cabecalhos,
  gcpProjectId: string | undefined = opcoesDoAmbiente().gcpProjectId,
): Record<string, unknown> {
  const trace = lerTrace(cabecalhosComoObjeto(cabecalhos));
  if (!trace) return {};
  return {
    requestId: trace.traceId,
    "logging.googleapis.com/trace": gcpProjectId ? `projects/${gcpProjectId}/traces/${trace.traceId}` : undefined,
    "logging.googleapis.com/spanId": trace.spanId,
    "logging.googleapis.com/trace_sampled": trace.amostrado,
  };
}

/** `child` do logger com o contexto de uma requisição (`await headers()` num server component ou route handler). */
export function logDaRequisicao(cabecalhos: Headers | Cabecalhos): Logger {
  return log.child(contextoDaRequisicao(cabecalhos));
}
