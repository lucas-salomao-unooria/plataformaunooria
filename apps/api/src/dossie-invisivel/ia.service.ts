import { Inject, Injectable, Optional } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { rateLimit } from "../comum/rate-limit";
import { logger } from "../observabilidade/logger";
import type { ConteudoDoPacote, Disciplina, ItemDoPacote } from "./conteudo";
import {
  MAX_TOKENS_DO_CLASSIFICADOR,
  MAX_TOKENS_DO_ITEM,
  MAX_TOKENS_DO_PREPARO,
  SCHEMA_DO_CLASSIFICADOR,
  SCHEMA_DO_PREPARO,
  SYSTEM_DO_CLASSIFICADOR,
  SYSTEM_DO_PREPARO,
  promptDoClassificador,
  promptDoItem,
  promptDoPreparo,
  schemaDoItem,
  validarSaidaDoClassificador,
  validarSaidaDoItem,
  validarSaidaDoPreparo,
} from "./prompts";
import type { LeituraDaIa } from "./regras/intencoes";

// ─────────────────────────────────────────────────────────── o preparo

/** Por que o rascunho saiu do banco curado (ou o item não mudou) — é o que decide a frase da tela. */
export type MotivoDoPadrao = "sem-saldo" | "indisponivel";

export interface ResultadoDoPreparo {
  conteudo: ConteudoDoPacote | null;
  motivo: MotivoDoPadrao | null;
  tokens: number;
}

/**
 * A IA do PREPARO da exp09ef1b: o pacote inteiro e o "Regenerar item
 * pontual" da curadoria. Não aprova (só a homologação do professor), não
 * avalia ninguém. Quota do PERFIL (regra 5 e ADR-74): `temSaldo` ANTES, e o
 * que o vendor cobrou é debitado por TENTATIVA. A medição de custo (ADR-161)
 * é do `MedidorDeProvider`. Não lança: sem saldo ou com o vendor fora, o
 * professor recebe o banco curado (ou o item como estava).
 */
@Injectable()
export class PreparoDaExp09ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  gerar(escolaId: string, usuarioId: string, perfil: Perfil, recorte: { disciplina: Disciplina; tema: string; assuntos: readonly string[]; contexto?: string | null }) {
    return this.chamar(escolaId, usuarioId, perfil, "exp09ef1b-preparo", (contar) =>
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

  regenerar(escolaId: string, usuarioId: string, perfil: Perfil, item: ItemDoPacote, conteudo: ConteudoDoPacote, tema: string) {
    return this.chamar(escolaId, usuarioId, perfil, "exp09ef1b-regenerar", (contar) =>
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

// ─────────────────────────────────────────────────────────── a aula

/** O SDK da experiência desiste em 10 s, e a rota ainda lê e grava: a IA perde a corrida antes. */
export const TETO_DO_CLASSIFICADOR_MS = 5_000;
/** Token de injeção do prazo — a suíte o encurta para provar a corrida sem esperar. */
export const TETO_DO_CLASSIFICADOR_TOKEN = "TETO_DO_CLASSIFICADOR_EXP09EF1B";
/** Pedidos por estudante por janela: segura a rajada antes de a transação contar (o teto de negócio é o da sessão, 5). */
export const LIMITE_DO_CLASSIFICADOR = { usos: 8, janelaMs: 60_000 } as const;

/**
 * A IA DURANTE a aula (decisão do Lucas de 2026-10-29: híbrido) — UMA chamada
 * curta, o classificador: a pergunta vira uma intenção da lista fechada, com
 * a confiança declarada. A fala é sempre do catálogo; quem decide a
 * bifurcação A/B é a intenção que a regra aceita (`decidirIntencao`).
 *
 * Quota do perfil `estudante` (regra 5): `temSaldo` ANTES, débito por
 * tentativa. Uma tentativa só, em corrida contra o teto. NUNCA lança: toda
 * falha devolve `null`, e quem chama usa a árvore.
 */
@Injectable()
export class IaDaAulaDaExp09ef1bService {
  private readonly teto: number;

  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
    @Optional() @Inject(TETO_DO_CLASSIFICADOR_TOKEN) teto?: number,
  ) {
    this.teto = teto ?? TETO_DO_CLASSIFICADOR_MS;
  }

  async classificar(escolaId: string, estudanteId: string, contexto: { mensagem: string; nomes: { papel: string; parcial: string; nuvem: string } }): Promise<LeituraDaIa | null> {
    const motivo = (m: string) => {
      /* Sem o texto do estudante: é de menor (regra 6). */
      logger.info({ codigo: "exp09ef1b-classificador-sem-ia", escolaId, motivo: m }, "o classificador da aula não respondeu; vale a árvore");
      return null;
    };
    if (!rateLimit(`dossie-invisivel:classificador:${estudanteId}`, LIMITE_DO_CLASSIFICADOR.usos, LIMITE_DO_CLASSIFICADOR.janelaMs).ok) return motivo("limite");
    try {
      if (!(await this.quota.temSaldo(escolaId, estudanteId, "estudante"))) return motivo("sem-saldo");
    } catch {
      return motivo("quota-falhou");
    }

    const debitos: Promise<unknown>[] = [];
    const chamada = this.ia.generateJson<LeituraDaIa>({
      system: SYSTEM_DO_CLASSIFICADOR,
      prompt: promptDoClassificador(contexto),
      responseSchema: SCHEMA_DO_CLASSIFICADOR,
      maxTokens: MAX_TOKENS_DO_CLASSIFICADOR,
      temperatura: 0,
      modelo: "padrao",
      tentativas: 1,
      validar: validarSaidaDoClassificador,
      aoUsarTokens: (n) => {
        if (n <= 0) return;
        debitos.push(this.quota.consumir(escolaId, estudanteId, n).catch(() => undefined));
      },
    });
    /* A chamada que perde a corrida ainda pode rejeitar depois: sem este `catch`, vira `unhandledRejection`. */
    chamada.catch(() => undefined);

    let relogio: ReturnType<typeof setTimeout> | undefined;
    const teto = new Promise<"tempo-esgotado">((resolver) => {
      relogio = setTimeout(() => resolver("tempo-esgotado"), this.teto);
      relogio.unref?.();
    });
    try {
      const vencedor = await Promise.race([chamada, teto]);
      if (vencedor === "tempo-esgotado") return motivo("tempo-esgotado");
      await Promise.allSettled(debitos);
      return vencedor;
    } catch {
      await Promise.allSettled(debitos);
      return motivo("provedor-falhou");
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  }
}
