import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import {
  MAX_TOKENS_DA_REGENERACAO,
  MAX_TOKENS_DO_PREPARO,
  SCHEMA_DA_REGENERACAO,
  SCHEMA_DO_PREPARO,
  SYSTEM_DO_PREPARO,
  TENTATIVAS_DO_PREPARO,
  promptDaRegeneracao,
  promptDoPreparo,
} from "./prompts";
import { conteudoDaIa, projetoRegeneradoDaIa, type ConteudoDoPacote, type ProjetoDoPacote } from "./regras/preparo";
import type { Disciplina } from "./vocabulario";

/**
 * O PREPARO da mostra com IA — os dezesseis projetos sobre o tema, a
 * disciplina e os assuntos do professor, antes da aula, e a regeneração de um
 * projeto isolado. Molde: `jornal-escola/preparo.service.ts`.
 *
 * Três coisas que este serviço não faz, e cada ausência é uma regra:
 *
 * 1. **Não publica.** O que ele devolve é RASCUNHO; só a homologação grava
 *    (ADR-66/67), e o rascunho não persiste.
 * 2. **Não aceita o que fere a régua.** O `validar` normaliza o cosmético
 *    (`semExclamacao`, hashtag e perfil) e recusa o resto pelo MESMO schema da
 *    homologação (`regras/preparo.ts`); o `generateJson` regera com o motivo.
 * 3. **Não esconde a falha.** Não há acervo padrão (decisão de 2026-10-02): sem
 *    saldo, a resposta é 429 `sem-saldo-de-ia`, e com a IA fora do ar, 503
 *    `ia-indisponivel` — sem IA, não há atividade.
 *
 * Quota: a do PERFIL (ADR-105), `temSaldo` antes e o que o vendor cobrou
 * debitado por tentativa, inclusive as recusadas pelo `validar` (ADR-74).
 */

export type ResultadoDoPreparo<T> =
  | { ok: true; valor: T; tokens: number; chamouIa: true }
  | { ok: false; codigo: "sem-saldo-de-ia" | "ia-indisponivel"; tokens: number; chamouIa: boolean };

export type ParametrosDoPreparo = { disciplina: Disciplina; tema: string; assuntos: string; contexto?: string };

@Injectable()
export class PreparoDaExp06ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  /** O rascunho da mostra inteira. Nunca lança: a falha volta com o código. */
  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: ParametrosDoPreparo,
  ): Promise<ResultadoDoPreparo<ConteudoDoPacote>> {
    return this.chamar(escolaId, usuarioId, perfil, "preparo", (aoUsarTokens) =>
      this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(parametros),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        temperatura: 0.7,
        aoUsarTokens,
        validar: (bruto) => conteudoDaIa(bruto, parametros.tema),
      }),
    );
  }

  /**
   * "Regenerar projeto": o novo mantém o id e a área do que sai, e o pacote
   * inteiro, com ele no lugar, continua válido. Não persiste.
   */
  async regenerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: ParametrosDoPreparo,
    conteudo: ConteudoDoPacote,
    projetoId: string,
  ): Promise<ResultadoDoPreparo<ProjetoDoPacote>> {
    return this.chamar(escolaId, usuarioId, perfil, "regeneracao", (aoUsarTokens) =>
      this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDaRegeneracao(parametros, conteudo, projetoId),
        responseSchema: SCHEMA_DA_REGENERACAO,
        maxTokens: MAX_TOKENS_DA_REGENERACAO,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        temperatura: 0.8,
        aoUsarTokens,
        validar: (bruto) => projetoRegeneradoDaIa(bruto, conteudo, projetoId),
      }),
    );
  }

  private async chamar<T>(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    oQue: "preparo" | "regeneracao",
    fazer: (aoUsarTokens: (n: number) => void) => Promise<T>,
  ): Promise<ResultadoDoPreparo<T>> {
    try {
      if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
        logger.info({ codigo: `exp06ef1b-${oQue}-sem-saldo`, escolaId }, "preparo sem saldo de IA");
        return { ok: false, codigo: "sem-saldo-de-ia", tokens: 0, chamouIa: false };
      }
    } catch {
      return { ok: false, codigo: "ia-indisponivel", tokens: 0, chamouIa: false };
    }

    let tokens = 0;
    try {
      const valor = await fazer((n) => {
        if (n > 0) tokens += n;
      });
      await this.debitar(escolaId, usuarioId, tokens);
      return { ok: true, valor, tokens, chamouIa: true };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha: as tentativas rejeitadas pelo
         `validar` já foram faturadas pelo vendor (ADR-74). Sem `err` no log: a
         mensagem da recusa repete trechos do que a IA escreveu sobre o tema. */
      await this.debitar(escolaId, usuarioId, tokens);
      logger.warn(
        { codigo: `exp06ef1b-${oQue}-falhou`, escolaId, tokens, erro: erro instanceof Error ? erro.name : "desconhecido" },
        "geração da mostra falhou",
      );
      return { ok: false, codigo: "ia-indisponivel", tokens, chamouIa: true };
    }
  }

  private async debitar(escolaId: string, usuarioId: string, tokens: number): Promise<void> {
    if (tokens <= 0) return;
    try {
      await this.quota.consumir(escolaId, usuarioId, tokens);
    } catch {
      logger.warn({ codigo: "exp06ef1b-preparo-debito-falhou", escolaId }, "débito do preparo não gravado");
    }
  }
}
