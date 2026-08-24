import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Quota diária de IA por aluno, PERSISTIDA.
 *
 * O `Map` em memória que existia antes tinha dois furos: zerava a cada restart
 * e era por instância — com `min-instances: 3` no Cloud Run, a mesma criança
 * tinha três quotas. Aqui o contador é uma linha por (escola, usuário, dia) e
 * o incremento é atômico (`ON CONFLICT DO UPDATE ... RETURNING`), então
 * requisições simultâneas não se sobrescrevem.
 *
 * A checagem acontece ANTES de chamar o provider: gastar token e depois
 * recusar seria pagar pelo que não se entrega.
 */
@Injectable()
export class QuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private limite(): number {
    return Number(this.config.get("AI_DAILY_TOKEN_QUOTA_PER_ALUNO") ?? 20000);
  }

  private hoje(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Quanto já foi gasto hoje. */
  async usadoHoje(escolaId: string, usuarioId: string): Promise<number> {
    const linha = await this.prisma.comTenancy(
      (tx) =>
        tx.iaUsoDiario.findUnique({
          where: {
            escolaId_usuarioId_dia: { escolaId, usuarioId, dia: this.hoje() },
          },
        }),
      escolaId,
    );
    return linha?.tokensUsados ?? 0;
  }

  /** `true` quando ainda há saldo — checar antes de chamar o provider. */
  async temSaldo(escolaId: string, usuarioId: string): Promise<boolean> {
    return (await this.usadoHoje(escolaId, usuarioId)) < this.limite();
  }

  /** Incremento atômico; devolve o total do dia depois do consumo. */
  async consumir(escolaId: string, usuarioId: string, tokens: number): Promise<number> {
    const dia = this.hoje();
    return this.prisma.comTenancy(async (tx) => {
      const linhas = await tx.$queryRaw<Array<{ tokens_usados: number }>>`
        INSERT INTO ia_uso_diario (escola_id, usuario_id, dia, tokens_usados)
        VALUES (${escolaId}, ${usuarioId}, ${dia}, ${tokens})
        ON CONFLICT (escola_id, usuario_id, dia)
          DO UPDATE SET tokens_usados = ia_uso_diario.tokens_usados + ${tokens}
        RETURNING tokens_usados`;
      return Number(linhas[0]?.tokens_usados ?? tokens);
    }, escolaId);
  }
}
