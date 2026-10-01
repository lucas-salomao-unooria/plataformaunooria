import { PrismaClient } from "@prisma/client";
import { comEscola } from "./tenancy-do-seed";
import { criarFabricaDePessoas, type PessoaDemo } from "./pessoas-demo";
import { semearCatalogo, semearLiberacoes } from "./catalogo-e-liberacoes";
import bcrypt from "bcryptjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Seed de desenvolvimento — uma rede pequena, mas com a FORMA de uma rede real:
 * duas unidades sob uma diretoria, o ciclo completo do 1º ano EF à 3ª série EM
 * com duas turmas por série, um docente por turma, e pessoas com nome, login e
 * CPF de verdade.
 *
 * Por que gente de verdade e não `estudante01`: a plataforma valida CPF
 * (`cpfEhValido`, ADR-33), busca por nome e por documento, e ordena listas
 * alfabeticamente. Uma base de `Estudante 01..40` não exercita nada disso — e
 * esconde exatamente os defeitos de tela que aparecem quando o nome é longo,
 * tem acento, ou dois irmãos dividem o sobrenome.
 *
 * DETERMINÍSTICO: a mesma `SEMENTE` produz as mesmas pessoas, na mesma ordem.
 * Rodar de novo reencontra a criança que estava aberta numa aba.
 *
 * Ao final escreve `credenciais-demo.csv` na RAIZ do repositório (fora do git):
 * é a lista de quem entrar. Os walkthroughs leem esse arquivo em vez de fixar
 * login no código.
 *
 * Usuários reais NÃO nascem aqui: entram por importação
 * (`POST /rostering/importar`, papel `gestor_escola`/`gestor_contrato`).
 *
 * `SEED_MINIMO=1` cria só a escola, um `gestor_escola` e um `gestor_contrato`
 * — o ponto de partida para percorrer a plataforma do zero, sem as contas de
 * demonstração
 * poluindo o diagnóstico de contas de assento.
 */
const prisma = new PrismaClient();

/**
 * A senha das contas de demonstração vem do AMBIENTE, nunca do código.
 * O default de DEV vive nos dois compose; no host,
 * `SEED_SENHA=... pnpm --filter @edu/api seed`.
 *
 * Sem env o seed FALHA, e falha alto: constante no fonte significa que este
 * script, rodado por engano contra o banco de um contrato, criaria mil contas
 * com uma senha publicada no README — inclusive o `gestor_contrato`, o único
 * papel que atravessa escolas.
 */
const SENHA_PADRAO = senhaDoSeed();

function senhaDoSeed(): string {
  const senha = process.env.SEED_SENHA?.trim();
  if (!senha) {
    throw new Error(
      "SEED_SENHA não definida — o seed não inventa senha. " +
        "No compose ela já vem; no host: SEED_SENHA=<senha> pnpm --filter @edu/api seed",
    );
  }
  if (senha.length < 8) throw new Error("SEED_SENHA precisa de ao menos 8 caracteres");
  return senha;
}

/** Trocar isto gera uma rede inteira nova. Não troque sem querer. */
const SEMENTE = 20260901;

const ANO_LETIVO = 2026;
const TITULO_PERIODO = `Ano letivo ${ANO_LETIVO}`;

/** Do 1º ano EF à 3ª série EM — o ciclo que o produto atende. */
const SERIES = [
  "1EF", "2EF", "3EF", "4EF", "5EF", "6EF", "7EF", "8EF", "9EF",
  "1EM", "2EM", "3EM",
] as const;
const TURMAS_POR_SERIE = ["A", "B"] as const;
const ESTUDANTES_POR_TURMA = 40;
/** Papéis que não nascem de turma: 5 de cada, como pedido. */
const GESTORES = 5;
const ADMINS_CONTRATO = 5;
/** Os dois papéis que nasceram com a ADR-80. Dois de cada basta: eles não têm
 *  turma nem lotação, e o que a demonstração precisa provar é que ENTRAM e que
 *  o escopo deles vem do lugar certo. */
const GESTORES_REGIONAIS = 2;
const ADMINS_UNOORIA = 2;

