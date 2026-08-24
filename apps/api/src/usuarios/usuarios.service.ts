import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { parseCsv } from "./csv";

/**
 * Importação de usuários por CSV — o caminho de entrada de usuários REAIS
 * (o seed só cria a escola demo).
 *
 * Formato (header obrigatório, na primeira linha, nesta grafia):
 *   nome,usuario,senha,papel,turma,serie
 *
 * Regras:
 *  - papel ∈ {aluno, professor, gestor} — admin-contrato NUNCA nasce de CSV;
 *  - aluno exige turma+serie (turma é criada na escola se não existir);
 *  - upsert por (escola, usuario): reimportar o mesmo CSV é no-op;
 *  - senha vazia em linha de atualização = mantém a senha atual;
 *  - linha inválida NÃO derruba o lote — volta no relatório de erros
 *    (mesmo padrão do /perfis/importar do projeto origem).
 */

const SERIES = [
  "1EF", "2EF", "3EF", "4EF", "5EF", "6EF", "7EF", "8EF", "9EF",
  "1EM", "2EM", "3EM",
] as const;

const LinhaSchema = z
  .object({
    nome: z.string().trim().min(1, "nome vazio").max(120),
    usuario: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,64}$/, "usuario: use 3–64 caracteres [a-z 0-9 . _ -]"),
    senha: z.union([z.literal(""), z.string().min(8, "senha: mínimo 8 caracteres").max(200)]),
    papel: z.enum(["aluno", "professor", "gestor"], {
      errorMap: () => ({ message: "papel: use aluno, professor ou gestor" }),
    }),
    turma: z.string().trim().max(40).default(""),
    serie: z.union([z.literal(""), z.enum(SERIES)]).default(""),
  })
  .superRefine((linha, ctx) => {
    if (linha.papel === "aluno") {
      if (!linha.turma) ctx.addIssue({ code: "custom", path: ["turma"], message: "turma: obrigatória para aluno" });
      if (!linha.serie) ctx.addIssue({ code: "custom", path: ["serie"], message: "serie: obrigatória para aluno" });
    }
  });

export interface RelatorioImportacao {
  criados: number;
  atualizados: number;
  erros: Array<{ linha: number; campo: string; mensagem: string }>;
}

