import {
  IDS_DE_NOTICIA,
  MEIOS,
  MEIOS_DIGITAIS,
  MEIOS_TRADICIONAIS,
  TOTAL_DE_NOTICIAS,
  type Meio,
  type PilarEmFalta,
} from "./vocabulario";

/**
 * As invariantes do PACOTE da exp04ef1b — as oito notícias da mesa, com o
 * gabarito. Vivem em UM lugar e passam por elas, do mesmo jeito, o banco padrão
 * (`catalogo.ts`, com teste), o lote que a IA gera no preparo (lançar aqui faz
 * regerar) e a homologação do professor (o `superRefine` do contrato).
 *
 * O que elas guardam é o PDF "proposta revisada" (§2, §3, §10): um conjunto
 * que EXIGE investigar. Sem elas, o pacote gerado pode ter três boatos óbvios e
 * cinco notícias certas — e a missão passaria a medir leitura, não checagem.
 *
 * Molde: `a-selecao/invariantes.ts`.
 */

/**
 * A forma que a régua precisa — estrutural, para aceitar tanto o tipo do Zod
 * (`NoticiaDoPacote` do contrato) quanto o do catálogo.
 */
export interface NoticiaParaARegua {
  readonly id: string;
  readonly meio: Meio;
  readonly veiculo: string;
  readonly falante: string | null;
  readonly manchete: string;
  readonly resumo: string;
  readonly corpo: string;
  readonly legenda: string | null;
  readonly descricaoImagem: string | null;
  readonly pistas: { readonly fonte: string; readonly data: string; readonly autoria: string };
  readonly gabarito: {
    readonly publicavel: boolean;
    readonly pilarEmFalta: PilarEmFalta | null;
    readonly explicacao: string;
  };
  readonly consequencia: { readonly leitor: string; readonly fala: string };
}

/** As réguas de tamanho, em PALAVRAS (a unidade do brief e da copy revisada). */
export const REGUAS_DE_PALAVRAS = {
  manchete: { min: 3, max: 10 },
  resumo: { min: 25, max: 35 },
  corpo: { min: 15, max: 80 },
  legenda: { min: 2, max: 20 },
  pista: { min: 2, max: 25 },
  fala: { min: 5, max: 25 },
  explicacao: { min: 5, max: 35 },
} as const;

/** Quantas de cada tipo o conjunto precisa (PDF §3). Somam 8. */
export const COMPOSICAO = {
  publicaveisMin: 3,
  /** Fato antigo apresentado como atual (`pilarEmFalta = data`). */
  antigas: { min: 2, max: 3 },
  /** Aviso sem confirmação ou sem autoria (`pilarEmFalta = fonte | autoria`). */
  semConfirmacao: { min: 2, max: 3 },
  /** "Variedade visual entre todas as opções": notícias com imagem, no mínimo. */
  comImagemMin: 4,
} as const;

/** Os meios que não existem sem imagem: o quadro de telejornal e o post. */
export const MEIOS_COM_IMAGEM_OBRIGATORIA: readonly Meio[] = ["tv", "rede_social"];

/**
 * Termos que não aparecem em NADA que a criança lê — notícia, pista,
 * consequência. Dois grupos:
 *
 * - **O carimbo** (PDF §3 e §7): a missão não rotula a notícia ("falsa",
 *   "fake news", "mentira") — uma mensagem sem autor não é automaticamente
 *   falsa, e uma notícia antiga pode ser verdadeira. O que a criança aprende é
 *   que falta EVIDÊNCIA para publicar.
 * - **O rótulo sobre a criança**: "você errou", nota, ranking. O resultado
 *   descreve a seleção, não quem escolheu (PDF §6).
 *
 * `fake news` fica na lista mesmo sendo termo que a ADR-91 mantém: ele pode
 * aparecer no guia do PROFESSOR, nunca na tela da criança.
 */
export const TERMOS_PROIBIDOS_NA_TELA = [
  "fake news",
  "notícia falsa",
  "falsa",
  "falso",
  "mentira",
  "mentiroso",
  "mentirosa",
  "você errou",
  "errou",
  "errado",
  "errada",
  "aluno",
  "alunos",
  "gabarito",
  "sua nota",
  "pontuação",
  "ranking",
] as const;

