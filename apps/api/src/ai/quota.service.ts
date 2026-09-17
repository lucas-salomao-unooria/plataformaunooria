import { Injectable, Optional } from "@nestjs/common";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { Metricas } from "../observabilidade/metricas";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Os perfis que TÊM linha em `ia_quotas` — e o CHECK da migration espelha esta
 * tupla. Só dois chamam IA de fato: o estudante (tutor da exp-01, exp-03,
 * exp-07) e o professor (exp-04, exp-07, exp-08, exp-90, exp-91, exp-92).
 * Gestores e `admin` não têm rota de IA hoje; quando tiverem, o perfil entra
 * aqui, no CHECK e na semente — nunca só num dos três.
 */
export const PERFIS_COM_QUOTA = ["estudante", "professor"] as const;
export type PerfilDaQuota = (typeof PERFIS_COM_QUOTA)[number];

/**
 * O que vale quando a linha NÃO existe — e ela deveria existir sempre, porque a
 * migration a semeia. São os valores que viviam nas envs até a ADR-105: 300k é
 * ~4 partidas da exp-03 (uma custa ~77k, MEDIDO em `unoogpt/regras/defaults.ts`);
 * 2M dá de 6 a 9 planos anuais, cujo PROMPT sozinho passa de 200k tokens.
 *
 * Falhar ABERTO com a constante, e não fechado: uma stack recém-provisionada
 * sem a linha derrubaria toda a IA por um dado ausente, com um 429 que não
 * explica nada. O que denuncia a ausência é o log `ia-quota-sem-linha`.
 */
export const QUOTA_PADRAO: Record<PerfilDaQuota, number> = {
  estudante: 300_000,
  professor: 2_000_000,
};

/**
 * Qual linha de `ia_quotas` vale para um perfil do token. Todo perfil que não é
 * `estudante` cai em `professor` — é o comportamento que já valia com as duas
 * envs, agora escrito em vez de implícito num `if`.
 */
export function perfilDaQuota(perfil: Perfil | string): PerfilDaQuota {
  return perfil === "estudante" ? "estudante" : "professor";
}

/**
 * Quota diária de IA por usuário, PERSISTIDA — o contador E o limite.
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
 * O LIMITE depende do perfil e é DADO (ADR-105): uma linha por perfil em
 * `ia_quotas`, semeada pela migration e editada só pelo `admin` no painel da
 * Unooria. Antes vivia em duas envs, e mudar o teto de uma rede era editar o
 * Terraform de outro repositório e fazer deploy. **Sem cache**, e é decisão: é
 * uma leitura por chave primária numa tabela de duas linhas, antes de uma
 * chamada que dura segundos — a regra da casa é não acrescentar estado sem
 * gargalo medido.
 */
@Injectable()
export class QuotaService {
  /** Um aviso por perfil por processo: a ausência da linha é um estado, não um evento por chamada. */
  private readonly avisouSemLinha = new Set<PerfilDaQuota>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly metricas?: Metricas,
  ) {}

  /** O teto diário que vale para este perfil, lido do banco. */
  async limite(perfil: Perfil | string): Promise<number> {
    const chave = perfilDaQuota(perfil);
    // Tabela de CONTRATO, sem RLS e sem `escola_id`: fora do `comTenancy`, como
    // `disponibilidades`. A política por escola a esconderia.
    const linha = await this.prisma.iaQuota.findUnique({ where: { perfil: chave } });
    if (linha) return linha.tokensPorDia;

    if (!this.avisouSemLinha.has(chave)) {
      this.avisouSemLinha.add(chave);
      logger.warn(
        { codigo: "ia-quota-sem-linha", perfil: chave, padrao: QUOTA_PADRAO[chave] },
        "ia_quotas sem linha para o perfil: valendo a constante do código",
      );
    }
    return QUOTA_PADRAO[chave];
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
    const [usado, limite] = await Promise.all([this.usadoHoje(escolaId, usuarioId), this.limite(perfil)]);
    const ok = usado < limite;
    // O único ponto que sabe que uma chamada de IA foi recusada por saldo — e o
    // perfil é rótulo fechado, não a escola.
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
