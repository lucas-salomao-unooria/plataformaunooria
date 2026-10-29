import { SUGESTOES, type Intencao } from "../conteudo";

/**
 * A ÁRVORE DE INTENÇÕES do chat (`dev/01e`, "Árvore de intenções") e a
 * decisão entre ela e a IA da aula (molde da exp02em1b, ADR-193; decisão do
 * Lucas de 2026-10-29: a IA só CLASSIFICA, a fala é sempre do catálogo).
 *
 * Normalização: minúsculas, sem acento, sem pontuação repetida. Lista FECHADA
 * de gatilhos e precedência: a lacuna dos cadernos vence tudo (é a bifurcação
 * investigativa — a pergunta que desconfia da ausência de dados do projeto em
 * papel), depois o pedido de recomendação, depois custo, regularidade e
 * impacto. O que não casa é fora do tema (não conta como consulta).
 */

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/([!?.,;:])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Os gatilhos do 01e, mais variações do mesmo sentido que a árvore tinha de
 * ler (o "1 documento", "papel", "caderno"). `{papel}` é trocado pelo nome do
 * projeto em papel do pacote (normalizado) — num pacote gerado, o Mesa Aberta
 * tem outro nome.
 */
const GATILHOS: ReadonlyArray<[Intencao, readonly string[]]> = [
  [
    "investigar_lacuna_cadernos",
    [
      "por que o {papel} nao tem relatorio",
      "onde estao os registros",
      "cade os relatorios",
      "registros fisicos",
      "registro fisico",
      "cadernos de campo",
      "caderno",
      "documentos em papel",
      "documento em papel",
      "em papel",
      "papel arquivado",
      "arquivo fisico",
      "por que so um documento",
      "por que so 1 documento",
      "so tem um documento",
      "so tem 1 documento",
      "falta relatorio",
      "faltam relatorios",
      "falta de documento",
      "dados faltando",
      "dados ausentes",
      "fora do sistema",
      "nao esta no sistema",
      "nao digitalizado",
      "manuscrito",
      "anotado a mao",
    ],
  ],
  ["solicitar_recomendacao", ["qual projeto escolher", "quem deve ganhar", "qual e o melhor", "qual o melhor", "recomende", "recomendacao", "quem esta em primeiro", "parecer", "qual o mais confiavel", "em qual votar"]],
  ["custo_atendimento", ["qual projeto atende mais", "menor custo", "custo por vaga", "quantas vagas", "quantos jovens", "custo por pessoa", "valor por vaga", "orcamento", "atendimento", "vagas", "custo", "quanto custa"]],
  ["regularidade_documental", ["compare a regularidade", "relatorios enviados", "documentos", "quantos relatorios", "regularidade", "comprovacao", "fichas", "pastas", "arquivos", "relatorio"]],
  ["impacto_social", ["evidencias de impacto", "resultados", "eficacia", "impacto", "qualidade", "permanencia", "evasao", "resultado"]],
];

/** A leitura da árvore. Não lê estado: a oferta dos cadernos e o limite são da sessão. */
export function classificar(texto: string, nomeDoPapel: string): Intencao {
  const t = normalizar(texto);
  const papel = normalizar(nomeDoPapel);
  for (const [intencao, gatilhos] of GATILHOS) {
    if (gatilhos.some((g) => t.includes(g.replace("{papel}", papel)))) return intencao;
  }
  return "fora_do_tema";
}

const SUGESTOES_NORMALIZADAS = new Map(SUGESTOES.map((s) => [normalizar(s.texto), s.intencao]));

/** O texto que tenta mandar no classificador (nome de intenção, "ignore as instruções"). */
export function pareceInjecao(texto: string): boolean {
  const t = normalizar(texto);
  return /\b[a-z]+_[a-z_]+\b/.test(texto) || /ignore (as|todas as) instruc|esqueca (as|suas) instruc|voce agora e|system prompt|prompt do sistema/.test(t);
}

/**
 * Por onde a mensagem passa: `sugestao` (uma das três sugestões da copy,
 * exata: nunca vai à IA), `guarda` (tenta mandar no classificador: fora do
 * tema) ou `ia` (a IA lê primeiro; a árvore é a reserva). `arvore` vai junto.
 */
export type RotaDaMensagem = { tipo: "sugestao" | "guarda" | "ia"; arvore: Intencao };

export function rotaDaMensagem(texto: string, nomeDoPapel: string): RotaDaMensagem {
  const sugestao = SUGESTOES_NORMALIZADAS.get(normalizar(texto));
  if (sugestao) return { tipo: "sugestao", arvore: sugestao };
  if (pareceInjecao(texto)) return { tipo: "guarda", arvore: "fora_do_tema" };
  return { tipo: "ia", arvore: classificar(texto, nomeDoPapel) };
}

/** A leitura do classificador: a intenção e a confiança que ele declarou. */
export interface LeituraDaIa {
  intencao: Intencao;
  confianca: number;
}

/** Abaixo disto a IA não decide: vale a árvore. */
export const CONFIANCA_MINIMA = 0.7;

/**
 * A intenção que vale. Fora da rota `ia`, a da árvore (ou a guarda). Na rota
 * `ia`: a da IA se ela respondeu com confiança; senão — lenta, sem saldo,
 * recusada, insegura —, a da árvore. `arvore` volta junto para a sessão
 * guardar as duas leituras quando discordam (o dado do piloto).
 */
export function decidirIntencao(rota: RotaDaMensagem, ia: LeituraDaIa | null): { intencao: Intencao; classificador: "arvore" | "ia" | "guarda"; arvore: Intencao } {
  if (rota.tipo === "guarda") return { intencao: "fora_do_tema", classificador: "guarda", arvore: rota.arvore };
  if (rota.tipo === "ia" && ia && ia.confianca >= CONFIANCA_MINIMA) return { intencao: ia.intencao, classificador: "ia", arvore: rota.arvore };
  return { intencao: rota.arvore, classificador: "arvore", arvore: rota.arvore };
}
