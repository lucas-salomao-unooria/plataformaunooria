import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { NEWS_MEDIUMS, NEWSPAPER_LAYOUTS } from "@edu/ui/ds";
import { ICONE_DA_PISTA, ICONE_DO_BLOCO, MEIO_PARA_MEDIUM, PECA_DO_MEIO } from "./meios";
import { TELA_DO_PASSO } from "./regras";
import {
  ETAPAS,
  IDS_DE_NOTICIA,
  LAYOUTS,
  MEIOS,
  MOTIVOS,
  ORIGENS_DO_LAYOUT,
  PASSOS,
  PASSOS_PEDIDOS,
  TAMANHO_DA_EDICAO,
  TIPOS_DE_PISTA,
} from "./tipos";

/**
 * O ESPELHO do vocabulário contra a api. A experiência não importa a api (o
 * bundle é público, a api é outro pacote), então `lib/tipos.ts` tem uma cópia
 * DECLARADA das listas — e este teste LÊ os arquivos da api como texto e
 * reprova a divergência. Sem ele, um meio novo no servidor cairia num cartão
 * sem desenho, e um passo novo numa tela que não existe; o typecheck não veria
 * nenhum dos dois. Molde: `exp07ef1b/src/lib/regras.test.ts`.
 */
const VOCABULARIO = "../../api/src/jornal-escola/vocabulario.ts";
const PASSOS_DA_API = "../../api/src/jornal-escola/regras/passos.ts";

function listaDoArquivo(caminho: string, nome: string): string[] {
  const fonte = readFileSync(caminho, "utf8");
  const bloco = new RegExp(`export const ${nome} = \\[([\\s\\S]*?)\\] as const`).exec(fonte);
  if (!bloco?.[1]) throw new Error(`${nome} não encontrado em ${caminho}`);
  return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

function numeroDoArquivo(caminho: string, nome: string): number {
  const casou = new RegExp(`export const ${nome} = (\\d+);`).exec(readFileSync(caminho, "utf8"));
  if (!casou?.[1]) throw new Error(`${nome} não encontrado em ${caminho}`);
  return Number(casou[1]);
}

describe("o vocabulário é o da api, na mesma ordem", () => {
  test.each([
    ["IDS_DE_NOTICIA", IDS_DE_NOTICIA],
    ["MEIOS", MEIOS],
    ["TIPOS_DE_PISTA", TIPOS_DE_PISTA],
    ["LAYOUTS", LAYOUTS],
    ["ORIGENS_DO_LAYOUT", ORIGENS_DO_LAYOUT],
    ["MOTIVOS", MOTIVOS],
  ] as const)("%s", (nome, lista) => {
    expect([...lista]).toEqual(listaDoArquivo(VOCABULARIO, nome));
  });

  test("a edição tem o tamanho da api", () => {
    expect(TAMANHO_DA_EDICAO).toBe(numeroDoArquivo(VOCABULARIO, "TAMANHO_DA_EDICAO"));
    expect(numeroDoArquivo(VOCABULARIO, "TAMANHO_DA_CHAVE")).toBe(TAMANHO_DA_EDICAO);
  });

  test.each([
    ["PASSOS", PASSOS],
    ["ETAPAS", ETAPAS],
    ["PASSOS_PEDIDOS", PASSOS_PEDIDOS],
  ] as const)("%s (regras/passos.ts)", (nome, lista) => {
    expect([...lista]).toEqual(listaDoArquivo(PASSOS_DA_API, nome));
  });

  test("os seis blocos da Chave têm ícone — e o bundle não guarda a lista dos pilares", () => {
    const daApi = [...listaDoArquivo(VOCABULARIO, "TIPOS_DE_PISTA"), ...listaDoArquivo(VOCABULARIO, "BLOCOS_ISCA")];
    expect(Object.keys(ICONE_DO_BLOCO).sort()).toEqual([...daApi].sort());
    // A ordem do Record é alfabética: agrupar os três pilares escreveria o conjunto certo.
    expect(Object.keys(ICONE_DO_BLOCO)).toEqual([...Object.keys(ICONE_DO_BLOCO)].sort());
  });
});

describe("o vocabulário da api traduzido para o do design system", () => {
  test("LAYOUTS é o NEWSPAPER_LAYOUTS do DS — a IA só escolhe um desses", () => {
    expect([...LAYOUTS]).toEqual([...NEWSPAPER_LAYOUTS]);
  });

  test("cada meio tem um NewsMedium do DS, e dois meios não dividem o mesmo", () => {
    expect(Object.keys(MEIO_PARA_MEDIUM).sort()).toEqual([...MEIOS].sort());
    const mediums = Object.values(MEIO_PARA_MEDIUM);
    for (const m of mediums) expect(NEWS_MEDIUMS).toContain(m);
    expect(new Set(mediums).size).toBe(MEIOS.length);
  });

  test("o post é do Instanooria, a mensagem é do WhatsApp, o resto é da redação", () => {
    expect(PECA_DO_MEIO.rede_social).toEqual({ secao: "instanooria" });
    expect(PECA_DO_MEIO.mensagem).toEqual({ secao: "whatsappmobile" });
    for (const meio of MEIOS.filter((m) => m !== "rede_social" && m !== "mensagem")) {
      const peca = PECA_DO_MEIO[meio];
      expect(peca.secao).toBe("unooria");
      if (peca.secao === "unooria") expect(peca.medium).toBe(MEIO_PARA_MEDIUM[meio]);
    }
  });

  test("cada pista tem ícone, e todo passo tem tela", () => {
    expect(Object.keys(ICONE_DA_PISTA)).toEqual([...TIPOS_DE_PISTA]);
    expect(Object.keys(TELA_DO_PASSO)).toEqual([...PASSOS]);
  });
});
