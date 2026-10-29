import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import type { ConteudoDoPacote, Disciplina, ItemDoPacote } from "./conteudo";
import {
  MAX_TOKENS_DO_ITEM,
  MAX_TOKENS_DO_PREPARO,
  SCHEMA_DO_PREPARO,
  SYSTEM_DO_PREPARO,
  promptDoItem,
  promptDoPreparo,
  schemaDoItem,
  validarSaidaDoItem,
  validarSaidaDoPreparo,
} from "./prompts";

/** Por que o rascunho saiu do banco curado (ou o item não mudou) — é o que decide a frase da tela. */
export type MotivoDoPadrao = "sem-saldo" | "indisponivel";

export interface ResultadoDoPreparo {
  conteudo: ConteudoDoPacote | null;
  motivo: MotivoDoPadrao | null;
  tokens: number;
}

/**
 * A IA do PREPARO da exp03em1b: o pacote inteiro (API-002) e o "Regenerar
 * Item" da curadoria. Não aprova (só a homologação do professor), não avalia
 * ninguém e não entra na aula.
 *
 * Quota do PERFIL (regra 5 e ADR-74): `temSaldo` ANTES, e o que o vendor
 * cobrou é debitado por TENTATIVA — inclusive as que o `validar` recusou. A
 * medição de custo (ADR-161) é do `MedidorDeProvider`, automática no
 * `AiProvider`: a rota (`porta-voz-dos-dados`) dá o recurso.
 *
 * Não lança em falha de vendor: sem saldo ou com o Vertex fora, o professor
 * recebe o banco curado (ou o item como estava) e a aula acontece.
 */
@Injectable()
export class PreparoDaExp03em1bService {
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
    return this.chamar(escolaId, usuarioId, perfil, "exp03em1b-preparo", (contar) =>
      this.ia.generateJson<ConteudoDoPacote>({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(recorte),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        temperatura: 0.5,
        aoUsarTokens: contar,
        validar: validarSaidaDoPreparo,
      }),
    );
  }

  /** "Regenerar Item": o item novo, junto ao pacote, passa a régua inteira. Falha = `conteudo: null`. */
  async regenerar(escolaId: string, usuarioId: string, perfil: Perfil, item: ItemDoPacote, conteudo: ConteudoDoPacote, tema: string): Promise<ResultadoDoPreparo> {
    return this.chamar(escolaId, usuarioId, perfil, "exp03em1b-regenerar", (contar) =>
      this.ia.generateJson<ConteudoDoPacote>({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoItem(item, conteudo, tema),
        responseSchema: schemaDoItem(item),
        maxTokens: MAX_TOKENS_DO_ITEM,
        temperatura: 0.8,
        aoUsarTokens: contar,
        validar: (bruto) => validarSaidaDoItem(item, bruto, conteudo),
      }),
    );
  }

  private async chamar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    codigo: string,
    pedir: (contar: (n: number) => void) => Promise<ConteudoDoPacote>,
  ): Promise<ResultadoDoPreparo> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      logger.info({ codigo: `${codigo}-sem-saldo`, escolaId }, "preparo sem saldo de IA; o banco curado responde");
      return { conteudo: null, motivo: "sem-saldo", tokens: 0 };
    }
    let tokens = 0;
    try {
      const conteudo = await pedir((n) => {
        tokens += n;
      });
      await this.quota.consumir(escolaId, usuarioId, tokens);
      return { conteudo, motivo: null, tokens };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha (ADR-74). */
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens).catch(() => undefined);
      logger.warn({ codigo: `${codigo}-falhou`, escolaId, tokens, err: erro }, "a IA do preparo falhou; o banco curado responde");
      return { conteudo: null, motivo: "indisponivel", tokens };
    }
  }
}
