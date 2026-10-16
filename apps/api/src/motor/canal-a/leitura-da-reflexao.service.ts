import { Inject, Injectable, Optional } from "@nestjs/common";
import { z } from "zod";
import { AI_PROVIDER, type AiProvider } from "../../ai/provider";
import { QuotaService } from "../../ai/quota.service";
import { EXP_ID } from "../../comum/insta/defaults";
import { rateLimit } from "../../comum/rate-limit";
import { EvidenciasService } from "../../evidencias/evidencias.service";
import { logger } from "../../observabilidade/logger";
import { PrismaService } from "../../prisma/prisma.service";
import { contextoDaRun } from "../contexto-da-evidencia";
import {
  MOTIVOS_DA_LEITURA,
  RESULTADO_DO_MOTIVO,
  RESULTADOS_DA_LEITURA,
  SCHEMA_DA_LEITURA,
  SYSTEM_DA_LEITURA,
  promptDaLeitura,
  type MotivoDaLeitura,
  type ResultadoDaLeituraDaIa,
} from "./prompts-da-reflexao";
import { MARCADOR_DA_REFLEXAO } from "./vocabulario";

/**
 * A LEITURA DA REFLEXÃO pela IA (EF08CO11, ADR-167) — no molde do Canal A da
 * A Seleção (`a-selecao/classificacao.service.ts`).
 *
 * UMA LEITURA SÓ, do PRIMEIRO texto salvo, com até 3 tentativas dentro dela
 * para a falha técnica (`TENTATIVAS_DA_LEITURA`), qualquer que seja o resultado: a
 * linha em `exp08ef1b_leituras_da_reflexao` nasce na transação do primeiro
 * salvamento (a unicidade por atividade e estudante impede a segunda, mesmo
 * com dois salvamentos ao mesmo tempo), e esta chamada, DEPOIS da transação e
 * sem a criança esperar, só preenche resultado e motivo. "Sem marca" e falha
 * também encerram: nada é lido de novo, nem depois de reescrever, nem depois
 * de um reinício.
 *
 * Os guardrails, na ordem: rate limit por estudante, `temSaldo` da quota do
 * perfil `estudante` ANTES (regra 5), `generateJson` com temperatura 0 e UMA
 * tentativa, o `validar` Zod que recusa motivo incoerente com o resultado, o
 * teto de 60 s por `Promise.race` (a criança não espera: a leitura roda depois
 * da resposta do salvamento, fora do teto de 30 s do BFF), e o débito no `aoUsarTokens` (a chamada
 * que perde a corrida também foi paga). A medição de custo vem do
 * `MedidorDeProvider`, como toda chamada pelo `AiProvider`.
 *
 * Nenhum log leva o texto da criança: só o código do motivo ou da falha.
 */

/** Próprio desta missão — o da A Seleção (`TETO_DO_CANAL_A_MS`) continua o dele. */
export const TETO_DA_LEITURA_MS = 60_000;
export const TETO_DA_LEITURA = "TETO_DA_LEITURA_DA_REFLEXAO";
/**
 * ATÉ 3 TENTATIVAS dentro da leitura única: só a FALHA TÉCNICA (tempo
 * esgotado, provider fora, saída que o Zod recusa) tenta de novo, com recuo de
 * 2 s e 4 s. Resultado válido (nível ou "sem marca") encerra na hora; sem
 * saldo (ou o rate limit) não é falha técnica e encerra sem nova tentativa.
 */
export const TENTATIVAS_DA_LEITURA = 3;
export const RECUO_DA_LEITURA_MS = 2000;
export const RECUO_DA_LEITURA = "RECUO_DA_LEITURA_DA_REFLEXAO";
/** O rate limit cabe as 3 tentativas de uma leitura (que é uma só por atividade). */
export const LIMITE_DA_LEITURA = { usos: TENTATIVAS_DA_LEITURA, janelaMs: 10 * 60_000 } as const;

/** As falhas que tentam de novo. */
const FALHA_TECNICA: readonly FalhaDaLeitura[] = ["tempo-esgotado", "saida-invalida", "provedor-falhou"];

export type FalhaDaLeitura = "limite" | "sem-saldo" | "tempo-esgotado" | "saida-invalida" | "provedor-falhou";
export type ResultadoDaLeitura =
  | { ok: true; resultado: ResultadoDaLeituraDaIa; motivo: MotivoDaLeitura }
  | { ok: false; codigo: FalhaDaLeitura };

/** A saída que vale: resultado e motivo COERENTES; a contradição vira "sem marca" (falha). */
export const LeituraSchema = z
  .object({ resultado: z.enum(RESULTADOS_DA_LEITURA), motivo: z.enum(MOTIVOS_DA_LEITURA) })
  .refine((l) => RESULTADO_DO_MOTIVO[l.motivo] === l.resultado, "motivo incoerente com o resultado");

/** O que a leitura precisa — o texto vem do banco (`primeiro_texto`), não da requisição. */
export interface LeituraAgendada {
  leituraId: string;
  escolaId: string;
  estudanteId: string;
  activityId: string;
  turmaId: string | null;
}