const ESCOLA_ID = "escola-demo";
const ESCOLA_NOME = "EE Professora Maria Aparecida Nogueira";
/** Segunda unidade: é ela que torna visível o docente lotado em DUAS. */
const ESCOLA_2_ID = "escola-demo-2";
const ESCOLA_2_NOME = "EE Coronel Firmino Rodrigues";
/** A diretoria que agrupa as duas — o nível entre a escola e o contrato. */
const REGIONAL_ID = "de-demo";
const REGIONAL_NOME = "DE Campinas Leste";
/**
 * A regional PADRÃO (ADR-79): a linha que a rede sem divisão administrativa usa,
 * e o destino de quem chega sem regional declarada.
 *
 * A migração já a cria — mas só quando a rede está vazia ou tem escola órfã.
 * Garantida aqui também, o banco de desenvolvimento converge para o mesmo
 * estado tenha a migração rodado antes ou depois de já existir a `de-demo`.
 */
const REGIONAL_PADRAO_ID = "rede";
const REGIONAL_PADRAO_NOME = "Rede";
/** Turma da segunda unidade (ver comentário na seção dela). */
const TURMA_ESCOLA_2 = { nome: "5A", serie: "5EF", turno: "tarde" };

const MINIMO = process.env.SEED_MINIMO === "1";

const ARQUIVO_CREDENCIAIS = resolve(__dirname, "../../../credenciais-demo.csv");

interface LinhaDeCredencial {
  login: string;
  nome: string;
  papel: string;
  escola: string;
  turma: string;
  serie: string;
  cpf: string;
}
const credenciais: LinhaDeCredencial[] = [];

/**
 * Executa em lotes com paralelismo limitado. Mil pessoas × (upsert + lotação +
 * matrícula) em série são ~3 mil idas ao banco: no host isso são segundos, mas
 * contra o Cloud SQL por túnel IAP (~60ms de ida e volta) vira minutos. O teto
 * é baixo de propósito — o pool do Prisma é pequeno, e estourá-lo troca a espera
 * de rede por espera de conexão.
 */
