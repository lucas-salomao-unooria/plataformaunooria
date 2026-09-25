import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { professorEnsinaOEstudante, professorLeciona } from "../comum/turmas-do-professor";
import { habilidadePorCodigo } from "../curriculo/consulta";
import { computadoresDaMontagem, mapaDeEquipes } from "../equipes/consulta";
import { EquipesService } from "../equipes/equipes.service";
import { PrismaService } from "../prisma/prisma.service";
import type { Ajustes } from "./contrato-de-rotas";
import { FICHAS, type FichaPedagogica } from "./fichas";
import {
  ATIVIDADE_ID_RE,
  ORIGENS_DE_COPIA,
  alternativasParaExibir,
  chaveDaEvidencia,
  copiasDesejadas,
  decidirCopia,
  diferencaDasCopias,
  ehNivel,
  ehProjecao,
  marcadorDaFicha,
  marcadoresDaPergunta,
  melhor,
  melhorRodadaPorHabilidade,
  statusProprio,
  validarFicha,
  type CopiaDesejada,
  type EstadoDaEvidencia,
  type Nivel,
  type Origem,
  type Situacao,
  type Status,
  type TipoDeEvento,
} from "./regras";

/**
 * ONDE O ESTUDANTE ESTÁ AGORA numa missão: a turma, a atividade e a rodada.
 *
 * Quem sabe é o módulo DA MISSÃO (a atividade é dela, e é ela quem conta os
 * reinícios) — daí o registro, no molde de `EquipesService.registrarFonteDeGrupo`.
 * A pergunta de múltipla escolha passa por aqui: o cliente manda só a
 * alternativa, e a atividade e a rodada NUNCA vêm dele. `null` = não há
 * atividade em andamento (409 `sem-atividade-em-andamento`).
 */
export type ContextoDaAtividade = { turmaId: string; atividadeId: string; rodada: number };
export type ResolverDeContexto = (
  tx: Prisma.TransactionClient,
  escolaId: string,
  estudanteId: string,
) => Promise<ContextoDaAtividade | null>;

/**
 * UMA MARCA, como a missão a entrega pela porta `marcar`. `status` é o nível
 * que a missão OBSERVOU — na múltipla escolha, quem o calcula é `responder`, a
 * partir do gabarito da ficha.
 */
export interface MarcaDaMissao {
  escolaId: string;
  turmaId: string;
  expId: string;
  atividadeId: string;
  rodada: number;
  estudanteId: string;
  marcador: string;
  status: Nivel;
}

export interface ResultadoDaMarca {
  /** A marca entrou ou melhorou. `false` = segunda resposta de pergunta, ou ação sem melhora. */
  registrada: boolean;
  /** A evidência do estudante nesta habilidade depois da marca (a do professor, se houver). */
  evidencia: Status | null;
  /** Quantos colegas de equipe receberam (ou melhoraram) a cópia. */
  copias: number;
}

const TURMA_NAO_ENCONTRADA = "Turma não encontrada.";
const ESTUDANTE_NAO_ENCONTRADO = "Estudante não encontrado.";

/** Os campos de uma evidência que o histórico e as decisões leem. */
const CAMPOS_DA_EVIDENCIA = {
  id: true,
  estudanteId: true,
  habilidade: true,
  status: true,
  origem: true,
  situacao: true,
  fonteEstudanteId: true,
  equipeId: true,
} satisfies Prisma.EvidenciaSelect;

type LinhaDaEvidencia = Prisma.EvidenciaGetPayload<{ select: typeof CAMPOS_DA_EVIDENCIA }>;

/** O estado de uma linha, tipado — o banco guarda texto, e o CHECK garante o vocabulário. */
function estadoDe(l: { status: string; origem: string; situacao: string }): EstadoDaEvidencia {
  return { status: l.status as Status, origem: l.origem as Origem, situacao: l.situacao as Situacao };
}

/** `null` numa coluna `Json?` do Prisma é `DbNull` — `null` cru é recusado no `createMany`. */
function json(valor: Prisma.InputJsonValue | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return valor === null ? Prisma.DbNull : valor;
}

/** Existe na BNCC, com a grafia exata — `habilidadePorCodigo` sozinho aceitaria minúscula. */
const CODIGOS_DA_BNCC = { has: (codigo: string) => habilidadePorCodigo(codigo)?.codigo === codigo };

interface Evento {
  escolaId: string;
  turmaId: string;
  expId: string;
  atividadeId: string;
  rodada: number;
  estudanteId: string | null;
  habilidade: string | null;
  tipo: TipoDeEvento;
  de: Prisma.InputJsonValue | null;
  para: Prisma.InputJsonValue | null;
  autorId: string | null;
}

