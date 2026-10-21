import { Inject, Injectable, Optional } from "@nestjs/common";
import { z } from "zod";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { rateLimit } from "../comum/rate-limit";
import type { Nivel } from "../evidencias/regras";
import { logger } from "../observabilidade/logger";
import {
  SCHEMA_DO_CANAL_A,
  SYSTEM_DO_CANAL_A,
  nivelDosIndicadores,
  promptDoCanalA,
  type IndicadoresDaLegenda,
} from "./prompts";

/**
 * O CANAL A: a legenda dos Stories lida para a EF07CO11 (ADR-170).
 *
 * É a exceção ao princípio "IA não decide desfecho", e por isso é cercada de
 * guardrails, todos aqui, na ORDEM em que rodam:
 *
 *   1. RATE LIMIT por estudante — o latch faz haver uma leitura por rodada, e
 *      cada leitura tem até três tentativas; o teto é para o "Zerar" repetido.
 *   2. QUOTA DE AVALIAÇÃO da escola (ADR-169), `temSaldoDaAvaliacao` ANTES
 *      (regra inviolável nº 5): avaliar não sai da quota do estudante — quem
 *      usou o tutor de manhã não pode ser lido por uma régua pior à tarde.
 *   3. `generateJson` com o modelo padrão, temperatura 0, UMA tentativa do
 *      provider, o `responseSchema` com os três indicadores e um `validar` Zod
 *      que recusa a combinação incoerente ("sem relação" com "conteúdo"). SEM
 *      teto de saída (ADR-148): o Gemini 3 raciocina mesmo com
 *      `thinkingBudget: 0`.
 *   4. TETO DE TEMPO por `Promise.race` (60 s, como a leitura da reflexão da
 *      exp08ef1b): a criança NÃO espera — a leitura roda depois da resposta do
 *      latch (`void`), fora do teto de 30 s do BFF.
 *   5. ATÉ TRÊS TENTATIVAS só para a FALHA TÉCNICA (tempo esgotado, provider
 *      fora, saída recusada), com recuo de 2 s e 4 s. Sem saldo e o rate limit
 *      não são falha técnica: encerram na hora.
 *   6. O débito vai no `aoUsarTokens`, e não depois do `await`: a chamada que
 *      PERDE a corrida para o teto chega depois e é cobrada igual (ADR-74).
 *
 * O modelo devolve INDICADORES; o nível é do servidor (`nivelDosIndicadores`).
 * Falhou tudo? Quem chama cai na regra de RESERVA (`regras/legenda-reserva.ts`),
 * que grava só uma sugestão para a professora. Nada do que o modelo escreve é
 * gravado nem registrado: o log leva o CÓDIGO da falha, nunca a legenda.
 */

/** Quanto cada tentativa espera a IA. A criança não espera nenhuma delas. */
export const TETO_DO_CANAL_A_MS = 60_000;
/** Token de injeção do teto — a suíte o encurta; em produção vale o padrão. */
export const TETO_DO_CANAL_A = "TETO_DO_CANAL_A";

export const TENTATIVAS_DO_CANAL_A = 3;
export const RECUO_DO_CANAL_A_MS = 2000;
export const RECUO_DO_CANAL_A = "RECUO_DO_CANAL_A";

/** Duas leituras completas (com as três tentativas) a cada dez minutos, por estudante. */
export const LIMITE_DO_CANAL_A = { usos: 2 * TENTATIVAS_DO_CANAL_A, janelaMs: 10 * 60_000 } as const;

export interface EntradaDoCanalA {
  legenda: string;
  posts: ReadonlyArray<{ perfil: string; legenda: string }>;
}

export type FalhaDoCanalA = "limite" | "sem-saldo" | "tempo-esgotado" | "saida-invalida" | "provedor-falhou";

/** As falhas que tentam de novo. */
const FALHA_TECNICA: readonly FalhaDoCanalA[] = ["tempo-esgotado", "saida-invalida", "provedor-falhou"];

export type ResultadoDoCanalA =
  | { ok: true; nivel: Nivel; indicadores: IndicadoresDaLegenda; tentativas: number }
  | { ok: false; codigo: FalhaDoCanalA; tentativas: number };

/**
 * A saída que vale: os três indicadores, COERENTES. "Sem relação" com
 * "conteúdo" é o modelo se contradizendo, e a contradição não vira marca.
 */
