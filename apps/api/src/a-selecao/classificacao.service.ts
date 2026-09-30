import { Inject, Injectable, Optional } from "@nestjs/common";
import { z } from "zod";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { rateLimit } from "../comum/rate-limit";
import { STATUS_DE_MARCA, type Nivel } from "../evidencias/regras";
import { logger } from "../observabilidade/logger";
import {
  MAX_TOKENS_DO_CANAL_A,
  MOTIVOS_DO_CANAL_A,
  NIVEL_DO_MOTIVO,
  SCHEMA_DO_CANAL_A,
  SYSTEM_DO_CANAL_A,
  promptDoCanalA,
  type MotivoDoCanalA,
} from "./prompts";

/**
 * O CANAL A: a legenda dos Stories graduada nos três níveis da EF07CO11.
 *
 * É a exceção ao princípio "IA não decide desfecho", e por isso é cercada de
 * guardrails, todos aqui, na ORDEM em que rodam:
 *
 *   1. RATE LIMIT por estudante — três classificações a cada dez minutos. O
 *      latch já faz haver uma por rodada; o teto é para o "Zerar" repetido.
 *   2. QUOTA do perfil `estudante` (`temSaldo` ANTES, regra inviolável nº 5).
 *   3. `generateJson` com o modelo padrão, temperatura 0, UMA tentativa (não
 *      há reforço útil: ou a leitura sai, ou fica "Não avaliado"), o
 *      `responseSchema` com o enum dos níveis e o código do motivo, um
 *      `validar` Zod que recusa motivo incoerente com o nível, e um teto de
 *      saída de 64 tokens.
 *   4. TETO DE TEMPO por `Promise.race` (~6 s): o provider só corta em 15 min e
 *      não aceita `signal`, então o teto de N s é `Promise.race`, e a
 *      publicação da criança espera esta resposta.
 *   5. O débito da quota vai no `aoUsarTokens`, e não depois do `await`: a
 *      chamada que PERDE a corrida para o teto chega depois, e é cobrada igual
 *      — ela foi paga ao vendor (ADR-74).
 *
 * **Falhou qualquer passo, nada é marcado.** Sem saldo, teto de tempo, saída
 * inválida, provider fora do ar, o mock (que SEMPRE lança em `generateJson`):
 * a EF07CO11 fica "Não avaliado" nesta marca, e o professor decide. Em dev e
 * na e2e, portanto, este canal sempre cai aqui — e a enquete P1 continua
 * medindo a mesma habilidade (vale a melhor das duas).
 *
 * Nada do que o modelo escreve é gravado nem registrado: o log leva o CÓDIGO
 * da falha ou do motivo, e nunca a legenda (texto livre de menor).
 */

/** Quanto a publicação espera a IA antes de desistir. */
export const TETO_DO_CANAL_A_MS = 6000;

/** Token de injeção do teto — a suíte o encurta; em produção vale o padrão. */
export const TETO_DO_CANAL_A = "TETO_DO_CANAL_A";

/** Três classificações a cada dez minutos, por estudante. */
export const LIMITE_DO_CANAL_A = { usos: 3, janelaMs: 10 * 60_000 } as const;

export interface EntradaDoCanalA {
  legenda: string;
  posts: ReadonlyArray<{ perfil: string; legenda: string }>;
}

export type FalhaDoCanalA = "limite" | "sem-saldo" | "tempo-esgotado" | "saida-invalida" | "provedor-falhou";

export type ResultadoDoCanalA =
  | { ok: true; nivel: Nivel; motivo: MotivoDoCanalA }
  | { ok: false; codigo: FalhaDoCanalA };

/**
 * A saída que vale: um nível, um motivo, e os dois COERENTES. "atingiu por ser
 * desconexa" é o modelo se contradizendo, e a contradição não vira marca.
 */
export const ClassificacaoSchema = z
  .object({ nivel: z.enum(STATUS_DE_MARCA), motivo: z.enum(MOTIVOS_DO_CANAL_A) })
  .refine((c) => NIVEL_DO_MOTIVO[c.motivo] === c.nivel, "motivo incoerente com o nível");

export function validarClassificacao(bruto: unknown): { nivel: Nivel; motivo: MotivoDoCanalA } {
  return ClassificacaoSchema.parse(bruto);
}

@Injectable()
export class ClassificacaoService {
  private readonly tetoMs: number;

  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
    @Optional() @Inject(TETO_DO_CANAL_A) tetoMs?: number,
  ) {
    this.tetoMs = tetoMs ?? TETO_DO_CANAL_A_MS;
  }

  /**
   * Classifica a legenda. NUNCA lança: toda falha vira `{ ok: false, codigo }`,
   * porque quem chama já gravou a publicação e não pode responder erro à
   * criança por causa da IA.
   */
  async classificar(escolaId: string, estudanteId: string, entrada: EntradaDoCanalA): Promise<ResultadoDoCanalA> {
    const resultado = await this.tentar(escolaId, estudanteId, entrada);
    logger.info(
      resultado.ok
        ? { codigo: "exp07ef1b-canal-a-avaliado", escolaId, motivo: resultado.motivo }
        : { codigo: "exp07ef1b-canal-a-nao-avaliado", escolaId, motivo: resultado.codigo },
      resultado.ok ? "legenda graduada pelo Canal A" : "Canal A sem avaliação; fica Não avaliado",
    );
    return resultado;
  }

  private async tentar(escolaId: string, estudanteId: string, entrada: EntradaDoCanalA): Promise<ResultadoDoCanalA> {
    /* Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT. */
    const limite = rateLimit(`a-selecao:canal-a:${estudanteId}`, LIMITE_DO_CANAL_A.usos, LIMITE_DO_CANAL_A.janelaMs);
    if (!limite.ok) return { ok: false, codigo: "limite" };

    try {
      if (!(await this.quota.temSaldo(escolaId, estudanteId, "estudante"))) return { ok: false, codigo: "sem-saldo" };
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
      maxTokens: MAX_TOKENS_DO_CANAL_A,
      validar: (bruto) => {
        try {
          return validarClassificacao(bruto);
        } catch (erro) {
          saidaInvalida = true;
          throw erro;
        }
      },
      aoUsarTokens: (tokens) => {
        if (tokens <= 0) return;
        debitos.push(
          this.quota.consumir(escolaId, estudanteId, tokens).catch(() => {
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
      return { ok: true, nivel: vencedor.nivel, motivo: vencedor.motivo };
    } catch {
      await Promise.allSettled(debitos);
      return { ok: false, codigo: saidaInvalida ? "saida-invalida" : "provedor-falhou" };
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  }
}
