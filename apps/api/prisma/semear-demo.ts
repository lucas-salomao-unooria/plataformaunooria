/**
 * Atividade de DEMONSTRAÇÃO, sem chamar o Gemini — porte multi-tenant do
 * `prisma/semear-demo.ts` do projeto origem (escola-demo, prof.demo).
 *
 * Existe para exercitar o fluxo da aula — o relógio da turma, o debate, os posts
 * perdidos — sem esperar a geração de centenas de posts com imagem a cada
 * rodada. O conteúdo é marcado no título; não confunda com atividade real.
 *
 * Uso:  pnpm --filter @edu/api seed:demo            (8 estudantes com perfil do Ato 1)
 *       pnpm --filter @edu/api seed:demo -- 24      (24 estudantes)
 *       pnpm --filter @edu/api seed:demo -- --apagar
 */
import { PrismaClient } from "@prisma/client";
import { clientDoSeed } from "./tenancy-do-seed";
import { ENGINE_CONFIG_DEFAULT, PERFIS, PROPORCOES_DEFAULT } from "../src/comum/insta/defaults";

/* Cliente com a RLS armada na sessão: este seed é de UMA escola do começo ao
   fim, e várias das tabelas que ele escreve (`exp08ef1b_activities`, `exp08ef1b_posts`,
   `exp08ef1b_app_70_perfis_importados`, ...) têm FORCE ROW LEVEL SECURITY. Ver
   `tenancy-do-seed.ts` para por que sessão e não transação. */
let prisma: PrismaClient;
const TITULO = "DEMO — Descobrimento (sem Gemini)";
const ESCOLA_ID = "escola-demo";

const ANTAGONISMO = {
  perguntas_candidatas: [
    {
      pergunta: "O descobrimento do Brasil foi algo planejado ou foi por acaso?",
      // `equilibrio` é objeto, não número: com o shape errado o
      // `antagonismoSchema` recusa tudo em silêncio e a UI cai no rótulo
      // genérico "Lado A" / "Lado B".
      equilibrio: { ok: true, nota: 0.9, aviso: null },
      por_que: "Os dois lados têm documento e defensor.",
    },
  ],
  escolhida: 0,
  equilibrio: { ok: true, nota: 0.9, aviso: null },
  ladoA: {
    label: "Intenção e Planejamento",
    tese: "A viagem tinha rota, ordem do rei e cálculo por trás.",
    argumentos: ["o tratado assinado antes da viagem", "uma frota grande demais para só passar"],
    tom_tipico: "documento, estratégia, perícia de navegação",
  },
  ladoB: {
    label: "Acaso e Navegação",
    tese: "Ventos, correntes e desvio de rota levaram a frota ao litoral.",
    argumentos: ["as correntes do Atlântico Sul", "o relato de Caminha"],
    tom_tipico: "surpresa, a história é mais bagunçada do que parece",
  },
  /** Eixo por eixo, com as quatro justificativas. */
  afinidade: {
    abertura: "B" as const,
    por_que_abertura: "esse lado convida a duvidar da versão pronta e a procurar o que não está no livro",
    por_que_conservacao: "esse lado se apoia no documento oficial e no que sempre foi ensinado",
    autopromocao: "A" as const,
    por_que_autopromocao: "esse lado enfatiza o feito técnico e a perícia de quem navegou",
    por_que_autotranscendencia: "esse lado abre espaço para quem pagou o preço da chegada",
  },
  categorias_neutras_sugeridas: ["memes de escola", "animais", "comida", "esportes"],
  neutros_no_tema_sugeridos: ["cronologia da viagem", "como se sabe isso: fontes"],
  reformulacoes_sugeridas: [],
};

/**
 * Apaga a atividade de demonstração e tudo que pende dela.
 * A ordem importa: `activities` não tem `ON DELETE CASCADE` para `runs` (de
 * propósito), então os dependentes saem primeiro.
 */
