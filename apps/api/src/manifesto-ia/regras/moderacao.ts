/**
 * O FILTRO DE DADO PESSOAL no parágrafo autoral da Etapa 5.
 *
 * A decisão de produto: dado pessoal detectado é **RECUSADO com dica, e não
 * gravado** (422). As duas alternativas foram consideradas e descartadas:
 *
 * - *Gravar com flag de moderação* deixaria o telefone da criança dentro da
 *   coluna, à espera de alguém que decidisse o que fazer com ele. A regra 6 do
 *   `AGENTS.md` (dados de menores) prefere não guardar — e um dado que não foi
 *   gravado não vaza em backup, em dump de diagnóstico nem em log.
 * - *Ofuscar os termos e salvar o resto* devolveria à professora um parágrafo
 *   mutilado, com a argumentação da criança cortada no meio, sem que ninguém
 *   soubesse o que estava ali.
 *
 * Recusar também ENSINA, que é o ponto pedagógico: a dica diz o que tirar, a
 * criança reescreve, e a aula sobre privacidade acontece no momento em que ela
 * está prestes a entregar um dado pessoal. É a única superfície da missão em
 * que a regra vira experiência vivida.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * O QUE ESTE FILTRO NÃO É: um detector de PII completo.
 *
 * Ele é deliberadamente CONSERVADOR nos padrões estruturados (telefone, CPF,
 * e-mail, CEP, cartão) e **não tenta adivinhar nome próprio**. Um filtro de
 * sobrenome recusaria "meu tio Silva foi reprovado pelo sistema" — que é
 * exatamente o tipo de argumento situado que a Etapa 5 quer — e a criança não
 * teria como saber o que fazer com a mensagem de erro. Nome próprio é risco
 * ACEITO e registrado: o texto é lido só pela professora da turma dela, nunca
 * vai a log (`justificativaTexto` está em `CHAVES_REDIGIDAS`) e nunca ao canal
 * analítico.
 *
 * Falso positivo tem um custo real e o mais provável é o ANO: "desde 2019 a
 * escola usa esse sistema" não pode ser confundido com um dado pessoal. Por
 * isso nenhum padrão aqui casa número de 4 dígitos solto.
 */

/** O que o cliente recebe quando a validação recusa — código estável. */
export const PII_DETECTADA = "dado-pessoal-no-texto";

interface Padrao {
  /** Nome do padrão, para o log. NUNCA o trecho que casou — ele é o dado. */
  nome: string;
  re: RegExp;
}

/**
 * Os padrões, e o motivo de cada recorte.
 *
 * Todos com `g` recriado a cada chamada por `padroesEm()`: `RegExp` com `g`
 * guarda `lastIndex`, e um literal compartilhado entre requisições pula o
 * começo do texto seguinte — o bug clássico de reusar regex global, que aqui
 * apareceria como um telefone passando batido a cada duas submissões.
 */
const PADROES: readonly Padrao[] = [
  {
    nome: "cpf",
    // Com ou sem pontuação. 11 dígitos seguidos também casa aqui.
    re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
  },
  {
    nome: "telefone",
    // DDD entre parênteses ou não, 8 ou 9 dígitos, com ou sem hífen/espaço.
    // Exige o DDD ou o formato com separador: um "12345678" solto no meio de
    // uma frase é mais provavelmente um número inventado que um telefone.
    re: /(\(\d{2}\)\s?\d{4,5}-?\d{4})|(\b\d{2}\s\d{4,5}-\d{4}\b)|(\b\d{4,5}-\d{4}\b)/,
  },
  {
    nome: "email",
    re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  },
  {
    nome: "cep",
    re: /\b\d{5}-\d{3}\b/,
  },
  {
    nome: "cartao",
    // 16 dígitos em quatro grupos. Improvável num texto de 8º ano, e é
    // justamente por isso que casar aqui é sinal forte.
    re: /\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b/,
  },
  {
    nome: "instagram",
    // @arroba seguido de identificador. É a forma como esta faixa de idade
    // escreve o próprio contato, e ela aparece antes de um telefone.
    re: /(^|\s)@[a-z0-9._]{3,}/i,
  },
];

/**
 * Quais padrões o texto viola. Devolve os NOMES, nunca os trechos.
 *
 * A lista de nomes é o que pode ir ao log e à resposta: `["telefone"]` diz à
 * professora e ao suporte o que aconteceu sem reproduzir o dado que a regra
 * está tentando não guardar.
 */
export function padroesEm(texto: string): string[] {
  return PADROES.filter(({ re }) => new RegExp(re.source, re.flags).test(texto)).map(
    (p) => p.nome,
  );
}

export function temDadoPessoal(texto: string): boolean {
  return padroesEm(texto).length > 0;
}
