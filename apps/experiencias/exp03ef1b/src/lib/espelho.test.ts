import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { TETO_DA_ETAPA } from "./regras";
import { ROTULO_DO_CARIMBO, ROTULO_DO_SUPORTE } from "./textos";
import {
  CAMPOS,
  CARIMBOS,
  CARTOES_DA_INSPECAO,
  CARTOES_DO_CASO,
  DESFECHOS,
  DIAS,
  ETAPAS,
  ETIQUETAS,
  FERRAMENTAS_DO_CASO,
  LUGARES,
  PASSOS,
  PASSOS_PEDIDOS,
  PESSOAS,
  POLLING_DO_GATE_MS,
  PULSO_DA_GALERIA_MS,
  PULSO_DA_INSPECAO_MS,
  SIMULACAO_DA_ROTINA_MS,
  SUPORTES,
  VAGAS_DA_ESTEIRA,
  VALORES_DO_FILTRO,
} from "./tipos";

/**
 * O ESPELHO do contrato contra a api. A experiência não importa a api (o
 * bundle é público), então `lib/tipos.ts` tem uma cópia DECLARADA das listas,
 * e este teste LÊ os arquivos de `apps/api/src/nina-noticia/` como texto e
 * reprova a divergência — um passo novo no servidor cairia numa tela que não
 * existe, e o typecheck não veria. Molde: `exp06ef1b/src/lib/espelho.test.ts`.
 */
const MODULO = "../../api/src/nina-noticia";
const ler = (arquivo: string) => readFileSync(`${MODULO}/${arquivo}`, "utf8");

