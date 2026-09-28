import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { exigirRecursoDisponivel } from "../comum/disponibilidade";
import { turmasDoEstudante } from "../comum/liberacao";
import { professorLeciona } from "../comum/turmas-do-professor";
import { PrismaService } from "../prisma/prisma.service";
import { equipeDoEstudante, equipesDaMissao } from "./consulta";
import type { SalvarMontagem } from "./contrato-de-rotas";
import {
  EXPERIENCIAS_COM_EQUIPE,
  permiteEquipes,
  propostaManual,
  rotulosSemRepeticao,
  sortear,
  validarMontagem,
  type Lado,
  type MembroDaEquipe,
  type Modo,
} from "./regras";

/**
 * DE ONDE VEM O LADO DE CADA CRIANÇA, numa missão que tem lados.
 *
 * O Instanooria divide a turma em dois times, e uma equipe com gente dos dois
 * diante da mesma tela desmancha a missão. Quem sabe o lado de cada um é o
 * módulo DA MISSÃO, não este — daí o registro: o módulo da experiência chama
 * `registrarFonteDeGrupo` na subida, e este serviço nunca importa nada dele.
 * Sem fonte registrada, o sorteio ignora lados (e `agrupamento` volta `null`).
 *
 * `descricao` e `aviso` são frases para o PROFESSOR, ditas na tela do sorteio.
 */
export type FonteDeGrupo = (
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
) => Promise<{ grupos: Map<string, Lado | null>; descricao: string; aviso: string | null }>;

/**
 * QUEM PRECISA SABER QUE AS EQUIPES MUDARAM — hoje, a evidência pedagógica
 * (E14), que recalcula as cópias da rodada em andamento.
 *
 * Roda DENTRO da transação do `PUT`/`DELETE`, depois da escrita: vê as equipes
 * novas, e um erro nele desfaz a montagem junto — equipe salva com a evidência
 * contando pela montagem velha seria o painel mentindo sem ninguém ver.
 *
 * Registro, e não import: quem depende é o outro módulo (evidencias importa
 * equipes, nunca o contrário), no molde de `registrarFonteDeGrupo`.
 */
export type AoMudarEquipes = (
  tx: Prisma.TransactionClient,
  alvo: { escolaId: string; turmaId: string; expId: string },
) => Promise<void>;

/** Os campos da montagem que as respostas mostram. */
const CAMPOS_DA_MONTAGEM = {
  modo: true,
  computadores: true,
  ausentes: true,
  versao: true,
  atualizadoEm: true,
} satisfies Prisma.EquipesMontagemSelect;

const TURMA_NAO_ENCONTRADA = "Turma não encontrada.";

/**
 * AS EQUIPES NA MISSÃO (E13, ADR-111): quem divide um computador.
 *
 * Módulo de PLATAFORMA, como `salas`: tabela sem prefixo de experiência, e a
 * única coisa que ele sabe de missão é a lista `EXPERIENCIAS_COM_EQUIPE`. O que
 * cada missão FAZ com a equipe — o painel contando por computador — é assunto
 * do módulo dela, lendo `consulta.ts`.
 *
 * Quem MONTA é só quem leciona a turma, como quem libera (ADR-69): gestor vê as
 * equipes e não decide a aula.
 */
@Injectable()
export class EquipesService {
  private readonly fontesDeGrupo = new Map<string, FonteDeGrupo>();
  private readonly aoMudar: AoMudarEquipes[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * O gancho do agrupamento por lado. Chamado pelo módulo da missão na subida
   * (`onModuleInit`); registrar de novo substitui — é o que o teste faz.
   */
  registrarFonteDeGrupo(expId: string, fonte: FonteDeGrupo): void {
    this.fontesDeGrupo.set(expId, fonte);
  }

  /**
   * O gancho de "as equipes mudaram", chamado por quem depende disso na subida
   * (`onModuleInit` do `EvidenciasService`). Cada registro ACRESCENTA — são
   * interessados diferentes, e todos rodam, na ordem em que se registraram.
   */
  aoMudarEquipes(callback: AoMudarEquipes): void {
    this.aoMudar.push(callback);
  }

  /** Avisa os interessados, dentro da transação de quem mudou. */
  private async avisarMudanca(
    tx: Prisma.TransactionClient,
    alvo: { escolaId: string; turmaId: string; expId: string },
  ): Promise<void> {
    for (const callback of this.aoMudar) await callback(tx, alvo);
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
    const turma = await tx.turma.findFirst({
      where: { id: turmaId, escolaId },
      select: { id: true },
    });
    if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) {
      throw new NotFoundException({ mensagem: TURMA_NAO_ENCONTRADA });
    }
  }

