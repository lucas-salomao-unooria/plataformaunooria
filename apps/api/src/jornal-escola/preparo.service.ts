import { Inject, Injectable, Optional } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import type { z } from "zod";
import type { MateriaDaSimulacao, NoticiaDeContextoSchema, NoticiaDoPacote } from "./contrato-de-rotas";
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
import { noticiaRegeneradaDaIa, preparoDaIa, sortearMolde, sortearMoldeDaSimulacao, vagaDoContexto } from "./regras/molde";
import type { IdDeNoticia } from "./vocabulario";

/**
 * O PREPARO do pacote com IA — o rascunho das oito notícias sobre o tema da
 * professora, antes da aula, e a regeneração de uma notícia isolada.
 *
 * Três coisas que este serviço não faz, e cada ausência é uma regra:
 *
 * 1. **Não publica.** O que ele devolve é RASCUNHO; só a homologação grava, e
 *    é ela que troca a atividade da turma (ADR-66/67).
 * 2. **Não decide a estrutura.** O molde (que id é de que meio, e que papel
 *    tem no gabarito) é sorteado AQUI (`regras/molde.ts`); o `validar` recusa a
 *    saída que o mudou ou fere `invariantes.ts`, e o `generateJson` regera com
 *    o motivo no prompt.
 * 3. **Não esconde a falha.** Diferente da A Seleção, sem saldo ou com a IA
 *    fora do ar a resposta é o ERRO (`sem-saldo-de-ia` 429, `ia-indisponivel`
 *    503), e quem oferece o banco padrão é o hub, em um toque (`GET
 *    professor/material`): a copy revisada tem uma frase para cada caso.
 *
 * Quota: a do PERFIL (ADR-105), `temSaldo` antes e o que o vendor cobrou
 * debitado por tentativa, inclusive as recusadas pelo `validar` (ADR-74). O
 * `tokens` de toda resposta — sucesso ou falha — alimenta o EVT-P02.
 */

export type ResultadoDoPreparo<T> =
  | { ok: true; valor: T; tokens: number; chamouIa: true }
  | { ok: false; codigo: "sem-saldo-de-ia" | "ia-indisponivel"; tokens: number; chamouIa: boolean };

/** Token de injeção do sorteio do molde — a suíte o fixa; em produção é `Math.random`. */
export const SORTEIO_DO_MOLDE = "SORTEIO_DO_MOLDE_EXP04EF1B";

type Parametros = { disciplina: string; tema: string; topicos?: string };
type NoticiaDeContexto = z.infer<typeof NoticiaDeContextoSchema>;

@Injectable()
export class PreparoDaExp04ef1bService {
  private readonly aleatorio: () => number;

  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
    @Optional() @Inject(SORTEIO_DO_MOLDE) aleatorio?: () => number,
  ) {
    this.aleatorio = aleatorio ?? Math.random;
  }

  /** O rascunho das oito notícias e das duas da simulação. Nunca lança: a falha volta com o código. */
  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: Parametros,
  ): Promise<ResultadoDoPreparo<{ noticias: NoticiaDoPacote[]; simulacao: MateriaDaSimulacao[] }>> {
    const molde = sortearMolde(this.aleatorio);
    const moldeDaSimulacao = sortearMoldeDaSimulacao(this.aleatorio);
    return this.chamar(escolaId, usuarioId, perfil, "preparo", (aoUsarTokens) =>
      this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(parametros, molde, moldeDaSimulacao),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        // Baixa de propósito: conteúdo coerente dentro de um molde fixo.
        temperatura: 0.5,
        aoUsarTokens,
        validar: (bruto) => preparoDaIa(bruto, molde, moldeDaSimulacao),
      }),
    );
  }

  /**
   * "Regenerar notícia" (E0-PROF-04): a nova mantém o id, o MEIO e o papel no
   * gabarito da que sai — senão a regeneração de uma desmontaria a composição
   * das oito. Das outras, só a manchete (para não repetir) e o papel: um campo
   * vazio no meio da edição de outra notícia não trava esta.
   */
  async regenerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: Parametros,
    noticiaId: IdDeNoticia,
    noticias: readonly NoticiaDeContexto[],
  ): Promise<ResultadoDoPreparo<NoticiaDoPacote>> {
    const alvo = noticias.find((n) => n.id === noticiaId);
    if (!alvo) return { ok: false, codigo: "ia-indisponivel", tokens: 0, chamouIa: false };
    const vaga = vagaDoContexto(alvo);
    return this.chamar(escolaId, usuarioId, perfil, "regeneracao", (aoUsarTokens) =>
      this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDaRegeneracao(parametros, vaga, noticias),
        responseSchema: SCHEMA_DA_REGENERACAO,
        maxTokens: MAX_TOKENS_DA_REGENERACAO,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        temperatura: 0.6,
        aoUsarTokens,
        validar: (bruto) => {
          const corpo = bruto && typeof bruto === "object" ? (bruto as { noticia?: unknown }).noticia : undefined;
          return noticiaRegeneradaDaIa(corpo, vaga, noticias);
        },
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
        logger.info({ codigo: `exp04ef1b-${oQue}-sem-saldo`, escolaId }, "preparo sem saldo de IA");
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
        { codigo: `exp04ef1b-${oQue}-falhou`, escolaId, tokens, erro: erro instanceof Error ? erro.name : "desconhecido" },
        "geração do pacote falhou; o hub oferece o banco padrão",
      );
      return { ok: false, codigo: "ia-indisponivel", tokens, chamouIa: true };
    }
  }

  private async debitar(escolaId: string, usuarioId: string, tokens: number): Promise<void> {
    if (tokens <= 0) return;
    try {
      await this.quota.consumir(escolaId, usuarioId, tokens);
    } catch {
      logger.warn({ codigo: "exp04ef1b-preparo-debito-falhou", escolaId }, "débito do preparo não gravado");
    }
  }
}
