import type { ConteudoDoPacote, Intencao } from "../conteudo";

/**
 * O que o estudante pediu ao UnooriaAI — a ÁRVORE DE INTENÇÕES do banco de
 * conteúdo (01e), no SERVIDOR. Não há modelo de linguagem na aula: a conversa é
 * determinística, a mesma para a turma inteira às oito da manhã, e o que a
 * EM13CO14 e a EM13CO26 medem é o PEDIDO do estudante, não a criatividade de um
 * modelo.
 *
 * A entrada passa pelo pré-processamento do 01e: minúsculas, sem acento, sem
 * pontuação. Os gatilhos são uma lista FECHADA, mais três que vêm do pacote (o
 * instituto inventado, o primeiro nome do colega e o veículo), porque o pacote
 * que a IA escreve para outra disciplina não tem "DataBrasil" nem "Lucas".
 */

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

/** A PRECEDÊNCIA importa: "reescrever tudo protegendo dados" é a revisão geral, não só a LGPD. */
const GATILHOS: ReadonlyArray<readonly [Exclude<Intencao, "fora_do_tema">, readonly string[]]> = [
  [
    "revisao_geral",
    [
      "reescrever tudo",
      "revisar post",
      "revisar o post",
      "corrigir erros",
      "corrigir os erros",
      "corrigir tudo",
      "limpar texto",
      "limpar o texto",
      "tirar dados falsos e nomes",
      "versao segura",
      "arrumar rascunho",
      "arrumar o rascunho",
      "editar postagem completa",
    ],
  ],
  [
    "auditar_lgpd",
    [
      "proteger dados",
      "protegendo dados",
      "dados de terceiros",
      "remover nome",
      "remover o nome",
      "tirar o nome",
      "privacidade",
      "lgpd",
      "nao expor",
      "dado sensivel",
      "dados pessoais",
      "segredo medico",
      "sigilo",
      "anonimizar",
      "anonimo",
    ],
  ],
  [
    "auditar_autoral",
    [
      "de quem e o texto",
      "plagio",
      "copiado",
      "copia",
      "citacao sem aspas",
      "sem aspas",
      "quem escreveu",
      "direito autoral",
      "direitos autorais",
      "colocar aspas",
      "dar credito",
      "credito",
      "atribuir autor",
      "citar o autor",
      "autoria",
    ],
  ],
  [
    "substituir_dado",
    ["substituir", "substitua", "pode substituir", "troque o dado", "trocar o dado", "trocar a estatistica", "tirar o dado", "remover o dado", "tirar a estatistica"],
  ],
  [
    "auditar_fonte",
    [
      "qual a fonte",
      "qual e a fonte",
      "fonte dessa pesquisa",
      "fonte da pesquisa",
      "de onde saiu",
      "estudo comprovado",
      "comprovar dados",
      "comprovar os dados",
      "fonte de pesquisa",
      "essa pesquisa e real",
      "pesquisa e real",
      "dados falsos",
      "inventou",
      "e verdade",
      "confiavel",
      "existe",
      "instituto",
      "estatistica",
      "esse dado",
      "esse numero",
      "92%",
    ],
  ],
  ["confirmar_previa", ["revisar publicacao", "abrir previa", "ver previa", "post pronto", "terminar rascunho", "ir para post"]],
  [
    "gerar_rascunho",
    [
      "gerar rascunho",
      "gere",
      "gerar",
      "iniciar post",
      "comecar texto",
      "criar campanha",
      "celular na escola",
      "post celular",
      "pauta gremio",
      "rascunho",
      "montar o post",
      "monte o post",
      "monta o post",
      "montar post",
      "vamos comecar",
      "vamos",
      "comecar",
    ],
  ],
];

/** "Sim" depois de a IA oferecer a substituição (a fala da fonte termina com a pergunta). */
const CONCORDANCIAS = new Set(["sim", "pode", "pode sim", "quero", "claro", "ok", "pode ser", "sim pode", "aceito", "faca isso"]);

function contem(normalizada: string, gatilho: string): boolean {
  return ` ${normalizada} `.includes(` ${gatilho} `);
}

/**
 * Os gatilhos que vêm do PACOTE: o instituto (inteiro, e cada palavra
 * distintiva dele — "databrasil"), o primeiro nome do colega e o veículo
 * (inteiro: "tecnologia" sozinha apareceria em pedido de outra coisa).
 */
function gatilhosDoPacote(c: Pick<ConteudoDoPacote, "fonteInventada" | "colega" | "veiculo">): Array<[Intencao, string]> {
  const fonte = normalizar(c.fonteInventada);
  const palavrasDaFonte = fonte.split(" ").filter((p) => p.length >= 5 && !/\d/.test(p));
  const primeiroNome = normalizar(c.colega).split(" ")[0] ?? "";
  const gatilhos: Array<[Intencao, string]> = [
    ["auditar_fonte", fonte],
    ...palavrasDaFonte.map((p): [Intencao, string] => ["auditar_fonte", p]),
    ["auditar_lgpd", primeiroNome],
    ["auditar_autoral", normalizar(c.veiculo)],
  ];
  return gatilhos.filter(([, g]) => g.length >= 3);
}

/**
 * A intenção de uma mensagem. `ofertaDeSubstituicao`: a última fala do
 * assistente foi a da fonte, que oferece substituir — e aí um "sim" é aceitar.
 */
export function classificar(
  texto: string,
  conteudo: Pick<ConteudoDoPacote, "fonteInventada" | "colega" | "veiculo">,
  ofertaDeSubstituicao = false,
): Intencao {
  const n = normalizar(texto);
  if (!n) return "fora_do_tema";
  if (ofertaDeSubstituicao && CONCORDANCIAS.has(n)) return "substituir_dado";
  for (const [intencao, gatilhos] of GATILHOS) {
    if (gatilhos.some((g) => contem(n, g))) return intencao;
    const doPacote = gatilhosDoPacote(conteudo).filter(([i]) => i === intencao);
    if (doPacote.some(([, g]) => contem(n, g))) return intencao;
  }
  return "fora_do_tema";
}
