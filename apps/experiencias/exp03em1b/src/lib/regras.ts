import type { Escala, Motivo, Parecer, Passo, Publicacao, Publicar, Sessao } from "./tipos";
import { TEXTOS } from "./textos";

/**
 * A lógica PURA das telas — sem React, sem SDK —, para o teste prender o que
 * não se vê no typecheck: o que o compositor publica, a ordem do feed, a régua
 * do laudo, a montagem do parecer e o que vai para o hub.
 */

// ─────────────────────────────────────────────────────────── etapa e hub

/** A etapa do PRD em que a tela está (EVT-U02 e o `contexto` de todo evento). */
export type EtapaDaTela = "E1" | "E2" | "E3" | "E4" | "E4b" | "E5" | "E6";

const ETAPA_DO_PASSO: Record<Passo, EtapaDaTela> = {
  abertura: "E1",
  dados: "E2",
  compositor: "E3",
  feed: "E4",
  errata: "E4b",
  laudo: "E5",
  pericia: "E6",
  concluida: "E6",
};

export function etapaDoPasso(passo: Passo): EtapaDaTela {
  return ETAPA_DO_PASSO[passo];
}

export interface Instrucao {
  antes: string;
  destaque: string;
  depois: string;
}

/**
 * A instrução ao lado do aparelho (`exp:estado.instrucao`), desenhada pelo HUB
 * fora dos 375px. Uma por etapa; a pausa vence qualquer uma; a conclusão e a
 * espera do pacote não têm (`{}` a retira). Sem gênero para quem conduz.
 */
export function estadoParaOHub(estado: Pick<Sessao, "passo" | "pausada" | "preparada">): Record<string, unknown> {
  if (!estado.preparada || estado.passo === "concluida") return {};
  const instrucao = estado.pausada ? TEXTOS.instrucao.pausa : TEXTOS.instrucao[estado.passo];
  return { instrucao: { ...instrucao } };
}

// ─────────────────────────────────────────────────────────── o compositor

/** O que o compositor tem marcado. `escala: null` = ainda não escolheu (decisão 5). */
export interface Escolha {
  escala: Escala | null;
  explicacao: boolean;
  fonte: boolean;
  contexto: boolean;
}

export const ESCOLHA_VAZIA: Escolha = { escala: null, explicacao: false, fonte: false, contexto: false };

/**
 * Onde o compositor começa. A 1ª publicação: SEM escala marcada e sem camada
 * (decisão 5 — a escolha do eixo é do estudante). A errata: a 1ª publicação
 * INTEIRA, escala e camadas (ele corrige a partir do que publicou).
 */
export function escolhaInicial(modo: "inicial" | "errata", primeira: Publicacao | null): Escolha {
  if (modo === "errata" && primeira) {
    return { escala: primeira.escala, explicacao: primeira.explicacao, fonte: primeira.fonte, contexto: primeira.contexto };
  }
  return { ...ESCOLHA_VAZIA };
}

/**
 * O corpo do publicar, ou `null` enquanto não há escala. Não é gate avaliado:
 * as camadas são opcionais; só a escala é parte do gesto de publicar.
 */
export function corpoDaPublicacao(escolha: Escolha): Publicar | null {
  if (escolha.escala === null) return null;
  return { escala: escolha.escala, explicacao: escolha.explicacao, fonte: escolha.fonte, contexto: escolha.contexto };
}

export interface TextosDasCamadas {
  explicacao: { zero: string; oitenta: string };
  fonte: string;
  contexto: string;
}

/** O texto da anotação de escala acompanha a origem escolhida (0 ou 80). */
export function textoDaExplicacao(camadas: TextosDasCamadas, escala: Escala): string {
  return escala === 0 ? camadas.explicacao.zero : camadas.explicacao.oitenta;
}

/**
 * As linhas que o post carrega, na ordem do compositor — a MESMA função na
 * prévia e no post publicado: o que se vê é o que sai.
 */