const COLUNAS = ["nome", "usuario", "senha", "papel", "turma", "serie"] as const;
export const MAX_LINHAS = 5000;
const CHUNK = 100;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async importarCsv(escolaId: string, csv: string): Promise<RelatorioImportacao> {
    const registros = parseCsv(csv);
    const header = registros[0]?.map((c) => c.trim().toLowerCase());
    if (!header || COLUNAS.some((c, i) => header[i] !== c)) {
      return {
        criados: 0,
        atualizados: 0,
        erros: [{ linha: 1, campo: "header", mensagem: `header esperado: ${COLUNAS.join(",")}` }],
      };
    }
    const corpo = registros.slice(1);
    if (corpo.length === 0) {
      return { criados: 0, atualizados: 0, erros: [{ linha: 2, campo: "arquivo", mensagem: "nenhuma linha de dados" }] };
    }
    if (corpo.length > MAX_LINHAS) {
      return {
        criados: 0,
        atualizados: 0,
        erros: [{ linha: 1, campo: "arquivo", mensagem: `máximo de ${MAX_LINHAS} linhas por importação — divida o arquivo` }],
      };
    }

    const relatorio: RelatorioImportacao = { criados: 0, atualizados: 0, erros: [] };

    // Valida tudo antes de escrever qualquer coisa; duplicata DENTRO do
    // arquivo é erro (a última linha venceria em silêncio).
    const validas: Array<{ linha: number; dados: z.infer<typeof LinhaSchema> }> = [];
    const vistos = new Map<string, number>();
    corpo.forEach((celulas, idx) => {
      const numeroDaLinha = idx + 2; // 1-based + header
      const bruto = Object.fromEntries(COLUNAS.map((c, i) => [c, celulas[i] ?? ""]));
      const parsed = LinhaSchema.safeParse(bruto);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          relatorio.erros.push({
            linha: numeroDaLinha,
            campo: String(issue.path[0] ?? "linha"),
            mensagem: issue.message,
          });
        }
        return;
      }
      const anterior = vistos.get(parsed.data.usuario);
      if (anterior) {
        relatorio.erros.push({
          linha: numeroDaLinha,
          campo: "usuario",
          mensagem: `usuario repetido no arquivo (linha ${anterior})`,
        });
        return;
      }
      vistos.set(parsed.data.usuario, numeroDaLinha);
      validas.push({ linha: numeroDaLinha, dados: parsed.data });
    });

    // Turmas: resolve/cria por nome dentro da escola, uma vez só.
    const nomesDeTurma = [...new Set(validas.filter((v) => v.dados.turma).map((v) => v.dados.turma))];
    const turmaIdPorNome = new Map<string, string>();
    for (const nome of nomesDeTurma) {
      const serie = validas.find((v) => v.dados.turma === nome && v.dados.serie)?.dados.serie || "";
      const turma = await this.prisma.turma.upsert({
        where: { escolaId_nome: { escolaId, nome } },
        update: serie ? { serie } : {},
        create: { escolaId, nome, serie: serie || "9EF" },
      });
      turmaIdPorNome.set(nome, turma.id);
    }

    // Escrita em chunks: bcrypt é CPU-pesado (~80ms/hash) — o chunk mantém a
    // transação curta e o event loop respirando entre lotes.
    for (let i = 0; i < validas.length; i += CHUNK) {
      const lote = validas.slice(i, i + CHUNK);
      const hashes = await Promise.all(
        lote.map((v) => (v.dados.senha ? bcrypt.hash(v.dados.senha, 10) : Promise.resolve(null))),
      );
      await this.prisma.$transaction(async (tx) => {
        for (let j = 0; j < lote.length; j += 1) {
          const { linha, dados } = lote[j]!;
          const hash = hashes[j] ?? null;
          const existente = await tx.user.findUnique({
            where: { escolaId_username: { escolaId, username: dados.usuario } },
          });
          if (existente) {
            if (existente.role === "admin-contrato") {
              relatorio.erros.push({ linha, campo: "usuario", mensagem: "usuario reservado" });
              continue;
            }
            await tx.user.update({
              where: { id: existente.id },
              data: {
                displayName: dados.nome,
                role: dados.papel,
                turmaId: dados.turma ? turmaIdPorNome.get(dados.turma) : null,
                ...(hash ? { passwordHash: hash } : {}),
              },
            });
            relatorio.atualizados += 1;
          } else {
            if (!hash) {
              relatorio.erros.push({ linha, campo: "senha", mensagem: "senha: obrigatória para usuário novo" });
              continue;
            }
            await tx.user.create({
              data: {
                escolaId,
                username: dados.usuario,
                displayName: dados.nome,
                role: dados.papel,
                passwordHash: hash,
                turmaId: dados.turma ? turmaIdPorNome.get(dados.turma) : null,
              },
            });
            relatorio.criados += 1;
          }
        }
      });
    }

    return relatorio;
  }

  async listar(escolaId: string, filtro: { papel?: string; pagina: number; porPagina: number }) {
    const where = {
      escolaId,
      ...(filtro.papel ? { role: filtro.papel } : {}),
    };
    const [total, usuarios] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { turma: true },
        orderBy: [{ role: "asc" }, { username: "asc" }],
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
      }),
    ]);
    return {
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      usuarios: usuarios.map((u) => ({
        id: u.id,
        usuario: u.username,
        nome: u.displayName,
        papel: u.role,
        turma: u.turma?.nome ?? null,
        serie: u.turma?.serie ?? null,
        criadoEm: u.createdAt,
      })),
    };
  }

  /** Gera senha temporária e devolve UMA vez — não fica em log nem em coluna. */
  async resetarSenha(escolaId: string, usuarioId: string) {
    const usuario = await this.prisma.user.findFirst({
      where: { id: usuarioId, escolaId, NOT: { role: "admin-contrato" } },
    });
    if (!usuario) return null;
    const senhaTemporaria = gerarSenhaTemporaria();
    await this.prisma.user.update({
      where: { id: usuario.id },
      data: { passwordHash: await bcrypt.hash(senhaTemporaria, 10) },
    });
    return { usuario: usuario.username, senhaTemporaria };
  }
}

function gerarSenhaTemporaria(): string {
  // Sem caracteres ambíguos (0/O, 1/l): a senha vai ser ditada em sala de aula.
  const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  for (const b of bytes) s += alfabeto[b % alfabeto.length];
  return s;
}
