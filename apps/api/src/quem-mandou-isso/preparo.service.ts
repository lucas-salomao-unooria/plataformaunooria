import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import type { Disciplina, MensagemDoPacote } from "./catalogo";
import { MAX_TOKENS_DO_PREPARO, SCHEMA_DO_PREPARO, SYSTEM_DO_PREPARO, promptDoPreparo, validarSaidaDoPreparo } from "./prompts";
import { sortearMolde } from "./regras/pacote";

/** Por que o rascunho saiu do banco curado — é o que decide a frase da tela (429 × 503 da copy). */
export type MotivoDoPadrao = "sem-saldo" | "indisponivel";

export interface ResultadoDoPreparo {
  /** As oito mensagens geradas, ou `null` quando não deu (e o rascunho sai do preset). */
  mensagens: MensagemDoPacote[] | null;
  motivo: MotivoDoPadrao | null;
  tokens: number;
}

/**
 * A ÚNICA superfície de IA da exp05ef1b: o rascunho das oito mensagens, antes
 * da aula.
 *
 * Três coisas que ele não faz, e cada ausência é uma regra:
 *
 * 1. **Não aprova.** O que sai daqui é rascunho; só o `POST /aprovar` do
 *    professor põe um pacote diante da turma (RF-003).
 * 2. **Não avalia ninguém.** A IA não lê a seleção nem a regra do estudante, e
 *    não entra na aula.
 * 3. **Não decide a estrutura.** O molde é sorteado aqui (`sortearMolde`), e o
 *    modelo só escreve.
 *
 * O contrato de quota é o da regra 5 e da ADR-74: `temSaldo` ANTES, e o que o
 * vendor cobrou é debitado por TENTATIVA — inclusive as que o `validar`
 * rejeitou, porque foram pagas igual. Perfil `professor`, com o teto próprio.
 *
 * Não lança em falha de vendor: o único jeito de esta rota estragar a aula
 * seria bloquear o professor, e ele precisa do preset com o Vertex fora do ar.
 */
@Injectable()
export class PreparoDaExp05ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null },
    aleatorio: () => number = Math.random,
  ): Promise<ResultadoDoPreparo> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      logger.info({ codigo: "exp05ef1b-preparo-sem-saldo", escolaId }, "preparo sem saldo de IA; rascunho do banco curado");
      return { mensagens: null, motivo: "sem-saldo", tokens: 0 };
    }

    const molde = sortearMolde(aleatorio);
    let tokens = 0;
    try {
      const mensagens = await this.ia.generateJson<MensagemDoPacote[]>({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(parametros, molde),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        // Baixa de propósito: conteúdo consistente num molde fixo, não variedade.
        temperatura: 0.3,
        aoUsarTokens: (n) => {
          tokens += n;
        },
        validar: validarSaidaDoPreparo(molde),
      });
      await this.quota.consumir(escolaId, usuarioId, tokens);
      return { mensagens, motivo: null, tokens };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha (ADR-74). */
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens);
      logger.warn(
        { codigo: "exp05ef1b-preparo-falhou", escolaId, tokens, err: erro },
        "geração do pacote falhou; rascunho do banco curado",
      );
      return { mensagens: null, motivo: "indisponivel", tokens };
    }
  }
}