/**
 * O que o painel do professor NÃO pode conter como campo de uma LINHA (uma
 * criança ou um computador): nenhum número que ordene alguém (PDF §7: "não há
 * ranking da turma nem exposição de quem errou"). As verificadas aparecem só no
 * histograma ANÔNIMO do resumo; o nível mora no painel de habilidades
 * (`/evidencias`), com origem e ajuste do professor.
 */
export const PROIBIDO_NA_LINHA_DO_PAINEL = [
  "score",
  "nivel",
  "pontos",
  "nota",
  "posicao",
  "ranking",
  "acerto",
  "verificadas",
  "percentual",
] as const;

/** Sem caixa, sem acento, espaços colapsados — a forma em que a régua compara. */
export function normalizarParaRegua(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const REGUAS = TERMOS_PROIBIDOS_NA_TELA.map((termo) => {
  const alvo = normalizarParaRegua(termo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { termo, re: new RegExp(`(^|[^a-z0-9])${alvo}($|[^a-z0-9])`) };
});

/**
 * Os termos proibidos num texto visível ao estudante. Por PALAVRA INTEIRA, sem
 * caixa e sem acento: "falso" reprova "falso", não "falsificação".
 */
export function termosProibidosEm(texto: string): string[] {
  const alvo = normalizarParaRegua(texto);
  return REGUAS.filter((r) => r.re.test(alvo)).map((r) => r.termo);
}

export function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function foraDaRegua(
  rotulo: string,
  texto: string,
  regua: { readonly min: number; readonly max: number },
): string | null {
  const n = palavras(texto);
  return n < regua.min || n > regua.max ? `${rotulo}: ${n} palavras (a régua é de ${regua.min} a ${regua.max}).` : null;
}

/** Os textos de uma notícia que a criança lê — é neles que a régua de termos passa. */
function textosDaTela(n: NoticiaParaARegua): string[] {
  return [
    n.veiculo,
    n.falante ?? "",
    n.manchete,
    n.resumo,
    n.corpo,
    n.legenda ?? "",
    n.pistas.fonte,
    n.pistas.data,
    n.pistas.autoria,
    n.consequencia.leitor,
    n.consequencia.fala,
  ];
}

/**
 * Os problemas de UMA notícia, em frases. A regeneração isolada do preparo
 * ("Regenerar notícia") passa por esta; o pacote inteiro, pela de baixo.
 */
export function problemasDaNoticia(n: NoticiaParaARegua): string[] {
  const p: string[] = [];
  const onde = `Notícia ${n.id}`;
  const r = REGUAS_DE_PALAVRAS;
  for (const erro of [
    foraDaRegua(`${onde}, manchete`, n.manchete, r.manchete),
    foraDaRegua(`${onde}, resumo`, n.resumo, r.resumo),
    foraDaRegua(`${onde}, texto da matéria`, n.corpo, r.corpo),
    n.legenda === null ? null : foraDaRegua(`${onde}, legenda`, n.legenda, r.legenda),
    foraDaRegua(`${onde}, pista de fonte`, n.pistas.fonte, r.pista),
    foraDaRegua(`${onde}, pista de data`, n.pistas.data, r.pista),
    foraDaRegua(`${onde}, pista de autoria`, n.pistas.autoria, r.pista),
    foraDaRegua(`${onde}, reação do leitor`, n.consequencia.fala, r.fala),
    foraDaRegua(`${onde}, explicação ao professor`, n.gabarito.explicacao, r.explicacao),
  ]) {
    if (erro) p.push(erro);
  }

  if (n.gabarito.publicavel !== (n.gabarito.pilarEmFalta === null)) {
    p.push(`${onde}: a publicável não tem pilar em falta, e a não publicável tem exatamente um.`);
  }
  if (MEIOS_COM_IMAGEM_OBRIGATORIA.includes(n.meio) && !n.descricaoImagem) {
    p.push(`${onde}: ${n.meio === "tv" ? "o quadro de telejornal" : "o post"} precisa de imagem.`);
  }
  if (n.meio === "radio" && !n.falante) p.push(`${onde}: o boletim de rádio precisa do nome do locutor.`);
  if (n.meio === "rede_social" && !n.veiculo.startsWith("@")) {
    p.push(`${onde}: o post precisa de um perfil com @ no lugar do veículo.`);
  }

  const termos = new Set(textosDaTela(n).flatMap(termosProibidosEm));
  if (termos.size > 0) p.push(`${onde}: termo que não pode aparecer na tela (${[...termos].join(", ")}).`);
  return p;
}

/**
 * Os problemas do PACOTE inteiro, em frases que o professor lê no preparo
 * (`pacote-invalido`). Lista vazia = pode ir para a sala.
 */
export function problemasDoPacote(noticias: readonly NoticiaParaARegua[]): string[] {
  const p: string[] = [];
  if (noticias.length !== TOTAL_DE_NOTICIAS) {
    return [`O pacote tem ${noticias.length} notícias; a mesa precisa de ${TOTAL_DE_NOTICIAS}.`];
  }

  const ids = noticias.map((n) => n.id);
  if (ids.join(",") !== IDS_DE_NOTICIA.join(",")) {
    p.push(`As notícias precisam dos ids ${IDS_DE_NOTICIA.join(", ")}, nesta ordem.`);
  }

  const meios = new Set(noticias.map((n) => n.meio));
  if (meios.size !== MEIOS.length) {
    p.push("Cada notícia precisa vir de um meio diferente, e os oito meios precisam aparecer.");
  }

  const manchetes = new Set(noticias.map((n) => normalizarParaRegua(n.manchete)));
  if (manchetes.size !== noticias.length) p.push("Duas notícias têm a mesma manchete.");

  const publicaveis = noticias.filter((n) => n.gabarito.publicavel);
  const naoPublicaveis = noticias.filter((n) => !n.gabarito.publicavel);
  const antigas = naoPublicaveis.filter((n) => n.gabarito.pilarEmFalta === "data").length;
  const semConfirmacao = naoPublicaveis.filter((n) => n.gabarito.pilarEmFalta !== "data").length;
  const c = COMPOSICAO;
  if (publicaveis.length < c.publicaveisMin) {
    p.push(`O pacote precisa de pelo menos ${c.publicaveisMin} notícias publicáveis.`);
  }
  if (antigas < c.antigas.min || antigas > c.antigas.max) {
    p.push(
      `O pacote precisa de ${c.antigas.min} a ${c.antigas.max} notícias antigas apresentadas como atuais (tem ${antigas}).`,
    );
  }
  if (semConfirmacao < c.semConfirmacao.min || semConfirmacao > c.semConfirmacao.max) {
    p.push(
      `O pacote precisa de ${c.semConfirmacao.min} a ${c.semConfirmacao.max} avisos sem confirmação ou sem autoria (tem ${semConfirmacao}).`,
    );
  }

  const misturaMeios = (grupo: readonly NoticiaParaARegua[]) =>
    grupo.some((n) => MEIOS_TRADICIONAIS.includes(n.meio)) && grupo.some((n) => MEIOS_DIGITAIS.includes(n.meio));
  if (!misturaMeios(publicaveis) || !misturaMeios(naoPublicaveis)) {
    p.push(
      "Publicáveis e não publicáveis precisam misturar meios tradicionais e digitais: nenhum meio pode carregar a resposta sozinho.",
    );
  }

  const comImagem = noticias.filter((n) => n.descricaoImagem);
  if (comImagem.length < c.comImagemMin) p.push(`Pelo menos ${c.comImagemMin} notícias precisam de imagem.`);
  if (!publicaveis.some((n) => n.descricaoImagem) || !naoPublicaveis.some((n) => n.descricaoImagem)) {
    p.push("Publicáveis e não publicáveis precisam ter imagem: notícia bonita não pode ser sinal de nada.");
  }

  for (const n of noticias) p.push(...problemasDaNoticia(n));
  return p;
}

/** Redige um texto que vai ao log: só o tamanho (regra 6). */
export function paraLog(texto: string): string {
  return `<${[...texto].length} caracteres>`;
}