@Injectable()
export class LeituraDaReflexaoService {
  private readonly tetoMs: number;
  private readonly recuoMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
    private readonly evidencias: EvidenciasService,
    @Optional() @Inject(TETO_DA_LEITURA) tetoMs?: number,
    @Optional() @Inject(RECUO_DA_LEITURA) recuoMs?: number,
  ) {
    this.tetoMs = tetoMs ?? TETO_DA_LEITURA_MS;
    this.recuoMs = recuoMs ?? RECUO_DA_LEITURA_MS;
  }

  /**
   * Lê a reflexão e ENCERRA a leitura: grava resultado, motivo e data, e marca
   * a EF08CO11 quando o resultado é um nível. NUNCA lança — quem chama já
   * respondeu à criança.
   */
  async ler(agendada: LeituraAgendada): Promise<void> {
    try {
      const texto = await this.prisma.comTenancy(async (tx) => {
        const leitura = await tx.leituraDaReflexao.findUnique({
          where: { id: agendada.leituraId },
          select: { lidaEm: true, run: { select: { reflexao: { select: { primeiroTexto: true } } } } },
        });
        if (!leitura || leitura.lidaEm) return null;
        return leitura.run.reflexao?.primeiroTexto ?? null;
      }, agendada.escolaId);
      /* A reflexão saiu (reinício) antes da leitura: encerra sem marca. Toda
         tentativa lê o MESMO primeiro texto, lido uma vez aqui. */
      let resultado: ResultadoDaLeitura = { ok: false, codigo: "provedor-falhou" };
      let tentativas = 0;
      while (texto && tentativas < TENTATIVAS_DA_LEITURA) {
        if (tentativas > 0) await new Promise((r) => setTimeout(r, this.recuoMs * 2 ** (tentativas - 1)));
        tentativas += 1;
        resultado = await this.classificar(agendada.escolaId, agendada.estudanteId, texto);
        if (resultado.ok || !FALHA_TECNICA.includes(resultado.codigo)) break;
      }
      await this.encerrar(agendada, resultado, tentativas);
    } catch (erro) {
      logger.warn(
        { codigo: "exp08ef1b-leitura-da-reflexao-nao-encerrada", escolaId: agendada.escolaId, erro: (erro as Error).name },
        "leitura da reflexão não encerrada",
      );
    }
  }

  private async encerrar(agendada: LeituraAgendada, r: ResultadoDaLeitura, tentativas: number): Promise<void> {
    await this.prisma.comTenancy(async (tx) => {
      const nivel = r.ok && r.resultado !== "sem_marca" ? r.resultado : null;
      const atualizada = await tx.leituraDaReflexao.updateMany({
        where: { id: agendada.leituraId, lidaEm: null },
        data: {
          resultado: r.ok ? (nivel ? "nivel" : "sem_marca") : "falha",
          nivel,
          motivo: r.ok ? r.motivo : r.codigo,
          tentativas,
          lidaEm: new Date(),
        },
      });
      if (atualizada.count === 0 || !nivel) return;
      const contexto = contextoDaRun({ id: agendada.activityId, turmaId: agendada.turmaId });
      if (!contexto) return;
      const base = { escolaId: agendada.escolaId, expId: EXP_ID, estudanteId: agendada.estudanteId, ...contexto };
      /* Vale a primeira leitura: depois de "Apagar as sessões" a marca saiu junto. */
      if (await this.evidencias.jaMarcou(tx, base, [MARCADOR_DA_REFLEXAO])) return;
      await this.evidencias.marcar(tx, { ...base, marcador: MARCADOR_DA_REFLEXAO, status: nivel });
    }, agendada.escolaId);
    logger.info(
      r.ok
        ? { codigo: "exp08ef1b-reflexao-lida", escolaId: agendada.escolaId, motivo: r.motivo }
        : { codigo: "exp08ef1b-reflexao-nao-lida", escolaId: agendada.escolaId, motivo: r.codigo },
      r.ok ? "reflexão lida pela IA" : "reflexão sem leitura; fica sem marca",
    );
  }

  /** A chamada ao modelo, com os guardrails. Nunca lança. */
  async classificar(escolaId: string, estudanteId: string, texto: string): Promise<ResultadoDaLeitura> {
    /* Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT. */
    const limite = rateLimit(`exp08ef1b:leitura:${estudanteId}`, LIMITE_DA_LEITURA.usos, LIMITE_DA_LEITURA.janelaMs);
    if (!limite.ok) return { ok: false, codigo: "limite" };

    try {
      if (!(await this.quota.temSaldo(escolaId, estudanteId, "estudante"))) return { ok: false, codigo: "sem-saldo" };
    } catch {
      return { ok: false, codigo: "provedor-falhou" };
    }

    const debitos: Promise<unknown>[] = [];
    let saidaInvalida = false;
    const chamada = this.ia.generateJson({
      system: SYSTEM_DA_LEITURA,
      prompt: promptDaLeitura(texto),
      responseSchema: SCHEMA_DA_LEITURA,
      modelo: "padrao",
      temperatura: 0,
      tentativas: 1,
      validar: (bruto) => {
        try {
          return LeituraSchema.parse(bruto);
        } catch (erro) {
          saidaInvalida = true;
          throw erro;
        }
      },
      aoUsarTokens: (tokens) => {
        if (tokens <= 0) return;
        debitos.push(
          this.quota.consumir(escolaId, estudanteId, tokens).catch(() => {
            logger.warn({ codigo: "exp08ef1b-leitura-debito-falhou", escolaId }, "débito da leitura não gravado");
          }),
        );
      },
    });
    /* A chamada que perde a corrida ainda pode rejeitar depois. */
    chamada.catch(() => undefined);

    let relogio: ReturnType<typeof setTimeout> | undefined;
    const teto = new Promise<"tempo-esgotado">((resolver) => {
      relogio = setTimeout(() => resolver("tempo-esgotado"), this.tetoMs);
      relogio.unref?.();
    });

    try {
      const vencedor = await Promise.race([chamada, teto]);
      if (vencedor === "tempo-esgotado") return { ok: false, codigo: "tempo-esgotado" };
      await Promise.allSettled(debitos);
      return { ok: true, resultado: vencedor.resultado, motivo: vencedor.motivo };
    } catch {
      await Promise.allSettled(debitos);
      return { ok: false, codigo: saidaInvalida ? "saida-invalida" : "provedor-falhou" };
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  }
}
