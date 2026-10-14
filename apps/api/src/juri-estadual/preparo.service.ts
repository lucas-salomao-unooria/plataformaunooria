import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import {
  MAX_TOKENS_DA_AREA,
  MAX_TOKENS_DA_REGENERACAO,
  MAX_TOKENS_DAS_CATEGORIAS,
  SCHEMA_DA_REGENERACAO,
  SCHEMA_DAS_CATEGORIAS,
  SYSTEM_DO_PREPARO,
  TENTATIVAS_DO_PREPARO,
  promptDaArea,
  promptDaRegeneracao,
  promptDasCategorias,
  schemaDaArea,
} from "./prompts";
import {
  categoriasDaIa,
  montarConteudo,
  projetoRegeneradoDaIa,
  projetosDaAreaDaIa,
  type ConteudoDoPacote,
  type ProjetoDoPacote,
} from "./regras/preparo";
import { AREAS, type Disciplina } from "./vocabulario";

/**
 * O PREPARO da mostra com IA — os quarenta projetos sobre o tema, a
 * disciplina e os assuntos do professor, antes da aula, e a regeneração de um
 * projeto isolado. Molde: `jornal-escola/preparo.service.ts`.
 *
 * **Quatro chamadas, não uma** (medido com IA real em 2026-10-14): os quarenta
 * numa chamada levaram 93 s — uma segunda tentativa estouraria o teto de 180 s
 * do BFF. O preparo pede as CATEGORIAS, depois as quatro ÁREAS em paralelo
 * (dez projetos cada, ~25 s), monta o pacote e regera sozinho o estande que
 * repetiu título ou perfil de outra área (`montarConteudo`).
 *
 * Três coisas que este serviço não faz, e cada ausência é uma regra:
 *
 * 1. **Não publica.** O que ele devolve é RASCUNHO; só a homologação grava
 *    (ADR-66/67), e o rascunho não persiste.
 * 2. **Não aceita o que fere a régua.** O `validar` normaliza o cosmético
 *    (`semExclamacao`, hashtag e perfil) e recusa o resto pelo MESMO schema da
 *    homologação (`regras/preparo.ts`); o `generateJson` regera com o motivo.
 * 3. **Não decide o fallback.** Sem saldo devolve `sem-saldo-de-ia`, com a IA
 *    fora do ar `ia-indisponivel`; quem troca isso pelo BANCO PADRÃO (200 com
 *    `usouIa: false`, RF-007 e §12.2) é a rota `gerar-conteudo`.
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

  /**
   * O rascunho da mostra inteira. Nunca lança: a falha volta com o código. Uma
   * área que falha (as duas tentativas) derruba o rascunho inteiro — meia mostra
   * não serve —, e a rota cai no banco padrão. Todas as tentativas de todas as
   * chamadas são debitadas (ADR-74).
   */
  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: ParametrosDoPreparo,
  ): Promise<ResultadoDoPreparo<ConteudoDoPacote>> {
    return this.chamar(escolaId, usuarioId, perfil, "preparo", async (aoUsarTokens) => {
      const categorias = await this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDasCategorias(parametros),
        responseSchema: SCHEMA_DAS_CATEGORIAS,
        maxTokens: MAX_TOKENS_DAS_CATEGORIAS,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        temperatura: 0.7,
        aoUsarTokens,
        validar: categoriasDaIa,
      });
      const porArea = await Promise.allSettled(
        AREAS.map((area) =>
          this.ia.generateJson({
            system: SYSTEM_DO_PREPARO,
            prompt: promptDaArea(parametros, categorias, area, { titulos: [], escolas: [], perfis: [] }),
            responseSchema: schemaDaArea(area),
            maxTokens: MAX_TOKENS_DA_AREA,
            tentativas: TENTATIVAS_DO_PREPARO,
            modelo: "padrao",
            temperatura: 0.7,
            aoUsarTokens,
            validar: (bruto) => projetosDaAreaDaIa(bruto, area, categorias),
          }),
        ),
      );
      /* `allSettled`, e não `all`: as áreas que deram certo também foram pagas, e
         o débito só fecha depois de TODAS voltarem. */
      const falha = porArea.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (falha) throw falha.reason;
      const projetos = porArea.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      let { conteudo, colidem } = montarConteudo(parametros.tema, categorias, projetos);
      for (const projetoId of colidem) {
        const novo = await this.ia.generateJson({
          system: SYSTEM_DO_PREPARO,
          prompt: promptDaRegeneracao(parametros, conteudo, projetoId),
          responseSchema: SCHEMA_DA_REGENERACAO,
          maxTokens: MAX_TOKENS_DA_REGENERACAO,
          tentativas: TENTATIVAS_DO_PREPARO,
          modelo: "padrao",
          temperatura: 0.8,
          aoUsarTokens,
          validar: (bruto) => projetoRegeneradoDaIa(bruto, conteudo, projetoId),
        });
        conteudo = { ...conteudo, projetos: conteudo.projetos.map((p) => (p.id === projetoId ? novo : p)) };
      }
      ({ conteudo, colidem } = montarConteudo(parametros.tema, categorias, conteudo.projetos));
      if (colidem.length > 0) throw new Error("projetos repetidos depois da regeneração");
      return conteudo;
    });
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
