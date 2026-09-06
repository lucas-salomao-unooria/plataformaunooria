import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { REACOES, type Desfecho, type IdDeOpcao, type Reacao } from "./catalogo";
import { erroDeJogo } from "./erros";
import { SCHEMA_DAS_REACOES, promptDaDevolutiva, promptDasReacoes, promptDeAmara } from "./prompts";
import {
  validarDevolutiva,
  validarFalaDeAmara,
  validarFalaDoGrupo,
} from "./regras/sanitizador";

/**
 * As três superfícies em que o modelo escreve algo na exp-07.
 *
 * A regra que atravessa todas: **o modelo escreve a fala, nunca decide o
 * resultado.** Qual desfecho o bairro vive, se o Admin fixa a mensagem e quanto
 * vale o percurso saem de `regras/`, com o gabarito do catálogo. Aqui só se
 * decide COMO isso soa.
 *
 * E as três falham para o lado seguro. Sem saldo, sem provider ou com a saída
 * reprovada pelo sanitizador, a missão continua: as reações caem no roteiro do
 * catálogo, Amara diz que está sem sinal e a devolutiva simplesmente não
 * aparece. Nenhuma aula depende de o Vertex estar de pé.
 */

/** Teto de turnos da conversa com Amara. Ela é amiga, não assistente: uma
 *  conversa infinita no privado viraria o centro da missão, e o centro é o que
 *  aconteceu no grupo. */
export const TURNOS_COM_AMARA = 3;

@Injectable()
export class IaDaExp07Service {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  /**
   * As reações do bairro à mensagem postada.
   *
   * A CADÊNCIA não vem do modelo: os atrasos 2s → 3s → 2s são o pico da missão
   * e ficam no catálogo. O modelo escreve o texto; o servidor entrega o ritmo.
   *
   * Devolve `null` quando não deu — e `null` é o sinal para o chamador usar o
   * roteiro do catálogo, que é um desfecho autoral completo, não um remendo.
   */
  async reacoes(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    opcao: IdDeOpcao,
    desfecho: Desfecho,
  ): Promise<{ reacoes: Reacao[]; tokens: number } | null> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) return null;

    try {
      const bruto = await this.ia.generateJson<{ autor: string; texto: string }[]>({
        prompt: promptDasReacoes(opcao, desfecho),
        responseSchema: SCHEMA_DAS_REACOES,
        validar: (dados) => {
          const lista = (dados as { reacoes?: unknown }).reacoes;
          if (!Array.isArray(lista) || lista.length !== 3) {
            throw new Error("esperava exatamente 3 reações");
          }
          const falas = lista as Array<{ autor?: unknown; texto?: unknown }>;
          return falas.map((f) => {
            const texto = String(f.texto ?? "").trim();
            const motivos = validarFalaDoGrupo(texto);
            if (motivos.length > 0) throw new Error(motivos.join("; "));
            return { autor: String(f.autor ?? "").trim(), texto };
          });
        },
      });

      // A ordem e o ritmo são do catálogo; do modelo vem só o que se lê.
      const cadencia = REACOES[desfecho];
      const reacoes = cadencia.map((molde, i) => ({
        autor: bruto[i]?.autor || molde.autor,
        texto: bruto[i]?.texto || molde.texto,
        atrasoMs: molde.atrasoMs,
      }));

      const tokens = 1_500;
      await this.quota.consumir(escolaId, usuarioId, tokens);
      return { reacoes, tokens };
    } catch {
      // Sem detalhe no log: a mensagem do provider pode trazer o texto gerado,
      // e ele fala do caso da missão.
      logger.warn(
        { codigo: "exp07.reacoes-no-roteiro", desfecho },
        "reações do modelo indisponíveis — o bairro reage pelo roteiro",
      );
      return null;
    }
  }

  /**
   * Amara no privado, depois da decisão.
   *
   * Ao contrário das outras duas, esta NÃO tem fallback autoral: uma conversa
   * não tem resposta pronta. Sem saldo ou sem provider, ela lança — e a frase
   * que o estudante lê é "Amara não conseguiu responder agora", dentro da
   * ficção, sem vocabulário de infraestrutura.
   */
  async amara(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    historico: Array<{ papel: "estudante" | "amara"; texto: string }>,
    pergunta: string,
  ): Promise<{ texto: string; tokens: number }> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      throw erroDeJogo("teto-da-sessao");
    }

    try {
      const r = await this.ia.conversar({
        system: promptDeAmara(),
        historico: [
          ...historico.map((m) => ({
            papel: m.papel === "amara" ? ("agente" as const) : ("estudante" as const),
            texto: m.texto,
          })),
          { papel: "estudante" as const, texto: pergunta },
        ],
        validar: validarFalaDeAmara,
        socorro:
          "Responda em uma frase curta, como uma amiga de 13 anos no WhatsApp, sem explicar nada.",
        temperatura: 0.8,
      });
      await this.quota.consumir(escolaId, usuarioId, r.tokensUsados);
      return { texto: r.texto.trim(), tokens: r.tokensUsados };
    } catch (falha) {
      if (falha instanceof Error && falha.name === "ErroDeGeracao") {
        throw erroDeJogo("amara-indisponivel");
      }
      throw falha;
    }
  }

  /**
   * O comentário sobre o "Meu percurso".
   *
   * Devolve `null` quando não deu, e a tela simplesmente não mostra o
   * parágrafo. Isso é deliberado: o percurso do estudante já está salvo e a
   * missão já fechou — inventar um texto de consolo ali seria pior que o
   * silêncio.
   */
  async devolutiva(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    estrategias: string[],
    justificativa: string,
  ): Promise<{ texto: string; tokens: number } | null> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) return null;

    try {
      const r = await this.ia.generate({
        system: "Você conversa com estudantes de 12 e 13 anos sobre checagem de informação.",
        user: promptDaDevolutiva(estrategias, justificativa),
        maxTokens: 300,
        temperatura: 0.7,
      });
      const texto = r.texto.trim();
      const motivos = validarDevolutiva(texto);
      if (motivos.length > 0) {
        logger.warn(
          { codigo: "exp07.devolutiva-reprovada", motivos: motivos.join("; ") },
          "devolutiva do modelo barrada pelo sanitizador",
        );
        return null;
      }
      await this.quota.consumir(escolaId, usuarioId, r.tokensUsados);
      return { texto, tokens: r.tokensUsados };
    } catch {
      logger.warn({ codigo: "exp07.devolutiva-indisponivel" }, "percurso salvo sem devolutiva");
      return null;
    }
  }
}
