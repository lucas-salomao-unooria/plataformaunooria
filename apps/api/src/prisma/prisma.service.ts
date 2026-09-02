import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "../observabilidade/logger";
import { escolaDoContexto } from "../tenancy/tenancy-context";

/** Acima disto a query vira `WARNING` em qualquer nível de log. */
export const LIMIAR_DE_QUERY_LENTA_MS = 500;

/**
 * Token das opções do PrismaClient. Ninguém o provê no container: o parâmetro
 * existe para os TESTES (`new PrismaService({ datasources })`), e sem
 * `@Optional()`/`@Inject()` o Nest tentaria resolver o tipo `Object` e a api
 * não subiria ("can't resolve dependencies of the PrismaService (?)").
 */
export const OPCOES_DO_PRISMA = "OPCOES_DO_PRISMA";

/**
 * PrismaClient injetável + a porta de entrada da tenancy.
 *
 * `comTenancy(fn)` abre uma transação e executa `set_config('app.escola_id',
 * ..., true)` ANTES do trabalho — `true` = local à transação, então a conexão
 * volta LIMPA ao pool (um `SET` de sessão vazaria escola entre requisições).
 * As políticas de RLS usam `current_setting('app.escola_id', true)`.
 *
 * A RLS é rede de segurança, não a única tranca: os services continuam
 * filtrando `escola_id` explicitamente em toda query (regra inviolável nº 1).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() @Inject(OPCOES_DO_PRISMA) opcoes?: Prisma.PrismaClientOptions) {
    // Evento por query, sempre: é o que permite avisar a lenta em qualquer
    // nível. O texto da query vai ao log (é SQL com `$1`, não dado); os
    // PARÂMETROS nunca — é neles que mora o CPF.
    super({ ...opcoes, log: [{ emit: "event", level: "query" }] });
    const aoConsultar = (e: Prisma.QueryEvent) => {
      if (e.duration >= LIMIAR_DE_QUERY_LENTA_MS) {
        logger.warn({ codigo: "query-lenta", duracaoMs: e.duration, sql: e.query.slice(0, 500) }, "query lenta");
      } else if (logger.isLevelEnabled("debug")) {
        logger.debug({ codigo: "query", duracaoMs: e.duration, sql: e.query.slice(0, 500) }, "query");
      }
    };
    (this.$on as unknown as (evento: "query", cb: (e: Prisma.QueryEvent) => void) => void)("query", aoConsultar);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Executa `fn` numa transação com a RLS armada para a escola do contexto da
   * requisição (posto pelo TenancyInterceptor). `escolaId` explícito só em
   * código fora de requisição (seed, worker, testes). `opts.timeout` é
   * repassado ao `$transaction` (o motor do feed usa 20s por causa do lock
   * consultivo por run).
   */
  async comTenancy<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    escolaId?: string,
    opts?: { timeout?: number },
  ): Promise<T> {
    const escola = escolaId ?? escolaDoContexto();
    if (!escola) {
      throw new Error(
        "comTenancy sem escola: rota sem OidcGuard/TenancyInterceptor ou chamada fora de requisição sem escolaId explícito",
      );
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.escola_id', ${escola}, true)`;
      return fn(tx);
    }, opts);
  }
}
