import { normalizarParaRegua } from "./invariantes";

/**
 * O SANITIZADOR DA LEGENDA — porque OUTRA criança vai lê-la.
 *
 * A legenda dos Stories é o único texto livre da missão que sai da tela de quem
 * o escreveu: no Mural ela aparece para o colega pareado, e projetada para a
 * sala na turma de um computador só. Por isso ela passa por aqui antes de ser
 * gravada, e o que não passa volta como 422 com um código ESTÁVEL — a tela
 * escolhe a frase, na voz do clone ("Tire o link da legenda para publicar"),
 * e não um "acesso negado".
 *
 * Barra cinco coisas, e cada uma tem um motivo que não é estético:
 *   - LINK: um endereço num Stories de grêmio é convite para fora da missão —
 *     e, com a turma projetada, para fora da escola;
 *   - TELEFONE e E-MAIL: dado de contato de menor de idade, lido por colegas
 *     (LGPD art. 14);
 *   - MENÇÃO (`@`): marcar alguém da sala é o primeiro passo de uma exposição
 *     que a missão não pode hospedar. As contas DA FICÇÃO (os três veículos e a
 *     do grêmio) são permitidas: "a @voz_coletiva mostrou…" é a criança citando
 *     a fonte, que é o critério editorial que a EF07CO11 procura;
 *   - PALAVRÃO: a tela do colega não é lugar dele, e a sala inteira pode estar
 *     olhando.
 *
 * Não reescreve nada: quem reescreve é a criança. Trocar a palavra por
 * asteriscos publicaria um texto que ela não escreveu, no nome dela.
 */

export type MotivoDaRecusa =
  | "legenda-com-link"
  | "legenda-com-telefone"
  | "legenda-com-email"
  | "legenda-com-mencao"
  | "legenda-com-palavrao";

export const MOTIVOS_DA_RECUSA: readonly MotivoDaRecusa[] = [
  "legenda-com-link",
  "legenda-com-telefone",
  "legenda-com-email",
  "legenda-com-mencao",
  "legenda-com-palavrao",
];

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+/u;

/**
 * Link: esquema (`https://`), `www.` ou um domínio com TLD conhecido. Número
 * com ponto ("3.200 veículos") não casa, porque o TLD exige letras.
 *
 * O TLD é comparado em MINÚSCULA e a lista é curta, de propósito: criança de
 * 12 anos esquece o espaço depois do ponto, e "ficou legal.Me ajudem" ou
 * "4 milhões.Com isso" não são links. `.me`, `.co` e `.tv` ficaram de fora
 * pela mesma razão — são palavras do português antes de serem domínios.
 */
const LINK_COM_ESQUEMA = /\b[a-z][a-z0-9+.-]*:\/\//i;
const LINK_WWW = /\bwww\./i;
const DOMINIO = /[\p{L}\p{N}-]+\.(com|net|org|br|gov|edu|info|site|online|xyz|link)(\.[a-z]{2})?(?![\p{L}\p{N}])/u;

/** Menção: `@` seguido de um nome, no começo ou depois de algo que não é letra. */
const MENCAO = /(^|[^\p{L}\p{N}_])@([\p{L}\p{N}_.]+)/gu;

/**
 * Telefone: uma sequência de pelo menos 8 dígitos, com os separadores de quem
 * digita número (espaço, ponto, hífen, parênteses, `+`). "18%", "3.200" e
 * "25/09/2026" não chegam lá — a barra quebra a sequência da data.
 */
