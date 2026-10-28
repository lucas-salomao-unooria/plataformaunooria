import { Inject, Injectable, Optional } from "@nestjs/common";
import { AI_PROVIDER, type AiJsonRequest, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { rateLimit } from "../comum/rate-limit";
import { logger } from "../observabilidade/logger";
import type { ConteudoDoPacote, Intencao } from "./conteudo";
import {
  MAX_TOKENS_DA_DEVOLUTIVA,
  MAX_TOKENS_DO_CLASSIFICADOR,
  SCHEMA_DA_DEVOLUTIVA,
  SCHEMA_DO_CLASSIFICADOR,
  SYSTEM_DA_DEVOLUTIVA,
  SYSTEM_DO_CLASSIFICADOR,
  promptDaDevolutiva,
  promptDoClassificador,
  validarSaidaDaDevolutiva,
  validarSaidaDoClassificador,
} from "./prompts-da-aula";
import type { FatosDaDevolutiva, HabilidadeDaDevolutiva } from "./regras/devolutiva";

/**
 * Os prazos da IA da aula. O SDK da experiência desiste em 10 s, e a rota
 * ainda lê e grava no banco: a IA tem de perder a corrida antes disso, e a
 * árvore (ou o modelo da devolutiva) responder.
 */
export const TETOS_DA_IA_DA_AULA = { classificar: 5_000, devolutiva: 7_000 } as const;
/** Token de injeção dos prazos — a suíte os encurta para provar a corrida sem esperar. */
export const TETOS_DA_IA_DA_AULA_TOKEN = "TETOS_DA_IA_DA_AULA_EXP02EM1B";

/**
 * Pedidos por estudante por janela. O teto de NEGÓCIO do chat é o da sessão (5
 * mensagens, no banco); este segura a rajada que chegaria ao modelo antes de a
 * transação contar. Por usuário, nunca por IP.
 */
export const LIMITE_DA_IA_DA_AULA = { usos: 8, janelaMs: 60_000 } as const;

/** Por que a IA não respondeu. Vai ao log; nunca à tela. */
export type MotivoSemIa = "limite" | "sem-saldo" | "tempo-esgotado" | "saida-invalida" | "provedor-falhou";

/**
 * A IA DURANTE a aula da exp02em1b (ADR-192) — duas chamadas curtas, e nenhuma
 * decide o que a régua lê:
 *
 * - `classificar`: a mensagem que a árvore NÃO entendeu vira uma intenção da
 *   lista fechada (ou `fora_do_tema`). A prévia muda pela intenção e a fala
 *   continua a do 01e;
 * - `redigirDevolutiva`: o parágrafo de cada habilidade, a partir dos fatos já
 *   gravados — nunca do texto do estudante.
 *
 * Quota do perfil `estudante` (regra 5): `temSaldo` ANTES, débito por
 * TENTATIVA (inclusive a recusada — foi paga, ADR-74). Uma tentativa só, em
 * corrida contra o teto. NUNCA lança: toda falha devolve `null`, e quem chama
 * tem a resposta sem IA — a sala não para porque o vendor caiu às 8h.
 */
@Injectable()
export class IaDaAulaDaExp02em1bService {
  private readonly tetos: { classificar: number; devolutiva: number };

  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
    @Optional() @Inject(TETOS_DA_IA_DA_AULA_TOKEN) tetos?: { classificar: number; devolutiva: number },
  ) {
    this.tetos = tetos ?? TETOS_DA_IA_DA_AULA;
  }

  async classificar(
    escolaId: string,
    estudanteId: string,
    contexto: { mensagem: string; tema: string; conteudo: Pick<ConteudoDoPacote, "fonteInventada" | "fonteOriginal" | "colega"> },
  ): Promise<Exclude<Intencao, "substituir_dado"> | null> {
    const r = await this.correr(escolaId, estudanteId, "classificar", {
      system: SYSTEM_DO_CLASSIFICADOR,
      prompt: promptDoClassificador(contexto),
      responseSchema: SCHEMA_DO_CLASSIFICADOR,
      maxTokens: MAX_TOKENS_DO_CLASSIFICADOR,
      temperatura: 0,
      validar: validarSaidaDoClassificador,
    });
    return r;
  }

  redigirDevolutiva(
    escolaId: string,
    estudanteId: string,
    contexto: { tema: string; manchete: string | null; fatos: FatosDaDevolutiva },
  ): Promise<Record<HabilidadeDaDevolutiva, string> | null> {
    return this.correr(escolaId, estudanteId, "devolutiva", {
      system: SYSTEM_DA_DEVOLUTIVA,
      prompt: promptDaDevolutiva(contexto),
      responseSchema: SCHEMA_DA_DEVOLUTIVA,
      maxTokens: MAX_TOKENS_DA_DEVOLUTIVA,
      temperatura: 0.5,
      validar: (bruto) => validarSaidaDaDevolutiva(bruto, contexto.fatos),
    });
  }

  private async correr<T>(
    escolaId: string,
    estudanteId: string,
    uso: "classificar" | "devolutiva",
    pedido: Omit<AiJsonRequest<T>, "aoUsarTokens" | "tentativas" | "modelo">,
  ): Promise<T | null> {
    const r = await this.tentar(escolaId, estudanteId, uso, pedido);
    if (typeof r === "object" && r !== null && "semIa" in r) {
      /* Sem o texto do estudante: é de menor (regra 6). */
      logger.info({ codigo: "exp02em1b-ia-da-aula-sem-ia", escolaId, uso, motivo: r.semIa }, "a IA da aula não respondeu; segue sem ela");
      return null;
    }
    return r as T;
  }

  private async tentar<T>(
    escolaId: string,
    estudanteId: string,
    uso: "classificar" | "devolutiva",
    pedido: Omit<AiJsonRequest<T>, "aoUsarTokens" | "tentativas" | "modelo">,
  ): Promise<T | { semIa: MotivoSemIa }> {
    if (!rateLimit(`efeito-amplificador:ia-da-aula:${estudanteId}`, LIMITE_DA_IA_DA_AULA.usos, LIMITE_DA_IA_DA_AULA.janelaMs).ok) {
      return { semIa: "limite" };
    }
    try {
      if (!(await this.quota.temSaldo(escolaId, estudanteId, "estudante"))) return { semIa: "sem-saldo" };
    } catch {
      return { semIa: "provedor-falhou" };
    }

    const debitos: Promise<unknown>[] = [];
    let saidaInvalida = false;
    const chamada = this.ia.generateJson<T>({
      ...pedido,
      modelo: "padrao",
      tentativas: 1,
      validar: (bruto) => {
        try {
          return pedido.validar(bruto);
        } catch (erro) {
          saidaInvalida = true;
          logger.warn({ codigo: "exp02em1b-ia-da-aula-recusada", escolaId, uso, motivo: (erro as Error).message }, "saída da IA da aula recusada");
          throw erro;
        }
      },
      aoUsarTokens: (n) => {
        if (n <= 0) return;
        debitos.push(
          this.quota.consumir(escolaId, estudanteId, n).catch(() => {
            logger.warn({ codigo: "exp02em1b-ia-da-aula-debito-falhou", escolaId, uso }, "débito da IA da aula não gravado");
          }),
        );
      },
    });
    /* A chamada que perde a corrida ainda pode rejeitar depois: sem este
       `catch`, a rejeição tardia vira `unhandledRejection` no processo. */
    chamada.catch(() => undefined);

    let relogio: ReturnType<typeof setTimeout> | undefined;
    const teto = new Promise<"tempo-esgotado">((resolver) => {
      relogio = setTimeout(() => resolver("tempo-esgotado"), this.tetos[uso]);
      relogio.unref?.();
    });

    try {
      const vencedor = await Promise.race([chamada, teto]);
      if (vencedor === "tempo-esgotado") return { semIa: "tempo-esgotado" };
      await Promise.allSettled(debitos);
      return vencedor;
    } catch {
      await Promise.allSettled(debitos);
      return { semIa: saidaInvalida ? "saida-invalida" : "provedor-falhou" };
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  }
}