async function apagar() {
  const atividades = await prisma.activity.findMany({
    where: { titulo: TITULO, escolaId: ESCOLA_ID },
    select: { id: true },
  });
  if (atividades.length === 0) {
    console.log("nada para apagar.");
    return;
  }

  const ids = atividades.map((atividade) => atividade.id);
  await prisma.$transaction([
    // runs cascateia events, conclusoes, reflexoes, comentarios e dossiers
    prisma.run.deleteMany({ where: { activityId: { in: ids } } }),
    prisma.perfilImportado.deleteMany({ where: { activityId: { in: ids } } }),
    prisma.post.deleteMany({ where: { activityId: { in: ids } } }),
    prisma.author.deleteMany({ where: { activityId: { in: ids } } }),
    prisma.generationJob.deleteMany({ where: { activityId: { in: ids } } }),
    prisma.activity.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`atividade de demonstração apagada (${ids.length}).`);
}

async function semear(qtdEstudantes: number) {
  /* Por MATRÍCULA, não por login: o seed gera docentes com nome de gente, e
     fixar `prof.demo` aqui voltaria a acoplar este script a um login inventado.
     Quem interessa é quem leciona no 8º ano — é a turma do Instanooria. */
  const professor = await prisma.user.findFirst({
    where: {
      role: "professor",
      escolaId: ESCOLA_ID,
      matriculas: { some: { fim: null, turma: { nome: "8A" } } },
    },
    orderBy: { username: "asc" },
  });
  if (!professor) {
    console.error(
      "rode `pnpm --filter @edu/api seed` antes: não há professor na turma 8A.",
    );
    process.exit(1);
  }

  /* A atividade é DA TURMA 8A, como toda atividade criada pelo hub (o `turmaId`
     é obrigatório na criação). Sem turma ela era do formato legado, que vale para
     a escola inteira — e a evidência pedagógica (E14) é por turma: as perguntas
     do fim respondiam 409 e o painel "Habilidades da BNCC" não existia. */
  const turma8A = await prisma.turma.findFirst({
    where: { escolaId: ESCOLA_ID, nome: "8A" },
    select: { id: true },
  });

  await apagar();

  const atividade = await prisma.activity.create({
    data: {
      escolaId: ESCOLA_ID,
      professorId: professor.id,
      turmaId: turma8A?.id ?? null,
      titulo: TITULO,
      disciplina: "História",
      temaGeral: "Brasil colonial",
      recorte: "O descobrimento do Brasil",
      perguntaChave: ANTAGONISMO.perguntas_candidatas[0]!.pergunta,
      perguntaOrigem: "ia",
      antagonismo: ANTAGONISMO,
      categoriasNeutras: ANTAGONISMO.categorias_neutras_sugeridas,
      neutrosNoTema: ANTAGONISMO.neutros_no_tema_sugeridos,
      estiloVisual: "pintura histórica",
      qtdPostsTese: 48,
      proporcoes: PROPORCOES_DEFAULT,
      // Sem isto o feed morre com "sinaisExplicitosParaDestravar undefined": o
      // motor lê a config da atividade em toda curadoria de bloco.
      engineConfig: ENGINE_CONFIG_DEFAULT,
      status: "ativa",
      etapa: "investigacao",
    },
  });

  const autores = await Promise.all(
    (["A", "B", "neutro"] as const).flatMap((lado) =>
      [0, 1, 2].map((indice) =>
        prisma.author.create({
          data: {
            escolaId: ESCOLA_ID,
            activityId: atividade.id,
            handle: `@demo.${lado.toLowerCase()}.${indice + 1}`,
            displayName: `Perfil ${lado} ${indice + 1}`,
            tipo: lado === "neutro" ? "humor" : "pagina_tema",
            lado,
            bio: "perfil de demonstração",
            voz: "voz de demonstração",
            perfilAfim: PERFIS[indice % PERFIS.length],
          },
        }),
      ),
    ),
  );
  const autorDe = (lado: string, i: number) => {
    const doLado = autores.filter((autor) => autor.lado === lado);
    return doLado[i % doLado.length]!.id;
  };

  /** 2 lados × 4 perfis × 3 intensidades × 3 posts + 20 neutros. */
  const dados: {
    escolaId: string;
    activityId: string;
    authorId: string;
    lado: string;
    perfil: string;
    intensidade: number;
    categoria: string;
    caption: string;
    hashtags: string[];
    imageBrief: string;
    likesCount: number;
    timestampLabel: string;
    imageStatus: string;
  }[] = [];

  let n = 0;
  for (const lado of ["A", "B"] as const) {
    const rotulo = lado === "A" ? ANTAGONISMO.ladoA.label : ANTAGONISMO.ladoB.label;
    for (const perfil of PERFIS) {
      for (const intensidade of [1, 2, 3] as const) {
        for (let k = 0; k < 3; k += 1) {
          n += 1;
          dados.push({
            escolaId: ESCOLA_ID,
            activityId: atividade.id,
            authorId: autorDe(lado, n),
            lado,
            perfil,
            intensidade,
            categoria: "tema",
            caption: `DEMO · ${rotulo} · ${perfil} · intensidade ${intensidade} · #${k + 1} — texto de demonstração para testar o fluxo da aula sem gastar geração.`,
            hashtags: ["#demo", "#historiadobrasil"],
            imageBrief: "brief de demonstração",
            likesCount: 400 + n * 7,
            timestampLabel: `há ${1 + (n % 9)} h`,
            // Fallback procedural: sem imagem gerada, o card ainda renderiza.
            imageStatus: "fallback",
          });
        }
      }
    }
  }
  for (const categoria of ["memes de escola", "animais", "comida", "cronologia da viagem"]) {
    for (let k = 0; k < 5; k += 1) {
      n += 1;
      dados.push({
        escolaId: ESCOLA_ID,
        activityId: atividade.id,
        authorId: autorDe("neutro", n),
        lado: "neutro",
        perfil: PERFIS[n % PERFIS.length]!,
        intensidade: 1,
        categoria,
        caption: `DEMO neutro · ${categoria} · #${k + 1}`,
        hashtags: ["#demo"],
        imageBrief: "brief de demonstração",
        likesCount: 700 + n * 5,
        timestampLabel: `há ${1 + (n % 9)} h`,
        imageStatus: "fallback",
      });
    }
  }

  await prisma.post.createMany({ data: dados });
  const posts = await prisma.post.findMany({
    where: { activityId: atividade.id },
    select: { id: true },
  });

  await prisma.postComment.createMany({
    data: posts.flatMap((post) => [
      {
        escolaId: ESCOLA_ID,
        postId: post.id,
        handle: "@comenta.demo",
        texto: "concordo, mas queria ver a fonte disso",
        likesCount: 4,
        ordem: 0,
        timestampLabel: "há 1 h",
      },
      {
        escolaId: ESCOLA_ID,
        postId: post.id,
        handle: "@outro.demo",
        texto: "nunca tinha pensado por esse lado",
        likesCount: 2,
        ordem: 1,
        timestampLabel: "há 2 h",
      },
    ]),
  });

  /** Perfis do Ato 1 em rodízio pelos 4, para a turma nascer dividida. */
  const estudantes = await prisma.user.findMany({
    // Só o 8º ano: a turma 4A do seed pertence à exp04ef1b, não ao Instanooria.
    where: { role: "estudante", escolaId: ESCOLA_ID, turma: { serie: "8EF" } },
    orderBy: { username: "asc" },
    take: qtdEstudantes,
    select: { id: true, username: true },
  });

  for (const [indice, estudante] of estudantes.entries()) {
    const dominante = PERFIS[indice % PERFIS.length]!;
    await prisma.perfilImportado.create({
      data: {
        escolaId: ESCOLA_ID,
        activityId: atividade.id,
        estudanteId: estudante.id,
        escores: Object.fromEntries(
          PERFIS.map((perfil) => [perfil, perfil === dominante ? 0.4 : 0.2]),
        ),
        dominante,
        origem: "jogo",
        medidoEm: new Date(),
      },
    });
  }

  console.log(`atividade ....... ${atividade.id}`);
  console.log(`posts ........... ${posts.length} (imagem em fallback procedural)`);
  console.log(`perfis do Ato 1 . ${estudantes.length} estudantes`);
}

// Sem top-level await: o ts-node compila este arquivo como CJS.
/**
 * Referências curriculares de DEMONSTRAÇÃO do gerador de plano de aula
 * (app-90): um trecho "geral" e um específico de 8EF, curtos, para o
 * `Selection` ter o que oferecer e o smoke visual gerar um plano com o
 * provider mock. Em produção elas vêm do `scripts/importar-referencias-plano.mjs`.
 * Catálogo do contrato (sem escola_id) — por isso fora do `apagar()` da escola.
 */
const REFERENCIAS_DEMO = [
  {
    disciplina: "letramento-digital",
    serie: null,
    nome: "DEMO — Proposta curricular da rede (trecho)",
    ordem: 0,
    texto: [
      "PROPOSTA CURRICULAR — LETRAMENTO DIGITAL (TRECHO DE DEMONSTRAÇÃO)",
      "",
      "Princípios: o componente Letramento Digital forma o estudante para ler, avaliar e produzir",
      "informação em ambientes digitais com autonomia e responsabilidade. Articula-se à BNCC",
      "Computação (eixos Pensamento Computacional, Mundo Digital e Cultura Digital).",
      "",
      "Competências gerais: compreender o funcionamento das redes e algoritmos; avaliar a",
      "confiabilidade de fontes; reconhecer mecanismos de persuasão e desinformação; produzir",
      "conteúdo digital com autoria e ética; proteger dados pessoais.",
      "",
      "Avaliação: processual, com produtos de síntese por bimestre (mural, podcast, checagem",
      "de fatos, campanha) e autoavaliação orientada por rubricas.",
    ].join("\n"),
  },
  {
    disciplina: "letramento-digital",
    serie: "2EF",
    nome: "DEMO — Material didático 2º ano, unidades 1 a 4 (trecho)",
    ordem: 0,
    texto: [
      "MATERIAL DIDÁTICO — 2º ANO — LETRAMENTO DIGITAL (TRECHO DE DEMONSTRAÇÃO)",
      "",
      "Unidade 1 — Mundo real e mundo digital: o que é tecnologia; dispositivos do cotidiano; cuidados básicos.",
      "Produto: mural ilustrado de tecnologias na escola.",
      "",
      "Unidade 2 — Convivência e regras no ambiente digital: respeito online, tempo de tela e jogos educativos.",
      "Produto: combinados de uso da tecnologia em sala.",
      "",
      "Unidade 3 — Criando com ferramentas digitais: desenho digital, registros de áudio e histórias ilustradas.",
      "Produto: livro digital coletivo de histórias da turma.",
      "",
      "Unidade 4 — Comunicação e compartilhamento: mensagens, cooperação e segurança inicial.",
      "Produto: apresentação visual das criações para a comunidade.",
    ].join("\n"),
  },
  {
    disciplina: "letramento-digital",
    serie: "4EF",
    nome: "DEMO — Material didático 4º ano, unidades 1 a 4 (trecho)",
    ordem: 0,
    texto: [
      "MATERIAL DIDÁTICO — 4º ANO — LETRAMENTO DIGITAL (TRECHO DE DEMONSTRAÇÃO)",
      "",
      "Unidade 1 — Navegando e pesquisando na internet: mecanismos de busca, palavras-chave e identificação de fontes.",
      "Produto: guia de pesquisa segura na internet.",
      "",
      "Unidade 2 — Identidade e pegada digital: privacidade, dados pessoais e respeito nas redes.",
      "Produto: cartilha de privacidade infantil.",
      "",
      "Unidade 3 — Produção de mídia digital: textos informativos, apresentações com slides e gravação de áudios.",
      "Produto: mini-podcast educativo em grupo.",
      "",
      "Unidade 4 — Pensamento computacional desplugado: algoritmos, decomposição e resolução de problemas.",
      "Produto: jogo de tabuleiro com comandos de programação desplugada.",
    ].join("\n"),
  },
  {
    disciplina: "letramento-digital",
    serie: "6EF",
    nome: "DEMO — Material didático 6º ano, unidades 1 a 4 (trecho)",
    ordem: 0,
    texto: [
      "MATERIAL DIDÁTICO — 6º ANO — LETRAMENTO DIGITAL (TRECHO DE DEMONSTRAÇÃO)",
      "",
      "Unidade 1 — Informação e desinformação: notícias, boatos digitais e introdução à verificação de fatos.",
      "Produto: mural de checagem de manchetes.",
      "",
      "Unidade 2 — Segurança digital e proteção de senhas: autenticação, phishing e comportamento preventivo.",
      "Produto: cartilha digital de cibersegurança para a escola.",
      "",
      "Unidade 3 — Redes sociais e cultura digital: comunicação em rede, cyberbullying e empatia online.",
      "Produto: campanha de conscientização sobre convivência digital.",
      "",
      "Unidade 4 — Criação e autoria multimídia: direitos autorais, Creative Commons e edição básica de áudio e vídeo.",
      "Produto: vídeo explicativo ou podcast temático.",
    ].join("\n"),
  },
  {
    disciplina: "letramento-digital",
    serie: "8EF",
    nome: "DEMO — Material didático 8º ano, unidades 1 a 4 (trecho)",
    ordem: 0,
    texto: [
      "MATERIAL DIDÁTICO — 8º ANO — LETRAMENTO DIGITAL (TRECHO DE DEMONSTRAÇÃO)",
      "",
      "Unidade 1 — O feed decide por mim? Como algoritmos de recomendação selecionam o que",
      "vemos; bolhas e câmaras de eco; experimento com dois perfis. Produto: diário do feed.",
      "",
      "Unidade 2 — Em quais fontes eu confio? Critérios de credibilidade; verificação lateral;",
      "checagem de fatos. Produto: checagem coletiva de três notícias virais.",
      "",
      "Unidade 3 — Quem lucra com a minha atenção? Economia da atenção, dados pessoais e",
      "LGPD para adolescentes. Produto: campanha de conscientização em vídeo curto.",
      "",
      "Unidade 4 — Eu, autor na rede. Produção responsável, licenças, cultura do remix.",
      "Produto: podcast em grupo sobre um tema da comunidade escolar.",
    ].join("\n"),
  },
  {
    disciplina: "letramento-digital",
    serie: "2EM",
    nome: "DEMO — Material didático 2ª série EM, unidades 1 a 4 (trecho)",
    ordem: 0,
    texto: [
      "MATERIAL DIDÁTICO — 2ª SÉRIE EM — LETRAMENTO DIGITAL (TRECHO DE DEMONSTRAÇÃO)",
      "",
      "Unidade 1 — Inteligência Artificial, dados e sociedade: funcionamento dos modelos de linguagem, vieses e impactos no mercado de trabalho.",
      "Produto: ensaio crítico e debate estruturado sobre IA.",
      "",
      "Unidade 2 — Cidadania digital crítica e soberania de dados: vigilância de dados, LGPD aprofundada e direitos digitais.",
      "Produto: infográfico interativo sobre privacidade e dados.",
      "",
      "Unidade 3 — Algoritmos, polarização e desinformação avançada: deepfakes, microdirecionamento e impacto nas democracias.",
      "Produto: relatório de auditoria e checagem de conteúdos hiper-realistas.",
      "",
      "Unidade 4 — Projetos de intervenção social com tecnologia: ideação e prototipagem de soluções digitais para a comunidade escolar.",
      "Produto: pitch e protótipo funcional de projeto comunitário.",
    ].join("\n"),
  },
];

async function semearReferenciasDoPlano() {
  for (const ref of REFERENCIAS_DEMO) {
    const existente = await prisma.planoReferencia.findFirst({
      where: { disciplina: ref.disciplina, serie: ref.serie, nome: ref.nome },
      select: { id: true },
    });
    if (existente) {
      await prisma.planoReferencia.update({ where: { id: existente.id }, data: { texto: ref.texto, ordem: ref.ordem } });
    } else {
      await prisma.planoReferencia.create({ data: ref });
    }
  }
  console.info(`referências de demonstração do plano de aula: ${REFERENCIAS_DEMO.length}`);
}

async function principal() {
  prisma = await clientDoSeed(ESCOLA_ID);
  const args = process.argv.slice(2);
  if (args.includes("--apagar")) {
    await apagar();
    await prisma.planoReferencia.deleteMany({ where: { nome: { startsWith: "DEMO — " } } });
  } else {
    await semear(Number(args.find((a) => /^\d+$/.test(a)) ?? 8));
    await semearReferenciasDoPlano();
  }
  await prisma.$disconnect();
}

void principal();
