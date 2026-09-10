import { HttpException, Injectable } from "@nestjs/common";
/* `Prisma` como VALOR, não só tipo: `Prisma.JsonNull` é o jeito de gravar JSON
   null explícito numa coluna JSONB nullable — `null` cru significaria "não mexa
   neste campo" e o tipo do Prisma nem aceita. */
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { exigirMissaoLiberada } from "../comum/liberacao";
import {
  ondeAsTurmasSaoVisiveis,
  professorEnsinaOEstudante,
  professorLeciona,
} from "../comum/turmas-do-professor";
import { cartoesDaBolha, EXP_ID, semGabarito, type Bolha, type CartaoPublico } from "./catalogo";
import { validarPayload } from "./contrato";
import { linhasDeLeitura, resumoHonesto, type LinhaDeLeitura } from "./leitura";
import { lerMensagens, type LeituraMensagens } from "./mensagens";
import { calcularPerfil, VERSAO_MAPEAMENTO } from "./mapeamento";
import { colapsarEmQuadrantes, type EscoresPorQuadrante } from "./quadrantes";
import { bolhasElegiveis, corrigirCartoes, escolherBolha } from "./regras";

/**
 * Persistência da exp-70. O I/O e a transação moram aqui; o que decide está em
 * `regras.ts` (puro), `mapeamento.ts` (puro) e `contrato.ts` (validação).
 *
 * Assinaturas recebem `escolaId`/`estudanteId` explícitos, nunca o request: os
 * testes de integração chamam direto, e toda query leva `escola_id` no `where`
 * ALÉM da RLS que o `comTenancy` arma (regra inviolável nº 1, defesa em
 * profundidade).
 */

export interface SessaoAberta {
  sessaoId: string;
  bolha: Bolha;
  /** Só os cartões DESTA criança, e sem gabarito. */
  cartoes: CartaoPublico[];
}

export interface RelatorioDaPartida {
  sessaoId: string;
  abertaEm: string;
  concluidaEm: string | null;
  status: string;
  duracaoSeg: number | null;
  bolha: Bolha;
  cartoesServidos: number;
  resumo: {
    fogueirasAcesas: number;
    pedrasQuebradas: number;
    aldeoesAjudados: number;
    lampioesAcesos: number;
    tochasAcesas: number;
    dilemasVistos: number;
    dilemasResolvidos: number;
    distanciaM: number;
  };
  /** null enquanto a partida não fechou, ou quando ela foi abandonada. */
  perfil: {
    versaoMapeamento: number;
    /** Já com a decisão de mostrar número tomada AQUI. Ver `leitura.ts`. */
    linhas: LinhaDeLeitura[];
    aberturaVsConservacao: number | null;
    transcendenciaVsAutopromocao: number | null;
    amostraSuficiente: boolean;
    frase: string;
  } | null;
  /** null quando nenhum cartão chegou a aparecer — e isso NÃO é "ignorou tudo". */
  mensagens: LeituraMensagens | null;
}

export interface TurmaResumida {
  id: string;
  nome: string;
  serie: string;
  estudantes: number;
}

/**
 * O AGREGADO da turma — o que o gestor vê, e o que abre a tela do professor.
 *
 * Nenhum campo aqui identifica uma criança, e isso é o desenho: porta a regra do
 * app de origem ("pesquisador nunca vê a linha de uma criança; só agregados")
 * para o papel `gestor_escola`. A distribuição de bolhas existe porque o professor
 * precisa saber, ANTES do debate, se as três estão na sala — sem as três, o
 * momento em que a turma descobre que recebeu mensagens diferentes não acontece.
 */
export interface ResumoDaTurma {
  estudantes: number;
  jogaram: number;
  concluiram: number;
  abandonaram: number;
  /** Quantas partidas concluídas sustentam leitura (`amostraSuficiente`). */
  comAmostra: number;
  porBolha: Record<Bolha, number>;
  /** Só de quem tem leitura das mensagens gravada. */
  mensagens: {
    comLeitura: number;
    golpeAceito: number;
    golpeRecusado: number;
    legitimaRecusada: number;
    naoResponderam: number;
  };
}

