import type { ConteudoDoPacote, Intencao } from "../conteudo";

/**
 * O que o estudante pediu ao UnooriaAI — a ÁRVORE DE INTENÇÕES do banco de
 * conteúdo (01e), no SERVIDOR e sem IA (ADR-191: nenhuma chamada de IA durante
 * a aula, PRD RNF-012). O que a EM13CO14 e a EM13CO26 medem é o PEDIDO do
 * estudante, convertido em intenção.
 *
 * A entrada passa pelo pré-processamento do 01e: minúsculas, sem acento, sem
 * pontuação. Os gatilhos são uma lista FECHADA, mais os que vêm do pacote (o
 * instituto inventado, o primeiro nome do colega e as palavras da autoria),
 * porque o pacote que a IA escreve para outra disciplina não tem "DataBrasil"
 * nem "Gabriel".
 */

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

/** Os gatilhos do 01e, mais os sinônimos que a turma usa. */
const REVISAO_AMPLA = [
  "corrigir tudo",
  "corrija tudo",
  "revisar",
  "revise",
  "melhorar",
  "melhore",
  "ajustar texto",
  "ajuste o texto",
  "deixar equilibrado",
  "limpar erros",
  "reescrever tudo",
  "reescreva tudo",
  "versao segura",
] as const;

const LGPD = [
  "remover nomes",
  "removendo os nomes",
  "remover o nome",
  "remova o nome",
  "tirar o nome",
  "nome pessoal",
  "nomes pessoais",
  "turma",
  "advertencia",
  "privacidade",
  "lgpd",
  "dados pessoais",
  "dado pessoal",
  "anonimizar",
  "anonimo",
  "expor",
  "exposto",
] as const;

const AUTORAL = [
  "autor",
  "autora",
  "autoria",
  "plagio",
  "credito",
  "citando",
  "citar",
  "citacao",
  "aspas",
  "copiado",
  "copia",
  "direito autoral",
  "direitos autorais",
  "quem escreveu",
] as const;

const FONTES = [
  "fonte",
  "fontes",
  "de onde saiu",
  "pesquisa",
  "92%",
  "comprovar",
  "comprovado",
  "estatistica",
  "instituto",
  "e verdade",
  "confiavel",
  "dado falso",
  "dados falsos",
] as const;

const APROVAR = ["aprovar", "aprovo", "aprovado", "ficou bom", "pronto", "pode publicar", "concluir texto"] as const;

const GERAR = [
  "criar rascunho",
  "crie o rascunho",
  "rascunho",
  "escrever post",
  "escreva o post",
  "comecar",
  "fazer texto",
  "faca o texto",
  "gerar",
  "gere",
  "montar o post",
  "monte o post",
] as const;

/** "Sim" depois de a fala da fonte oferecer a atualização da prévia. */
const CONCORDANCIAS = new Set(["sim", "pode", "pode sim", "quero", "claro", "ok", "pode ser", "sim pode", "aceito", "atualize", "atualiza"]);

function contem(normalizada: string, gatilho: string): boolean {
  return ` ${normalizada} `.includes(` ${gatilho} `);
}

const algum = (n: string, gatilhos: readonly string[]) => gatilhos.some((g) => g.length >= 3 && contem(n, g));

/**
 * Os gatilhos que vêm do PACOTE: o instituto (inteiro, e cada palavra
 * distintiva dele — "databrasil"), o primeiro nome do colega e as palavras
 * distintivas da autoria ("helena", "ramos").
 */
function gatilhosDoPacote(c: Pick<ConteudoDoPacote, "fonteInventada" | "colega" | "fonteOriginal">) {
  const distintivas = (t: string) => normalizar(t).split(" ").filter((p) => p.length >= 5 && !/\d/.test(p));
  const fonte = normalizar(c.fonteInventada);
  return {
    fontes: [fonte, ...distintivas(c.fonteInventada)],
    lgpd: [normalizar(c.colega).split(" ")[0] ?? ""],
    autoral: [normalizar(c.fonteOriginal), ...distintivas(c.fonteOriginal).filter((p) => !["revista", "jornal", "artigo"].includes(p))],
  };
}

/**
 * A intenção de uma mensagem. `ofertaDeSubstituicao`: a última fala do
 * assistente foi a da fonte, que oferece atualizar a prévia — e aí um "sim" é
 * aceitar. A PRECEDÊNCIA importa: a revisão ampla vem antes de tudo; autoria e
 * LGPD juntas (o TC-03) são o direito digital inteiro; a fonte vem antes de
 * aprovar e de gerar ("qual a fonte desse rascunho?" é auditoria).
 */
export function classificar(
  texto: string,
  conteudo: Pick<ConteudoDoPacote, "fonteInventada" | "colega" | "fonteOriginal">,
  ofertaDeSubstituicao = false,
): Intencao {
  const n = normalizar(texto);
  if (!n) return "fora_do_tema";
  if (ofertaDeSubstituicao && CONCORDANCIAS.has(n)) return "substituir_dado";
  const doPacote = gatilhosDoPacote(conteudo);
  if (algum(n, REVISAO_AMPLA)) return "revisao_ampla";
  const lgpd = algum(n, LGPD) || algum(n, doPacote.lgpd);
  const autoral = algum(n, AUTORAL) || algum(n, doPacote.autoral);
  if (lgpd && autoral) return "auditar_direito_digital";
  if (lgpd) return "auditar_lgpd";
  if (autoral) return "auditar_autoral";
  if (algum(n, FONTES) || algum(n, doPacote.fontes)) return "auditar_fontes";
  if (algum(n, APROVAR)) return "aprovar_previa";
  if (algum(n, GERAR)) return "gerar_rascunho_inicial";
  return "fora_do_tema";
}

/** O `prompt_tipo` da telemetria (PRD EVT-001) de cada intenção — o que o KPI-02 conta. */
export function tipoDoPrompt(intencao: Intencao): string {
  switch (intencao) {
    case "auditar_fontes":
    case "substituir_dado":
      return "auditar_fontes";
    case "auditar_direito_digital":
    case "auditar_autoral":
    case "auditar_lgpd":
      return "auditar_direito_digital";
    case "gerar_rascunho_inicial":
      return "gerar_rascunho";
    default:
      return intencao;
  }
}
