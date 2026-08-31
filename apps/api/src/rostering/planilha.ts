/**
 * Leitura da PLANILHA SIMPLES de pessoas — uma linha por pessoa, o formato que
 * a escola preenche e que a área administrativa oferece para download.
 *
 * O cabeçalho é lido por NOME, não por posição: quem abre no Excel move coluna,
 * e um importador que dependesse da ordem transformaria isso em dado trocado
 * (nome no campo do login) em vez de erro. Coluna desconhecida é erro de
 * cabeçalho, não coluna ignorada.
 */
import { parseCsv } from "../usuarios/csv";
import {
  COLUNAS_CONHECIDAS,
  COLUNAS_LEGADO,
  COLUNAS_MODELO,
  type PapelImportavel,
  type Serie,
  type Turno,
} from "./catalogo";
import { cpfEhValido, digitosDoCpf } from "../comum/cpf";
import { chave, normalizarPapel, normalizarSerie, normalizarTurno, usuarioEhValido } from "./regras";

export interface ErroDeLinha {
  linha: number;
  campo: string;
  mensagem: string;
}

export interface PessoaDaPlanilha {
  /** Linha no arquivo (1-based, contando o cabeçalho) — é o que o relatório cita. */
  linha: number;
  /** Dígitos do CPF, já validados. Vazio quando a coluna não veio. */
  cpf: string;
  matricula: string;
  nome: string;
  usuario: string;
  email: string;
  papel: PapelImportavel;
  turma: string;
  serie: Serie | "";
  turno: Turno | null;
  /** Só o formato legado traz senha por linha. */
  senha: string;
}

export interface LeituraDaPlanilha {
  formato: "modelo" | "legado";
  pessoas: PessoaDaPlanilha[];
  erros: ErroDeLinha[];
  avisos: ErroDeLinha[];
}

/** O modelo em branco, gerado da MESMA constante que o leitor consome. */
export function modeloEmBranco(): string {
  return `${COLUNAS_MODELO.join(",")}\n`;
}

/**
 * Exemplo preenchido — arquivo SEPARADO do modelo, de propósito: linha de
 * exemplo dentro do modelo vira usuário fantasma importado no primeiro uso.
 */
export function exemploPreenchido(): string {
  return [
    COLUNAS_MODELO.join(","),
    "529.982.247-25,2026001,Ana Paula Ribeiro,,ana.ribeiro@escola.exemplo,estudante,8A,8EF,manha",
    '045.833.259-32,2026002,"Souza, João Pedro",joao.souza,,estudante,8A,8EF,manha',
    ",1099,Marta Nunes Alves,,marta.alves@escola.exemplo,professor,8A,8EF,manha",
    ",1100,Carlos Eduardo Dias,,,coordenacao,,,",
    "",
  ].join("\n");
}

