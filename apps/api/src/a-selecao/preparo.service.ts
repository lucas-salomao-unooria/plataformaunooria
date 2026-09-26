import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { POSTS_PADRAO, TEMA_PADRAO, type PostDaCobertura } from "./catalogo";
import { FALAS_DO_TEMA_PADRAO, type FalasDoTema } from "./podcast";
import {
  MAX_TOKENS_DO_PREPARO,
  SCHEMA_DO_PREPARO,
  SYSTEM_DO_PREPARO,
  TENTATIVAS_DO_PREPARO,
  promptDoPreparo,
} from "./prompts";
import { postsDaIa } from "./regras/lote";

/**
 * O PREPARO da cobertura com IA — o rascunho dos 12 posts sobre o tema que a
 * professora escolheu, antes da aula, e as três falas do podcast que dizem o
 * que cada veículo mostrou (`podcast.ts`).
 *
 * Três coisas que este serviço não faz, e cada ausência é uma regra:
 *
 * 1. **Não publica.** O que ele devolve é RASCUNHO; só a homologação grava, e
 *    é ela que troca a atividade da turma (ADR-66/67).
 * 2. **Não decide a estrutura.** Id, veículo e lente são da POSIÇÃO: o
 *    `validar` recusa o lote fora do 4:4:4 (e com termo que antecipe a
 *    revelação), e o `generateJson` regera com o motivo no prompt.
 * 3. **Não trava a professora.** Sem saldo, com o Vertex fora do ar ou com a
 *    saída fora do molde, volta o banco curado com `usouIa: false` — e a tela
 *    diz que o tema padrão foi carregado, em vez de fingir que a IA respondeu.
 *
 * Quota: a do PERFIL (ADR-105), `temSaldo` antes e o que o vendor cobrou
 * debitado por tentativa, inclusive as recusadas pelo `validar` (ADR-74).
 */
@Injectable()
export class PreparoDaExp07ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: { tema: string; foco?: string },
  ): Promise<{
    rascunho: { tema: string; foco: string | null; posts: PostDaCobertura[]; podcast: FalasDoTema };
    usouIa: boolean;
    tokens: number;
  }> {
    const curado = () => ({
      rascunho: {
        tema: TEMA_PADRAO,
        foco: null,
        posts: POSTS_PADRAO.map((p) => ({ ...p })),
        podcast: { ...FALAS_DO_TEMA_PADRAO },
      },
      usouIa: false,
    });

    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      logger.info({ codigo: "exp07ef1b-preparo-sem-saldo", escolaId }, "preparo sem saldo de IA");
      return { ...curado(), tokens: 0 };
    }

    let tokens = 0;
    try {
      const lote = await this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(parametros),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        // Baixa de propósito: o que se pede é conteúdo coerente dentro de um
        // molde fixo, não variedade criativa.
        temperatura: 0.4,
        aoUsarTokens: (n) => {
          tokens += n;
        },
        validar: postsDaIa,
      });
      await this.quota.consumir(escolaId, usuarioId, tokens);
      return {
        rascunho: {
          tema: parametros.tema,
          foco: parametros.foco?.trim() || null,
          posts: lote.posts,
          podcast: lote.podcast,
        },
        usouIa: true,
        tokens,
      };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha: as tentativas rejeitadas pelo
         `validar` já foram faturadas pelo vendor (ADR-74). */
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens);
      logger.warn(
        { codigo: "exp07ef1b-preparo-falhou", escolaId, tokens, err: erro },
        "geração da cobertura falhou; devolvendo o banco curado",
      );
      return { ...curado(), tokens };
    }
  }
}