const SEQUENCIA_NUMERICA = /\+?\(?\d[\d\s().-]{6,}\d/g;

/**
 * O léxico do palavrão, já na forma normalizada (sem acento, minúsculo). É
 * curto de propósito: é o que um colega de 12 anos escreveria num Stories, e
 * não um filtro de moderação de rede social. Comparado por PALAVRA INTEIRA, e
 * com os prefixos que variam por conjugação ("fod-", "caralh-").
 */
const PALAVROES = new Set([
  "porra",
  "caralho",
  "caralhos",
  "cacete",
  "merda",
  "merdas",
  "bosta",
  "puta",
  "putas",
  "puto",
  "putaria",
  "buceta",
  "cu",
  "cuzao",
  "arrombado",
  "arrombada",
  "vagabundo",
  "vagabunda",
  "viado",
  "fdp",
  "vtnc",
  "pqp",
  "otario",
  "otaria",
  "babaca",
  "desgracado",
  "desgracada",
  "piranha",
]);
const PREFIXOS_DE_PALAVRAO = ["fod", "caralh", "porr", "merd", "bucet"];

/**
 * Palavras de verdade que começam como palavrão. "Porrada" fica de fora da
 * lista porque, numa legenda sobre uma obra, "porrada de gente" é o jeito de
 * falar de uma criança — e barrar a frase inteira por isso ensinaria que a
 * plataforma não entende português.
 */
const PERMITIDAS = new Set(["porrada", "porradas", "porres", "porre", "merdo"]);

/** O que a criança troca para escapar do filtro sem perceber que está sendo lida: 4 → a, 0 → o. */
function desfazerTroca(palavra: string): string {
  return palavra
    .replace(/4|@/g, "a")
    .replace(/3/g, "e")
    .replace(/1|!/g, "i")
    .replace(/0/g, "o")
    .replace(/5|\$/g, "s");
}

function temPalavrao(texto: string): boolean {
  const palavras = normalizarParaRegua(texto)
    .split(/[^a-z0-9@$!]+/)
    /* A pontuação da PONTA não é troca de letra: "puta!" é "puta", e só o
       "!" do meio ("p!ranha") vira "i". */
    .map((p) => p.replace(/^[!@$]+|[!@$]+$/g, ""))
    .filter(Boolean)
    .map(desfazerTroca)
    /* "poooorra" é "porra": letra repetida três vezes ou mais vira uma. */
    .map((p) => p.replace(/(.)\1{2,}/g, "$1"));
  return palavras.some(
    (p) =>
      PALAVROES.has(p) ||
      PALAVROES.has(p.replace(/(.)\1+/g, "$1")) ||
      PREFIXOS_DE_PALAVRAO.some((prefixo) => p.startsWith(prefixo) && !PERMITIDAS.has(p)),
  );
}

function temTelefone(texto: string): boolean {
  for (const trecho of texto.match(SEQUENCIA_NUMERICA) ?? []) {
    if ((trecho.match(/\d/g) ?? []).length >= 8) return true;
  }
  return false;
}

function temMencaoDeFora(texto: string, permitidas: ReadonlySet<string>): boolean {
  for (const m of texto.matchAll(MENCAO)) {
    const conta = `@${m[2] ?? ""}`.toLowerCase().replace(/[.]+$/, "");
    if (!permitidas.has(conta)) return true;
  }
  return false;
}

/**
 * Confere a legenda. `arrobasPermitidas` são as contas da ficção
 * (`catalogo.ts#ARROBAS_DA_FICCAO`).
 *
 * A ORDEM importa: o e-mail vem antes da menção e do link, porque um e-mail
 * TEM uma arroba e um domínio — e a frase certa para a criança é "tire o
 * e-mail", não "tire a menção".
 */
export function sanitizarLegenda(
  texto: string,
  arrobasPermitidas: readonly string[],
): { ok: true } | { ok: false; codigo: MotivoDaRecusa } {
  if (EMAIL.test(texto)) return { ok: false, codigo: "legenda-com-email" };
  if (LINK_COM_ESQUEMA.test(texto) || LINK_WWW.test(texto) || DOMINIO.test(texto)) {
    return { ok: false, codigo: "legenda-com-link" };
  }
  if (temTelefone(texto)) return { ok: false, codigo: "legenda-com-telefone" };
  if (temMencaoDeFora(texto, new Set(arrobasPermitidas.map((a) => a.toLowerCase())))) {
    return { ok: false, codigo: "legenda-com-mencao" };
  }
  if (temPalavrao(texto)) return { ok: false, codigo: "legenda-com-palavrao" };
  return { ok: true };
}