async function emLotes<T>(itens: readonly T[], tamanho: number, fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(fn));
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const fabrica = criarFabricaDePessoas(SEMENTE);

  /* A padrão entra primeiro de todas: é ela que o trigger usa para adotar
     qualquer escola que chegue sem regional, e o `SEED_MINIMO` também depende
     de haver uma regional na rede. Só se não houver outra marcada — a marca é
     única no banco, e insistir daria erro de índice num seed reexecutado. */
  if ((await prisma.escola.count({ where: { regionalPadrao: true } })) === 0) {
    await prisma.escola.upsert({
      where: { id: REGIONAL_PADRAO_ID },
      update: { tipo: "regional", regionalPadrao: true },
      create: {
        id: REGIONAL_PADRAO_ID,
        nome: REGIONAL_PADRAO_NOME,
        tipo: "regional",
        regionalPadrao: true,
      },
    });
  }

  /* A diretoria entra ANTES das unidades: ela é o pai, e o trigger do banco
     recusa `pai_id` apontando para escola. */
  await prisma.escola.upsert({
    where: { id: REGIONAL_ID },
    update: { nome: REGIONAL_NOME, tipo: "regional", uf: "SP" },
    create: { id: REGIONAL_ID, nome: REGIONAL_NOME, tipo: "regional", uf: "SP" },
  });

  const dadosEscola1 = {
    nome: ESCOLA_NOME,
    municipio: "Campinas",
    uf: "SP",
    codigoInep: "35000101",
    paiId: REGIONAL_ID,
  };
  await prisma.escola.upsert({
    where: { id: ESCOLA_ID },
    update: dadosEscola1,
    create: { id: ESCOLA_ID, ...dadosEscola1 },
  });

  const dadosEscola2 = {
    nome: ESCOLA_2_NOME,
    municipio: "Valinhos",
    uf: "SP",
    codigoInep: "35000202",
    paiId: REGIONAL_ID,
  };
  await prisma.escola.upsert({
    where: { id: ESCOLA_2_ID },
    update: dadosEscola2,
    create: { id: ESCOLA_2_ID, ...dadosEscola2 },
  });

  // Toda turma vive dentro de um ano letivo — é o que faz "8A de 2026" e "8A de
  // 2027" serem turmas diferentes, e o histórico sobreviver à virada do ano.
  const periodo = await prisma.periodoLetivo.upsert({
    where: { tipo_titulo: { tipo: "ano_letivo", titulo: TITULO_PERIODO } },
    update: {},
    create: {
      tipo: "ano_letivo",
      titulo: TITULO_PERIODO,
      ano: ANO_LETIVO,
      inicio: new Date(Date.UTC(ANO_LETIVO, 0, 1)),
      fim: new Date(Date.UTC(ANO_LETIVO, 11, 31)),
    },
  });

  const upsertTurma = (nome: string, serie: string, turno = "manha", escolaId = ESCOLA_ID) =>
    prisma.turma.upsert({
      where: {
        escolaId_periodoLetivoId_nome: { escolaId, periodoLetivoId: periodo.id, nome },
      },
      update: { serie, turno },
      create: { escolaId, periodoLetivoId: periodo.id, nome, serie, turno },
    });

  /**
   * Lotação: o vínculo com a ESCOLA. Professor e gestor acumulam; estudante tem
   * uma só. `users.escola_id` é o cache da principal.
   */
  const lotar = (escolaId: string, usuarioId: string, papel: string, principal: boolean) =>
    prisma.lotacao.upsert({
      where: { escolaId_usuarioId_papel: { escolaId, usuarioId, papel } },
      update: { fim: null, principal },
      create: { escolaId, usuarioId, papel, principal, inicio: periodo.inicio },
    });

  /* `matriculas` tem FORCE RLS: o upsert precisa da escola no contexto, senão
     o banco recusa. Local passava porque a DATABASE_URL de dev é do `postgres`
     (superusuário ignora RLS); em produção, conectando como `app`, não passa. */
  const matricular = (
    turmaId: string,
    usuarioId: string,
    papel: "estudante" | "professor",
    escolaId = ESCOLA_ID,
  ) =>
    comEscola(prisma, escolaId, (tx) =>
      tx.matricula.upsert({
        where: {
          escolaId_turmaId_usuarioId_papel: { escolaId, turmaId, usuarioId, papel },
        },
        update: { fim: null },
        create: {
          escolaId,
          turmaId,
          usuarioId,
          papel,
          principal: papel === "estudante",
          inicio: periodo.inicio,
        },
      }),
    );

  /**
   * Uma pessoa. O CPF entra em TODAS as contas — é a identidade imutável da
   * rede (ADR-33), e é ele que faz a transferência entre unidades reconhecer a
   * mesma criança em vez de criar uma segunda.
   */
  const upsertPessoa = async (
    pessoa: PessoaDemo,
    role: string,
    extras: { escolaId?: string; turmaId?: string; semCpf?: boolean } = {},
  ) => {
    const escolaId = extras.escolaId ?? ESCOLA_ID;
    const dados = {
      displayName: pessoa.nome,
      role,
      passwordHash,
      cpf: extras.semCpf ? null : pessoa.cpf,
      turmaId: extras.turmaId,
      ativo: true,
    };
    return prisma.user.upsert({
      where: { escolaId_username: { escolaId, username: pessoa.username } },
      update: dados,
      create: {
        username: pessoa.username,
        ...dados,
        // Conta de demonstração entra direto: senha provisória é o caminho de
        // quem NASCE de importação, e prender o seed nela pararia os
        // walkthroughs na tela de troca de senha.
        senhaProvisoria: false,
        escolaId,
      },
    });
  };

  const anotar = (
    pessoa: PessoaDemo,
    papel: string,
    escola: string,
    turma = "",
    serie = "",
    cpf = pessoa.cpf,
  ) => credenciais.push({ login: pessoa.username, nome: pessoa.nome, papel, escola, turma, serie, cpf });

  /**
   * Os perfis de CONTRATO (`gestor_contrato`, `admin`) são os únicos SEM
   * escola — o upsert por
   * `(escolaId, username)` não o cobre com `escolaId` nulo, então procura-se
   * pelo login.
   */
  /**
   * Os perfis SEM escola: os dois de contrato (que enxergam a rede inteira) e o
   * regional (cuja escola ativa sai da regional, não de lotação). Não passam
   * pelo importador — `PAPEIS_IMPORTAVEIS` sempre os excluiu, porque não cabem
   * numa planilha da escola.
   */
  const upsertSemEscola = async (
    pessoa: PessoaDemo,
    papel: "gestor_contrato" | "admin" | "gestor_regional",
    onde: string,
    regionalId?: string,
  ) => {
    const existente = await prisma.user.findFirst({
      where: { username: pessoa.username, role: papel },
    });
    const dados = {
      displayName: pessoa.nome,
      passwordHash,
      cpf: pessoa.cpf,
      role: papel,
      regionalId: regionalId ?? null,
      senhaProvisoria: false,
    };
    if (existente) await prisma.user.update({ where: { id: existente.id }, data: dados });
    else await prisma.user.create({ data: { username: pessoa.username, ...dados } });
    anotar(pessoa, papel, onde);
  };

  if (MINIMO) {
    const gestor = fabrica.pessoa("gestor.");
    const criado = await upsertPessoa(gestor, "gestor_escola");
    await lotar(ESCOLA_ID, criado.id, "gestor_escola", true);
    anotar(gestor, "gestor_escola", ESCOLA_NOME);
    await upsertSemEscola(fabrica.pessoa("admin."), "gestor_contrato", "— (atravessa escolas)");
    /* O catálogo de experiências não depende de turma nem de gente: ele entra
       até no seed mínimo, senão a primeira turma criada pelo gestor abriria uma
       sala sem nada para liberar. */
    await semearCatalogo(prisma);
    escreverCredenciais();
    console.log(
      `Seed MÍNIMO: "${ESCOLA_NOME}", período "${periodo.titulo}", 1 gestor_escola ` +
        `e 1 gestor_contrato. Nenhuma turma, nenhum estudante — as pessoas entram ` +
        `por /admin/importar. Credenciais em ${ARQUIVO_CREDENCIAIS}`,
    );
    return;
  }

  // ---------------------------------------------------------------- turmas
  /**
   * Nome da turma: `8A` no fundamental, `2EM-A` no médio. O sufixo do médio não
   * é enfeite — `UNIQUE (escola_id, periodo_letivo_id, nome)` faria a 2ª série
   * do EM colidir com o 2º ano do EF se as duas se chamassem `2A`.
   */
  const nomeDaTurma = (serie: string, letra: string) =>
    serie.endsWith("EM") ? `${serie[0]}EM-${letra}` : `${serie[0]}${letra}`;

  const turmas: { nome: string; serie: string; id: string }[] = [];
  for (const serie of SERIES) {
    for (const letra of TURMAS_POR_SERIE) {
      const nome = nomeDaTurma(serie, letra);
      const turma = await upsertTurma(nome, serie);
      turmas.push({ nome, serie, id: turma.id });
    }
  }

  // ------------------------------------------------------------ professores
  // Um docente por turma — é o que faz "as turmas do professor" (a matrícula,
  // não a escola) ser um recorte de verdade em vez de "tudo".
  const professores: { pessoa: PessoaDemo; id: string; turma: (typeof turmas)[number] }[] = [];
  for (const turma of turmas) {
    const pessoa = fabrica.pessoa("prof.");
    const criado = await upsertPessoa(pessoa, "professor");
    await lotar(ESCOLA_ID, criado.id, "professor", true);
    await matricular(turma.id, criado.id, "professor");
    professores.push({ pessoa, id: criado.id, turma });
    anotar(pessoa, "professor", ESCOLA_NOME, turma.nome, turma.serie);
  }

  // -------------------------------------------------------------- estudantes
  for (const turma of turmas) {
    const alunosDaTurma = Array.from({ length: ESTUDANTES_POR_TURMA }, () => fabrica.pessoa());
    await emLotes(alunosDaTurma, 20, async (pessoa) => {
      const criado = await upsertPessoa(pessoa, "estudante", { turmaId: turma.id });
      await lotar(ESCOLA_ID, criado.id, "estudante", true);
      await matricular(turma.id, criado.id, "estudante");
    });
    for (const pessoa of alunosDaTurma) {
      anotar(pessoa, "estudante", ESCOLA_NOME, turma.nome, turma.serie);
    }
    console.log(`  ${turma.nome} (${turma.serie}): ${ESTUDANTES_POR_TURMA} estudantes`);
  }

  // ----------------------------------------------------------------- gestão
  // O PRIMEIRO gestor é a supervisora de diretoria: lotada nas DUAS unidades.
  // Não é papel novo — é o que a ADR-34 decidiu, e é o que faz aparecer o
  // seletor de escola no cabeçalho e o item "Minhas escolas".
  // São CINCO no total, não cinco mais um: o gestor da segunda unidade sai
  // desta mesma conta (o índice 1), senão a rede teria seis.
  for (let i = 0; i < GESTORES; i += 1) {
    const pessoa = fabrica.pessoa("gestor.");
    const daSegunda = i === 1;
    const criado = await upsertPessoa(pessoa, "gestor_escola", {
      escolaId: daSegunda ? ESCOLA_2_ID : ESCOLA_ID,
    });
    if (i === 0) {
      await lotar(ESCOLA_ID, criado.id, "gestor_escola", true);
      await lotar(ESCOLA_2_ID, criado.id, "gestor_escola", false);
      anotar(pessoa, "gestor_escola (supervisora, 2 unidades)", `${ESCOLA_NOME} + ${ESCOLA_2_NOME}`);
    } else if (daSegunda) {
      await lotar(ESCOLA_2_ID, criado.id, "gestor_escola", true);
      anotar(pessoa, "gestor_escola", ESCOLA_2_NOME);
    } else {
      await lotar(ESCOLA_ID, criado.id, "gestor_escola", true);
      anotar(pessoa, "gestor_escola", ESCOLA_NOME);
    }
  }

  /**
   * SEGUNDA UNIDADE. Existe para a rede ficar visível sem ninguém montar nada:
   * o docente da 5A é o MESMO da primeira turma da lista, lotado nas duas — é
   * disso que sai o seletor de escola no cabeçalho dele e a prova de que a
   * lista de turmas muda com a escola ativa.
   */
  const turma5A = await upsertTurma(
    TURMA_ESCOLA_2.nome,
    TURMA_ESCOLA_2.serie,
    TURMA_ESCOLA_2.turno,
    ESCOLA_2_ID,
  );
  const docenteDasDuas = professores[0]!;
  await lotar(ESCOLA_2_ID, docenteDasDuas.id, "professor", false);
  await matricular(turma5A.id, docenteDasDuas.id, "professor", ESCOLA_2_ID);
  /* Atualiza a linha que já existe em vez de acrescentar outra: o mesmo login
     duas vezes no CSV faria quem procura "o professor de 1A" achar duas
     respostas e escolher pela ordem. */
  const linhaDoDocente = credenciais.find((c) => c.login === docenteDasDuas.pessoa.username)!;
  linhaDoDocente.papel = "professor (2 unidades)";
  linhaDoDocente.escola = `${ESCOLA_NOME} + ${ESCOLA_2_NOME}`;
  linhaDoDocente.turma = `${docenteDasDuas.turma.nome} + ${TURMA_ESCOLA_2.nome}`;
  linhaDoDocente.serie = `${docenteDasDuas.turma.serie} + ${TURMA_ESCOLA_2.serie}`;

  const turmaDaSegunda = Array.from({ length: ESTUDANTES_POR_TURMA }, () => fabrica.pessoa());
  await emLotes(turmaDaSegunda, 20, async (pessoa) => {
    const criado = await upsertPessoa(pessoa, "estudante", {
      escolaId: ESCOLA_2_ID,
      turmaId: turma5A.id,
    });
    await lotar(ESCOLA_2_ID, criado.id, "estudante", true);
    await matricular(turma5A.id, criado.id, "estudante", ESCOLA_2_ID);
  });
  for (const pessoa of turmaDaSegunda) {
    anotar(pessoa, "estudante", ESCOLA_2_NOME, TURMA_ESCOLA_2.nome, TURMA_ESCOLA_2.serie);
  }

  // ------------------------------------------- os papéis sem escola própria
  // Nível de produto: vê a análise entre escolas e turmas; não alcança as telas
  // do professor nem a do estudante.
  for (let i = 0; i < ADMINS_CONTRATO; i += 1) {
    await upsertSemEscola(fabrica.pessoa("admin."), "gestor_contrato", "— (atravessa escolas)");
  }

  /* O GESTOR REGIONAL (ADR-80): cobre as escolas da `de-demo` SEM lotação em
     nenhuma delas. É a conta que torna visível a diferença que o papel existe
     para ter — ele entra e o seletor do cabeçalho já lhe oferece as duas
     unidades da diretoria, sem ninguém o ter lotado. */
  for (let i = 0; i < GESTORES_REGIONAIS; i += 1) {
    await upsertSemEscola(
      fabrica.pessoa("regional."),
      "gestor_regional",
      `${REGIONAL_NOME} (${ESCOLA_NOME} + ${ESCOLA_2_NOME})`,
      REGIONAL_ID,
    );
  }

  /* A conta da UNOORIA. Mesmas capacidades de `gestor_contrato` — o que a
     distingue é de quem ela é, não o que pode. Existe no seed porque um papel
     sem conta de demonstração é um papel que ninguém percorre, e a suíte e2e
     não teria com que provar que ele entra. */
  for (let i = 0; i < ADMINS_UNOORIA; i += 1) {
    await upsertSemEscola(fabrica.pessoa("unooria."), "admin", "— (equipe Unooria)");
  }

  // ------------------------------------------------- catálogo e liberações
  const experiencias = await semearCatalogo(prisma);
  const liberadas = await semearLiberacoes(
    prisma,
    ESCOLA_ID,
    new Map(turmas.map((t) => [t.nome, t.id])),
    new Map(professores.map((p) => [p.turma.nome, p.id])),
  );

  /**
   * Professor em TODAS as turmas de `ESCOLA_NOME`, de propósito — é a conta
   * que serve para exercitar telas que listam/filtram por turma sem precisar
   * logar com N professores diferentes. Nasce por ÚLTIMO entre as pessoas do
   * seed: qualquer chamada anterior a `fabrica.pessoa()` consome o próximo
   * nome da sequência determinística, e inserir esta no meio deslocaria o
   * nome/CPF de todo mundo gerado depois dela num reseed.
   */
  const docenteDeTodas = fabrica.pessoa("prof.");
  const criadoDocenteDeTodas = await upsertPessoa(docenteDeTodas, "professor");
  await lotar(ESCOLA_ID, criadoDocenteDeTodas.id, "professor", true);
  for (const turma of turmas) {
    await matricular(turma.id, criadoDocenteDeTodas.id, "professor");
  }
  anotar(
    docenteDeTodas,
    `professor (${turmas.length} turmas)`,
    ESCOLA_NOME,
    turmas.map((t) => t.nome).join(" + "),
    turmas.map((t) => t.serie).join(" + "),
  );

  escreverCredenciais();

  const total = await prisma.user.count();
  const estudantes = turmas.length * ESTUDANTES_POR_TURMA + ESTUDANTES_POR_TURMA;
  console.log(
    `\nSeed ok — ${REGIONAL_NOME} com 2 unidades:\n` +
      `  ${ESCOLA_NOME}: ${turmas.length} turmas (1EF→3EM, 2 por série), ` +
      `${turmas.length * ESTUDANTES_POR_TURMA} estudantes, ${professores.length} professores\n` +
      `  ${ESCOLA_2_NOME}: turma ${TURMA_ESCOLA_2.nome}, ${ESTUDANTES_POR_TURMA} estudantes\n` +
      `  ${GESTORES} gestores (o 1º nas duas unidades), ${ADMINS_CONTRATO} gestor_contrato\n` +
      `  ${experiencias} experiências no catálogo · ${liberadas} missões liberadas ` +
      `(só nas turmas "A"; as "B" ficam fechadas para o professor exercitar liberar)\n` +
      `  ${estudantes} estudantes no total · ${total} contas na base (senha: a de SEED_SENHA)\n` +
      `  credenciais: ${ARQUIVO_CREDENCIAIS}`,
  );
}

/**
 * O arquivo de credenciais fica FORA do git (`.gitignore`): é uma lista de
 * logins com CPF ao lado, e mesmo sendo gente inventada não é coisa que se
 * versiona. Ele é o índice de quem entrar — e é o que os walkthroughs leem, em
 * vez de fixar login no código e quebrar a cada mudança do seed.
 */
function escreverCredenciais() {
  const escapar = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const linhas = [
    "login,nome,papel,escola,turma,serie,cpf,senha",
    ...credenciais.map((c) =>
      [c.login, c.nome, c.papel, c.escola, c.turma, c.serie, c.cpf, SENHA_PADRAO]
        .map(escapar)
        .join(","),
    ),
  ];
  mkdirSync(dirname(ARQUIVO_CREDENCIAIS), { recursive: true });
  writeFileSync(ARQUIVO_CREDENCIAIS, `${linhas.join("\n")}\n`, "utf8");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
