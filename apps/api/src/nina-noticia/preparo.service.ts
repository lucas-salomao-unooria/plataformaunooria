import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { FICHA_DO_SUPORTE, aplicarEstrutura, type ConteudoDoPacote, type Reportagem } from "./conteudo";
import { TextosGeradosSchema } from "./contrato-de-rotas";
import { problemasDoPacote } from "./invariantes";
import {
  SCHEMA_DA_REGENERACAO,
  SCHEMA_DO_PACOTE,
  SYSTEM_DO_PREPARO,
  TENTATIVAS_DO_PREPARO,
  promptDaRegeneracao,
  promptDoPacote,
  type ParametrosDoPreparo,
} from "./prompts";
import { LUGAR_DO_EVENTO, SUPORTES, type Suporte } from "./vocabulario";

/**
 * O PREPARO com IA — as três reportagens e o cartaz sobre o tema, a
 * disciplina e o assunto da professora (E0-PROF-02/03), e o "Regenerar
 * Notícia" de uma reportagem (E0-PROF-04). Molde: `juri-estadual/preparo.service.ts`.
 *
 * Três coisas que este serviço não faz, e cada ausência é uma regra:
 *
 * 1. **Não publica.** O que devolve é RASCUNHO; só a homologação grava.
 * 2. **Não aceita estrutura da IA.** A IA escreve só texto
 *    (`TextosGeradosSchema`); o servidor põe a estrutura por cima
 *    (`aplicarEstrutura`) e só então a régua (`problemasDoPacote`) decide. A
 *    reprovação regera a tentativa com o motivo (o `validar` lança).
 * 3. **Não decide o fallback.** Sem saldo devolve `sem-saldo-de-ia`; com a IA
 *    fora do ar (ou a saída reprovada nas duas tentativas), `ia-indisponivel`.
 *    Quem troca isso pelo BANCO PADRÃO (`usouIa: false`, `motivo`) é a rota.
 *
 * Quota: a do PERFIL (ADR-105), `temSaldo` antes e o que o vendor cobrou
 * debitado por tentativa, inclusive as recusadas (ADR-74). A medição no painel
 * de custos (ADR-161) é do `MedidorDeProvider`, pela rota (`nina-noticia`).
 */

export type ResultadoDoPreparo<T> =
  | { ok: true; valor: T; tokens: number; chamouIa: true }
  | { ok: false; codigo: "sem-saldo-de-ia" | "ia-indisponivel"; tokens: number; chamouIa: boolean };

/** O texto da IA vira pacote com a estrutura do servidor, ou lança com os problemas (a tentativa é regerada). */
export function pacoteDaIa(bruto: unknown): ConteudoDoPacote {
  const textos = TextosGeradosSchema.parse(bruto);
  const suportes = new Set(textos.reportagens.map((r) => r.suporte));
  if (suportes.size !== SUPORTES.length) throw new Error("as três reportagens precisam ser de suportes diferentes");
  const conteudo = aplicarEstrutura(textos);
  const problemas = problemasDoPacote(conteudo);
  if (problemas.length > 0) throw new Error(problemas.join("; "));
  return conteudo;
}

/** A reportagem regerada no lugar dela, com a estrutura do servidor; o pacote inteiro tem de continuar válido. */
export function reportagemRegeneradaDaIa(bruto: unknown, conteudo: ConteudoDoPacote, suporte: Suporte): Reportagem {
  const r = TextosGeradosSchema.shape.reportagens.element.parse(
    (bruto as { reportagem?: unknown } | null)?.reportagem,
  );
  const nova: Reportagem = {
    suporte,
    manchete: r.manchete,
    legenda: r.legenda,
    lugar: LUGAR_DO_EVENTO,
    ficha: { ...FICHA_DO_SUPORTE[suporte] },
    imagem: r.imagem,
  };
  const problemas = problemasDoPacote({
    ...conteudo,
    reportagens: conteudo.reportagens.map((x) => (x.suporte === suporte ? nova : x)),
  });
  if (problemas.length > 0) throw new Error(problemas.join("; "));
  return nova;
}

@Injectable()
export class PreparoDaExp03ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  /** O rascunho inteiro, numa chamada. Nunca lança: a falha volta com o código. */
  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: ParametrosDoPreparo,
  ): Promise<ResultadoDoPreparo<ConteudoDoPacote>> {
    return this.chamar(escolaId, usuarioId, perfil, "preparo", (aoUsarTokens) =>
      this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPacote(parametros),
        responseSchema: SCHEMA_DO_PACOTE,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        temperatura: 0.7,
        aoUsarTokens,
        validar: pacoteDaIa,
      }),
    );
  }

  /** "Regenerar Notícia": a reportagem de UM suporte, com o pacote inteiro ainda válido. Não persiste. */
  async regenerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: ParametrosDoPreparo,
    conteudo: ConteudoDoPacote,
    suporte: Suporte,
  ): Promise<ResultadoDoPreparo<Reportagem>> {
    return this.chamar(escolaId, usuarioId, perfil, "regeneracao", (aoUsarTokens) =>
      this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDaRegeneracao(parametros, conteudo, suporte),
        responseSchema: SCHEMA_DA_REGENERACAO,
        tentativas: TENTATIVAS_DO_PREPARO,
        modelo: "padrao",
        temperatura: 0.8,
        aoUsarTokens,
        validar: (bruto) => reportagemRegeneradaDaIa(bruto, conteudo, suporte),
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
        logger.info({ codigo: `exp03ef1b-${oQue}-sem-saldo`, escolaId }, "preparo sem saldo de IA");
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
      /* Cobra o que foi PAGO mesmo na falha (ADR-74). Sem `err` no log: a
         mensagem da recusa repete trechos do que a IA escreveu sobre o tema. */
      await this.debitar(escolaId, usuarioId, tokens);
      logger.warn(
        { codigo: `exp03ef1b-${oQue}-falhou`, escolaId, tokens, erro: erro instanceof Error ? erro.name : "desconhecido" },
        "geração das notícias falhou",
      );
      return { ok: false, codigo: "ia-indisponivel", tokens, chamouIa: true };
    }
  }

  private async debitar(escolaId: string, usuarioId: string, tokens: number): Promise<void> {
    if (tokens <= 0) return;
    try {
      await this.quota.consumir(escolaId, usuarioId, tokens);
    } catch {
      logger.warn({ codigo: "exp03ef1b-preparo-debito-falhou", escolaId }, "débito do preparo não gravado");
    }
  }
}
