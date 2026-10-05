import { Inject, Injectable, Optional } from "@nestjs/common";
import { z } from "zod";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { rateLimit } from "../comum/rate-limit";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import type { NoticiaDoPacote } from "./contrato-de-rotas";
import { palavras } from "./invariantes";
import {
  SCHEMA_DA_DIAGRAMACAO,
  SYSTEM_DA_DIAGRAMACAO,
  promptDaDiagramacao,
} from "./prompts";
import { layoutAutomatico } from "./regras/layout";
import { LAYOUTS, type Layout, type OrigemDoLayout } from "./vocabulario";

/**
 * A DIAGRAMAÇÃO da primeira página — a IA em sala, e a exceção que ela
 * registra: a única chamada de IA com a turma diante da tela. É cercada de
 * guardrails, todos aqui, na ORDEM em que rodam (molde:
 * `a-selecao/classificacao.service.ts`):
 *
 *   1. O CACHE (`exp04ef1b_diagramacoes`): a mesma página (pacote + as três
 *      vagas na ordem) montada por outra criança não paga outra chamada.
 *   2. RATE LIMIT por estudante, em memória — a tela diagrama a cada troca de
 *      matéria, e o teto é contra o toque nervoso.
 *   3. QUOTA do perfil `estudante` (`temSaldo` ANTES, regra inviolável nº 5).
 *   4. `generateJson` com o modelo padrão, temperatura 0, UMA tentativa, o
 *      `responseSchema` com SÓ o enum de layout (não há campo de texto onde a
 *      IA escreva) e um `validar` Zod. SEM teto de saída (ADR-148): o Gemini 3
 *      raciocina mesmo com `thinkingBudget: 0`, e o raciocínio sai do mesmo
 *      orçamento — com 32 tokens a resposta era cortada antes do JSON e a
 *      diagramação caía SEMPRE no modelo automático, em silêncio.
 *   5. TETO DE TEMPO por `Promise.race` (~6 s): o provider só corta em 15 min e
 *      não aceita `signal`, então o teto de N s é `Promise.race`.
 *   6. O débito vai no `aoUsarTokens`, para cobrar também a chamada que perde a
 *      corrida para o teto (ADR-74).
 *
 * **Falhou qualquer passo, o modelo automático diagrama** (`regras/layout.ts`),
 * com `origem: "modelo"` e sem gravar no cache. A tela nunca fica sem página
 * por causa da IA; em dev e na e2e, com o mock, é sempre o modelo.
 *
 * A IA recebe das três notícias só a manchete, o tamanho do resumo e se há
 * imagem — como DADO delimitado. Nunca o gabarito, a pista nem a consequência.
 */

/** Quanto a tela espera a IA antes de cair no modelo automático. */
export const TETO_DA_DIAGRAMACAO_MS = 6000;

/** Token de injeção do teto — a suíte o encurta; em produção vale o padrão. */
export const TETO_DA_DIAGRAMACAO = "TETO_DA_DIAGRAMACAO";

/** Doze diagramações a cada dez minutos, por estudante. */
export const LIMITE_DA_DIAGRAMACAO = { usos: 12, janelaMs: 10 * 60_000 } as const;

export type FalhaDaDiagramacao = "limite" | "sem-saldo" | "tempo-esgotado" | "saida-invalida" | "provedor-falhou";

/** A saída que vale: um layout do enum, e nada mais. */
export const DiagramacaoDaIaSchema = z.object({ layout: z.enum(LAYOUTS) });

export function validarDiagramacao(bruto: unknown): { layout: Layout } {
  return DiagramacaoDaIaSchema.parse(bruto);
}

/** A chave do cache: os três ids NA ORDEM das vagas. */
export function chaveDaPagina(slots: readonly string[]): string {
  return slots.join(",");
}

type NoticiaDaPagina = Pick<NoticiaDoPacote, "id" | "manchete" | "resumo" | "descricaoImagem">;

