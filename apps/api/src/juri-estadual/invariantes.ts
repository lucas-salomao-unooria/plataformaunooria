/**
 * As INVARIANTES do pacote da exp06ef1b — o que todo pacote homologado tem de
 * cumprir, venha da IA ou da edição do professor. O `validar` do preparo e o
 * `homologar` chamam as mesmas funções: uma regra escrita duas vezes é a que
 * diverge.
 *
 * Puro e sem dependência de Nest ou Prisma.
 */
import { AREAS, IDS_DE_PROJETO, areaDoProjeto, type Area } from "./vocabulario";

/** Teto de leitura de Anos Finais (PRD): legenda até 60 palavras, bastidor até 40. */
export const MAX_PALAVRAS_DA_LEGENDA = 60;
export const MAX_PALAVRAS_DO_BASTIDOR = 40;

export const HASHTAG_RE = /^#[a-z0-9_]{2,24}$/;
export const PERFIL_RE = /^@[a-z0-9_.]{3,30}$/;

/**
 * Marcas e nomes de terceiros que não entram num estande (a mostra é
 * fictícia, e a missão não faz propaganda): plataformas, fabricantes e placas.
 * A comparação é por palavra inteira, sem acento e sem caixa. "Meta" fica de
 * fora de propósito: em português é "objetivo", e recusaria legenda boa.
 */
export const TERMOS_PROIBIDOS = [
  "instagram",
  "facebook",
  "tiktok",
  "whatsapp",
  "youtube",
  "google",
  "arduino",
  "raspberry",
  "lego",
  "apple",
  "samsung",
  "microsoft",
  "chatgpt",
  "openai",
] as const;

export function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function termosProibidosEm(texto: string): string[] {
  const palavras = new Set(semAcento(texto).split(/[^a-z0-9]+/));
  return TERMOS_PROIBIDOS.filter((termo) => palavras.has(termo));
}

/**
 * A exclamação: a missão inteira tem UMA (a do Léo, na Etapa 5). Texto gerado
 * não traz nenhuma — em vez de recusar o pacote por isso, o preparo NORMALIZA
 * ("!" vira "."), porque é cosmético e a IA erra com frequência.
 */
export function semExclamacao(texto: string): string {
  return texto.replace(/!+/g, ".").replace(/\.\.+/g, ".");
}

/** Um projeto como a invariante o lê (o schema Zod do contrato tem a mesma forma). */
export type ProjetoParaInvariante = {
  id: string;
  area: Area;
  titulo: string;
  escola: string;
  perfil: string;
  legenda: string;
  bastidor: string;
  hashtags: readonly string[];
  imagem: { descricao: string; alt: string };
};

export type ConteudoParaInvariante = {
  tema: string;
  categorias: readonly { area: Area; nome: string; hashtag: string }[];
  projetos: readonly ProjetoParaInvariante[];
};

/**
 * Os problemas do pacote, em frases para o log e para a tela do professor.
 * Lista vazia = pacote válido.
 *
 * - quatro categorias, uma por área, com hashtags diferentes;
 * - dezesseis projetos, os ids exatos, cada um na área que o id diz;
 * - a PRIMEIRA hashtag de cada projeto é a da área dele (é a que o chip da
 *   busca encontra);
 * - legenda até 60 palavras, bastidor até 40;
 * - nenhum termo proibido em texto que a criança lê.
 */
export function problemasDoPacote(conteudo: ConteudoParaInvariante): string[] {
  const problemas: string[] = [];

  const areas = conteudo.categorias.map((c) => c.area);
  if (conteudo.categorias.length !== AREAS.length || AREAS.some((a) => !areas.includes(a))) {
    problemas.push("o pacote precisa de quatro categorias, uma por área");
  }
  const hashtags = conteudo.categorias.map((c) => c.hashtag);
  if (new Set(hashtags).size !== hashtags.length) problemas.push("as hashtags das categorias se repetem");
  for (const c of conteudo.categorias) {
    if (!HASHTAG_RE.test(c.hashtag)) problemas.push(`hashtag inválida na categoria ${c.area}`);
  }

  const ids = conteudo.projetos.map((p) => p.id);
  if (ids.length !== IDS_DE_PROJETO.length || IDS_DE_PROJETO.some((id) => !ids.includes(id))) {
    problemas.push("o pacote precisa dos dezesseis projetos, quatro por área");
  }

  const hashtagDaArea = new Map(conteudo.categorias.map((c) => [c.area, c.hashtag]));
  for (const p of conteudo.projetos) {
    if (areaDoProjeto(p.id) !== p.area) problemas.push(`${p.id} está na área errada`);
    if (p.hashtags[0] !== hashtagDaArea.get(p.area)) {
      problemas.push(`${p.id} precisa começar pela hashtag da área`);
    }
    if (!PERFIL_RE.test(p.perfil)) problemas.push(`perfil inválido em ${p.id}`);
    if (contarPalavras(p.legenda) > MAX_PALAVRAS_DA_LEGENDA) problemas.push(`legenda longa demais em ${p.id}`);
    if (contarPalavras(p.bastidor) > MAX_PALAVRAS_DO_BASTIDOR) problemas.push(`bastidor longo demais em ${p.id}`);
    const proibidos = termosProibidosEm([p.titulo, p.escola, p.legenda, p.bastidor, p.imagem.alt].join(" "));
    if (proibidos.length > 0) problemas.push(`${p.id} cita ${proibidos.join(", ")}`);
  }
  const proibidosNoTema = termosProibidosEm(conteudo.tema);
  if (proibidosNoTema.length > 0) problemas.push(`o tema cita ${proibidosNoTema.join(", ")}`);

  return problemas;
}
