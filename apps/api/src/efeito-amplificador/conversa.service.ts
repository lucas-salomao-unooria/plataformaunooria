import { Inject, Injectable, Optional } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { rateLimit } from "../comum/rate-limit";
import { logger } from "../observabilidade/logger";
import {
  MAX_TOKENS_DA_CONVERSA,
  SCHEMA_DA_CONVERSA,
  SYSTEM_DA_CONVERSA,
  TETO_DA_CONVERSA_MS,
  promptDaConversa,
  validarSaidaDaConversa,
  type ContextoDaConversa,
  type SaidaDaConversa,
} from "./prompts-da-conversa";

/** Token de injeção do prazo — a suíte o encurta para provar a corrida sem esperar 12 s. */
export const TETO_DA_CONVERSA = "TETO_DA_CONVERSA_EXP02EM1B";

/**
 * Pedidos por estudante por janela. O teto de NEGÓCIO é o do chat (5 por
 * sessão, no banco); este só segura a rajada que chegaria ao modelo antes de a
 * transação contar — a chamada à IA fica FORA dela. Por usuário, nunca por IP.
 */
export const LIMITE_DA_CONVERSA = { usos: 8, janelaMs: 60_000 } as const;

/** Por que a árvore respondeu no lugar da IA. Vai ao log; nunca à tela. */
export type MotivoDaArvore = "limite" | "sem-saldo" | "tempo-esgotado" | "saida-invalida" | "provedor-falhou";

/**
 * O UnooriaAI da AULA com IA real — a metade que ENTENDE e REDIGE da conversa
 * híbrida (ADR-181). Não toca o banco: devolve a intenção e o texto, e quem
 * aplica é o `EfeitoAmplificadorService`, na transação do funil.
 *
 * Quota do perfil `estudante` (regra 5): `temSaldo` ANTES, débito por TENTATIVA
 * (inclusive a que os guardrails recusaram — foi paga, ADR-74). Uma tentativa
 * só, em corrida contra `TETO_DA_CONVERSA_MS`. NUNCA lança: toda falha devolve
 * `null`, e a árvore responde — a sala não para porque o vendor caiu às 8h.
 */
@Injectable()
export class ConversaDaExp02em1bService {
  private readonly tetoMs: number;

  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
    @Optional() @Inject(TETO_DA_CONVERSA) tetoMs?: number,
  ) {
    this.tetoMs = tetoMs ?? TETO_DA_CONVERSA_MS;
  }

  async responder(escolaId: string, estudanteId: string, contexto: ContextoDaConversa): Promise<SaidaDaConversa | null> {
    const r = await this.tentar(escolaId, estudanteId, contexto);
    if ("motivo" in r) {
      /* Sem o texto do estudante: é de menor (regra 6). */
      logger.info({ codigo: "exp02em1b-conversa-arvore", escolaId, motivo: r.motivo }, "UnooriaAI respondeu pela árvore");
      return null;
    }
    return r;
  }

  private async tentar(
    escolaId: string,
    estudanteId: string,
    contexto: ContextoDaConversa,
  ): Promise<SaidaDaConversa | { motivo: MotivoDaArvore }> {
    if (!rateLimit(`efeito-amplificador:conversa:${estudanteId}`, LIMITE_DA_CONVERSA.usos, LIMITE_DA_CONVERSA.janelaMs).ok) {
      return { motivo: "limite" };
    }
    try {
      if (!(await this.quota.temSaldo(escolaId, estudanteId, "estudante"))) return { motivo: "sem-saldo" };
    } catch {
      return { motivo: "provedor-falhou" };
    }

    const debitos: Promise<unknown>[] = [];
    let saidaInvalida = false;
    const chamada = this.ia.generateJson<SaidaDaConversa>({
      system: SYSTEM_DA_CONVERSA,
      prompt: promptDaConversa(contexto),
      responseSchema: SCHEMA_DA_CONVERSA,
      modelo: "padrao",
      temperatura: 0.4,
      tentativas: 1,
      maxTokens: MAX_TOKENS_DA_CONVERSA,
      validar: (bruto) => {
        try {
          return validarSaidaDaConversa(bruto, contexto);
        } catch (erro) {
          saidaInvalida = true;
          logger.warn({ codigo: "exp02em1b-conversa-recusada", escolaId, motivo: (erro as Error).message }, "saída do UnooriaAI recusada");
          throw erro;
        }
      },
      aoUsarTokens: (n) => {
        if (n <= 0) return;
        debitos.push(
          this.quota.consumir(escolaId, estudanteId, n).catch(() => {
            logger.warn({ codigo: "exp02em1b-conversa-debito-falhou", escolaId }, "débito da conversa não gravado");
          }),
        );
      },
    });
    /* A chamada que perde a corrida ainda pode rejeitar depois: sem este
       `catch`, a rejeição tardia vira `unhandledRejection` no processo. */
    chamada.catch(() => undefined);

    let relogio: ReturnType<typeof setTimeout> | undefined;
    const teto = new Promise<"tempo-esgotado">((resolver) => {
      relogio = setTimeout(() => resolver("tempo-esgotado"), this.tetoMs);
      relogio.unref?.();
    });

    try {
      const vencedor = await Promise.race([chamada, teto]);
      if (vencedor === "tempo-esgotado") return { motivo: "tempo-esgotado" };
      await Promise.allSettled(debitos);
      return vencedor;
    } catch {
      await Promise.allSettled(debitos);
      return { motivo: saidaInvalida ? "saida-invalida" : "provedor-falhou" };
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  }
}
