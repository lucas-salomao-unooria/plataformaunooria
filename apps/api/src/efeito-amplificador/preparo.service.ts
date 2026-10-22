import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import type { ConteudoDoPacote, Disciplina } from "./conteudo";
import { MAX_TOKENS_DO_PREPARO, SCHEMA_DO_PREPARO, SYSTEM_DO_PREPARO, promptDoPreparo, validarSaidaDoPreparo } from "./prompts";

/** Por que o rascunho saiu do banco curado — é o que decide a frase da tela (429 × 503). */
export type MotivoDoPadrao = "sem-saldo" | "indisponivel";

export interface ResultadoDoPreparo {
  conteudo: ConteudoDoPacote | null;
  motivo: MotivoDoPadrao | null;
  tokens: number;
}

/**
 * A ÚNICA superfície de IA da exp02em1b: o rascunho do pacote, antes da aula.
 *
 * Não aprova (só a homologação do professor põe um pacote diante da turma), não
 * avalia ninguém e não entra na aula. O contrato de quota é o da regra 5 e da
 * ADR-74: `temSaldo` ANTES, e o que o vendor cobrou é debitado por TENTATIVA —
 * inclusive as que o `validar` rejeitou. Perfil `professor`.
 *
 * Não lança em falha de vendor: sem saldo ou com o Vertex fora, o professor
 * recebe o banco curado e a aula acontece.
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
      return { conteudo, motivo: null, tokens };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha (ADR-74). */
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens);
      logger.warn({ codigo: "exp02em1b-preparo-falhou", escolaId, tokens, err: erro }, "geração do pacote falhou; rascunho do banco curado");
      return { conteudo: null, motivo: "indisponivel", tokens };
    }
  }
}
