import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import type { ConteudoDoPacote, ItemDoPacote } from "./conteudo";
import {
  MAX_TOKENS_DA_REGENERACAO,
  MAX_TOKENS_DO_PREPARO,
  SCHEMA_DO_PREPARO,
  SYSTEM_DO_PREPARO,
  TENTATIVAS_DO_PREPARO,
  promptDaRegeneracao,
  promptDoPreparo,
  schemaDoItem,
  validarItemRegenerado,
  validarSaidaDoPreparo,
  type RecorteDoPreparo,
} from "./prompts";

/** Por que a IA não entregou — é o que decide a frase da tela (E0-PROF-03: 429 × 503). */
export type MotivoDaReserva = "sem-saldo" | "indisponivel";

export type ResultadoDoPreparo<T> = { ok: true; valor: T; tokens: number } | { ok: false; motivo: MotivoDaReserva; tokens: number };

/**
 * A ÚNICA superfície de IA da exp01em1b: o PACOTE didático, antes da aula
 * (one-pager §9a), e o "Regenerar Este Item" da curadoria. Molde:
 * `juri-estadual/preparo.service.ts` (o `chamar` com o débito por tentativa).
 *
 * Quota do PERFIL (regra 5, ADR-105): `temSaldo` ANTES; o que o vendor cobrou
 * é debitado DEPOIS, por tentativa — inclusive as que o `validar` recusou
 * (ADR-74), e inclusive quando a chamada falha no fim.
 *
 * Não lança em falha de vendor e não decide a reserva: devolve o motivo, e o
 * serviço da missão troca por PACOTE_PADRAO (no gerar) ou responde 429/503
 * (no regenerar). Não persiste nada.
 */
@Injectable()
export class PreparoDaExp01em1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  gerar(escolaId: string, usuarioId: string, perfil: Perfil, recorte: RecorteDoPreparo): Promise<ResultadoDoPreparo<ConteudoDoPacote>> {
    return this.chamar(escolaId, usuarioId, perfil, "preparo", (aoUsarTokens) =>
      this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(recorte),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        temperatura: 0.7,
        aoUsarTokens,
        validar: validarSaidaDoPreparo,
      }),
    );
  }

  /** "Regenerar Este Item": devolve o pacote INTEIRO com o item novo no lugar, já pela régua. */
  regenerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    recorte: RecorteDoPreparo,
    conteudo: ConteudoDoPacote,
    item: ItemDoPacote,
  ): Promise<ResultadoDoPreparo<ConteudoDoPacote>> {
    return this.chamar(escolaId, usuarioId, perfil, "regeneracao", (aoUsarTokens) =>
      this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDaRegeneracao(recorte, conteudo, item),
        responseSchema: schemaDoItem(item),
        maxTokens: MAX_TOKENS_DA_REGENERACAO,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        temperatura: 0.8,
        aoUsarTokens,
        validar: (bruto) => validarItemRegenerado(bruto, conteudo, item),
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
        logger.info({ codigo: `exp01em1b-${oQue}-sem-saldo`, escolaId }, "preparo sem saldo de IA");
        return { ok: false, motivo: "sem-saldo", tokens: 0 };
      }
    } catch {
      return { ok: false, motivo: "indisponivel", tokens: 0 };
    }

    let tokens = 0;
    try {
      const valor = await fazer((n) => {
        if (n > 0) tokens += n;
      });
      await this.debitar(escolaId, usuarioId, tokens);
      return { ok: true, valor, tokens };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha (ADR-74). Sem `err` no log: a
         mensagem da recusa repete trechos do que a IA escreveu sobre o tema. */
      await this.debitar(escolaId, usuarioId, tokens);
      logger.warn(
        { codigo: `exp01em1b-${oQue}-falhou`, escolaId, tokens, erro: erro instanceof Error ? erro.name : "desconhecido" },
        "preparo da exp01em1b falhou",
      );
      return { ok: false, motivo: "indisponivel", tokens };
    }
  }

  private async debitar(escolaId: string, usuarioId: string, tokens: number): Promise<void> {
    if (tokens <= 0) return;
    try {
      await this.quota.consumir(escolaId, usuarioId, tokens);
    } catch {
      logger.warn({ codigo: "exp01em1b-preparo-debito-falhou", escolaId }, "débito do preparo não gravado");
    }
  }
}