export const IndicadoresSchema = z
  .object({ razao: z.boolean(), conteudo: z.boolean(), semRelacao: z.boolean() })
  .refine((i) => !(i.semRelacao && i.conteudo), "sem relação com os posts e com conteúdo deles ao mesmo tempo");

export function validarIndicadores(bruto: unknown): IndicadoresDaLegenda {
  return IndicadoresSchema.parse(bruto);
}

type Tentativa = { ok: true; indicadores: IndicadoresDaLegenda } | { ok: false; codigo: FalhaDoCanalA };

@Injectable()
export class ClassificacaoService {
  private readonly tetoMs: number;
  private readonly recuoMs: number;

  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
    @Optional() @Inject(TETO_DO_CANAL_A) tetoMs?: number,
    @Optional() @Inject(RECUO_DO_CANAL_A) recuoMs?: number,
  ) {
    this.tetoMs = tetoMs ?? TETO_DO_CANAL_A_MS;
    this.recuoMs = recuoMs ?? RECUO_DO_CANAL_A_MS;
  }

  /**
   * Lê a legenda. NUNCA lança: toda falha vira `{ ok: false, codigo }`, porque
   * quem chama já respondeu à criança e cai na reserva.
   */
  async classificar(escolaId: string, estudanteId: string, entrada: EntradaDoCanalA): Promise<ResultadoDoCanalA> {
    let tentativas = 0;
    let ultima: Tentativa = { ok: false, codigo: "provedor-falhou" };
    while (tentativas < TENTATIVAS_DO_CANAL_A) {
      if (tentativas > 0) await new Promise((r) => setTimeout(r, this.recuoMs * 2 ** (tentativas - 1)));
      tentativas += 1;
      ultima = await this.tentar(escolaId, estudanteId, entrada);
      if (ultima.ok || !FALHA_TECNICA.includes(ultima.codigo)) break;
    }
    const resultado: ResultadoDoCanalA = ultima.ok
      ? { ok: true, nivel: nivelDosIndicadores(ultima.indicadores), indicadores: ultima.indicadores, tentativas }
      : { ok: false, codigo: ultima.codigo, tentativas };
    logger.info(
      resultado.ok
        ? { codigo: "exp07ef1b-canal-a-avaliado", escolaId, nivel: resultado.nivel, tentativas }
        : { codigo: "exp07ef1b-canal-a-nao-avaliado", escolaId, motivo: resultado.codigo, tentativas },
      resultado.ok ? "legenda lida pelo Canal A" : "Canal A sem leitura; vale a reserva",
    );
    return resultado;
  }

  private async tentar(escolaId: string, estudanteId: string, entrada: EntradaDoCanalA): Promise<Tentativa> {
    /* Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT. */
    const limite = rateLimit(`a-selecao:canal-a:${estudanteId}`, LIMITE_DO_CANAL_A.usos, LIMITE_DO_CANAL_A.janelaMs);
    if (!limite.ok) return { ok: false, codigo: "limite" };

    try {
      if (!(await this.quota.temSaldoDaAvaliacao(escolaId))) return { ok: false, codigo: "sem-saldo" };
    } catch {
      return { ok: false, codigo: "provedor-falhou" };
    }

    const debitos: Promise<unknown>[] = [];
    let saidaInvalida = false;
    const chamada = this.ia.generateJson({
      system: SYSTEM_DO_CANAL_A,
      prompt: promptDoCanalA(entrada),
      responseSchema: SCHEMA_DO_CANAL_A,
      modelo: "padrao",
      temperatura: 0,
      tentativas: 1,
      validar: (bruto) => {
        try {
          return validarIndicadores(bruto);
        } catch (erro) {
          saidaInvalida = true;
          throw erro;
        }
      },
      aoUsarTokens: (tokens) => {
        if (tokens <= 0) return;
        debitos.push(
          this.quota.consumirDaAvaliacao(escolaId, tokens).catch(() => {
            logger.warn({ codigo: "exp07ef1b-canal-a-debito-falhou", escolaId }, "débito do Canal A não gravado");
          }),
        );
      },
    });
    /* A chamada que perde a corrida ainda pode rejeitar depois: sem este
       `catch`, a rejeição tardia vira `unhandledRejection` no processo. */
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
      return { ok: true, indicadores: vencedor };
    } catch {
      await Promise.allSettled(debitos);
      return { ok: false, codigo: saidaInvalida ? "saida-invalida" : "provedor-falhou" };
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  }
}