/** Os campos que uma linha pode ter — a chave do acesso por NOME de coluna. */
type CampoDaLinha =
  | "cpf"
  | "matricula"
  | "nome"
  | "usuario"
  | "email"
  | "papel"
  | "turma"
  | "serie"
  | "turno"
  | "senha";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function lerPlanilha(csv: string): LeituraDaPlanilha {
  const registros = parseCsv(csv);
  const erros: ErroDeLinha[] = [];
  const avisos: ErroDeLinha[] = [];

  const cabecalho = registros[0]?.map((c) => chave(c));
  if (!cabecalho || cabecalho.length === 0) {
    return {
      formato: "modelo",
      pessoas: [],
      erros: [{ linha: 1, campo: "header", mensagem: `cabeçalho esperado: ${COLUNAS_MODELO.join(",")}` }],
      avisos,
    };
  }

  const ehLegado =
    cabecalho.length === COLUNAS_LEGADO.length && COLUNAS_LEGADO.every((c, i) => cabecalho[i] === c);
  const formato: LeituraDaPlanilha["formato"] = ehLegado ? "legado" : "modelo";

  if (!ehLegado) {
    const desconhecidas = cabecalho.filter((c) => c && !COLUNAS_CONHECIDAS.includes(c));
    for (const coluna of desconhecidas) {
      erros.push({ linha: 1, campo: "header", mensagem: `coluna desconhecida: "${coluna}"` });
    }
    for (const obrigatoria of ["nome", "papel"] as const) {
      if (!cabecalho.includes(obrigatoria)) {
        erros.push({
          linha: 1,
          campo: "header",
          mensagem: `falta a coluna "${obrigatoria}" — cabeçalho esperado: ${COLUNAS_MODELO.join(",")}`,
        });
      }
    }
    if (erros.length > 0) return { formato, pessoas: [], erros, avisos };
  }

  const corpo = registros.slice(1);
  if (corpo.length === 0) {
    return {
      formato,
      pessoas: [],
      erros: [{ linha: 2, campo: "arquivo", mensagem: "nenhuma linha de dados" }],
      avisos,
    };
  }

  const indice = new Map<string, number>();
  cabecalho.forEach((coluna, i) => {
    if (coluna && !indice.has(coluna)) indice.set(coluna, i);
  });

  const pessoas: PessoaDaPlanilha[] = [];
  const porCpf = new Map<string, number>();
  const porMatricula = new Map<string, number>();
  const porUsuario = new Map<string, number>();

  corpo.forEach((celulas, idx) => {
    const linha = idx + 2;
    const campo = (nome: CampoDaLinha) => {
      const i = indice.get(nome);
      return i === undefined ? "" : (celulas[i] ?? "").trim();
    };

    const nome = campo("nome");
    const papelBruto = campo("papel");
    // Linha inteiramente vazia (planilha exportada costuma trazer várias) não é erro.
    if (!nome && !papelBruto && celulas.every((c) => c.trim() === "")) return;

    const daLinha: ErroDeLinha[] = [];
    if (!nome) daLinha.push({ linha, campo: "nome", mensagem: "nome vazio" });
    if (nome.length > 120) daLinha.push({ linha, campo: "nome", mensagem: "nome acima de 120 caracteres" });

    const papel = normalizarPapel(papelBruto);
    if (!papel) {
      daLinha.push({
        linha,
        campo: "papel",
        mensagem: papelBruto
          ? `papel não reconhecido: "${papelBruto}" — use estudante, professor ou coordenação`
          : "papel: informe estudante, professor ou coordenação",
      });
    }

    const usuario = chave(campo("usuario")).replace(/\s+/g, "");
    if (usuario && !usuarioEhValido(usuario)) {
      daLinha.push({ linha, campo: "usuario", mensagem: "usuario: use 3–64 caracteres [a-z 0-9 . _ -]" });
    }

    const email = campo("email");
    if (email && !EMAIL.test(email)) {
      daLinha.push({ linha, campo: "email", mensagem: "email inválido" });
    }

    const matricula = campo("matricula");
    if (matricula.length > 64) {
      daLinha.push({ linha, campo: "matricula", mensagem: "matricula acima de 64 caracteres" });
    }

    /* CPF errado numa planilha de 10 mil linhas cria identidade fantasma que
       nunca casa com a da rede — e o erro só aparece meses depois, quando a
       criança se transfere e vira uma segunda pessoa. Por isso valida aqui. */
    const cpfBruto = campo("cpf");
    const cpf = cpfBruto ? digitosDoCpf(cpfBruto) : "";
    if (cpfBruto && !cpfEhValido(cpfBruto)) {
      daLinha.push({
        linha,
        campo: "cpf",
        mensagem: `CPF inválido: "${cpfBruto}" — confira os dígitos verificadores`,
      });
    }

    const turma = campo("turma");
    const serieBruta = campo("serie");
    const serie = serieBruta ? normalizarSerie(serieBruta) : null;
    if (serieBruta && !serie) {
      daLinha.push({ linha, campo: "serie", mensagem: `série não reconhecida: "${serieBruta}"` });
    }

    const turnoBruto = campo("turno");
    const turno = turnoBruto ? normalizarTurno(turnoBruto) : null;
    if (turnoBruto && !turno) {
      daLinha.push({ linha, campo: "turno", mensagem: `turno não reconhecido: "${turnoBruto}"` });
    }

    if (papel === "estudante") {
      if (!turma) daLinha.push({ linha, campo: "turma", mensagem: "turma: obrigatória para estudante" });
      if (!serie) daLinha.push({ linha, campo: "serie", mensagem: "serie: obrigatória para estudante" });
    }

    const senha = campo("senha");
    if (senha && (senha.length < 8 || senha.length > 200)) {
      daLinha.push({ linha, campo: "senha", mensagem: "senha: mínimo 8 caracteres" });
    }

    // Gestor não é matrícula de turma (é papel no nível da escola). A turma na
    // linha não é ignorada em silêncio: vira aviso, para o gestor saber que
    // aquela coluna não teve efeito.
    if (papel === "gestor" && turma) {
      avisos.push({
        linha,
        campo: "turma",
        mensagem: "coordenação não é matriculada em turma — a coluna turma foi ignorada nesta linha",
      });
    }

    if (daLinha.length > 0) {
      erros.push(...daLinha);
      return;
    }

    const anteriorCpf = cpf ? porCpf.get(cpf) : undefined;
    if (anteriorCpf) {
      erros.push({ linha, campo: "cpf", mensagem: `CPF repetido no arquivo (linha ${anteriorCpf})` });
      return;
    }
    if (cpf) porCpf.set(cpf, linha);

    const anteriorMatricula = matricula ? porMatricula.get(chave(matricula)) : undefined;
    if (anteriorMatricula) {
      erros.push({ linha, campo: "matricula", mensagem: `matricula repetida no arquivo (linha ${anteriorMatricula})` });
      return;
    }
    const anteriorUsuario = usuario ? porUsuario.get(usuario) : undefined;
    if (anteriorUsuario) {
      erros.push({ linha, campo: "usuario", mensagem: `usuario repetido no arquivo (linha ${anteriorUsuario})` });
      return;
    }
    if (matricula) porMatricula.set(chave(matricula), linha);
    if (usuario) porUsuario.set(usuario, linha);

    pessoas.push({
      linha,
      cpf,
      matricula,
      nome,
      usuario,
      email,
      papel: papel!,
      turma: papel === "gestor" ? "" : turma,
      serie: serie ?? "",
      turno,
      senha,
    });
  });

  return { formato, pessoas, erros, avisos };
}
