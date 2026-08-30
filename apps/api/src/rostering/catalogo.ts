/**
 * Vocabulários da fronteira de importação de pessoas e turmas.
 *
 * Este módulo é a ÚNICA parte da api que conhece o OneRoster 1.2. O domínio
 * (papéis, séries, turmas) segue em pt-BR e não sabe o que é um `sourcedId` —
 * mesma disciplina de `src/ai`, onde só o provider conhece o vendor.
 */

import { SERIES, type Serie } from "../comum/series";

/** 1º ao 9º do fundamental, 1ª a 3ª do médio — a lista é uma só na api. */
export { SERIES, type Serie };

export const TURNOS = ["manha", "tarde", "noite", "integral"] as const;
export type Turno = (typeof TURNOS)[number];

/** `admin-contrato` NUNCA nasce de importação — é papel de operação do produto. */
export const PAPEIS_IMPORTAVEIS = ["estudante", "professor", "gestor"] as const;
export type PapelImportavel = (typeof PAPEIS_IMPORTAVEIS)[number];

/**
 * O que a escola escreve na coluna `papel`, e o que isso vira aqui.
 *
 * "Coordenação" não é papel novo: `PAPEIS` é contrato congelado entre a api e o
 * hub, e um quinto papel atravessaria middleware, guards e RLS. Coordenador,
 * diretor e o `principal`/`siteAdministrator` do OneRoster são todos `gestor` —
 * quem enxerga a escola inteira sem estar matriculado em turma nenhuma.
 *
 * Papel que não está aqui não é descartado em silêncio: vira linha de relatório.
 * Perder uma linha `teacher` calada é a mesma armadilha da coluna de prazo que
 * ninguém cumpre — o arquivo diz uma coisa, o banco tem outra, e ninguém vê.
 */
export const SINONIMOS_DE_PAPEL: Readonly<Record<string, PapelImportavel>> = {
  estudante: "estudante",
  estudantes: "estudante",
  aluno: "estudante",
  alunos: "estudante",
  discente: "estudante",
  student: "estudante",
  professor: "professor",
  professora: "professor",
  docente: "professor",
  teacher: "professor",
  gestor: "gestor",
  gestora: "gestor",
  coordenacao: "gestor",
  coordenador: "gestor",
  coordenadora: "gestor",
  diretor: "gestor",
  diretora: "gestor",
  principal: "gestor",
  siteadministrator: "gestor",
};

/**
 * O modelo que a área administrativa oferece para download. Ordem livre no
 * arquivo (o cabeçalho é lido por NOME), mas esta é a ordem do modelo.
 *
 * `senha` NÃO é coluna: a senha do lote é escolhida na tela de importação e a
 * pessoa é obrigada a trocá-la no primeiro acesso. Planilha de senha em texto
 * claro circula por e-mail, WhatsApp e pen drive.
 */
export const COLUNAS_MODELO = [
  /**
   * A identidade IMUTÁVEL do estudante na rede. Vem primeiro na planilha porque
   * é a coluna que decide se uma criança que mudou de escola é reconhecida como
   * a mesma pessoa ou nasce de novo, com o histórico partido em duas.
   * Nunca guardado em claro — ver `comum/cpf.ts`.
   */
  "cpf",
  "matricula",
  "nome",
  "usuario",
  "email",
  "papel",
  "turma",
  "serie",
  "turno",
] as const;

/** Formato anterior. Continua aceito para não quebrar quem já tem o arquivo. */
export const COLUNAS_LEGADO = ["nome", "usuario", "senha", "papel", "turma", "serie"] as const;

export const COLUNAS_CONHECIDAS: readonly string[] = [
  ...new Set<string>([...COLUNAS_MODELO, ...COLUNAS_LEGADO]),
];

/**
 * Séries ⇄ `grades` do OneRoster (vocabulário CEDS, dos EUA: "01".."12").
 * O casamento é POSICIONAL — 9 anos de fundamental + 3 de médio dão os mesmos
 * 12 degraus — e não semântico. Um provedor brasileiro pode ser explícito
 * mandando `ext:1EF`, que a leitura também aceita.
 */
export const SERIE_PARA_GRADE: Readonly<Record<Serie, string>> = {
  "1EF": "01", "2EF": "02", "3EF": "03", "4EF": "04", "5EF": "05",
  "6EF": "06", "7EF": "07", "8EF": "08", "9EF": "09",
  "1EM": "10", "2EM": "11", "3EM": "12",
};

export const GRADE_PARA_SERIE: Readonly<Record<string, Serie>> = Object.fromEntries(
  Object.entries(SERIE_PARA_GRADE).map(([serie, grade]) => [grade, serie as Serie]),
);

/** Arquivos do binding CSV do OneRoster 1.2 que esta api lê, em ORDEM. */
export const ARQUIVOS_ONEROSTER = [
  "manifest",
  "orgs",
  "academicSessions",
  "classes",
  "users",
  "enrollments",
  "roles",
] as const;
export type ArquivoOneRoster = (typeof ARQUIVOS_ONEROSTER)[number];

export const VERSAO_ONEROSTER = "1.2";
