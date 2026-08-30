import { randomUUID } from "node:crypto";
import { PrismaService } from "../src/prisma/prisma.service";
import { ENGINE_CONFIG_DEFAULT, PROPORCOES_DEFAULT } from "../src/comum/insta/defaults";
import { estadoInicial } from "../src/motor/estado";

/**
 * Monta uma atividade completa no Postgres de teste (sem chamar o Gemini) —
 * porte multi-tenant do `tests/helpers/fixture-db.ts` do origem.
 *
 * Diferença deliberada: tudo nasce numa ESCOLA DE TESTE própria e a limpeza é
 * escopada a ela — o original apagava o banco inteiro, o que aqui destruiria o
 * seed de desenvolvimento (escola-demo) a cada `pnpm test`.
 */
/**
 * Cada SUÍTE usa a própria escola: o Jest roda suítes em workers paralelos, e
 * uma limpeza compartilhada apagaria os dados da outra no meio do teste.
 */
export function contextoDeTeste(escolaId: string) {
  return {
    escolaId,
    criar: (opcoes: { posts?: number } = {}) => criarAtividadeDeTeste(escolaId, opcoes),
    limpar: () => limparBancoDeTeste(escolaId),
  };
}

export const prisma = new PrismaService({
  datasources: {
    db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria" },
  },
});

