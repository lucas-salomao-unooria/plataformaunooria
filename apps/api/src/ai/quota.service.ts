import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Perfil } from "../auth/claims";
import { Metricas } from "../observabilidade/metricas";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Quota diária de IA por usuário, PERSISTIDA.
 *
 * O `Map` em memória que existia antes tinha dois furos: zerava a cada restart
 * e era por instância — com `min-instances: 3` no Cloud Run, a mesma criança
 * tinha três quotas. Aqui o contador é uma linha por (escola, usuário, dia) e
 * o incremento é atômico (`ON CONFLICT DO UPDATE ... RETURNING`), então
 * requisições simultâneas não se sobrescrevem.
 *
 * A checagem acontece ANTES de chamar o provider: gastar token e depois
 * recusar seria pagar pelo que não se entrega.
 *
 * O LIMITE depende do perfil: o estudante conversa com o tutor (300k tokens/dia
 * bastam); o professor gera planos anuais em que só o PROMPT (currículo da
 * rede + material didático) passa de 200k tokens — o teto dele é outro
 * (`AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR`). Sem o perfil, vale o do estudante.
 */
@Injectable()
export class QuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly metricas?: Metricas,
  ) {}

  private limite(perfil: Perfil): number {
    if (perfil === "professor" || perfil === "gestor_escola" || perfil === "gestor_contrato") {
      return Number(this.config.get("AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR") ?? 2_000_000);
    }
    return Number(
      this.config.get("AI_DAILY_TOKEN_QUOTA_PER_ESTUDANTE") ??
        300_000,
    );
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
  async temSaldo(escolaId: string, usuarioId: string, perfil: Perfil = "estudante"): Promise<boolean> {
    const ok = (await this.usadoHoje(escolaId, usuarioId)) < this.limite(perfil);
    // O único ponto que sabe que uma chamada de IA foi recusada por saldo — e o
    // perfil é rótulo fechado (4 valores), não a escola.
    if (!ok) this.metricas?.iaQuotaRecusas.add(1, { perfil });
    return ok;
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