function lista(arquivo: string, nome: string): string[] {
  const bloco = new RegExp(`export const ${nome}(?:: [^=]+)? = \\[([\\s\\S]*?)\\] as const`).exec(ler(arquivo));
  if (!bloco?.[1]) throw new Error(`${nome} não encontrado em ${arquivo}`);
  return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

function numero(arquivo: string, nome: string): number {
  const casou = new RegExp(`export const ${nome} = ([\\d_]+);`).exec(ler(arquivo));
  if (!casou?.[1]) throw new Error(`${nome} não encontrado em ${arquivo}`);
  return Number(casou[1].replace(/_/g, ""));
}

/** As chaves de PRIMEIRO nível de um `X.extend({...})`/`z.object({...})` do contrato. */
function chavesDoSchema(nome: string): string[] {
  const fonte = ler("contrato-de-rotas.ts");
  const inicio = fonte.indexOf(`export const ${nome} =`);
  if (inicio < 0) throw new Error(`${nome} não encontrado`);
  const abre = fonte.indexOf("({", inicio) + 1;
  let nivel = 0;
  let fim = abre;
  for (let i = abre; i < fonte.length; i++) {
    if (fonte[i] === "{" || fonte[i] === "(" || fonte[i] === "[") nivel++;
    if (fonte[i] === "}" || fonte[i] === ")" || fonte[i] === "]") nivel--;
    if (nivel === 0) {
      fim = i;
      break;
    }
  }
  const corpo = fonte.slice(abre + 1, fim);
  const chaves: string[] = [];
  let n = 0;
  for (const linha of corpo.split("\n")) {
    if (n === 0) {
      const m = /^\s*([a-zA-Z]+):/.exec(linha);
      if (m?.[1]) chaves.push(m[1]);
    }
    for (const ch of linha) {
      if ("{([".includes(ch)) n++;
      if ("})]".includes(ch)) n--;
    }
  }
  return chaves;
}

describe("as listas do vocabulário", () => {
  test.each([
    ["PASSOS", PASSOS],
    ["ETAPAS", ETAPAS],
    ["SUPORTES", SUPORTES],
    ["CAMPOS", CAMPOS],
    ["LUGARES", LUGARES],
    ["PESSOAS", PESSOAS],
    ["DIAS", DIAS],
    ["CARIMBOS", CARIMBOS],
    ["CARTOES_DA_INSPECAO", CARTOES_DA_INSPECAO],
    ["CARTOES_DO_CASO", CARTOES_DO_CASO],
    ["ETIQUETAS", ETIQUETAS],
    ["DESFECHOS", DESFECHOS],
  ] as const)("%s igual à api", (nome, nossa) => {
    expect([...nossa]).toEqual(lista("vocabulario.ts", nome));
  });

  test("os blocos: só a QUANTIDADE (a ordem certa nunca vem para cá)", () => {
    expect(lista("vocabulario.ts", "BLOCOS")).toHaveLength(VAGAS_DA_ESTEIRA);
  });

  test("os valores das pastilhas (Quem e Quando NÃO são os da feira)", () => {
    const fonte = ler("vocabulario.ts");
    const quem = /quem: \[([^\]]*)\]/.exec(fonte)?.[1] ?? "";
    const quando = /quando: \[([^\]]*)\]/.exec(fonte)?.[1] ?? "";
    expect([...VALORES_DO_FILTRO.quem]).toEqual([...quem.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
    expect([...VALORES_DO_FILTRO.quando]).toEqual([...quando.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  });

  test("os passos pedidos, as ferramentas e o teto de cada etapa", () => {
    expect([...PASSOS_PEDIDOS]).toEqual(lista("regras/passos.ts", "PASSOS_PEDIDOS"));
    expect([...FERRAMENTAS_DO_CASO]).toEqual(lista("conteudo.ts", "FERRAMENTAS_DO_CASO"));
    const passos = ler("regras/passos.ts");
    for (const [etapa, teto] of Object.entries(TETO_DA_ETAPA)) expect(passos).toContain(`${etapa}: "${teto}"`);
  });

  test("os tempos", () => {
    expect(PULSO_DA_GALERIA_MS).toBe(numero("vocabulario.ts", "PULSO_DA_GALERIA_MS"));
    expect(PULSO_DA_INSPECAO_MS).toBe(numero("vocabulario.ts", "PULSO_DA_INSPECAO_MS"));
    expect(POLLING_DO_GATE_MS).toBe(numero("vocabulario.ts", "POLLING_DO_GATE_MS"));
    expect(SIMULACAO_DA_ROTINA_MS).toBe(numero("vocabulario.ts", "SIMULACAO_DA_ROTINA_MS"));
  });

  test("os rótulos que a tela repete (carimbos e suportes)", () => {
    const fonte = ler("vocabulario.ts");
    for (const [k, v] of Object.entries(ROTULO_DO_CARIMBO)) expect(fonte).toContain(`${k}: "${v}"`);
    for (const [k, v] of Object.entries(ROTULO_DO_SUPORTE)) expect(fonte).toContain(`${k}: "${v}"`);
  });
});

describe("os campos que a tela lê existem no contrato", () => {
  test("a sessão do estudante", () => {
    const chaves = chavesDoSchema("SessaoSchema");
    for (const k of ["pacoteId", "rodada", "passoDoEstudante", "jornal", "selos", "previsao", "filtro", "ficha", "carimbos", "reparo", "rotina", "caso", "fim", "concluida"]) {
      expect(chaves).toContain(k);
    }
  });

  test("o estado e as respostas das jogadas", () => {
    expect(chavesDoSchema("EstadoSchema")).toEqual(["passo", "etapa", "pausada", "aguardandoOProfessor"]);
    expect(chavesDoSchema("RespostaDoFiltroSchema")).toEqual(["encontradas", "total"]);
    expect(chavesDoSchema("RespostaDaRotinaSchema")).toEqual(["valida", "simulacao"]);
    expect(chavesDoSchema("RespostaDoReparoSchema")).toEqual(["desfecho"]);
    expect(chavesDoSchema("ReparoSchema")).toEqual(["ficha"]);
    expect(chavesDoSchema("RotinaSchema")).toEqual(["sequencia"]);
    expect(chavesDoSchema("PrevisaoSchema")).toEqual(["itens"]);
    expect(chavesDoSchema("SelosSchema")).toEqual(["reportagens"]);
    expect(chavesDoSchema("FichaAbertaSchema")).toEqual(["dica"]);
  });
});
