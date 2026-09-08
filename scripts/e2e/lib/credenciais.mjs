import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Lê `credenciais-demo.csv` — o arquivo que o seed escreve na raiz.
 *
 * Existe para os walkthroughs pararem de fixar login no código. Antes, cada
 * roteiro carregava `estudante4a01` escrito à mão: qualquer mudança no seed
 * quebrava seis scripts, e o erro saía como "timeout esperando o feed", não
 * como "essa conta não existe".
 *
 * O arquivo é gerado e está fora do git — se faltar, a mensagem diz o que
 * rodar, em vez de estourar num `ENOENT` cru no meio do Playwright.
 */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ARQUIVO = resolve(RAIZ, "credenciais-demo.csv");

function linhas() {
  let bruto;
  try {
    bruto = readFileSync(ARQUIVO, "utf8");
  } catch {
    throw new Error(
      `credenciais-demo.csv não encontrado em ${ARQUIVO}.\n` +
        `Ele é gerado pelo seed: SEED_SENHA=<senha> pnpm --filter @edu/api seed`,
    );
  }
  const [cabecalho, ...resto] = bruto.trim().split("\n");
  const colunas = cabecalho.split(",");
  return resto.map((linha) => {
    /* CSV do nosso próprio gerador: só precisa tratar o campo entre aspas, que
       aparece quando o nome tem vírgula. */
    const campos = linha.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [];
    const valores = campos
      .slice(0, colunas.length)
      .map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
    return Object.fromEntries(colunas.map((c, i) => [c, valores[i] ?? ""]));
  });
}

let cache = null;
const todas = () => (cache ??= linhas());

/** Todas as contas de um papel (o papel do CSV começa com o termo: `gestor (…)`). */
export function contasDe(papel) {
  return todas().filter((c) => c.papel.startsWith(papel));
}

/**
 * A primeira conta que casa. Os filtros são opcionais — sem eles vem a
 * primeira do papel, que é estável porque o seed é determinístico.
 */
export function conta(papel, { turma, serie, escola } = {}) {
  const achada = contasDe(papel).find(
    (c) =>
      (!turma || c.turma.startsWith(turma)) &&
      (!serie || c.serie.startsWith(serie)) &&
      (!escola || c.escola === escola),
  );
  if (!achada) {
    throw new Error(
      `nenhuma conta de "${papel}"${turma ? ` na turma ${turma}` : ""}` +
        `${serie ? ` da série ${serie}` : ""}${escola ? ` em ${escola}` : ""}` +
        ` em credenciais-demo.csv`,
    );
  }
  return achada;
}

/**
 * Os nomes das duas unidades, lidos do arquivo em vez de fixados aqui — o seed
 * pode trocá-los, e um roteiro que procura "EE Vila Nova" numa combobox falha
 * com "timeout esperando option", que não diz que o nome mudou.
 *
 * A supervisora é a única lotada nas DUAS, e a coluna `escola` dela traz as
 * duas separadas por " + " — é a fonte mais barata dessa informação.
 */
export function escolas() {
  const dasDuas = contasDe("gestor_escola (supervisora")[0];
  if (!dasDuas) throw new Error("sem gestor supervisora em credenciais-demo.csv");
  const [primeira, segunda] = dasDuas.escola.split(" + ");
  return { primeira, segunda };
}

/** A senha é a mesma para todas as contas de demonstração (vem de SEED_SENHA). */
export function senhaDemo() {
  return todas()[0]?.senha ?? "unooria123";
}

export { ARQUIVO as ARQUIVO_DE_CREDENCIAIS };