export interface LinhaDaTurma {
  estudanteId: string;
  id?: string;
  nome: string;
  partidas: number;
  ultimaEm: string | null;
  bolha: Bolha | null;
  /** da última partida concluída */
  fogueirasAcesas: number | null;
  amostraSuficiente: boolean | null;
}

function naoEncontrado(): never {
  throw new HttpException({ mensagem: "Partida não encontrada." }, 404);
}

@Injectable()
export class VilaService {
  constructor(private readonly prisma: PrismaService) {}

  /* ======================================================================
     ABRIR
     ====================================================================== */

  /**
   * Abre a partida: crava o início no SERVIDOR, resolve a bolha e entrega os
   * cartões desta criança sem gabarito.
   *
   * Um estudante pode abrir várias partidas (ele pode jogar de novo). Partidas
   * anteriores que ficaram `aberta` são marcadas `abandonada`: aba fechada no
   * meio é o caso normal, e deixá-las abertas para sempre faria a contagem de
   * partidas do painel crescer sem que ninguém tivesse jogado.
   */
  async abrir(escolaId: string, estudanteId: string, expVersion: string): Promise<SessaoAberta> {
    return this.prisma.comTenancy(async (tx) => {
      const estudante = await tx.user.findFirst({
        where: { id: estudanteId, escolaId, role: "estudante" },
        select: { turmaId: true, turma: { select: { serie: true } } },
      });
      if (!estudante) throw new HttpException({ mensagem: "Estudante não encontrado nesta escola." }, 404);

      /* A porta da sala (ADR-69). A Vila é TRANSVERSAL (`series: []`), o que
         quer dizer que ela cabe em qualquer ano — não que ela abre sozinha: o
         professor decide quando ela entra, porque ela é o Ato 1 do Instanooria e
         a ordem entre as duas é a aula. */
      await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);

      const bolha = await this.resolverBolha(tx, escolaId, estudanteId, estudante.turmaId, estudante.turma?.serie ?? null);
      const cartoes = cartoesDaBolha(bolha);

      /* Fecha o que ficou aberto ANTES de criar a nova, para nunca haver duas
         abertas do mesmo estudante — o `concluir` procura por id, mas o painel conta
         partidas e duas abertas seriam duas partidas que ninguém jogou. */
      await tx.vilaSessao.updateMany({
        where: { escolaId, estudanteId: estudanteId, status: "aberta" },
        data: { status: "abandonada", concluidaEm: new Date() },
      });

      const sessao = await tx.vilaSessao.create({
        data: {
          escolaId,
          estudanteId: estudanteId,
          turmaId: estudante.turmaId,
          expVersion,
          schemaVersion: 1,
          bolha,
          /* Quantos a API ENTREGOU. Diferente de `seguranca.apareceram`, que é
             quantos chegaram a aparecer na tela: uma criança que termina em três
             minutos pode não disparar nenhum gatilho, e o relatório precisa
             distinguir "a missão não rodou" de "ela ignorou tudo". */
          cartoesServidos: cartoes.length,
          /* `abertaEm` sai do DEFAULT do banco (`CURRENT_TIMESTAMP`), não de um
             `new Date()` daqui: o instante de início é do servidor, e o relógio
             que vale é o dele. Havia um `expiresAt` calculado aqui; ver a nota
             sobre prazo no schema. */
        },
        select: { id: true },
      });

      return { sessaoId: sessao.id, bolha, cartoes: cartoes.map(semGabarito) };
    }, escolaId);
  }

  /**
   * A bolha do estudante: reusa a que ele já tem, ou atribui a menos usada na turma.
   *
   * O LOCK CONSULTIVO não é zelo: a sala inteira clica "jogar" no mesmo minuto,
   * e sem ele os 25 leriam a mesma contagem vazia e todos cairiam na bolha A —
   * que é exatamente a falha que estraga o debate. Por turma (não global), então
   * duas turmas em aulas simultâneas não se esperam.
   */
  private async resolverBolha(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    serie: string | null,
  ): Promise<Bolha> {
    const existente = await tx.vilaBolha.findUnique({
      where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      select: { bolha: true },
    });
    if (existente) return existente.bolha as Bolha;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`vila:${escolaId}:${turmaId ?? "sem-turma"}`}, 0))`;

    /* Relê depois do lock: quem esperou pode ter sido atendido enquanto esperava. */
    const depoisDoLock = await tx.vilaBolha.findUnique({
      where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      select: { bolha: true },
    });
    if (depoisDoLock) return depoisDoLock.bolha as Bolha;

    /* Contagem DENTRO DA TURMA: é a sala que precisa ter as três bolhas.
       Estudante sem turma conta contra os outros sem turma — não contra a rede. */
    const naTurma = await tx.vilaBolha.groupBy({
      by: ["bolha"],
      where: { escolaId, estudante: { turmaId } },
      _count: { bolha: true },
    });
    const contagem: Partial<Record<Bolha, number>> = {};
    for (const linha of naTurma) contagem[linha.bolha as Bolha] = linha._count.bolha;

    const bolha = escolherBolha(contagem, serie);
    await tx.vilaBolha.create({ data: { escolaId, estudanteId: estudanteId, bolha } });
    return bolha;
  }

  /* ======================================================================
     CONCLUIR
     ====================================================================== */

  /**
   * Fecha a partida: valida o payload, corrige os cartões, recalcula o perfil e
   * grava tudo numa transação.
   *
   * IDEMPOTENTE por `concluidaEm`: o cliente não tem retry em POST (regra do
   * SDK), mas a criança pode recarregar e o `pagehide` pode disparar duas vezes.
   * Reconcluir devolve o que já está gravado, sem recalcular.
   */
  async concluir(
    escolaId: string,
    estudanteId: string,
    sessaoId: string,
    bruto: unknown,
  ): Promise<{ status: "gravada" | "jaEstava"; perfilId: string | null }> {
    const v = validarPayload(bruto);
    if (!v.ok) {
      throw new HttpException(
        { codigo: "PAYLOAD_INVALIDO", mensagem: v.motivo, detalhes: v.detalhes },
        422,
      );
    }
    const p = v.payload;

    return this.prisma.comTenancy(async (tx) => {
      const sessao = await tx.vilaSessao.findFirst({
        where: { id: sessaoId, escolaId, estudanteId: estudanteId },
        select: { id: true, bolha: true, status: true },
      });
      if (!sessao) naoEncontrado();
      if (sessao.status !== "aberta") {
        const perfil = await tx.vilaPerfil.findFirst({
          where: { sessaoId, versaoMapeamento: VERSAO_MAPEAMENTO },
          select: { id: true },
        });
        return { status: "jaEstava" as const, perfilId: perfil?.id ?? null };
      }

      const bolha = sessao.bolha as Bolha;
      const correcao = corrigirCartoes(p.seguranca.cartoes, bolha);
      if (!correcao.ok) {
        throw new HttpException(
          { codigo: "CARTOES_INVALIDOS", mensagem: correcao.motivo, detalhes: correcao.detalhes },
          422,
        );
      }

      const mensagens = lerMensagens(bolha, correcao.cartoes);

      /* Partida abandonada NÃO gera perfil: quem largou no meio não escolheu
         nada que se possa ler, e um retrato a partir de dois minutos de jogo
         diria mais sobre o cansaço da criança do que sobre valores. O bruto fica
         mesmo assim — quantas partidas são abandonadas é um dado sobre o JOGO. */
      const perfil = p.status === "completa" ? calcularPerfil(p) : null;

      await tx.vilaSessao.update({
        where: { id: sessaoId },
        data: {
          status: p.status,
          concluidaEm: new Date(),
          duracaoSeg: p.duracaoSeg,
          duracaoTotalSeg: p.duracaoTotalSeg,
          fogueirasAcesas: p.resumo.fogueirasAcesas,
          pedrasQuebradas: p.resumo.pedrasQuebradas,
          aldeoesAjudados: p.resumo.aldeoesAjudados,
          lampioesAcesos: p.resumo.lampioesAcesos,
          tochasAcesas: p.resumo.tochasAcesas,
          dilemasVistos: p.resumo.dilemasVistos,
          dilemasResolvidos: p.resumo.dilemasResolvidos,
          distanciaM: p.resumo.distanciaM,
          payload: p as unknown as Prisma.InputJsonObject,
          /* Persistida junto do perfil e pelo mesmo motivo: sobreviver à purga do
             payload. No app de origem era derivada do bruto ao desenhar a tela,
             derivada do bruto ao desenhar a tela. Persistir é o que permite ao
             relatório sobreviver a qualquer expurgo futuro do `payload` — e é
             mais barato que reprocessar a leitura a cada visita. */
          /* `DbNull`, não `JsonNull`: o primeiro é SQL NULL, o segundo é o VALOR
             JSON `null` dentro da coluna. Com `JsonNull`, um
             `leitura_mensagens IS NOT NULL` responde TRUE para partidas em que a
             missão não aconteceu — e a pergunta "quais partidas têm leitura das
             mensagens?" passa a devolver todas. O caminho de leitura funcionava
             nos dois casos, que é o que torna esse erro silencioso. */
          leituraMensagens: mensagens
            ? ({ v: 1, ...mensagens } as unknown as Prisma.InputJsonObject)
            : Prisma.DbNull,
        },
      });

      let perfilId: string | null = null;
      if (perfil) {
        const criado = await tx.vilaPerfil.create({
          data: {
            escolaId,
            sessaoId,
            estudanteId: estudanteId,
            versaoMapeamento: VERSAO_MAPEAMENTO,
            valores: { v: 1, ...perfil.valores } as unknown as Prisma.InputJsonObject,
            graus: { v: 1, ...perfil.graus } as unknown as Prisma.InputJsonObject,
            aberturaVsConservacao: perfil.aberturaVsConservacao,
            transcendenciaVsAutopromocao: perfil.transcendenciaVsAutopromocao,
            amostraSuficiente: perfil.amostraSuficiente,
          },
          select: { id: true },
        });
        perfilId = criado.id;
      }

      return { status: "gravada" as const, perfilId };
    }, escolaId);
  }

  /* ======================================================================
     LEITURA (professor)
     ====================================================================== */

  /** Turmas da escola — alimenta o seletor da tela de resultados. SEM filtro por
   *  série: a Vila do Lume é transversal, e filtrar aqui deixaria de fora
   *  exatamente as turmas para as quais ela existe. */
  async turmas(escolaId: string, professorId?: string): Promise<TurmaResumida[]> {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: ondeAsTurmasSaoVisiveis(escolaId, professorId),
        select: { id: true, nome: true, serie: true, _count: { select: { estudantes: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return turmas.map((t) => ({
        id: t.id,
        nome: t.nome,
        serie: t.serie,
        estudantes: t._count.estudantes,
      }));
    }, escolaId);
  }

  /**
   * Agregado da turma. É o que o GESTOR pode ver — nenhuma linha de criança.
   *
   * Conta a ÚLTIMA partida concluída de cada estudante, não todas: quem jogou três
   * vezes contaria três golpes recusados e enviesaria a distribuição da sala.
   */
  async resumoDaTurma(
    escolaId: string,
    turmaId: string,
    professorId?: string,
  ): Promise<ResumoDaTurma | null> {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true } });
      if (!turma) return null;
      // Professor só lê a turma em que tem matrícula; gestor lê a escola.
      if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) return null;

      const estudantes = await tx.user.findMany({
        where: { escolaId, turmaId, role: "estudante" },
        select: { id: true },
      });
      const ids = estudantes.map((a) => a.id);
      const vazio: ResumoDaTurma = {
        estudantes: estudantes.length,
        jogaram: 0,
        concluiram: 0,
        abandonaram: 0,
        comAmostra: 0,
        porBolha: { A: 0, B: 0, C: 0 },
        mensagens: { comLeitura: 0, golpeAceito: 0, golpeRecusado: 0, legitimaRecusada: 0, naoResponderam: 0 },
      };
      if (ids.length === 0) return vazio;

      const [sessoes, bolhas, perfis] = await Promise.all([
        tx.vilaSessao.findMany({
          where: { escolaId, estudanteId: { in: ids }, status: { not: "aberta" } },
          select: { id: true, estudanteId: true, status: true, leituraMensagens: true, abertaEm: true },
          orderBy: { abertaEm: "desc" },
        }),
        tx.vilaBolha.findMany({ where: { escolaId, estudanteId: { in: ids } }, select: { bolha: true } }),
        tx.vilaPerfil.findMany({
          where: { escolaId, estudanteId: { in: ids }, versaoMapeamento: VERSAO_MAPEAMENTO },
          select: { sessaoId: true, amostraSuficiente: true },
        }),
      ]);

      for (const b of bolhas) {
        const chave = b.bolha as Bolha;
        if (chave in vazio.porBolha) vazio.porBolha[chave] += 1;
      }

      const amostraDe = new Map(perfis.map((p) => [p.sessaoId, p.amostraSuficiente]));
      const ultimaDe = new Map<string, (typeof sessoes)[number]>();
      for (const s of sessoes) if (!ultimaDe.has(s.estudanteId)) ultimaDe.set(s.estudanteId, s);

      for (const s of ultimaDe.values()) {
        vazio.jogaram += 1;
        if (s.status === "completa") vazio.concluiram += 1;
        else vazio.abandonaram += 1;
        if (amostraDe.get(s.id) === true) vazio.comAmostra += 1;

        const leitura = leituraGravada(s.leituraMensagens);
        if (!leitura) continue;
        vazio.mensagens.comLeitura += 1;
        if (leitura.golpeAceito > 0) vazio.mensagens.golpeAceito += 1;
        if (leitura.golpeRecusado > 0) vazio.mensagens.golpeRecusado += 1;
        if (leitura.legitimaRecusada > 0) vazio.mensagens.legitimaRecusada += 1;
        /* "Não respondeu nada" é populaçao própria, e o debate depende dela: são
           as crianças que ficam caladas ou perguntam "que mensagem?". */
        if (leitura.nemViu + leitura.deixouPassar === leitura.cartoes.length) {
          vazio.mensagens.naoResponderam += 1;
        }
      }
      return vazio;
    }, escolaId);
  }

  /** Uma linha por estudante da turma. Nunca atravessa escola: `escolaId` no where. */
  async daTurma(escolaId: string, turmaId: string, professorId?: string): Promise<LinhaDaTurma[]> {
    return this.prisma.comTenancy(async (tx) => {
      if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) return [];
      const estudantes = await tx.user.findMany({
        where: { escolaId, turmaId, role: "estudante" },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      });
      if (estudantes.length === 0) return [];

      const ids = estudantes.map((a) => a.id);
      const [sessoes, bolhas, perfis] = await Promise.all([
        tx.vilaSessao.findMany({
          where: { escolaId, estudanteId: { in: ids } },
          select: { id: true, estudanteId: true, abertaEm: true, status: true, fogueirasAcesas: true },
          orderBy: { abertaEm: "desc" },
        }),
        tx.vilaBolha.findMany({ where: { escolaId, estudanteId: { in: ids } }, select: { estudanteId: true, bolha: true } }),
        tx.vilaPerfil.findMany({
          where: { escolaId, estudanteId: { in: ids }, versaoMapeamento: VERSAO_MAPEAMENTO },
          select: { estudanteId: true, sessaoId: true, amostraSuficiente: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const bolhaDe = new Map(bolhas.map((b) => [b.estudanteId, b.bolha as Bolha]));
      /* Só partidas CONCLUÍDAS contam como "última": uma aberta agora mesmo não
         tem números, e mostrá-la faria a linha do estudante piscar zeros no meio da
         aula. */
      const ultimaDe = new Map<string, (typeof sessoes)[number]>();
      const totalDe = new Map<string, number>();
      for (const s of sessoes) {
        totalDe.set(s.estudanteId, (totalDe.get(s.estudanteId) ?? 0) + 1);
        if (s.status !== "aberta" && !ultimaDe.has(s.estudanteId)) ultimaDe.set(s.estudanteId, s);
      }
      const perfilDe = new Map<string, (typeof perfis)[number]>();
      for (const perfil of perfis) if (!perfilDe.has(perfil.estudanteId)) perfilDe.set(perfil.estudanteId, perfil);

      return estudantes.map((a) => {
        const ultima = ultimaDe.get(a.id);
        const perfil = perfilDe.get(a.id);
        return {
          estudanteId: a.id,
          id: a.id,
          nome: a.displayName,
          partidas: totalDe.get(a.id) ?? 0,
          ultimaEm: ultima ? ultima.abertaEm.toISOString() : null,
          bolha: bolhaDe.get(a.id) ?? null,
          fogueirasAcesas: ultima ? ultima.fogueirasAcesas : null,
          amostraSuficiente: perfil ? perfil.amostraSuficiente : null,
        };
      });
    }, escolaId);
  }

  /**
   * Quais bolhas a api serve para ESTA turma — a mesma regra de `abrir`.
   *
   * Existe para o guia do professor não projetar um golpe que a sala nunca
   * recebeu: nos anos iniciais a bolha B fica de fora, e um guia que a mostrasse
   * mandaria o professor esperar a reação de um grupo que não existe ali.
   */
  async bolhasDaTurma(
    escolaId: string,
    turmaId: string,
    professorId?: string,
  ): Promise<Bolha[] | null> {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({
        where: { id: turmaId, escolaId },
        select: { serie: true },
      });
      if (!turma) return null;
      // Professor só lê a turma em que tem matrícula; gestor lê a escola.
      if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) return null;
      return [...bolhasElegiveis(turma.serie)];
    }, escolaId);
  }

  /**
   * ZERA os dados da Vila de uma turma: partidas, perfis e as bolhas.
   *
   * As BOLHAS vão junto, e é o ponto. Rodar a missão de novo com a mesma bolha
   * serviria à criança o mesmo golpe — ela reconhece, e a segunda rodada não mede
   * nada. Quem zera está dizendo "vou rodar isto do zero"; sem sortear de novo,
   * não é do zero.
   *
   * O que NÃO é tocado: `exp_01_exp_70_perfis_importados`. Aquilo pertence à atividade do
   * Instanooria, não à Vila, e apagar de lá trocaria os lados de uma atividade em
   * andamento sem ninguém pedir. Se o professor quiser refazer a largada, ele
   * reimporta depois de a turma jogar de novo.
   */
  async zerarTurma(
    escolaId: string,
    turmaId: string,
    professorId?: string,
  ): Promise<{ partidas: number; perfis: number; bolhas: number } | null> {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true } });
      if (!turma) return null;
      /* Apagar é o que mais precisa da matrícula: sem esta linha, qualquer
         professor da escola zerava a missão de qualquer turma dela. */
      if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) return null;

      const estudantes = await tx.user.findMany({
        where: { escolaId, turmaId, role: "estudante" },
        select: { id: true },
      });
      const ids = estudantes.map((a) => a.id);
      if (ids.length === 0) return { partidas: 0, perfis: 0, bolhas: 0 };

      /* Ordem: perfis antes das partidas. O FK de `vila_perfis.sessao_id` é
         ON DELETE CASCADE, então apagar a sessão levaria o perfil junto — mas
         contar depois de o cascade rodar daria zero, e o professor precisa ver
         quantos perfis sumiram. */
      const perfis = await tx.vilaPerfil.deleteMany({ where: { escolaId, estudanteId: { in: ids } } });
      const partidas = await tx.vilaSessao.deleteMany({ where: { escolaId, estudanteId: { in: ids } } });
      const bolhas = await tx.vilaBolha.deleteMany({ where: { escolaId, estudanteId: { in: ids } } });

      return { partidas: partidas.count, perfis: perfis.count, bolhas: bolhas.count };
    }, escolaId);
  }

  /* ======================================================================
     ATO 1 — o perfil da Vila alimentando o Instanooria
     ====================================================================== */

  /**
   * O perfil mais recente de cada estudante, já colapsado nos quatro quadrantes.
   *
   * Devolve TAMBÉM quem ficou de fora e por quê: uma importação que diz "23
   * importados" sem dizer que 7 foram descartados deixa o professor achando que
   * a turma inteira entrou. Ele precisa saber para decidir se completa à mão.
   *
   * Não escreve nada — quem grava em `exp_01_exp_70_perfis_importados` é o módulo `perfis`,
   * que é o dono daquela tabela. Este método é a leitura.
   */
  async perfisParaOAto1(
    escolaId: string,
    turmaId?: string,
  ): Promise<{
    prontos: Array<{
      id: string;
      estudanteId: string;
      escores: EscoresPorQuadrante;
      medidoEm: Date;
      /** A partida de onde a medida saiu, e sob que mapeamento — o que permite
       *  ao painel dizer depois que a versão mudou desde a importação. */
      sessaoId: string;
      versaoMapeamento: number;
    }>;
    descartados: Array<{ id: string; estudanteId: string; nome: string; motivo: string }>;
    semPartida: number;
  }> {
    return this.prisma.comTenancy(async (tx) => {
      const estudantes = await tx.user.findMany({
        where: { escolaId, role: "estudante", ...(turmaId ? { turmaId } : {}) },
        select: { id: true, displayName: true },
      });
      if (estudantes.length === 0) return { prontos: [], descartados: [], semPartida: 0 };

      const ids = estudantes.map((a) => a.id);
      const perfis = await tx.vilaPerfil.findMany({
        where: { escolaId, estudanteId: { in: ids }, versaoMapeamento: VERSAO_MAPEAMENTO },
        orderBy: { createdAt: "desc" },
      });

      /* O MAIS RECENTE de cada estudante. Quem jogou três vezes tem três perfis, e o
         que vale é o último — não a média, que misturaria partidas de dias
         diferentes num número que não descreve nenhuma delas. */
      const ultimoDe = new Map<string, (typeof perfis)[number]>();
      for (const perfil of perfis) if (!ultimoDe.has(perfil.estudanteId)) ultimoDe.set(perfil.estudanteId, perfil);

      const prontos: Array<{
        id: string;
        estudanteId: string;
        escores: EscoresPorQuadrante;
        medidoEm: Date;
        sessaoId: string;
        versaoMapeamento: number;
      }> = [];
      const descartados: Array<{ id: string; estudanteId: string; nome: string; motivo: string }> = [];
      let semPartida = 0;

      for (const estudante of estudantes) {
        const perfil = ultimoDe.get(estudante.id);
        if (!perfil) {
          semPartida += 1;
          continue;
        }
        const colapso = colapsarEmQuadrantes(
          perfil.valores as Record<string, unknown>,
          perfil.graus as Record<string, unknown>,
          perfil.amostraSuficiente,
        );
        if (!colapso.ok) {
          descartados.push({ id: estudante.id, estudanteId: estudante.id, nome: estudante.displayName, motivo: colapso.detalhe });
          continue;
        }
        prontos.push({
          id: estudante.id,
          estudanteId: estudante.id,
          escores: colapso.escores,
          medidoEm: perfil.createdAt,
          sessaoId: perfil.sessaoId,
          versaoMapeamento: perfil.versaoMapeamento,
        });
      }

      return { prontos, descartados, semPartida };
    }, escolaId);
  }

  /**
   * O relatório da última partida concluída de um estudante.
   *
   * As linhas do perfil saem daqui JÁ COM A DECISÃO de mostrar número tomada
   * (`leitura.ts`): a api não devolve número para valor não-`scored`, e o tipo
   * da linha não tem onde carregá-lo. O hub fica incapaz de imprimir "Poder 100"
   * a partir de um sinal só.
   */
  async doEstudante(
    escolaId: string,
    estudanteId: string,
    professorId?: string,
  ): Promise<RelatorioDaPartida | null> {
    return this.prisma.comTenancy(async (tx) => {
      /* A criança tem de ser de uma turma DELE. Antes bastava ser da mesma
         escola, e este relatório carrega a leitura de perfil de um menor. */
      if (!(await professorEnsinaOEstudante(tx, escolaId, estudanteId, professorId))) return null;

      const sessao = await tx.vilaSessao.findFirst({
        where: { escolaId, estudanteId, status: { not: "aberta" } },
        orderBy: { abertaEm: "desc" },
      });
      if (!sessao) return null;

      const perfil = await tx.vilaPerfil.findFirst({
        where: { sessaoId: sessao.id, versaoMapeamento: VERSAO_MAPEAMENTO },
      });

      const linhas = perfil
        ? linhasDeLeitura(
            perfil.valores as Record<string, unknown>,
            perfil.graus as Record<string, unknown>,
          )
        : [];

      return {
        sessaoId: sessao.id,
        abertaEm: sessao.abertaEm.toISOString(),
        concluidaEm: sessao.concluidaEm ? sessao.concluidaEm.toISOString() : null,
        status: sessao.status,
        duracaoSeg: sessao.duracaoSeg,
        bolha: sessao.bolha as Bolha,
        cartoesServidos: sessao.cartoesServidos,
        resumo: {
          fogueirasAcesas: sessao.fogueirasAcesas,
          pedrasQuebradas: sessao.pedrasQuebradas,
          aldeoesAjudados: sessao.aldeoesAjudados,
          lampioesAcesos: sessao.lampioesAcesos,
          tochasAcesas: sessao.tochasAcesas,
          dilemasVistos: sessao.dilemasVistos,
          dilemasResolvidos: sessao.dilemasResolvidos,
          distanciaM: sessao.distanciaM,
        },
        perfil: perfil
          ? {
              versaoMapeamento: perfil.versaoMapeamento,
              linhas,
              aberturaVsConservacao: perfil.aberturaVsConservacao,
              transcendenciaVsAutopromocao: perfil.transcendenciaVsAutopromocao,
              amostraSuficiente: perfil.amostraSuficiente,
              frase: resumoHonesto(linhas, perfil.amostraSuficiente),
            }
          : null,
        mensagens: leituraGravada(sessao.leituraMensagens),
      };
    }, escolaId);
  }
}

/** O JSONB da leitura das mensagens, normalizado por `v`. Nunca adivinha por
 *  presença de chave: JSONB de outra geração vira `null` em vez de meia-leitura. */
function leituraGravada(bruto: unknown): LeituraMensagens | null {
  if (bruto === null || typeof bruto !== "object") return null;
  const obj = bruto as Record<string, unknown>;
  if (obj.v !== 1) return null;
  const { v: _v, ...resto } = obj;
  return resto as unknown as LeituraMensagens;
}
