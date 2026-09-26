/**
 * Regra 6 do AGENTS.md (nada de PII em texto claro) saindo da convenção e
 * entrando na ferramenta: TODO objeto e TODA mensagem que o logger recebe
 * passam por aqui antes de virar linha.
 *
 * Por caminho de CHAVE (`redigirObjeto`): qualquer campo com um destes nomes,
 * em qualquer profundidade, vira `[redigido]`. É o que o `redact` do pino
 * faria, se ele aceitasse `**` — ele não aceita (o fast-redact é por nível), e
 * um `err` do Prisma carrega o objeto que o service tentou gravar.
 *
 * Por PADRÃO no texto (`redigirTexto`): e-mail, CPF, `Bearer …` e query
 * string. É a rede para a mensagem de exceção que embute o valor recebido.
 */
export const CHAVES_REDIGIDAS: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "token",
  "senha",
  "password",
  "passwordhash",
  "cpf",
  "username",
  "email",
  "nome",
  "texto",
  "mensagem",
  "transcricao",
  "observacao",
  // O parágrafo autoral da exp08ef4b (TEC-03 / DAD-08). `texto` acima não o
  // cobre: a chave é `justificativaTexto` / `justificativa_texto`, e a
  // comparação aqui é por nome INTEIRO em minúsculas, não por substring — um
  // `err` do Prisma carrega o objeto que o service tentou gravar, e é por ele
  // que a caixa livre de um menor de idade chegaria ao log.
  "justificativatexto",
  "justificativa_texto",
  "justificativasugerida",
  // O GABARITO de missão que classifica mensagens: se cada uma é verdadeira,
  // em que tom ela foi escrita, e a explicação da resposta. Não é PII: é a
  // resposta que a missão existe para não entregar antes da revelação — e um
  // `err` do Prisma carrega o lote que o service tentou gravar, com o gabarito
  // inteiro dentro. Log de produção é lido por gente da escola.
  //
  // `veracidade` e `tom` são os dois eixos de Quem Mandou Isso? v2.2
  // (exp05ef1b) — o pacote de 8 mensagens os leva no JSONB. `explicacao` veio
  // da primeira versão (ADR-114) e FICA: tirar chave desta lista só afrouxa a
  // rede, e o custo de ela sobrar é redigir um campo que ninguém manda.
  "veracidade",
  "tom",
  "explicacao",
  // O `Então` da regra Se/Então da exp05ef1b — TEXTO LIVRE DE MENOR (RF-014).
  // `entao` no corpo e na resposta, `acaoEntao` no Prisma, `acao_entao` na
  // coluna: um `err` do Prisma carrega o objeto que o service tentou gravar.
  "entao",
  "acaoentao",
  "acao_entao",
  // As variações de hash de senha que `senha`/`passwordhash` NÃO cobrem: a
  // comparação aqui é por nome INTEIRO em minúsculas, então `senha_hash` e
  // `senhaHash` passavam inteiros.
  "password_hash",
  "senhahash",
  "senha_hash",
]);

export const MARCA = "[redigido]";
const PROFUNDIDADE_MAXIMA = 8;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/g;
const QUERY_STRING = /\?[^\s"']+/g;

export function redigirTexto(texto: string): string {
  return texto
    .replace(BEARER, `Bearer ${MARCA}`)
    .replace(EMAIL, MARCA)
    .replace(CPF, MARCA)
    .replace(QUERY_STRING, `?${MARCA}`);
}

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  if (valor === null || typeof valor !== "object") return false;
  const proto = Object.getPrototypeOf(valor);
  return proto === Object.prototype || proto === null;
}

/**
 * Caminha o objeto redigindo por nome de chave. `Error` é preservado como está
 * (o `pino.stdSerializers.err` cuida dele, e a mensagem passa por
 * `redigirTexto` no logger). Instâncias de classe (Date, Buffer, Prisma) não
 * são atravessadas: só objeto simples e array.
 */
export function redigirObjeto<T>(valor: T, profundidade = 0): T {
  if (profundidade > PROFUNDIDADE_MAXIMA) return "[profundo]" as unknown as T;
  if (typeof valor === "string") return redigirTexto(valor) as unknown as T;
  if (Array.isArray(valor)) {
    return valor.map((item) => redigirObjeto(item, profundidade + 1)) as unknown as T;
  }
  if (!ehObjetoSimples(valor)) return valor;

  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor)) {
    saida[chave] = CHAVES_REDIGIDAS.has(chave.toLowerCase()) ? MARCA : redigirObjeto(v, profundidade + 1);
  }
  return saida as T;
}