  /** A missão aceita equipe? 400, e não 404: a turma existe, a missão também. */
  private exigirMissaoComEquipe(expId: string): void {
    if (!permiteEquipes(expId)) {
      throw new BadRequestException({
        codigo: "missao-sem-equipes",
        mensagem: "Esta missão não é feita em equipes.",
      });
    }
  }

  /**
   * OS ESTUDANTES DA TURMA — a mesma fonte dos painéis de missão (o
   * `resultadosDaTurma` da exp04ef1b): `users.turma_id`, e não `matriculas`. A criança cuja matrícula
   * ainda não existe tem sala na prática e entra na missão; uma equipe que não
   * pudesse tê-la seria a tela negando o que a aula está fazendo.
   *
   * `users` está FORA da RLS: o `escolaId` no `where` é a tranca aqui.
   */
  private async estudantesDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
  ): Promise<MembroDaEquipe[]> {
    const linhas = await tx.user.findMany({
      where: { escolaId, turmaId, role: "estudante" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    });
    return linhas.map((l) => ({ id: l.id, nome: l.displayName }));
  }

  /** A resposta do `GET` (e do `PUT`), já dentro da transação. */
  private async projecao(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    expId: string,
  ) {
    const [estudantes, montagem, equipes] = await Promise.all([
      this.estudantesDaTurma(tx, escolaId, turmaId),
      tx.equipesMontagem.findUnique({
        where: { escolaId_turmaId_expId: { escolaId, turmaId, expId } },
        select: CAMPOS_DA_MONTAGEM,
      }),
      equipesDaMissao(tx, escolaId, turmaId, expId),
    ]);

    const emEquipe = new Set(equipes.flatMap((e) => e.membros.map((m) => m.id)));
    return {
      permitida: true,
      montagem: montagem
        ? {
            modo: montagem.modo as Modo,
            computadores: montagem.computadores,
            ausentes: montagem.ausentes,
            versao: montagem.versao,
            atualizadoEm: montagem.atualizadoEm.toISOString(),
          }
        : null,
      equipes: equipes.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem, membros: e.membros })),
      semEquipe: estudantes.filter((e) => !emEquipe.has(e.id)),
      estudantes: estudantes.length,
    };
  }

  /**
   * AS EQUIPES DESTA MISSÃO NESTA TURMA.
   *
   * Missão sem equipe responde 200 com `permitida: false`, e não 400: é por
   * esta resposta que o hub decide se desenha o bloco de equipes, e um erro
   * ali viraria `api-recusou` no log a cada abertura de missão sem equipe.
   */
  async daMissao(escolaId: string, turmaId: string, expId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.exigirTurma(tx, escolaId, turmaId, professorId);
      if (!permiteEquipes(expId)) {
        const estudantes = await tx.user.count({ where: { escolaId, turmaId, role: "estudante" } });
        return { permitida: false, montagem: null, equipes: [], semEquipe: [], estudantes };
      }
      return this.projecao(tx, escolaId, turmaId, expId);
    }, escolaId);
  }

  /**
   * UMA PROPOSTA, que NUNCA grava. O professor sorteia quantas vezes quiser,
   * ajusta arrastando, e só o `PUT` escreve — sorteio que gravasse sozinho
   * sobrescreveria a montagem que outro professor da turma acabou de salvar.
   *
   * Ausente que não é da turma é ignorado, sem erro: aqui ele só sai de uma
   * lista que já não o tinha. Quem recusa id estranho é o `PUT`.
   *
   * `computadores` volta como foi pedido, e não o número de equipes: é o que o
   * professor disse que a sala tem, e é o que o `PUT` grava. Com mais
   * computadores que presentes, as equipes são uma por criança.
   */
  async sugerir(
    escolaId: string,
    turmaId: string,
    expId: string,
    pedido: { modo: Modo; computadores: number; ausentes: string[] },
    professorId: string,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.exigirTurma(tx, escolaId, turmaId, professorId);
      this.exigirMissaoComEquipe(expId);

      const ausentes = new Set(pedido.ausentes);
      const presentes = (await this.estudantesDaTurma(tx, escolaId, turmaId)).filter(
        (e) => !ausentes.has(e.id),
      );
      const porId = new Map(presentes.map((p) => [p.id, p]));
      const membro = (id: string): MembroDaEquipe => porId.get(id) ?? { id, nome: "" };
      const porNome = (a: MembroDaEquipe, b: MembroDaEquipe) => a.nome.localeCompare(b.nome, "pt-BR");

      if (pedido.modo === "manual") {
        const proposta = propostaManual(presentes, pedido.computadores);
        return {
          modo: pedido.modo,
          computadores: pedido.computadores,
          equipes: proposta.equipes.map((e) => ({
            nome: e.nome,
            membros: e.membros,
            grupo: null,
            mista: false,
          })),
          semEquipe: proposta.semEquipe,
          agrupamento: null,
        };
      }

      const fonte = this.fontesDeGrupo.get(expId);
      const grupos = fonte ? await fonte(tx, escolaId, turmaId) : null;
      const comLado = presentes.map((p) => ({ id: p.id, grupo: grupos?.grupos.get(p.id) ?? null }));
      const sorteio = sortear(comLado, pedido.computadores);
      const comGrupo = comLado.filter((p) => p.grupo !== null).length;

      return {
        modo: pedido.modo,
        computadores: pedido.computadores,
        equipes: sorteio.equipes.map((e) => ({
          nome: e.nome,
          /* Em ordem alfabética dentro da equipe: a ordem do sorteio não quer
             dizer nada, e na tela ela pareceria uma hierarquia. */
          membros: e.membros.map(membro).sort(porNome),
          grupo: e.grupo,
          mista: e.mista,
        })),
        semEquipe: [],
        agrupamento: grupos
          ? {
              fonte: grupos.descricao,
              comGrupo,
              neutros: comLado.length - comGrupo,
              equipesMistas: sorteio.equipesMistas,
              aviso: grupos.aviso,
            }
          : null,
      };
    }, escolaId);
  }

  /**
   * AS EQUIPES DA ÚLTIMA MISSÃO, como ponto de partida desta.
   *
   * Quem divide computador numa aula costuma dividir na seguinte — a sala é a
   * mesma, as máquinas são as mesmas. A montagem mais recente da MESMA turma em
   * OUTRA missão com equipe é reprojetada sobre a turma de HOJE: quem saiu da
   * turma cai (e é contado em `saidas`, para a tela dizer por que uma equipe
   * encolheu), equipe que ficou vazia some, e quem chegou depois fica em
   * `semEquipe`. Os AUSENTES de lá não vêm: falta é da aula, não da criança.
   *
   * Nada é gravado: é uma proposta, como a `sugestao`.
   */
  async ultima(escolaId: string, turmaId: string, expId: string, professorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.exigirTurma(tx, escolaId, turmaId, professorId);
      this.exigirMissaoComEquipe(expId);

      const outras = EXPERIENCIAS_COM_EQUIPE.filter((e) => e !== expId);
      const [estudantes, origem] = await Promise.all([
        this.estudantesDaTurma(tx, escolaId, turmaId),
        tx.equipesMontagem.findFirst({
          where: { escolaId, turmaId, expId: { in: [...outras] } },
          orderBy: { atualizadoEm: "desc" },
          select: {
            expId: true,
            atualizadoEm: true,
            equipes: {
              where: { escolaId },
              orderBy: { ordem: "asc" },
              select: { nome: true, membros: { where: { escolaId }, select: { estudanteId: true } } },
            },
          },
        }),
      ]);

      if (!origem) return { origem: null, equipes: [], semEquipe: estudantes, saidas: 0 };

      const daTurma = new Map(estudantes.map((e) => [e.id, e]));
      const porNome = (a: MembroDaEquipe, b: MembroDaEquipe) => a.nome.localeCompare(b.nome, "pt-BR");
      const saidas = new Set<string>();
      const colocados = new Set<string>();
      const equipes = origem.equipes
        .map((e) => {
          const membros: MembroDaEquipe[] = [];
          for (const { estudanteId } of e.membros) {
            const atual = daTurma.get(estudanteId);
            if (atual) {
              membros.push(atual);
              colocados.add(estudanteId);
            } else {
              saidas.add(estudanteId);
            }
          }
          return { nome: e.nome, membros: membros.sort(porNome) };
        })
        .filter((e) => e.membros.length > 0);

      return {
        origem: { expId: origem.expId, atualizadoEm: origem.atualizadoEm.toISOString() },
        equipes,
        semEquipe: estudantes.filter((e) => !colocados.has(e.id)),
        saidas: saidas.size,
      };
    }, escolaId);
  }

  /**
   * SALVAR A MONTAGEM — a única rota que escreve.
   *
   * As MESMAS checagens de `SalasService.definirEstado` (turma e matrícula →
   * 404; catálogo → 404; ferramenta de professor → 403; disponibilidade), mais
   * duas: a missão aceita equipe (400) e a montagem é possível (400, com a
   * lista inteira de problemas). A de equipe vem ANTES do catálogo: é fato do
   * código, e responde igual em qualquer instalação.
   *
   * CONCORRÊNCIA OTIMISTA pela `versao`. O computador da sala e o celular do
   * professor abrem a mesma montagem; sem isto, o segundo a salvar apagaria o
   * que o primeiro acabou de arrastar, sem ninguém ver. A trava é o próprio
   * banco: o `updateMany ... WHERE versao = $esperada` pega o lock da linha, e o
   * `PUT` concorrente espera, relê a versão nova e não casa — 409. Para a
   * PRIMEIRA montagem (versão 0), o `createMany` com `skipDuplicates` é um
   * `INSERT ... ON CONFLICT DO NOTHING`: o segundo espera o primeiro, não insere
   * e vira 409 também. Um `P2002` apanhado aqui não serviria — erro dentro da
   * transação a aborta, e a consulta da versão atual já não rodaria.
   *
   * Depois da versão, TROCA INTEIRA: apaga as equipes (os membros caem por
   * cascata) e grava as novas. Diff por equipe economizaria umas linhas numa
   * tabela de dezenas, e custaria a regra de "quem se moveu para onde".
   *
   * Por último, `aoMudarEquipes` avisa quem depende da montagem (a evidência
   * pedagógica), na MESMA transação — e o `desfazer` também avisa.
   */
  async salvar(
    escolaId: string,
    turmaId: string,
    expId: string,
    corpo: SalvarMontagem,
    professorId: string,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.exigirTurma(tx, escolaId, turmaId, professorId);
      this.exigirMissaoComEquipe(expId);

      const experiencia = await tx.experiencia.findUnique({
        where: { expId },
        select: { publico: true },
      });
      if (!experiencia) {
        throw new NotFoundException({
          mensagem:
            "Experiência não está no catálogo desta instalação. " +
            "Em desenvolvimento, rode o seed; em produção, ela entra no catálogo ao ser publicada.",
        });
      }
      if (experiencia.publico !== "estudante") {
        throw new ForbiddenException({
          mensagem: "Esta é uma ferramenta do professor, não uma missão de turma.",
        });
      }
      /* O recurso tem de existir NESTA REDE (ADR-87) — senão a missão sai da
         grade e as equipes dela continuam aceitando gravação pelo endereço. */
      await exigirRecursoDisponivel(tx, escolaId, expId);

      const estudantes = await this.estudantesDaTurma(tx, escolaId, turmaId);
      const erros = validarMontagem(corpo, new Set(estudantes.map((e) => e.id)));
      if (erros.length > 0) {
        throw new BadRequestException({
          codigo: "montagem-invalida",
          mensagem: "As equipes não puderam ser salvas.",
          erros,
        });
      }

      const chave = { escolaId, turmaId, expId };
      const campos = {
        modo: corpo.modo,
        computadores: corpo.computadores,
        ausentes: [...new Set(corpo.ausentes)],
        atualizadoPor: professorId,
        atualizadoEm: new Date(),
      };
      const gravou =
        corpo.versao === 0
          ? await tx.equipesMontagem.createMany({
              data: [{ ...chave, ...campos, versao: 1 }],
              skipDuplicates: true,
            })
          : await tx.equipesMontagem.updateMany({
              where: { ...chave, versao: corpo.versao },
              data: { ...campos, versao: { increment: 1 } },
            });
      if (gravou.count === 0) {
        const atual = await tx.equipesMontagem.findUnique({
          where: { escolaId_turmaId_expId: chave },
          select: { versao: true },
        });
        throw new ConflictException({
          codigo: "equipes-desatualizadas",
          mensagem: "As equipes foram alteradas em outra tela. Recarregue para ver a versão atual.",
          versaoAtual: atual?.versao ?? 0,
        });
      }

      await tx.equipe.deleteMany({ where: chave });
      if (corpo.equipes.length > 0) {
        const criadas = await tx.equipe.createManyAndReturn({
          data: corpo.equipes.map((e, ordem) => ({ ...chave, nome: e.nome.trim(), ordem })),
          select: { id: true, ordem: true },
        });
        const idDaOrdem = new Map(criadas.map((c) => [c.ordem, c.id]));
        const membros = corpo.equipes.flatMap((e, ordem) =>
          e.membros.map((estudanteId) => ({
            ...chave,
            equipeId: idDaOrdem.get(ordem) as string,
            estudanteId,
          })),
        );
        if (membros.length > 0) await tx.equipeMembro.createMany({ data: membros });
      }

      await this.avisarMudanca(tx, chave);
      return this.projecao(tx, escolaId, turmaId, expId);
    }, escolaId);
  }

  /**
   * DESFAZER AS EQUIPES desta missão: a montagem sai, e as equipes e os
   * membros caem por cascata. Idempotente — apagar o que não existe devolve o
   * mesmo `ok`, porque o estado final é o mesmo.
   *
   * Sem checagem de catálogo nem de disponibilidade, de propósito: desfazer é
   * sempre seguro, e uma missão desligada na rede não pode deixar equipes
   * presas que ninguém consegue apagar.
   */
  async desfazer(escolaId: string, turmaId: string, expId: string, professorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.exigirTurma(tx, escolaId, turmaId, professorId);
      await tx.equipesMontagem.deleteMany({ where: { escolaId, turmaId, expId } });
      await this.avisarMudanca(tx, { escolaId, turmaId, expId });
      return { ok: true as const };
    }, escolaId);
  }

  /**
   * A EQUIPE DO ESTUDANTE nesta missão: o nome dela e o primeiro nome dos
   * colegas de computador — desempatado (`rotulosSemRepeticao`) quando repete
   * dentro da equipe. O empate conta o PRÓPRIO estudante: duas Gabrielas no
   * computador, e a outra aparece como "Gabriela Correia", não como "Gabriela".
   *
   * SEMPRE 200, com `equipe: null` quando não há — um 404 aqui apareceria no
   * log do hub como `api-recusou` a cada abertura de missão, para a imensa
   * maioria das crianças, que não tem equipe.
   *
   * A turma sai de `turmasDoEstudante` (matrícula + cache), a mesma da porta
   * da sala. Com equipe em mais de uma turma (a regular e a de componente, na
   * mesma missão), vale a primeira que o banco devolver — caso que a tela do
   * professor não produz hoje, porque a montagem só aceita quem tem a turma
   * como `users.turma_id`.
   */
  async minha(escolaId: string, estudanteId: string, expId: string) {
    if (!permiteEquipes(expId)) return { equipe: null };
    return this.prisma.comTenancy(async (tx) => {
      const turmaIds = await turmasDoEstudante(tx, escolaId, estudanteId);
      if (turmaIds.length === 0) return { equipe: null };

      const vinculo = await tx.equipeMembro.findFirst({
        where: { escolaId, estudanteId, expId, turmaId: { in: turmaIds } },
        select: { turmaId: true },
      });
      if (!vinculo) return { equipe: null };

      const equipe = await equipeDoEstudante(tx, escolaId, vinculo.turmaId, expId, estudanteId);
      if (!equipe) return { equipe: null };
      /* O universo do desempate é a equipe inteira; a resposta leva só os outros. */
      const rotulos = rotulosSemRepeticao(equipe.membros);
      return {
        equipe: {
          nome: equipe.nome,
          colegas: equipe.membros
            .filter((m) => m.id !== estudanteId)
            .map((m) => rotulos.get(m.id) ?? "")
            .filter((nome) => nome.length > 0),
        },
      };
    }, escolaId);
  }
}
