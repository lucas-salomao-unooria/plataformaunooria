import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { escolaDoContexto } from "../tenancy/tenancy-context";

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
