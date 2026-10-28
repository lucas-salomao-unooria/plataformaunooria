import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import type { ConteudoDoPacote, Disciplina } from "./conteudo";
import {
  MAX_TOKENS_DAS_REACOES,
  MAX_TOKENS_DO_PREPARO,
  SCHEMA_DAS_REACOES,
  SCHEMA_DO_PREPARO,
  SYSTEM_DAS_REACOES,
  SYSTEM_DO_PREPARO,
  promptDasReacoes,
  promptDoPreparo,
  validarSaidaDasReacoes,
  validarSaidaDoPreparo,
} from "./prompts";

/** Por que o rascunho saiu do banco curado — é o que decide a frase da tela (429 × 503). */
export type MotivoDoPadrao = "sem-saldo" | "indisponivel";

export interface ResultadoDoPreparo {
  conteudo: ConteudoDoPacote | null;
  motivo: MotivoDoPadrao | null;
  tokens: number;
}

/**
 * A IA do PREPARO da exp02em1b: o pacote, antes da aula, e — desde a 2.2.0
 * (ADR-192) — as reações do feed ao post de cada estudante, numa segunda
 * chamada sobre o pacote já validado. A IA da aula está em
 * `classificador.service.ts` e `devolutiva.service.ts`.
 *
 * Não aprova (só a homologação do professor põe um pacote diante da turma), não
 * avalia ninguém e não entra na aula. O contrato de quota é o da regra 5 e da
 * ADR-74: `temSaldo` ANTES, e o que o vendor cobrou é debitado por TENTATIVA —
 * inclusive as que o `validar` rejeitou. Perfil `professor`.
 *
 * Não lança em falha de vendor: sem saldo ou com o Vertex fora, o professor
 * recebe o banco curado e a aula acontece. As reações falhando não derrubam o
 * pacote: ele sai sem elas, e o feed é o mesmo para todos (o de antes da 2.2.0).
 */
@Injectable()
export class PreparoDaExp02em1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    recorte: { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null },
  ): Promise<ResultadoDoPreparo> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      logger.info({ codigo: "exp02em1b-preparo-sem-saldo", escolaId }, "preparo sem saldo de IA; rascunho do banco curado");
      return { conteudo: null, motivo: "sem-saldo", tokens: 0 };
    }
    let tokens = 0;
    try {
      const conteudo = await this.ia.generateJson<ConteudoDoPacote>({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(recorte),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        temperatura: 0.4,
        aoUsarTokens: (n) => {
          tokens += n;
        },
        validar: validarSaidaDoPreparo,
      });
      await this.quota.consumir(escolaId, usuarioId, tokens);
      const reacoes = await this.reacoes(escolaId, usuarioId, perfil, conteudo);
      tokens += reacoes.tokens;
      return { conteudo: reacoes.reacoes ? { ...conteudo, reacoes: reacoes.reacoes } : conteudo, motivo: null, tokens };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha (ADR-74). */
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens);
      logger.warn({ codigo: "exp02em1b-preparo-falhou", escolaId, tokens, err: erro }, "geração do pacote falhou; rascunho do banco curado");
      return { conteudo: null, motivo: "indisponivel", tokens };
    }
  }

  /** As reações ao post do estudante (ADR-192). Mesmo contrato de quota; falha = `null`, nunca lança. */
  private async reacoes(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    conteudo: ConteudoDoPacote,
  ): Promise<{ reacoes: ConteudoDoPacote["reacoes"] | null; tokens: number }> {
    let tokens = 0;
    try {
      if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) return { reacoes: null, tokens: 0 };
      const reacoes = await this.ia.generateJson<NonNullable<ConteudoDoPacote["reacoes"]>>({
        system: SYSTEM_DAS_REACOES,
        prompt: promptDasReacoes(conteudo),
        responseSchema: SCHEMA_DAS_REACOES,
        maxTokens: MAX_TOKENS_DAS_REACOES,
        temperatura: 0.7,
        aoUsarTokens: (n) => {
          tokens += n;
        },
        validar: (bruto) => validarSaidaDasReacoes(bruto, conteudo),
      });
      await this.quota.consumir(escolaId, usuarioId, tokens);
      return { reacoes, tokens };
    } catch (erro) {
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens).catch(() => undefined);
      logger.warn({ codigo: "exp02em1b-reacoes-falharam", escolaId, tokens, err: erro }, "reações do feed não geradas; o pacote segue sem elas");
      return { reacoes: null, tokens };
    }
  }
}