@Injectable()
export class DiagramacaoService {
  private readonly tetoMs: number;

  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(TETO_DA_DIAGRAMACAO) tetoMs?: number,
  ) {
    this.tetoMs = tetoMs ?? TETO_DA_DIAGRAMACAO_MS;
  }

  /**
   * O layout da página com estas três notícias, na ordem. NUNCA lança: toda
   * falha vira o modelo automático, porque a tela da criança espera esta
   * resposta para desenhar a página.
   */
  async diagramar(
    escolaId: string,
    estudanteId: string,
    pacoteId: string,
    vagas: readonly NoticiaDaPagina[],
  ): Promise<{ layout: Layout; origem: OrigemDoLayout }> {
    const chave = chaveDaPagina(vagas.map((v) => v.id));
    const modelo = { layout: layoutAutomatico(vagas.map((v) => ({ manchete: v.manchete, temImagem: v.descricaoImagem !== null }))), origem: "modelo" as const };

    const doCache = await this.lerCache(escolaId, pacoteId, chave);
    if (doCache) return { layout: doCache, origem: "ia" };

    const resultado = await this.tentar(escolaId, estudanteId, vagas);
    if (!resultado.ok) {
      logger.info(
        { codigo: "exp04ef1b-diagramacao-modelo", escolaId, motivo: resultado.codigo },
        "diagramação pelo modelo automático",
      );
      return modelo;
    }
    await this.gravarCache(escolaId, pacoteId, chave, resultado.layout, resultado.tokens);
    return { layout: resultado.layout, origem: "ia" };
  }

  private async lerCache(escolaId: string, pacoteId: string, chave: string): Promise<Layout | null> {
    try {
      const linha = await this.prisma.comTenancy(
        (tx) =>
          tx.exp04ef1bDiagramacao.findUnique({
            where: { escolaId_pacoteId_chave: { escolaId, pacoteId, chave } },
            select: { layout: true },
          }),
        escolaId,
      );
      const lido = linha ? DiagramacaoDaIaSchema.safeParse({ layout: linha.layout }) : null;
      return lido?.success ? lido.data.layout : null;
    } catch {
      return null;
    }
  }

  /**
   * `createMany` com `skipDuplicates`: duas crianças que montam a mesma página
   * ao mesmo tempo gravam uma linha só, e a segunda não aborta nada. Falha de
   * gravação não derruba a resposta — o layout já veio.
   */
  private async gravarCache(escolaId: string, pacoteId: string, chave: string, layout: Layout, tokens: number) {
    try {
      await this.prisma.comTenancy(
        (tx) =>
          tx.exp04ef1bDiagramacao.createMany({
            data: [{ escolaId, pacoteId, chave, layout, tokens: Math.max(0, Math.round(tokens)) }],
            skipDuplicates: true,
          }),
        escolaId,
      );
    } catch {
      logger.warn({ codigo: "exp04ef1b-diagramacao-cache-falhou", escolaId }, "cache da diagramação não gravado");
    }
  }

  private async tentar(
    escolaId: string,
    estudanteId: string,
    vagas: readonly NoticiaDaPagina[],
  ): Promise<{ ok: true; layout: Layout; tokens: number } | { ok: false; codigo: FalhaDaDiagramacao }> {
    /* Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT. */
    const limite = rateLimit(
      `jornal-escola:diagramar:${estudanteId}`,
      LIMITE_DA_DIAGRAMACAO.usos,
      LIMITE_DA_DIAGRAMACAO.janelaMs,
    );
    if (!limite.ok) return { ok: false, codigo: "limite" };

    try {
      if (!(await this.quota.temSaldo(escolaId, estudanteId, "estudante"))) return { ok: false, codigo: "sem-saldo" };
    } catch {
      return { ok: false, codigo: "provedor-falhou" };
    }

    const debitos: Promise<unknown>[] = [];
    let tokens = 0;
    let saidaInvalida = false;
    const chamada = this.ia.generateJson({
      system: SYSTEM_DA_DIAGRAMACAO,
      prompt: promptDaDiagramacao(
        vagas.map((v) => ({ manchete: v.manchete, palavrasDoResumo: palavras(v.resumo), temImagem: v.descricaoImagem !== null })),
      ),
      responseSchema: SCHEMA_DA_DIAGRAMACAO,
      modelo: "padrao",
      temperatura: 0,
      tentativas: 1,
      validar: (bruto) => {
        try {
          return validarDiagramacao(bruto);
        } catch (erro) {
          saidaInvalida = true;
          throw erro;
        }
      },
      aoUsarTokens: (n) => {
        if (n <= 0) return;
        tokens += n;
        debitos.push(
          this.quota.consumir(escolaId, estudanteId, n).catch(() => {
            logger.warn({ codigo: "exp04ef1b-diagramacao-debito-falhou", escolaId }, "débito da diagramação não gravado");
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
      if (vencedor === "tempo-esgotado") return { ok: false, codigo: "tempo-esgotado" };
      await Promise.allSettled(debitos);
      return { ok: true, layout: vencedor.layout, tokens };
    } catch {
      await Promise.allSettled(debitos);
      return { ok: false, codigo: saidaInvalida ? "saida-invalida" : "provedor-falhou" };
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  }
}