/**
 * A EVIDÊNCIA PEDAGÓGICA (E14): que habilidades da BNCC cada estudante
 * demonstrou numa atividade de uma missão, rodada a rodada.
 *
 * Módulo de PLATAFORMA, como `salas` e `equipes`: tabelas sem prefixo de
 * experiência, e nenhuma missão conhecida pelo nome. O que cada missão sabe é
 * a própria FICHA (`fichas/`), o próprio CONTEXTO (`registrarContexto`) e a
 * porta `marcar`, que ela chama da transação dela.
 *
 * Quem lê é o professor e o gestor. **O estudante nunca vê o próprio
 * resultado**: as duas rotas dele são a pergunta (sem gabarito) e a resposta
 * (`{ enviada: true }`, sempre). E não há ranking em lugar nenhum.
 */
@Injectable()
export class EvidenciasService implements OnModuleInit {
  private readonly fichas = new Map<string, FichaPedagogica>(FICHAS.map((f) => [f.expId, f]));
  private readonly contextos = new Map<string, ResolverDeContexto>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly equipes: EquipesService,
  ) {}

  /**
   * Na subida, o recálculo entra no gancho das equipes: toda montagem salva ou
   * desfeita refaz as cópias da rodada em andamento, dentro da mesma transação.
   * No teste, quem chama isto é a suíte — sem ele, as equipes mudam e a
   * evidência não fica sabendo.
   */
  onModuleInit(): void {
    this.equipes.aoMudarEquipes((tx, alvo) => this.recalcularCopias(tx, alvo));
  }

  /** A ficha da missão, ou `null` — missão sem ficha não tem evidência. */
  fichaDe(expId: string): FichaPedagogica | null {
    return this.fichas.get(expId) ?? null;
  }

  /**
   * Registra uma ficha FORA do registro estático. **Só para teste**: a ficha de
   * uma missão real entra em `fichas/index.ts`, onde `evidencias-fichas.spec.ts`
   * a confere. Valida do mesmo jeito e lança com a lista de problemas, para a
   * suíte não medir com uma ficha que a produção recusaria.
   */
  registrarFicha(ficha: FichaPedagogica): void {
    const erros = validarFicha(ficha, CODIGOS_DA_BNCC);
    if (erros.length > 0) throw new Error(`ficha inválida: ${erros.join(" ")}`);
    this.fichas.set(ficha.expId, ficha);
  }

  /**
   * O gancho do contexto da missão. Chamado pelo módulo da missão na subida;
   * registrar de novo substitui — é o que o teste faz.
   */
  registrarContexto(expId: string, resolver: ResolverDeContexto): void {
    this.contextos.set(expId, resolver);
  }

  private exigirFicha(expId: string): FichaPedagogica {
    const ficha = this.fichas.get(expId);
    if (!ficha) {
      throw new BadRequestException({
        codigo: "missao-sem-ficha",
        mensagem: "Esta missão não tem ficha pedagógica.",
      });
    }
    return ficha;
  }

  /**
   * 404 e não 403 para turma que não existe OU que o professor não leciona: uma
   * tela que dissesse "sem permissão" já contaria que a turma existe. É o
   * desenho de `SalasService.daTurma`. `professorId` indefinido = gestor.
   */
  private async exigirTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    professorId?: string,
  ): Promise<void> {
    const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true } });
    if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) {
      throw new NotFoundException({ mensagem: TURMA_NAO_ENCONTRADA });
    }
  }

  /**
   * OS ESTUDANTES DA TURMA — `users.turma_id`, a mesma fonte das equipes e dos
   * painéis de missão. `users` está FORA da RLS: o `escolaId` no `where` é a
   * tranca aqui.
   */
  private estudantesDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    return tx.user.findMany({
      where: { escolaId, turmaId, role: "estudante" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    });
  }

  private async registrarEventos(tx: Prisma.TransactionClient, eventos: readonly Evento[]): Promise<void> {
    if (eventos.length === 0) return;
    await tx.evidenciaEvento.createMany({
      data: eventos.map((e) => ({ ...e, de: json(e.de), para: json(e.para) })),
    });
  }

  /**
   * A PORTA DAS MISSÕES: registrar o que a missão viu o estudante fazer.
   *
   * Recebe o `tx` de quem chama — a missão marca DENTRO da transação dela, e
   * a marca cai junto se a jogada cair. Por isso não abre `comTenancy`: o `tx`
   * já vem com a RLS armada (fora dela, as três tabelas recusam a escrita).
   *
   * O caminho inteiro:
   *   1. o marcador tem de estar na ficha (400 `marcador-desconhecido`);
   *   2. a MARCA: na ação, fica a melhor; na pergunta, só a PRIMEIRA resposta
   *      entra (a segunda volta `registrada: false`, sem erro — a criança não
   *      pode descobrir pelo 4xx que já tinha respondido);
   *   3. a EVIDÊNCIA PRÓPRIA: a melhor marca da habilidade nesta rodada, gravada
   *      como `propria` — a não ser que o professor tenha ajustado, e aí o
   *      ajuste fica;
   *   4. a CÓPIA para a equipe (`decidirCopia`), se a criança está numa;
   *   5. o histórico.
   *
   * Marca que não muda nada (ação sem melhora) só renova o carimbo — é ele que
   * diz qual é a rodada em andamento — e não copia nem historia.
   */
  async marcar(tx: Prisma.TransactionClient, m: MarcaDaMissao): Promise<ResultadoDaMarca> {
    const ficha = this.exigirFicha(m.expId);
    const alvo = marcadorDaFicha(ficha, m.marcador);
    if (!alvo) {
      throw new BadRequestException({
        codigo: "marcador-desconhecido",
        mensagem: "Este marcador não está na ficha da missão.",
      });
    }
    if (!ATIVIDADE_ID_RE.test(m.atividadeId) || !Number.isInteger(m.rodada) || m.rodada < 1 || !ehNivel(m.status)) {
      throw new BadRequestException({
        codigo: "marca-invalida",
        mensagem: "Atividade, rodada ou nível fora do formato.",
      });
    }

    const { habilidade, marcador } = alvo;
    const agora = new Date();
    const chaveDaMarca = {
      escolaId: m.escolaId,
      expId: m.expId,
      atividadeId: m.atividadeId,
      rodada: m.rodada,
      estudanteId: m.estudanteId,
      marcador: marcador.id,
    };

    /* `createMany` com `skipDuplicates` é um `INSERT ... ON CONFLICT DO
       NOTHING`: a segunda marca concorrente espera a primeira e não insere, em
       vez de abortar a transação da missão com um P2002. */
    const criou = await tx.evidenciaMarca.createMany({
      data: [
        {
          ...chaveDaMarca,
          turmaId: m.turmaId,
          habilidade,
          status: m.status,
          tipo: marcador.tipo,
          versaoFicha: ficha.versao,
          registradaEm: agora,
        },
      ],
      skipDuplicates: true,
    });

    let marcaAnterior: Nivel | null = null;
    if (criou.count === 0) {
      /* A PRIMEIRA resposta vale: a segunda nem renova o carimbo. */
      if (marcador.tipo === "multipla_escolha") {
        return { registrada: false, evidencia: await this.statusAtual(tx, m, habilidade), copias: 0 };
      }
      const existente = await tx.evidenciaMarca.findUnique({
        where: { escolaId_expId_atividadeId_rodada_estudanteId_marcador: chaveDaMarca },
        select: { status: true },
      });
      marcaAnterior = (existente?.status as Nivel | undefined) ?? null;
      const nova = melhor(marcaAnterior, m.status) ?? m.status;
      await tx.evidenciaMarca.update({
        where: { escolaId_expId_atividadeId_rodada_estudanteId_marcador: chaveDaMarca },
        data: { status: nova, registradaEm: agora },
      });
      if (nova === marcaAnterior) {
        return { registrada: false, evidencia: await this.statusAtual(tx, m, habilidade), copias: 0 };
      }
    }

    const daRodada = {
      escolaId: m.escolaId,
      expId: m.expId,
      atividadeId: m.atividadeId,
      rodada: m.rodada,
    };
    const marcasDaHabilidade = await tx.evidenciaMarca.findMany({
      where: { ...daRodada, estudanteId: m.estudanteId, habilidade },
      select: { status: true },
    });
    const proprio = statusProprio(marcasDaHabilidade.map((x) => ({ status: x.status as Nivel }))) ?? m.status;

    const chaveDaEvidencia = { ...daRodada, estudanteId: m.estudanteId, habilidade };
    const atual = await tx.evidencia.findUnique({
      where: { escolaId_expId_atividadeId_rodada_estudanteId_habilidade: chaveDaEvidencia },
      select: CAMPOS_DA_EVIDENCIA,
    });
    const antes = atual ? estadoDe(atual) : null;
    let depois = antes;

    /* PRECEDÊNCIA: o ajuste do professor fica. A cópia da equipe perde para a
       marca própria — mesmo que a cópia fosse melhor: o que a criança fez com o
       próprio login é dela. */
    if (atual?.origem !== "professor" && !(atual?.origem === "propria" && atual.status === proprio)) {
      const dados = {
        turmaId: m.turmaId,
        status: proprio,
        origem: "propria",
        situacao: "valida",
        fonteEstudanteId: null,
        equipeId: null,
        editadoPor: null,
      };
      const nova = await tx.evidencia.createMany({ data: [{ ...chaveDaEvidencia, ...dados }], skipDuplicates: true });
      if (nova.count === 0) {
        /* O filtro `origem != professor` é a tranca contra o ajuste que chegou
           entre a leitura e esta escrita. */
        await tx.evidencia.updateMany({
          where: { ...chaveDaEvidencia, origem: { not: "professor" } },
          data: dados,
        });
      }
      depois = { status: proprio, origem: "propria", situacao: "valida" };
    }

    await this.registrarEventos(tx, [
      {
        ...daRodada,
        turmaId: m.turmaId,
        estudanteId: m.estudanteId,
        habilidade,
        tipo: "marca",
        de: antes ? { ...antes } : null,
        para: { ...(depois ?? {}), marcador: marcador.id, marca: m.status, marcaAnterior },
        autorId: m.estudanteId,
      },
    ]);

    const copias = await this.copiarParaAEquipe(tx, m, habilidade, proprio);
    return { registrada: true, evidencia: depois?.status ?? null, copias };
  }

  /** A evidência do estudante nesta habilidade e rodada, sem mudar nada. */
  private async statusAtual(tx: Prisma.TransactionClient, m: MarcaDaMissao, habilidade: string) {
    const linha = await tx.evidencia.findUnique({
      where: {
        escolaId_expId_atividadeId_rodada_estudanteId_habilidade: {
          escolaId: m.escolaId,
          expId: m.expId,
          atividadeId: m.atividadeId,
          rodada: m.rodada,
          estudanteId: m.estudanteId,
          habilidade,
        },
      },
      select: { status: true },
    });
    return (linha?.status as Status | undefined) ?? null;
  }

  /** A equipe é a turma inteira? (`regras.ts#ehProjecao`) */
  private async ehProjecaoDaEquipe(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    expId: string,
    membros: readonly string[],
  ): Promise<boolean> {
    const [computadores, estudantes] = await Promise.all([
      computadoresDaMontagem(tx, escolaId, turmaId, expId),
      tx.user.findMany({ where: { escolaId, turmaId, role: "estudante" }, select: { id: true } }),
    ]);
    return ehProjecao({ computadores, membros, estudantesDaTurma: estudantes.map((e) => e.id) });
  }

  /**
   * A CÓPIA DE UMA HABILIDADE para os colegas de computador de quem marcou.
   * Só o NÍVEL vai — nunca texto. A decisão por colega é `decidirCopia`.
   */
  private async copiarParaAEquipe(
    tx: Prisma.TransactionClient,
    m: MarcaDaMissao,
    habilidade: string,
    status: Nivel,
  ): Promise<number> {
    const mapa = await mapaDeEquipes(tx, m.escolaId, m.turmaId, m.expId);
    const equipe = mapa.get(m.estudanteId);
    if (!equipe) return 0;
    const colegas = equipe.membros.map((x) => x.id).filter((id) => id !== m.estudanteId);
    if (colegas.length === 0) return 0;

    const daRodada = { escolaId: m.escolaId, expId: m.expId, atividadeId: m.atividadeId, rodada: m.rodada };
    const [projecao, comMarca, linhas] = await Promise.all([
      this.ehProjecaoDaEquipe(tx, m.escolaId, m.turmaId, m.expId, equipe.membros.map((x) => x.id)),
      tx.evidenciaMarca.findMany({
        where: { ...daRodada, habilidade, estudanteId: { in: colegas } },
        select: { estudanteId: true },
        distinct: ["estudanteId"],
      }),
      tx.evidencia.findMany({
        where: { ...daRodada, habilidade, estudanteId: { in: colegas } },
        select: CAMPOS_DA_EVIDENCIA,
      }),
    ]);
    const temMarca = new Set(comMarca.map((x) => x.estudanteId));
    const linhaDe = new Map(linhas.map((l) => [l.estudanteId, l]));

    const apagar: string[] = [];
    const gravar: CopiaDesejada[] = [];
    const eventos: Evento[] = [];
    for (const colega of colegas) {
      const atual = linhaDe.get(colega);
      const decisao = decidirCopia(
        { temMarcaPropria: temMarca.has(colega), atual: atual ? estadoDe(atual) : null },
        { status, projecao },
      );
      if (!decisao.gravar) continue;
      if (atual) apagar.push(atual.id);
      const copia: CopiaDesejada = {
        estudanteId: colega,
        habilidade,
        status: decisao.status,
        origem: decisao.origem,
        situacao: decisao.situacao,
        fonteEstudanteId: m.estudanteId,
        equipeId: equipe.id,
      };
      gravar.push(copia);
      eventos.push({
        ...daRodada,
        turmaId: m.turmaId,
        estudanteId: colega,
        habilidade,
        tipo: "copia",
        de: atual ? { ...estadoDe(atual) } : null,
        para: {
          status: copia.status,
          origem: copia.origem,
          situacao: copia.situacao,
          fonteEstudanteId: m.estudanteId,
          equipeId: equipe.id,
        },
        autorId: null,
      });
    }
    await this.aplicarCopias(tx, daRodada, m.turmaId, apagar, gravar);
    await this.registrarEventos(tx, eventos);
    return gravar.length;
  }

  /**
   * Troca de cópias em DUAS consultas: sai o que vai ser substituído, entra o
   * novo. O `skipDuplicates` é a tranca contra a marca própria que chegou no
   * meio (ela ganha, e é o certo pela precedência).
   */
  private async aplicarCopias(
    tx: Prisma.TransactionClient,
    daRodada: { escolaId: string; expId: string; atividadeId: string; rodada: number },
    turmaId: string,
    apagar: readonly string[],
    gravar: readonly CopiaDesejada[],
  ): Promise<void> {
    if (apagar.length > 0) {
      await tx.evidencia.deleteMany({
        where: { escolaId: daRodada.escolaId, id: { in: [...apagar] }, origem: { in: [...ORIGENS_DE_COPIA] } },
      });
    }
    if (gravar.length > 0) {
      await tx.evidencia.createMany({
        data: gravar.map((c) => ({ ...daRodada, turmaId, ...c, editadoPor: null })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * O RECÁLCULO DAS CÓPIAS quando as equipes mudam — registrado no gancho
   * `EquipesService.aoMudarEquipes`, e roda na transação do `PUT`/`DELETE` das
   * equipes.
   *
   * SÓ A RODADA EM ANDAMENTO: a (atividade, rodada) da marca mais recente desta
   * turma × missão. Rodada passada NUNCA muda por troca de equipe — a aula de
   * ontem não pode mudar de resultado porque hoje a sala tem menos
   * computadores; o que estiver errado lá se corrige no ajuste do professor.
   *
   * O cálculo é o de `copiasDesejadas` (a melhor fonte de cada equipe, para
   * quem não tem marca própria nem ajuste) contra as cópias que existem
   * (`diferencaDasCopias`): sai quem saiu da equipe, entra quem entrou, e a
   * cópia que não mudou fica com a confirmação que tinha.
   */
  async recalcularCopias(
    tx: Prisma.TransactionClient,
    alvo: { escolaId: string; turmaId: string; expId: string },
  ): Promise<void> {
    if (!this.fichas.has(alvo.expId)) return;
    const { escolaId, turmaId, expId } = alvo;

    const ultima = await tx.evidenciaMarca.findFirst({
      where: { escolaId, turmaId, expId },
      orderBy: [{ registradaEm: "desc" }, { rodada: "desc" }],
      select: { atividadeId: true, rodada: true },
    });
    if (!ultima) return;

    const daRodada = { escolaId, expId, atividadeId: ultima.atividadeId, rodada: ultima.rodada };
    const [mapa, computadores, estudantes] = await Promise.all([
      mapaDeEquipes(tx, escolaId, turmaId, expId),
      computadoresDaMontagem(tx, escolaId, turmaId, expId),
      tx.user.findMany({ where: { escolaId, turmaId, role: "estudante" }, select: { id: true } }),
    ]);
    const idsDaTurma = estudantes.map((e) => e.id);
    const [marcas, linhas] = await Promise.all([
      tx.evidenciaMarca.findMany({
        where: { ...daRodada, estudanteId: { in: idsDaTurma } },
        select: { estudanteId: true, habilidade: true, status: true },
      }),
      tx.evidencia.findMany({
        where: { ...daRodada, estudanteId: { in: idsDaTurma } },
        select: CAMPOS_DA_EVIDENCIA,
      }),
    ]);

    const proprios = new Map<string, Map<string, Nivel>>();
    for (const marca of marcas) {
      const doEstudante = proprios.get(marca.estudanteId) ?? new Map<string, Nivel>();
      const m = melhor(doEstudante.get(marca.habilidade), marca.status as Nivel);
      if (m) doEstudante.set(marca.habilidade, m);
      proprios.set(marca.estudanteId, doEstudante);
    }
    const bloqueados = new Set(
      linhas
        .filter((l) => l.origem === "professor" || l.origem === "propria")
        .map((l) => chaveDaEvidencia(l.estudanteId, l.habilidade)),
    );

    const equipes = [...new Map([...mapa.values()].map((e) => [e.id, e])).values()].map((e) => ({
      id: e.id,
      membros: e.membros.map((x) => x.id),
    }));
    const desejadas = copiasDesejadas({
      equipes,
      proprios,
      bloqueados,
      projecao: (e) => ehProjecao({ computadores, membros: e.membros, estudantesDaTurma: idsDaTurma }),
    });
    const existentes = linhas
      .filter((l) => (ORIGENS_DE_COPIA as readonly string[]).includes(l.origem))
      .map((l: LinhaDaEvidencia) => ({ ...l, ...estadoDe(l) }));
    const diferenca = diferencaDasCopias(existentes, desejadas);

    await this.aplicarCopias(tx, daRodada, turmaId, diferenca.apagar, diferenca.gravar);
    await this.registrarEventos(
      tx,
      diferenca.mudancas.map((mudanca) => ({
        ...daRodada,
        turmaId,
        estudanteId: mudanca.estudanteId,
        habilidade: mudanca.habilidade,
        tipo: "recalculo" as const,
        de: mudanca.de ? { ...mudanca.de } : null,
        para: mudanca.para ? { ...mudanca.para } : null,
        autorId: null,
      })),
    );
  }

  /**
   * A PERGUNTA, como o estudante a vê: o enunciado e as alternativas — SEM o
   * nível de cada uma. O gabarito fica aqui (regra 3).
   *
   * Se a ficha pede (`embaralhar`), as alternativas saem numa ordem NOVA a cada
   * exibição (`regras.ts#alternativasParaExibir`): o F5 que reabre a enquete
   * mostra outra ordem, e a resposta continua corrigida pelo `id`.
   *
   * Passa pela porta da sala (`exigirMissaoLiberada`) como toda entrada de
   * estudante em missão: a pergunta é da missão, e a missão fechada não tem
   * pergunta aberta.
   */
  async pergunta(escolaId: string, estudanteId: string, expId: string, perguntaId: string) {
    const pergunta = this.perguntaDaFicha(expId, perguntaId);
    return this.prisma.comTenancy(async (tx) => {
      await exigirMissaoLiberada(tx, escolaId, estudanteId, expId);
      return {
        enunciado: pergunta.enunciado,
        alternativas: alternativasParaExibir(pergunta),
      };
    }, escolaId);
  }

  private perguntaDaFicha(expId: string, perguntaId: string) {
    const pergunta = this.fichas.get(expId)?.perguntas.find((p) => p.id === perguntaId);
    if (!pergunta) {
      throw new NotFoundException({ codigo: "pergunta-nao-encontrada", mensagem: "Pergunta não encontrada." });
    }
    return pergunta;
  }

  /**
   * A RESPOSTA do estudante a uma pergunta de múltipla escolha.
   *
   * O cliente manda SÓ a alternativa. A atividade e a rodada saem do contexto
   * da missão (`registrarContexto`) — nunca do corpo, senão a criança
   * escolheria em que rodada a resposta conta. O nível sai do gabarito, aqui.
   * E a resposta é sempre `{ enviada: true }`: nem a primeira nem a segunda
   * dizem se acertou (a segunda nem conta).
   */
  async responder(
    escolaId: string,
    estudanteId: string,
    expId: string,
    perguntaId: string,
    alternativaId: string,
  ): Promise<{ enviada: true }> {
    const pergunta = this.perguntaDaFicha(expId, perguntaId);
    const alternativa = pergunta.alternativas.find((a) => a.id === alternativaId);
    if (!alternativa) {
      throw new BadRequestException({
        codigo: "alternativa-desconhecida",
        mensagem: "Esta alternativa não é desta pergunta.",
      });
    }
    const ficha = this.exigirFicha(expId);

    return this.prisma.comTenancy(async (tx) => {
      await exigirMissaoLiberada(tx, escolaId, estudanteId, expId);
      const resolver = this.contextos.get(expId);
      const contexto = resolver ? await resolver(tx, escolaId, estudanteId) : null;
      if (!contexto) {
        throw new ConflictException({
          codigo: "sem-atividade-em-andamento",
          mensagem: "Nada para responder agora.",
        });
      }
      for (const marcador of marcadoresDaPergunta(ficha, perguntaId)) {
        await this.marcar(tx, { escolaId, estudanteId, expId, ...contexto, marcador, status: alternativa.status });
      }
      return { enviada: true as const };
    }, escolaId);
  }

  /** O painel, já dentro da transação — o `GET` e a resposta das duas escritas. */
  private async montarPainel(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    expId: string,
    atividadeId: string,
  ) {
    const ficha = this.fichas.get(expId);
    if (!ficha) return { temFicha: false, habilidades: [], rodadas: [], estudantes: [], pendentes: {} };

    const [estudantes, mapa, linhas] = await Promise.all([
      this.estudantesDaTurma(tx, escolaId, turmaId),
      mapaDeEquipes(tx, escolaId, turmaId, expId),
      tx.evidencia.findMany({
        where: { escolaId, turmaId, expId, atividadeId },
        select: { estudanteId: true, rodada: true, habilidade: true, status: true, origem: true, situacao: true },
        orderBy: [{ rodada: "asc" }, { habilidade: "asc" }],
      }),
    ]);

    /* Só quem AINDA é da turma: a linha de quem saiu fica no banco (é dela), e
       volta a aparecer se a criança voltar. */
    const daTurma = new Set(estudantes.map((e) => e.id));
    const validas = linhas.filter((l) => daTurma.has(l.estudanteId));

    const codigos = ficha.habilidades.map((h) => h.codigo);
    /* Habilidade que saiu da ficha numa versão nova continua aparecendo onde
       tem evidência — esconder seria apagar o que a criança fez. */
    for (const l of validas) if (!codigos.includes(l.habilidade)) codigos.push(l.habilidade);

    const rodadas = [...new Set(validas.map((l) => l.rodada))].sort((a, b) => a - b);
    const pendentes: Record<string, number> = Object.fromEntries(rodadas.map((r) => [String(r), 0]));
    const porEstudante = new Map<string, typeof validas>();
    for (const l of validas) {
      porEstudante.set(l.estudanteId, [...(porEstudante.get(l.estudanteId) ?? []), l]);
      if (l.situacao === "a_revisar") pendentes[String(l.rodada)] = (pendentes[String(l.rodada)] ?? 0) + 1;
    }

    return {
      temFicha: true,
      habilidades: codigos.map((codigo) => ({ codigo, descricao: habilidadePorCodigo(codigo)?.descricao ?? "" })),
      rodadas,
      estudantes: estudantes.map((e) => {
        const minhas = porEstudante.get(e.id) ?? [];
        const porRodada: Record<string, Record<string, EstadoDaEvidencia>> = {};
        for (const l of minhas) {
          const r = String(l.rodada);
          porRodada[r] = { ...(porRodada[r] ?? {}), [l.habilidade]: estadoDe(l) };
        }
        const equipe = mapa.get(e.id);
        return {
          id: e.id,
          nome: e.displayName,
          equipe: equipe ? { id: equipe.id, nome: equipe.nome } : null,
          porRodada,
          resultado: Object.fromEntries(
            melhorRodadaPorHabilidade(minhas.map((l) => ({ ...l, ...estadoDe(l) }))),
          ),
        };
      }),
      pendentes,
    };
  }

  /**
   * O PAINEL DA ATIVIDADE: cada estudante da turma, cada rodada, cada
   * habilidade — e o resultado (a melhor rodada por habilidade).
   *
   * Missão sem ficha responde 200 com `temFicha: false` e tudo vazio, e não
   * 400: é por esta resposta que o hub decide se desenha o bloco, e um erro
   * aqui viraria `api-recusou` no log a cada abertura de missão sem ficha.
   */
  async painel(escolaId: string, turmaId: string, expId: string, atividadeId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.exigirTurma(tx, escolaId, turmaId, professorId);
      return this.montarPainel(tx, escolaId, turmaId, expId, atividadeId);
    }, escolaId);
  }

  /**
   * "CONFIRMAR PARA A TURMA": as cópias da projeção desta rodada passam a
   * valer (`a_revisar` → `valida`). Depois disso o professor ainda pode ajustar
   * cada criança, uma a uma. Repetir não muda nada — e não historia de novo.
   */
  async confirmar(
    escolaId: string,
    turmaId: string,
    expId: string,
    atividadeId: string,
    rodada: number,
    professorId: string,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.exigirTurma(tx, escolaId, turmaId, professorId);
      this.exigirFicha(expId);
      const ids = (await this.estudantesDaTurma(tx, escolaId, turmaId)).map((e) => e.id);
      const confirmadas = await tx.evidencia.updateMany({
        where: {
          escolaId,
          turmaId,
          expId,
          atividadeId,
          rodada,
          situacao: "a_revisar",
          estudanteId: { in: ids },
        },
        data: { situacao: "valida" },
      });
      if (confirmadas.count > 0) {
        await this.registrarEventos(tx, [
          {
            escolaId,
            turmaId,
            expId,
            atividadeId,
            rodada,
            estudanteId: null,
            habilidade: null,
            tipo: "confirmacao",
            de: { situacao: "a_revisar", linhas: confirmadas.count },
            para: { situacao: "valida", linhas: confirmadas.count },
            autorId: professorId,
          },
        ]);
      }
      return this.montarPainel(tx, escolaId, turmaId, expId, atividadeId);
    }, escolaId);
  }

  /**
   * O AJUSTE DO PROFESSOR: um estudante ou muitos, uma habilidade, uma rodada —
   * a qualquer momento, mesmo com a missão encerrada.
   *
   * O ajuste é a origem que NADA sobrescreve (nem a marca própria que chegar
   * depois, nem a cópia da equipe), e `nao_participou` é o N/A explícito que
   * barra a cópia. Cada mudança vai para o histórico com de/para e quem;
   * ajuste que repete o que já estava é ignorado, sem evento.
   *
   * 400 `ajuste-invalido` com a LISTA inteira (estudante de fora da turma,
   * habilidade fora da ficha, par repetido), e 400 `rodada-inexistente` para
   * rodada depois da última que a atividade teve — a rodada 1 sempre existe,
   * para a atividade feita fora da missão.
   */
  async ajustar(
    escolaId: string,
    turmaId: string,
    expId: string,
    atividadeId: string,
    rodada: number,
    professorId: string,
    ajustes: Ajustes["ajustes"],
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.exigirTurma(tx, escolaId, turmaId, professorId);
      const ficha = this.exigirFicha(expId);

      const daTurma = new Set((await this.estudantesDaTurma(tx, escolaId, turmaId)).map((e) => e.id));
      const daFicha = new Set(ficha.habilidades.map((h) => h.codigo));
      const erros = new Set<string>();
      const vistos = new Set<string>();
      for (const a of ajustes) {
        if (!daTurma.has(a.estudanteId)) erros.add("Há um estudante que não é desta turma.");
        if (!daFicha.has(a.habilidade)) erros.add(`A habilidade ${a.habilidade} não está na ficha desta missão.`);
        const chave = chaveDaEvidencia(a.estudanteId, a.habilidade);
        if (vistos.has(chave)) erros.add("O mesmo estudante aparece duas vezes na mesma habilidade.");
        vistos.add(chave);
      }
      if (erros.size > 0) {
        throw new BadRequestException({
          codigo: "ajuste-invalido",
          mensagem: "Os ajustes não puderam ser salvos.",
          erros: [...erros],
        });
      }

      const [ultimaMarca, ultimaEvidencia] = await Promise.all([
        tx.evidenciaMarca.aggregate({ where: { escolaId, turmaId, expId, atividadeId }, _max: { rodada: true } }),
        tx.evidencia.aggregate({ where: { escolaId, turmaId, expId, atividadeId }, _max: { rodada: true } }),
      ]);
      const maior = Math.max(1, ultimaMarca._max.rodada ?? 0, ultimaEvidencia._max.rodada ?? 0);
      if (rodada > maior) {
        throw new BadRequestException({
          codigo: "rodada-inexistente",
          mensagem: "Esta rodada ainda não aconteceu nesta atividade.",
        });
      }

      const daRodada = { escolaId, expId, atividadeId, rodada };
      const existentes = await tx.evidencia.findMany({
        where: { ...daRodada, estudanteId: { in: [...new Set(ajustes.map((a) => a.estudanteId))] } },
        select: CAMPOS_DA_EVIDENCIA,
      });
      const atualDe = new Map(existentes.map((l) => [chaveDaEvidencia(l.estudanteId, l.habilidade), l]));

      const apagar: string[] = [];
      const gravar: Prisma.EvidenciaCreateManyInput[] = [];
      const eventos: Evento[] = [];
      for (const a of ajustes) {
        const atual = atualDe.get(chaveDaEvidencia(a.estudanteId, a.habilidade));
        if (atual?.origem === "professor" && atual.status === a.status) continue;
        if (atual) apagar.push(atual.id);
        gravar.push({
          ...daRodada,
          turmaId,
          estudanteId: a.estudanteId,
          habilidade: a.habilidade,
          status: a.status,
          origem: "professor",
          situacao: "valida",
          fonteEstudanteId: null,
          equipeId: null,
          editadoPor: professorId,
        });
        eventos.push({
          ...daRodada,
          turmaId,
          estudanteId: a.estudanteId,
          habilidade: a.habilidade,
          tipo: "ajuste",
          de: atual ? { ...estadoDe(atual) } : null,
          para: { status: a.status, origem: "professor", situacao: "valida" },
          autorId: professorId,
        });
      }
      if (apagar.length > 0) await tx.evidencia.deleteMany({ where: { escolaId, id: { in: apagar } } });
      if (gravar.length > 0) await tx.evidencia.createMany({ data: gravar });
      await this.registrarEventos(tx, eventos);

      return this.montarPainel(tx, escolaId, turmaId, expId, atividadeId);
    }, escolaId);
  }

  /**
   * O PERFIL DO ESTUDANTE: em cada missão, em cada atividade, o nível de cada
   * habilidade — a melhor rodada por habilidade, SÓ com o que vale.
   *
   * Sem origem (quem lê o perfil quer saber o que a criança demonstrou, não de
   * que computador veio), sem N/A e sem `nao_participou`, sem a projeção que o
   * professor ainda não confirmou.
   *
   * O professor só abre o perfil de quem ele ensina (`professorEnsinaOEstudante`,
   * 404 e nunca 403); gestor e admin leem a escola.
   */
  async perfil(escolaId: string, estudanteId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const estudante = await tx.user.findFirst({
        where: { id: estudanteId, escolaId, role: "estudante" },
        select: { id: true, displayName: true },
      });
      if (!estudante || !(await professorEnsinaOEstudante(tx, escolaId, estudanteId, professorId))) {
        throw new NotFoundException({ mensagem: ESTUDANTE_NAO_ENCONTRADO });
      }

      const linhas = await tx.evidencia.findMany({
        where: { escolaId, estudanteId, situacao: "valida", status: { not: "nao_participou" } },
        select: { expId: true, atividadeId: true, habilidade: true, status: true, situacao: true },
        orderBy: [{ expId: "asc" }, { atividadeId: "asc" }],
      });
      const expIds = [...new Set(linhas.map((l) => l.expId))];
      const catalogo = await tx.experiencia.findMany({
        where: { expId: { in: expIds } },
        select: { expId: true, nome: true },
      });
      const nomeDe = new Map(catalogo.map((c) => [c.expId, c.nome]));

      const missoes = expIds.map((expId) => {
        const daMissao = linhas.filter((l) => l.expId === expId);
        /* A ordem das habilidades é a da ficha, quando há ficha — é a ordem em
           que o painel as mostra. */
        const ordem = this.fichas.get(expId)?.habilidades.map((h) => h.codigo) ?? [];
        const posicao = (codigo: string) => {
          const i = ordem.indexOf(codigo);
          return i === -1 ? ordem.length : i;
        };
        const atividades = [...new Set(daMissao.map((l) => l.atividadeId))].map((atividadeId) => {
          const resultado = melhorRodadaPorHabilidade(
            daMissao
              .filter((l) => l.atividadeId === atividadeId)
              .map((l) => ({ habilidade: l.habilidade, status: l.status as Status, situacao: l.situacao as Situacao })),
          );
          return {
            atividadeId,
            habilidades: [...resultado.entries()]
              .sort(([a], [b]) => posicao(a) - posicao(b) || a.localeCompare(b))
              .map(([codigo, status]) => ({
                codigo,
                descricao: habilidadePorCodigo(codigo)?.descricao ?? "",
                status,
              })),
          };
        });
        return { expId, nome: nomeDe.get(expId) ?? expId, atividades };
      });

      return { estudante: { id: estudante.id, nome: estudante.displayName }, missoes };
    }, escolaId);
  }
}