export function linhasDoPost(p: Publicar, camadas: TextosDasCamadas): string[] {
  const linhas: string[] = [];
  if (p.explicacao) linhas.push(textoDaExplicacao(camadas, p.escala));
  if (p.fonte) linhas.push(camadas.fonte);
  if (p.contexto) linhas.push(camadas.contexto);
  return linhas;
}

// ─────────────────────────────────────────────────────────── o grupo (E4)

export type ItemDoFeed =
  | { tipo: "post"; publicacao: Publicacao; errata: boolean }
  | { tipo: "reacao"; indice: number }
  | { tipo: "rival" }
  | { tipo: "conflito" }
  | { tipo: "coordenador" };

/**
 * O feed do grupo depois da 1ª publicação, na ordem em que chega: o post do
 * estudante, as reações do RAMO da escala que ele publicou (o servidor só manda
 * esse ramo), o post espelho da escola rival, o morador confuso e o
 * Coordenador. A errata, quando existe, entra ABAIXO de tudo — o original fica
 * no histórico.
 */
export function itensDoFeed(estado: Pick<Sessao, "publicacoes" | "feed">): ItemDoFeed[] {
  const { inicial, errata } = estado.publicacoes;
  if (!inicial || !estado.feed) return [];
  const itens: ItemDoFeed[] = [{ tipo: "post", publicacao: inicial, errata: false }];
  estado.feed.reacoes.forEach((_r, indice) => itens.push({ tipo: "reacao", indice }));
  itens.push({ tipo: "rival" }, { tipo: "conflito" }, { tipo: "coordenador" });
  if (errata) itens.push({ tipo: "post", publicacao: errata, errata: true });
  return itens;
}

/** O ritmo da chegada (ms ANTES de cada item, depois do post): ~10 s até o post espelho. */
export const RITMO_DO_FEED = { reacao: 1800, rivalAposPost: 10_000, conflito: 2400, coordenador: 2400 } as const;

/**
 * Os atrasos de cada item do feed que CHEGA (o post do estudante já está lá):
 * as reações em sequência, o post espelho ~10 s depois da publicação, e o
 * conflito e o Coordenador logo depois dele.
 */
export function atrasosDoFeed(reacoes: number): number[] {
  const atrasos: number[] = Array.from({ length: reacoes }, () => RITMO_DO_FEED.reacao);
  const gasto = reacoes * RITMO_DO_FEED.reacao;
  atrasos.push(Math.max(RITMO_DO_FEED.reacao, RITMO_DO_FEED.rivalAposPost - gasto));
  atrasos.push(RITMO_DO_FEED.conflito, RITMO_DO_FEED.coordenador);
  return atrasos;
}

/** A escala oposta: a do post espelho da escola rival. */
export function escalaOposta(escala: Escala): Escala {
  return escala === 0 ? 80 : 0;
}

// ─────────────────────────────────────────────────────────── o gráfico

export interface Barra {
  rotulo: string;
  valor: number;
}

/** A altura de cada barra, de 0 a 1, com o eixo indo de `origem` a `teto`. */
export function alturasDasBarras(valores: readonly number[], origem: number, teto: number): number[] {
  const faixa = teto - origem;
  if (faixa <= 0) return valores.map(() => 0);
  return valores.map((v) => Math.min(1, Math.max(0, (v - origem) / faixa)));
}

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function numeroBr(n: number): string {
  return NUMERO.format(n);
}

/** O `alt` do gráfico: o eixo e os valores — o leitor de tela lê o que o olho vê. */
export function descricaoDoGrafico(barras: readonly Barra[], origem: number, teto: number, unidade: string): string {
  const valores = barras.map((b) => `${b.rotulo}: ${numeroBr(b.valor)}${unidade}`).join("; ");
  return `Gráfico de barras com o eixo vertical de ${numeroBr(origem)}${unidade} a ${numeroBr(teto)}${unidade}. ${valores}.`;
}

