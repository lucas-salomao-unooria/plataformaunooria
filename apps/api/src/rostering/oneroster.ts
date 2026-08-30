/**
 * Leitura do binding CSV do OneRoster 1.2 — o caminho de quem TEM sistema de
 * gestão. A planilha simples (`planilha.ts`) é o caminho de quem não tem; as
 * duas caem no mesmo núcleo que aplica o lote.
 *
 * UM ARQUIVO POR CHAMADA, em ordem de dependência. O padrão empacota os sete
 * num zip com `manifest.csv`, mas empacotamento é embalagem, não semântica:
 * aplicar cada arquivo contra o banco, na ordem, dá o mesmo resultado sem
 * dependência nova e sem guardar lote pela metade em lugar nenhum. Quando um
 * arquivo referencia `sourcedId` que ainda não existe, a linha volta no
 * relatório dizendo QUAL arquivo falta — não some.
 */
import { parseCsv } from "../usuarios/csv";
import type { ArquivoOneRoster } from "./catalogo";
import { VERSAO_ONEROSTER } from "./catalogo";
import type { ErroDeLinha } from "./planilha";
import { chave } from "./regras";

/** Colunas de cada arquivo: as que exigimos e as que sabemos ler. */
export const COLUNAS_POR_ARQUIVO: Readonly<
  Record<ArquivoOneRoster, { obrigatorias: readonly string[]; conhecidas: readonly string[] }>
> = {
  manifest: {
    obrigatorias: ["propertyname", "value"],
    conhecidas: ["propertyname", "value"],
  },
  orgs: {
    obrigatorias: ["sourcedid", "name", "type"],
    conhecidas: ["sourcedid", "status", "datelastmodified", "name", "type", "identifier", "parentsourcedid"],
  },
  academicSessions: {
    obrigatorias: ["sourcedid", "title", "type", "startdate", "enddate"],
    conhecidas: [
      "sourcedid", "status", "datelastmodified", "title", "type",
      "startdate", "enddate", "parentsourcedid", "schoolyear",
    ],
  },
  classes: {
    obrigatorias: ["sourcedid", "title", "schoolsourcedid"],
    conhecidas: [
      "sourcedid", "status", "datelastmodified", "title", "grades",
      "coursesourcedid", "classcode", "classtype", "location",
      "schoolsourcedid", "termsourcedids", "subjects", "subjectcodes", "periods",
    ],
  },
  users: {
    obrigatorias: ["sourcedid", "username", "givenname", "familyname"],
    conhecidas: [
      "sourcedid", "status", "datelastmodified", "enableduser", "username",
      "userids", "givenname", "familyname", "middlename", "identifier",
      "email", "sms", "phone", "agentsourcedids", "grades", "password",
      "usermasteridentifier", "preferredgivenname", "preferredmiddlename",
      "preferredfamilyname", "primaryorgsourcedid", "pronouns",
      /* Extensão brasileira: o CPF é a identidade imutável do estudante e o
         padrão não tem campo para ele. `userIds` também o carrega, no formato
         `cpf:NNNNNNNNNNN`. */
      "metadata.br.cpf",
      /* `role` saiu de users.csv na 1.2 (foi para roles.csv), mas provedores
         seguem emitindo a coluna da 1.1. Aceitar é mais barato que exigir dois
         arquivos para saber se alguém é aluno. */
      "role",
    ],
  },
  enrollments: {
    obrigatorias: ["sourcedid", "classsourcedid", "usersourcedid", "role"],
    conhecidas: [
      "sourcedid", "status", "datelastmodified", "classsourcedid",
      "schoolsourcedid", "usersourcedid", "role", "primary", "begindate", "enddate",
    ],
  },
  roles: {
    obrigatorias: ["sourcedid", "usersourcedid", "role"],
    conhecidas: [
      "sourcedid", "status", "datelastmodified", "usersourcedid", "roletype",
      "role", "begindate", "enddate", "orgsourcedid", "userprofilesourcedid",
    ],
  },
};

export interface LinhaOneRoster {
  /** Linha no arquivo (1-based, contando o cabeçalho). */
  linha: number;
  campo: (nome: string) => string;
  /** `active` | `tobedeleted` — vazio em `bulk`, onde a coluna é opcional. */
  status: string;
}

export interface LeituraOneRoster {
  linhas: LinhaOneRoster[];
  erros: ErroDeLinha[];
}

/**
 * Campo-lista do padrão: valores separados por vírgula DENTRO de uma célula
 * (por isso o arquivo os traz entre aspas). O `parseCsv` já resolveu as aspas;
 * aqui só se divide o que sobrou.
 */
