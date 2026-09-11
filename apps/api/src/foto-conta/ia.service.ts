import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiJsonSchema, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import {
  PACOTE_PADRAO,
  type Complexidade,
  type PacoteDaTurma,
  type Tema,
} from "./catalogo";
import { PacoteDaTurmaSchema } from "./contrato-de-rotas";

/**
 * A ÚNICA superfície de IA da exp-04: a preparação docente (E0-PROF-01).
 *
 * O modelo escreve TEXTOS — legendas do feed, o par de legendas decisórias e
 * os 8 comentários da matriz causal — adaptados ao tema e ao nível de leitura
 * da turma. Ele NUNCA roda em tempo de execução no tablet da criança, nunca
 * avalia resposta e nunca decide a estrutura: o shape do pacote, as fotos
 * (banco curado do bundle) e a existência das 4 combinações são fixos aqui.
 *
 * Falha para o lado seguro (molde do o-eco-no-grupo): sem saldo, sem provider
 * ou com a saída reprovada, devolve `null` — o chamador serve o
 * `PACOTE_PADRAO`, que é material autoral completo, não um remendo. Nenhuma
 * aula depende de o Vertex estar de pé.
 */

const TEMA_ROTULO: Record<Tema, string> = {
  recreio: "o pátio do recreio",
  nossa_horta: "a horta da escola",
  sala_de_aula: "a sala de aula",
  parquinho: "o parquinho",
};

/** Teto de PALAVRAS por string do 1º EF (bloco 15 do one-pager). */
const MAX_PALAVRAS = 8;

const SCHEMA_DO_PACOTE: AiJsonSchema = {
  type: "object",
  properties: {
    feed: {
      type: "array",
      items: { type: "object", properties: { legenda: { type: "string" } } },
    },
    legendaDetalhe: { type: "string" },
    legendaGeral: { type: "string" },
    comentarios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          par: { type: "string" },
          leo: { type: "string" },
          sofia: { type: "string" },
        },
      },
    },
  },
};

interface SaidaDoModelo {
  feed: Array<{ legenda: string }>;
  legendaDetalhe: string;
  legendaGeral: string;
  comentarios: Array<{ par: string; leo: string; sofia: string }>;
}

const PARES = ["detalhe+detalhe", "geral+geral", "detalhe+geral", "geral+detalhe"] as const;

function promptDoPacote(tema: Tema, complexidade: Complexidade): string {
  const nivel =
    complexidade === "nivel_1"
      ? "palavras curtas e concretas, frases de ate 5 palavras"
      : "frases simples de ate 8 palavras";
  return [
    "Você escreve textos para uma missão de letramento visual do 1º ano do Ensino Fundamental (crianças de 6 anos, em alfabetização inicial).",
    `O cenário é ${TEMA_ROTULO[tema]} de uma escola pública brasileira.`,
    "A missão compara DUAS fotos do MESMO lugar: a foto DETALHE mostra de perto algo que a turma construiu ou cuida (bonito, organizado); a foto GERAL mostra o mesmo lugar de longe, com coisas espalhadas pelo chão.",
    "Escreva, todas EM CAIXA ALTA, sem emojis, sem nomes de criança e sem marcas comerciais:",
    "1. `feed`: exatamente 3 legendas curtas para fotos do cotidiano escolar nesse cenário.",
    "2. `legendaDetalhe`: uma legenda que celebra o que aparece na foto DETALHE.",
    "3. `legendaGeral`: uma legenda que descreve a bagunça/quantidade de coisas da foto GERAL.",
    `4. \`comentarios\`: exatamente 4 itens, um para cada par (campo \`par\`): ${PARES.join(", ")} — onde o primeiro termo é a FOTO escolhida e o segundo a LEGENDA. Cada item tem \`leo\` e \`sofia\`, comentários de colegas de 6-7 anos reagindo ao que a foto DEIXA ver e ao que ela ESCONDE. Nos pares cruzados a reação é de estranhamento engraçado (a legenda fala de uma coisa e a foto mostra outra).`,
    `Regras rígidas: máximo ${MAX_PALAVRAS} palavras por texto; ${nivel}; nada de vocabulário técnico; nunca diga qual foto é a "certa" — não existe foto certa.`,
  ].join("\n");
}