/** O eixo do boletim: origem 0 ou 80, teto 100. */
export function eixoDaEscala(escala: Escala): { origem: number; teto: number } {
  return { origem: escala, teto: 100 };
}

// ─────────────────────────────────────────────────────────── o laudo (E5)

export const REGUA = { minimo: 0, maximo: 80, passo: 1 } as const;

/**
 * O Fator de Mentira com o eixo começando em `origem`: a variação visual
 * ((p − u) / (p − o)) dividida pela real ((p − u) / p) = p / (p − o). Com
 * 95 → 88: 1 na origem 0, ≈ 6,3 na origem 80.
 */
export function fatorDeMentira(origem: number, primeiro = 95): number {
  if (origem >= primeiro) return Number.POSITIVE_INFINITY;
  return primeiro / (primeiro - origem);
}

/** "≈ 6,3" — UMA casa, vírgula decimal, como o laudo escreve (correção do PO). */
export function formatarFator(fator: number): string {
  return `≈ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(fator)}`;
}

/**
 * A demonstração do gesto (2 ciclos, 0 → 80 → 0): o valor da régua no instante
 * `t` (ms) de uma animação de `duracao` por ciclo. Depois do fim, a origem.
 */
export function valorDaDemonstracao(t: number, duracao = 2400, ciclos = 2): number {
  if (t <= 0 || t >= duracao * ciclos) return REGUA.minimo;
  const fase = (t % duracao) / duracao;
  const ida = fase < 0.5 ? fase * 2 : (1 - fase) * 2;
  return Math.round(REGUA.minimo + (REGUA.maximo - REGUA.minimo) * ida);
}

// ─────────────────────────────────────────────────────────── a perícia (E6)

export interface MarcaDoCartao {
  sinalizou: boolean;
  motivo: Motivo | null;
}

export type MarcasDaPericia = Record<"A" | "B", MarcaDoCartao>;

export const PERICIA_VAZIA: MarcasDaPericia = { A: { sinalizou: false, motivo: null }, B: { sinalizou: false, motivo: null } };

/** Ligar/desligar a sinalização: desmarcar DESFAZ o motivo. */
export function alternarSinalizacao(marca: MarcaDoCartao, ligado: boolean): MarcaDoCartao {
  return ligado ? { sinalizou: true, motivo: marca.motivo } : { sinalizou: false, motivo: null };
}

/**
 * O corpo do parecer, ou `null` enquanto um cartão sinalizado está sem motivo
 * (a api recusaria: sinalizou ⇒ motivo). Não sinalizar nada é parecer válido.
 */
export function montarParecer(m: MarcasDaPericia): Parecer | null {
  for (const id of ["A", "B"] as const) if (m[id].sinalizou && !m[id].motivo) return null;
  return {
    sinalizouA: m.A.sinalizou,
    motivoA: m.A.sinalizou ? m.A.motivo : null,
    sinalizouB: m.B.sinalizou,
    motivoB: m.B.sinalizou ? m.B.motivo : null,
  };
}

/** "Ano Anterior (Período 1)" → "Ano Anterior": o rótulo do eixo do cartão. */
export function rotuloCurto(rotulo: string): string {
  const i = rotulo.indexOf(" (");
  return i < 0 ? rotulo : rotulo.slice(0, i);
}

// ─────────────────────────────────────────────────────────── a navegação

/** As conversas do mensageiro: a lista, o chat do Assistente, o grupo da cidade. */
export type Vista = "lista" | "assistente" | "grupo";

/**
 * A conversa aberta quando a tela chega a um passo SEM gesto desta aba (o F5,
 * a volta à missão). Depois de um gesto, quem decide é o gesto (publicou → o
 * grupo; a turma liberou com o grupo aberto → o grupo continua).
 */
export function vistaPadrao(passo: Passo): Vista {
  if (passo === "abertura") return "lista";
  if (passo === "feed") return "grupo";
  return "assistente";
}