export function listaDoCampo(valor: string): string[] {
  return valor
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function lerArquivoOneRoster(arquivo: ArquivoOneRoster, csv: string): LeituraOneRoster {
  const spec = COLUNAS_POR_ARQUIVO[arquivo];
  const registros = parseCsv(csv);
  const erros: ErroDeLinha[] = [];

  const cabecalho = registros[0]?.map((c) => chave(c).replace(/\s+/g, ""));
  if (!cabecalho || cabecalho.length === 0) {
    return { linhas: [], erros: [{ linha: 1, campo: "header", mensagem: "arquivo vazio" }] };
  }

  for (const obrigatoria of spec.obrigatorias) {
    if (!cabecalho.includes(obrigatoria)) {
      erros.push({
        linha: 1,
        campo: "header",
        mensagem: `${arquivo}.csv: falta a coluna "${obrigatoria}"`,
      });
    }
  }
  // Coluna que não conhecemos é AVISO implícito, não erro: o padrão permite
  // extensões (`metadata.*`) e um provedor pode mandar mais do que lemos.
  if (erros.length > 0) return { linhas: [], erros };

  const indice = new Map<string, number>();
  cabecalho.forEach((coluna, i) => {
    if (coluna && !indice.has(coluna)) indice.set(coluna, i);
  });

  const linhas: LinhaOneRoster[] = [];
  registros.slice(1).forEach((celulas, idx) => {
    if (celulas.every((c) => c.trim() === "")) return;
    const campo = (nome: string) => {
      const i = indice.get(chave(nome).replace(/\s+/g, ""));
      return i === undefined ? "" : (celulas[i] ?? "").trim();
    };
    linhas.push({ linha: idx + 2, campo, status: chave(campo("status")) });
  });

  return { linhas, erros };
}

/** `manifest.csv` é property/value — só declara o lote; não escreve nada. */
export function lerManifesto(csv: string): {
  versao: string;
  arquivos: Array<{ nome: string; modo: string }>;
  erros: ErroDeLinha[];
} {
  const { linhas, erros } = lerArquivoOneRoster("manifest", csv);
  const propriedades = new Map<string, string>();
  for (const linha of linhas) {
    propriedades.set(chave(linha.campo("propertyName")), linha.campo("value").trim());
  }
  const versao = propriedades.get("oneroster.version") ?? "";
  if (versao && versao !== VERSAO_ONEROSTER) {
    erros.push({
      linha: 1,
      campo: "oneroster.version",
      mensagem: `versão ${versao} não suportada — esta api lê ${VERSAO_ONEROSTER}`,
    });
  }
  const arquivos = [...propriedades.entries()]
    .filter(([nome]) => nome.startsWith("file."))
    .map(([nome, modo]) => ({ nome: nome.slice("file.".length), modo: chave(modo) }));
  return { versao, arquivos, erros };
}

/**
 * `sessionType` do padrão para o nosso vocabulário.
 *
 * `term` e `gradingPeriod` caem em `bimestre` porque é o recorte que a rede
 * brasileira usa com mais frequência; quem divide em três manda `trimestre` como
 * extensão (`ext:trimestre`), que também é aceita.
 */
export function tipoDePeriodo(bruto: string): string | null {
  const valor = chave(bruto).replace(/^ext:/, "");
  if (valor === "schoolyear" || valor === "ano_letivo") return "ano_letivo";
  if (valor === "semester" || valor === "semestre") return "semestre";
  if (valor === "trimestre") return "trimestre";
  if (valor === "term" || valor === "gradingperiod" || valor === "bimestre") return "bimestre";
  return null;
}

/** `classType`: `homeroom` é a turma de referência; `scheduled`, a de componente. */
export function tipoDeTurma(bruto: string): string {
  const valor = chave(bruto).replace(/^ext:/, "");
  return valor === "scheduled" || valor === "componente" ? "componente" : "regular";
}

/** `enrollments.role` — só `student` e `teacher` viram matrícula aqui. */
export function papelDaMatricula(bruto: string): "estudante" | "professor" | null {
  const valor = chave(bruto).replace(/^ext:/, "");
  if (valor === "student" || valor === "aluno" || valor === "estudante") return "estudante";
  if (valor === "teacher" || valor === "professor") return "professor";
  return null;
}

export function ehVerdadeiro(bruto: string): boolean {
  return chave(bruto) === "true" || bruto === "1";
}

/** Data do padrão (ISO). Vazia ou inválida devolve `null`, nunca hoje. */
export function dataDoCampo(bruto: string): Date | null {
  if (!bruto.trim()) return null;
  const data = new Date(bruto.length === 10 ? `${bruto}T00:00:00Z` : bruto);
  return Number.isNaN(data.getTime()) ? null : data;
}