export async function criarAtividadeDeTeste(escolaId: string, opcoes: { posts?: number } = {}) {
  const porGrupo = opcoes.posts ?? 40;

  await prisma.escola.upsert({
    where: { id: escolaId },
    update: {},
    create: { id: escolaId, nome: `Escola de teste (${escolaId})` },
  });

  const professor = await prisma.user.create({
    data: {
      escolaId,
      role: "professor",
      username: `prof.${randomUUID().slice(0, 8)}`,
      displayName: "Prof. Teste",
      passwordHash: "x",
    },
  });

  const aluno = await prisma.user.create({
    data: {
      escolaId,
      role: "estudante",
      username: `aluno.${randomUUID().slice(0, 8)}`,
      displayName: "Aluno Teste",
      passwordHash: "x",
    },
  });

  const atividade = await prisma.activity.create({
    data: {
      escolaId,
      professorId: professor.id,
      titulo: "Atividade de teste",
      disciplina: "História",
      temaGeral: "Revolução Francesa",
      recorte: "Revolução Francesa",
      perguntaChave: "A Revolução Francesa foi conquista de direitos ou banho de sangue?",
      antagonismo: {
        equilibrio: { ok: true, nota: 0.9, aviso: null },
        /**
         * Afinidade por eixo com as QUATRO justificativas: sem elas a
         * explicabilidade do relatório não tem o que mostrar para dois perfis.
         */
        afinidade: {
          abertura: "A",
          por_que_abertura: "esse lado convida a duvidar da versão pronta",
          por_que_conservacao: "esse lado se apoia no que sempre foi ensinado",
          autopromocao: "A",
          por_que_autopromocao: "esse lado enfatiza o feito e a estratégia",
          por_que_autotranscendencia: "esse lado olha para quem pagou a conta",
        },
        ladoA: { label: "Conquista", tese: "tese A", argumentos: ["a1", "a2"], tom_tipico: "celebração" },
        ladoB: { label: "Terror", tese: "tese B", argumentos: ["b1", "b2"], tom_tipico: "denúncia" },
        categorias_neutras_sugeridas: ["animais", "memes de escola", "esportes"],
        reformulacoes_sugeridas: [],
      },
      categoriasNeutras: ["animais", "memes de escola", "esportes"],
      estiloVisual: "pintura histórica",
      qtdPostsTese: porGrupo * 3,
      proporcoes: PROPORCOES_DEFAULT,
      engineConfig: ENGINE_CONFIG_DEFAULT,
      status: "ativa",
    },
  });

  const autores = await Promise.all(
    (["A", "B", "neutro"] as const).flatMap((lado) =>
      [1, 2, 3].map((indice) =>
        prisma.author.create({
          data: {
            escolaId,
            activityId: atividade.id,
            handle: `@perfil.${lado.toLowerCase()}.${indice}`,
            displayName: `Perfil ${lado} ${indice}`,
            tipo: lado === "neutro" ? "humor" : "pagina_tema",
            lado,
            bio: "bio",
            voz: "voz",
          },
        }),
      ),
    ),
  );

  const autorDe = (lado: string, indice: number) => {
    const doLado = autores.filter((autor) => autor.lado === lado);
    return doLado[indice % doLado.length]!.id;
  };

  const categoriasNeutras = ["animais", "memes de escola", "esportes"];
  /** Perfis de Schwartz: o fixture cobre os 4 em rodízio. */
  const perfis = ["abertura", "autotranscendencia", "autopromocao", "conservacao"] as const;
  const dados: {
    id: string;
    escolaId: string;
    activityId: string;
    authorId: string;
    lado: string;
    perfil: string;
    intensidade: number;
    categoria: string;
    caption: string;
    imageBrief: string;
    likesCount: number;
    timestampLabel: string;
    imageStatus: string;
  }[] = [];

  let contador = 0;
  for (const lado of ["A", "B"] as const) {
    for (const intensidade of [1, 2, 3] as const) {
      for (let i = 0; i < porGrupo; i += 1) {
        contador += 1;
        dados.push({
          id: randomUUID(),
          escolaId,
          activityId: atividade.id,
          authorId: autorDe(lado, i),
          lado,
          perfil: perfis[i % perfis.length]!,
          intensidade,
          categoria: "tema",
          caption: `post ${lado} int${intensidade} #${i}`,
          imageBrief: "brief",
          likesCount: 500 + contador,
          timestampLabel: "há 2 h",
          imageStatus: i % 5 === 0 ? "fallback" : "ok",
        });
      }
    }
  }
  for (const categoria of categoriasNeutras) {
    for (let i = 0; i < porGrupo; i += 1) {
      contador += 1;
      dados.push({
        id: randomUUID(),
        escolaId,
        activityId: atividade.id,
        authorId: autorDe("neutro", i),
        lado: "neutro",
        perfil: perfis[i % perfis.length]!,
        intensidade: 1,
        categoria,
        caption: `neutro ${categoria} #${i}`,
        imageBrief: "brief",
        likesCount: 800 + contador,
        timestampLabel: "há 5 h",
        imageStatus: "ok",
      });
    }
  }

  await prisma.post.createMany({
    data: dados.map((post) => ({
      ...post,
      hashtags: ["#teste"],
      imageUrl: post.imageStatus === "ok" ? `/generated/${atividade.id}/${post.id}.webp` : null,
    })),
  });

  await prisma.postComment.createMany({
    data: dados.flatMap((post) =>
      [0, 1, 2].map((ordem) => ({
        escolaId,
        postId: post.id,
        handle: `@comenta.${ordem}`,
        texto: `comentário ${ordem}`,
        likesCount: 10 * (3 - ordem),
        ordem,
        timestampLabel: "há 1 h",
      })),
    ),
  });

  const run = await prisma.run.create({
    data: {
      escolaId,
      activityId: atividade.id,
      estudanteId: aluno.id,
      fase: "onboarding",
      // Sorteio simples; o balanceamento na turma é do resolverLargada.
      ladoInicial: Math.random() < 0.5 ? "A" : "B",
      engineState: estadoInicial() as unknown as object,
    },
  });

  return { professor, aluno, atividade, run, autores };
}

/** Limpa SÓ a escola de teste — o resto do banco (seed de dev) fica intacto. */
export async function limparBancoDeTeste(escolaId: string) {
  const where = { escolaId };
  await prisma.event.deleteMany({ where });
  await prisma.conclusao.deleteMany({ where });
  await prisma.reflexao.deleteMany({ where });
  await prisma.comentarioDaSessao.deleteMany({ where });
  await prisma.perfilImportado.deleteMany({ where });
  await prisma.dossier.deleteMany({ where });
  await prisma.studentPost.deleteMany({ where });
  await prisma.run.deleteMany({ where });
  await prisma.postComment.deleteMany({ where });
  await prisma.post.deleteMany({ where });
  await prisma.generationJob.deleteMany({ where });
  await prisma.author.deleteMany({ where });
  await prisma.activity.deleteMany({ where });
  await prisma.user.deleteMany({ where });
}