function palavras(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function normalizar(s: string): string {
  const t = s.trim().toUpperCase();
  if (!t) throw new Error("texto vazio");
  if (palavras(t) > MAX_PALAVRAS) throw new Error(`mais de ${MAX_PALAVRAS} palavras: "${t}"`);
  return t;
}

@Injectable()
export class IaDaFotoContaService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  /**
   * Gera o pacote da turma. `null` = use o `PACOTE_PADRAO` (e a tela diz ao
   * professor que o material é o padrão — silêncio aqui viraria material
   * trocado sem ninguém saber).
   *
   * As FOTOS não passam pelo modelo: em V1 o banco de imagens é o do bundle
   * (tema `recreio`); pacote de outro tema reusa as mesmas fotos — pendência
   * de asset declarada, não decisão escondida.
   */
  async gerarPacote(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    tema: Tema,
    complexidade: Complexidade,
  ): Promise<PacoteDaTurma | null> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) return null;

    let tokens = 0;
    try {
      const saida = await this.ia.generateJson<SaidaDoModelo>({
        prompt: promptDoPacote(tema, complexidade),
        responseSchema: SCHEMA_DO_PACOTE,
        aoUsarTokens: (n) => {
          tokens += n;
        },
        validar: (dados) => {
          const s = dados as SaidaDoModelo;
          if (!Array.isArray(s.feed) || s.feed.length !== 3) {
            throw new Error("esperava exatamente 3 legendas de feed");
          }
          if (!Array.isArray(s.comentarios) || s.comentarios.length !== 4) {
            throw new Error("esperava exatamente 4 pares de comentários");
          }
          for (const par of PARES) {
            if (!s.comentarios.some((c) => c.par === par)) {
              throw new Error(`faltou o par ${par}`);
            }
          }
          return s;
        },
      });

      const pacote = this.montarPacote(tema, saida);
      // A validação final é o MESMO schema que a aprovação usa: o que a IA
      // produz e o que o professor aprova passam pelo mesmo portão.
      const valido = PacoteDaTurmaSchema.parse(pacote);
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens);
      return valido;
    } catch (erro) {
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens);
      logger.warn(
        { codigo: "foto-conta.pacote-ia-falhou", err: erro instanceof Error ? erro.message : "?" },
        "geração do pacote falhou; o banco curado padrão assume",
      );
      return null;
    }
  }

  /** Monta o `PacoteDaTurma` canônico com os textos do modelo e as fotos do
   *  banco. Sem áudio: fala gerada não tem locução gravada, e o cliente sabe
   *  mostrar só o balão. */
  private montarPacote(tema: Tema, saida: SaidaDoModelo): PacoteDaTurma {
    const porPar = new Map(saida.comentarios.map((c) => [c.par, c]));
    const par = (nome: (typeof PARES)[number]) => {
      const c = porPar.get(nome);
      if (!c) throw new Error(`faltou o par ${nome}`);
      return { leo: normalizar(c.leo), sofia: normalizar(c.sofia) };
    };
    const dd = par("detalhe+detalhe");
    const gg = par("geral+geral");
    const dg = par("detalhe+geral");
    const gd = par("geral+detalhe");

    return {
      tema,
      feed: PACOTE_PADRAO.feed.map((post, i) => ({
        ...post,
        legenda: normalizar(saida.feed[i]?.legenda ?? ""),
      })),
      par: { ...PACOTE_PADRAO.par },
      legendas: [
        { id: "legenda_1", texto: normalizar(saida.legendaDetalhe), icone: "bloco" },
        { id: "legenda_2", texto: normalizar(saida.legendaGeral), icone: "vassoura" },
      ],
      comentarios: [
        { fotoId: "par_b", legendaId: "legenda_1", ...dd },
        { fotoId: "par_a", legendaId: "legenda_2", ...gg },
        { fotoId: "par_b", legendaId: "legenda_2", ...dg },
        { fotoId: "par_a", legendaId: "legenda_1", ...gd },
      ],
    };
  }
}
