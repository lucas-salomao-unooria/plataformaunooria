import { Injectable } from "@nestjs/common";
import { Prisma, type EcoSessao } from "@prisma/client";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import type { Perfil } from "../auth/claims";
import { PrismaService } from "../prisma/prisma.service";
import {
  AMARA_CELEBRA,
  AMARA_CUTUCAO,
  CARDS,
  FEED,
  MATERIA,
  OPCOES,
  REACOES,
  estrategiasSemGabarito,
  justificativasSemGabarito,
  semGabarito,
  type Desfecho,
  type IdDeOpcao,
  type Reacao,
} from "./catalogo";
import { erroDeJogo } from "./erros";
import { IaDaExp07Service, TURNOS_COM_AMARA } from "./ia.service";
import { MidiaDaExp07Service } from "./midia.service";
import { avaliarPercurso } from "./regras/pontuacao";
import {
  ETAPA_DA_ACAO,
  ETAPA_INICIAL,
  aguardandoATurma,
  normalizarEtapa,
  normalizarPasso,
  passoEfetivo,
  type AcaoDoGate,
  type Etapa,
  type Passo,
} from "./regras/passos";
import {
  ESTADO_INICIAL,
  aplicarAcao,
  aplicarDesfazer,
  aplicarIntervencao,
  aplicarReflexao,
  aplicarVerSintese,
  desfechoDe,
  type Acao,
  type EstadoSessao,
  type ResultadoRegra,
} from "./regras/sessao";

/**
 * Persistência da exp-07. Assinaturas recebem `escolaId`/`estudanteId`
 * explícitos (não o request) — os testes de integração chamam direto, e toda
 * query leva `escola_id` no `where` ALÉM da RLS que o `comTenancy` arma
 * (regra inviolável nº 1, defesa em profundidade).
 *
 * A mídia e as três superfícies de IA entram na fase seguinte, por trás de
 * `apps/api/src/ai`. Este arquivo é a missão inteira SEM modelo nenhum — e ela
 * fecha assim, com as reações do catálogo. Isso não é degradação: é o piso que
 * garante que uma aula não depende de o Vertex estar de pé.
 */

/** Minutos sem ação para o painel marcar ociosidade. O alerta é para o
 *  professor ir até a carteira, não para punir. */
export const MINUTOS_PARA_OCIOSO = 3;

export interface EstadoPublico {
  passo: Passo;
  passoDoEstudante: Passo;
  aguardandoATurma: boolean;
  inspecionouMateria: boolean;
  ouviuAudio: boolean;
  ouviuPodcast: boolean;
  cardsLidos: number;
  opcao: IdDeOpcao | null;
  /**
   * O que a resposta produziu no bairro — `null` enquanto não houver resposta.
   *
   * Existe para o cliente não precisar saber QUE LETRA é a checada. Sem ele, a
   * tela comparava `opcao === "B"` para decidir se desenha o alfinete ou o
   * botão de desfazer, e essa comparação ia legível para o bundle: qualquer um
   * abrindo o DevTools lia a resposta certa antes de responder (regra 3).
   *
   * Devolvê-lo DEPOIS do envio não vaza nada: a essa altura a criança acabou de
   * ver a cena acontecer na tela.
   */
  desfecho: Desfecho | null;
  desfazerUsado: number;
  concluidoEm: string | null;
  turma: { etapa: Etapa };
}

type LinhaDaSessao = Pick<
  EcoSessao,
  | "passo"
  | "inspecionouMateria"
  | "ouviuAudio"
  | "ouviuPodcast"
  | "cardsLidos"
  | "opcao"
  | "latenciaSeg"
  | "desfazerUsado"
  | "score"
  | "concluidoEm"
>;

function paraEstado(linha: LinhaDaSessao | null | undefined): EstadoSessao {
  if (!linha) return { ...ESTADO_INICIAL };
  return {
    passo: normalizarPasso(linha.passo),
    inspecionouMateria: linha.inspecionouMateria,
    ouviuAudio: linha.ouviuAudio,
    ouviuPodcast: linha.ouviuPodcast,
    cardsLidos: linha.cardsLidos,
    opcao: (linha.opcao as IdDeOpcao | null) ?? null,
    latenciaSeg: linha.latenciaSeg,
    desfazerUsado: linha.desfazerUsado,
    score: linha.score,
    concluidoEm: linha.concluidoEm,
  };
}

function paraColunas(estado: EstadoSessao): Prisma.EcoSessaoUpdateInput {
  return {
    passo: estado.passo,
    inspecionouMateria: estado.inspecionouMateria,
    ouviuAudio: estado.ouviuAudio,
    ouviuPodcast: estado.ouviuPodcast,
    cardsLidos: estado.cardsLidos,
    opcao: estado.opcao,
    latenciaSeg: estado.latenciaSeg,
    desfazerUsado: estado.desfazerUsado,
    score: estado.score,
    concluidoEm: estado.concluidoEm,
  };
}

function publico(estado: EstadoSessao, etapa: Etapa | null): EstadoPublico {
  return {
    passo: passoEfetivo(estado.passo, etapa),
    passoDoEstudante: estado.passo,
    aguardandoATurma: aguardandoATurma(estado.passo, etapa),
    inspecionouMateria: estado.inspecionouMateria,
    ouviuAudio: estado.ouviuAudio,
    ouviuPodcast: estado.ouviuPodcast,
    cardsLidos: estado.cardsLidos,
    opcao: estado.opcao,
    desfecho: estado.opcao ? desfechoDe(estado.opcao).desfecho : null,
    desfazerUsado: estado.desfazerUsado,
    concluidoEm: estado.concluidoEm?.toISOString() ?? null,
    // Sem turma o cliente ainda precisa de um valor para renderizar; a etapa
    // inicial é a verdade ("a aula não começou"), e `aguardandoATurma` já
    // devolveu `false`, então nada trava.
    turma: { etapa: etapa ?? ETAPA_INICIAL },
  };
}

function avatarDe(estudante: { displayName: string }): string {
  const inicial = estudante.displayName.trim().charAt(0);
  return (inicial || "?").toUpperCase();
}

function minutosDesde(instante: Date, agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - instante.getTime()) / 60_000));
}

@Injectable()
export class OEcoNoGrupoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaDaExp07Service,
    private readonly midia: MidiaDaExp07Service,
  ) {}

  /** Boot da experiência — READ-ONLY: sem linha devolve o estado inicial. */
  async sessao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const estudante = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const [linha, etapa, mensagens, reflexao] = await Promise.all([
        tx.ecoSessao.findUnique({ where: { escolaId_estudanteId: { escolaId, estudanteId } } }),
        this.etapaDaTurma(tx, escolaId, turmaId),
        tx.ecoMensagem.findMany({
          where: { escolaId, estudanteId },
          orderBy: { id: "asc" },
          select: { papel: true, texto: true },
        }),
        tx.ecoReflexao.findUnique({ where: { escolaId_estudanteId: { escolaId, estudanteId } } }),
      ]);
      const estado = paraEstado(linha);
      return {
        ...publico(estado, etapa),
        catalogo: {
          feed: [...FEED],
          materia: { ...MATERIA },
          opcoes: OPCOES.map(semGabarito),
          cards: [...CARDS],
          estrategias: estrategiasSemGabarito(),
          justificativas: justificativasSemGabarito(),
          amaraCelebra: AMARA_CELEBRA,
          amaraCutucao: AMARA_CUTUCAO,
        },
        // `null` num id é informação: a mídia não foi preparada, e o cliente
        // cai na transcrição (que já está na tela) em vez de esperar arquivo.
        midia: { urls: await this.midia.urls() },
        reacoes: (linha?.reacoes as Reacao[] | null) ?? null,
        amara: mensagens.map((m) => ({ papel: m.papel as "estudante" | "amara", texto: m.texto })),
        reflexao: reflexao
          ? {
              estrategias: reflexao.estrategias,
              justificativa: reflexao.justificativa,
              devolutiva: reflexao.devolutiva,
            }
          : null,
        estudante: { nome: estudante.displayName, avatar: avatarDe(estudante) },
      };
    }, escolaId);
  }

  /** O polling do gate — leve de propósito: sem catálogo e sem mídia. */
  async gate(escolaId: string, turmaId: string | null, passoBruto?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const etapa = await this.etapaDaTurma(tx, escolaId, turmaId);
      const passo = normalizarPasso(passoBruto ?? "chat_amara");
      return {
        etapa: etapa ?? ETAPA_INICIAL,
        passoEfetivo: passoEfetivo(passo, etapa),
        // O instante é do SERVIDOR: o relógio da máquina da escola atrasa, e
        // não é ele que decide o momento da aula.
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  acao(escolaId: string, estudanteId: string, turmaId: string | null, acao: Acao) {
    return this.mutar(escolaId, estudanteId, turmaId, (estado, etapa) =>
      aplicarAcao(estado, acao, etapa),
    );
  }

  async intervencao(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    perfil: Perfil,
    opcao: IdDeOpcao,
    latenciaSeg: number,
  ) {
    // O DESFECHO é do servidor, sempre: sai do gabarito do catálogo antes de
    // qualquer modelo ser chamado. O que a IA faz é escrever como o bairro
    // reage a ele — e quando ela não responde, o roteiro do catálogo é o
    // desfecho autoral completo, não um remendo.
    const { desfecho, correta } = desfechoDe(opcao);
    const gerado = await this.ia.reacoes(escolaId, estudanteId, perfil, opcao, desfecho);
    const reacoes = gerado?.reacoes ?? [...REACOES[desfecho]];
    const resposta = await this.mutar(
      escolaId,
      estudanteId,
      turmaId,
      (estado, etapa) => aplicarIntervencao(estado, opcao, latenciaSeg, etapa),
      {
        reacoes: reacoes as unknown as Prisma.InputJsonValue,
        ...(gerado
          ? { tokensGastos: { increment: gerado.tokens }, chamadasIa: { increment: 1 } }
          : {}),
      },
    );
    return {
      ...resposta,
      desfecho,
      reacoes,
      // A comemoração no privado só existe quando o bairro se acalma. Mandá-la
      // no caminho degenerado seria Amara elogiar quem espalhou o boato.
      ...(correta ? { amaraCelebra: AMARA_CELEBRA } : {}),
    };
  }

  desfazer(escolaId: string, estudanteId: string, turmaId: string | null) {
    // `DbNull` e não `null`: a coluna é JSONB nullable, e o Prisma exige o
    // sentinela para distinguir "grave NULL" de "não mexa nesta coluna".
    return this.mutar(escolaId, estudanteId, turmaId, (estado) => aplicarDesfazer(estado), {
      reacoes: Prisma.DbNull,
    });
  }

  verSintese(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.mutar(escolaId, estudanteId, turmaId, (estado, etapa) =>
      aplicarVerSintese(estado, etapa),
    );
  }

  /**
   * O latch final. Grava a reflexão e o `score` na MESMA transação do estado:
   * um percurso salvo sem o carimbo de conclusão (ou o contrário) faria o
   * portfólio e a tela discordarem.
   */
  async reflexao(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    perfil: Perfil,
    estrategias: string[],
    justificativa: string,
  ) {
    let score = 0;
    const resposta = await this.mutar(
      escolaId,
      estudanteId,
      turmaId,
      (estado, etapa) => {
        const r = aplicarReflexao(estado, estrategias, etapa, new Date());
        if (r.ok) score = r.estado.score ?? 0;
        return r;
      },
      {},
      async (tx) => {
        await tx.ecoReflexao.upsert({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          create: { escolaId, estudanteId, estrategias, justificativa },
          update: { estrategias, justificativa },
        });
      },
    );

    // A devolutiva vem DEPOIS do latch, e fora da transação: o percurso já está
    // salvo e a missão já fechou. Se o modelo demorar ou falhar, o estudante
    // perde um parágrafo — nunca a entrega.
    const devolutiva = await this.ia.devolutiva(
      escolaId,
      estudanteId,
      perfil,
      estrategias,
      justificativa,
    );
    if (devolutiva) {
      await this.prisma.comTenancy(async (tx) => {
        await tx.ecoReflexao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          data: { devolutiva: devolutiva.texto },
        });
        await tx.ecoSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          data: {
            tokensGastos: { increment: devolutiva.tokens },
            chamadasIa: { increment: 1 },
          },
        });
      }, escolaId);
    }

    return { ...resposta, score, devolutiva: devolutiva?.texto ?? null };
  }

  /**
   * Uma fala para Amara, no privado, DEPOIS da decisão no grupo.
   *
   * O silêncio dela durante a investigação é não-negociável de ofício: se ela
   * apontasse qual mensagem é falsa, o reconhecimento de padrão que a missão
   * mede deixaria de acontecer. O portão está aqui, no servidor, e não numa
   * condição de tela.
   *
   * O texto do estudante é gravado em `exp_07_mensagens` (sob RLS) porque a
   * conversa precisa voltar inteira depois de um F5. Ele não vai a log nem à
   * telemetria, e nenhuma rota de gestor o alcança.
   */
  async amara(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    perfil: Perfil,
    texto: string,
  ) {
    const { historico, turnos } = await this.prisma.comTenancy(async (tx) => {
      const sessao = await tx.ecoSessao.findUnique({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        select: { passo: true, turnosAmara: true },
      });
      // Antes do desfecho ela está "offline" — dentro da ficção, sem dizer que
      // é uma regra da missão.
      const passo = normalizarPasso(sessao?.passo ?? "chat_amara");
      if (passo === "chat_amara" || passo === "grupo" || passo === "breakpoint" || passo === "podcast" || passo === "intervencao") {
        throw erroDeJogo("amara-em-silencio");
      }
      if ((sessao?.turnosAmara ?? 0) >= TURNOS_COM_AMARA) throw erroDeJogo("sem-turno");
      const mensagens = await tx.ecoMensagem.findMany({
        where: { escolaId, estudanteId },
        orderBy: { id: "asc" },
        select: { papel: true, texto: true },
      });
      return {
        historico: mensagens.map((m) => ({
          papel: m.papel as "estudante" | "amara",
          texto: m.texto,
        })),
        turnos: sessao?.turnosAmara ?? 0,
      };
    }, escolaId);

    const resposta = await this.ia.amara(escolaId, estudanteId, perfil, historico, texto);

    await this.prisma.comTenancy(async (tx) => {
      await tx.ecoMensagem.createMany({
        data: [
          { escolaId, estudanteId, papel: "estudante", texto },
          { escolaId, estudanteId, papel: "amara", texto: resposta.texto },
        ],
      });
      await tx.ecoSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: {
          turnosAmara: { increment: 1 },
          tokensGastos: { increment: resposta.tokens },
          chamadasIa: { increment: 1 },
        },
      });
    }, escolaId);

    return { texto: resposta.texto, turnosRestantes: Math.max(0, TURNOS_COM_AMARA - turnos - 1) };
  }

  /** O mapa de mídia para o cliente. Não gera nada — quem gera é o preparo. */
  midiaDaMissao() {
    return this.midia.urls();
  }

  /** O preparo da aula: gera o que falta e devolve o que saiu. */
  async prepararMidia(escolaId: string, turmaId: string, usuarioId: string, perfil: Perfil) {
    await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, perfil === "professor" ? usuarioId : undefined);
    }, escolaId);
    return this.midia.preparar(escolaId, usuarioId, perfil);
  }

  // ------------------------------------------------------- visão do professor

  /** `professorId` presente = só as turmas dele (ver `ondeAsTurmasSaoVisiveis`). */
  async turmas(escolaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: ondeAsTurmasSaoVisiveis(escolaId, professorId),
        select: { id: true, nome: true, serie: true, _count: { select: { estudantes: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return {
        turmas: turmas.map((t) => ({
          id: t.id,
          nome: t.nome,
          serie: t.serie,
          estudantes: t._count.estudantes,
        })),
      };
    }, escolaId);
  }

  /**
   * O painel da turma. Parte de `users` (quem não iniciou também aparece);
   * `users`/`turmas` estão fora da RLS, por isso o `escolaId` no `where`.
   *
   * Sem coluna de pontos: a leitura é de progresso e de estratégia. A
   * distribuição A/B/C existe porque é o material do debate, e aparece como
   * percentual da turma — nunca como "quem errou" (PED-07).
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const agora = new Date();

      const estudantes = await tx.user.findMany({
        where: { escolaId, turmaId, role: "estudante" },
        select: {
          id: true,
          displayName: true,
          username: true,
          // A reflexão pendura na SESSÃO (FK composta), não em `users`: uma
          // linha de percurso sem sessão não existe.
          ecoSessoes: { where: { escolaId }, take: 1, include: { reflexoes: true } },
        },
        orderBy: { displayName: "asc" },
      });

      const linhas = estudantes.map((a) => {
        const sessao = a.ecoSessoes[0];
        const estado = paraEstado(sessao);
        const reflexao = sessao?.reflexoes[0];
        return {
          estudanteId: a.id,
          nome: a.displayName,
          usuario: a.username,
          iniciou: Boolean(sessao),
          passo: estado.passo,
          inspecionouMateria: estado.inspecionouMateria,
          ouviuPodcast: estado.ouviuPodcast,
          opcao: estado.opcao,
          desfazerUsado: estado.desfazerUsado,
          entregouPercurso: Boolean(reflexao),
          ociosoMin: sessao && !estado.concluidoEm ? minutosDesde(sessao.atualizadoEm, agora) : null,
          _percurso: reflexao
            ? avaliarPercurso(reflexao.estrategias, reflexao.justificativa)
            : null,
        };
      });

      const responderam = linhas.filter((l) => l.opcao !== null);
      const distribuicao: Record<string, number> = { A: 0, B: 0, C: 0 };
      for (const l of responderam) if (l.opcao) distribuicao[l.opcao] = (distribuicao[l.opcao] ?? 0) + 1;

      return {
        turma: { ...turma, etapa: await this.etapaDaTurma(tx, escolaId, turmaId, true) },
        estudantes: linhas.map(({ _percurso: _p, ...linha }) => linha),
        resumo: {
          total: linhas.length,
          iniciaram: linhas.filter((l) => l.iniciou).length,
          inspecionaram: linhas.filter((l) => l.inspecionouMateria).length,
          responderam: responderam.length,
          entregaram: linhas.filter((l) => l.entregouPercurso).length,
          ociosos: linhas.filter((l) => (l.ociosoMin ?? 0) >= MINUTOS_PARA_OCIOSO).length,
          distribuicao,
          usaramRecuperacao: linhas.filter((l) => l.desfazerUsado > 0).length,
          percursoComAsDuas: linhas.filter((l) => l._percurso?.estrategiasPrioritarias === 2).length,
        },
      };
    }, escolaId);
  }

  /**
   * O gate da aula. IDEMPOTENTE de propósito: `liberar-aula2` duas vezes é
   * exatamente o clique que uma professora nervosa dá, e a segunda não pode
   * derrubar nada nem voltar a turma.
   *
   * `redefinir` volta ao pré-aula sem apagar percurso: é para o professor que
   * abriu a Aula 2 antes da hora, não um "zerar".
   */
  async mexerNoGate(escolaId: string, turmaId: string, acao: AcaoDoGate, professorId?: string) {
    const etapa = ETAPA_DA_ACAO[acao];
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      // Lock por TURMA, no espírito da exp-70: dois docentes na mesma sala (ou
      // dois cliques) não podem intercalar escrita no mesmo gate.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`eco:${escolaId}:${turmaId}`}, 0))`;
      const linha = await tx.ecoGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, etapa },
        update: { etapa },
      });
      return { turma, etapa: normalizarEtapa(linha.etapa), atualizadoEm: linha.atualizadoEm.toISOString() };
    }, escolaId);
  }

  /**
   * "Zerar turma" — a segunda aplicação. Apaga o estado transacional e o gate,
   * e PRESERVA `telemetria_eventos`, que é a trilha analítica imutável.
   */
  async zerarTurma(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const estudantes = await tx.user.findMany({
        where: { escolaId, turmaId, role: "estudante" },
        select: { id: true },
      });
      const ids = estudantes.map((e) => e.id);
      if (ids.length === 0) return { sucesso: true as const, registrosApagados: 0 };
      // As filhas caem por cascata da FK composta; apagar a sessão basta.
      const apagados = await tx.ecoSessao.deleteMany({
        where: { escolaId, estudanteId: { in: ids } },
      });
      await tx.ecoGateTurma.deleteMany({ where: { escolaId, turmaId } });
      return { sucesso: true as const, registrosApagados: apagados.count };
    }, escolaId);
  }

  // -------------------------------------------------------------- privados

  /**
   * A etapa da turma, ou `null` quando o estudante não tem turma — e `null` é
   * "sem gate", não "etapa inicial": ver `passoEfetivo`.
   *
   * `exigirTurma` é para o painel, onde a turma sempre existe e a ausência de
   * linha significa "a aula ainda não começou".
   */
  private async etapaDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
    exigirTurma = false,
  ): Promise<Etapa | null> {
    if (!turmaId) return exigirTurma ? ETAPA_INICIAL : null;
    const linha = await tx.ecoGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      select: { etapa: true },
    });
    return linha ? normalizarEtapa(linha.etapa) : ETAPA_INICIAL;
  }

  /** `users` está fora da RLS — a escola do token precisa bater com a do usuário. */
  private async estudanteDaEscola(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ) {
    const estudante = await tx.user.findUnique({
      where: { id: estudanteId },
      select: { displayName: true, escolaId: true, turmaId: true },
    });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    return estudante;
  }

  /** Escola do token E matrícula na turma quando quem pede é professor. */
  private async turmaVisivel(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    professorId?: string,
  ) {
    const turma = await tx.turma.findFirst({
      where: { id: turmaId, escolaId },
      select: { id: true, nome: true, serie: true },
    });
    if (!turma) throw erroDeJogo("turma-nao-encontrada");
    if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) {
      throw erroDeJogo("turma-nao-encontrada");
    }
    return turma;
  }

  /**
   * Núcleo de toda mutação: garante a linha, tranca por (escola, estudante) e
   * aplica a regra sobre o estado lido já serializado. Dois toques rápidos em
   * "enviar" viram duas transações em fila, e a segunda relê o estado com a
   * primeira aplicada — daí o `resposta-ja-enviada` em vez de duas mensagens
   * no grupo. Os CHECKs do banco são a rede final.
   */
  private mutar(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    regra: (estado: EstadoSessao, etapa: Etapa | null) => ResultadoRegra,
    extra: Prisma.EcoSessaoUpdateInput = {},
    depois?: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<EstadoPublico> {
    return this.prisma.comTenancy(async (tx) => {
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`eco:${escolaId}:${estudanteId}`}, 0))`;
      await tx.$executeRaw`
        INSERT INTO exp_07_sessoes (escola_id, estudante_id, turma_id)
        VALUES (${escolaId}, ${estudanteId}::uuid, ${turmaId}::uuid)
        ON CONFLICT DO NOTHING`;
      // A turma pode ter mudado depois da primeira visita (transferência no
      // meio do ano): o painel lê por turma, e uma linha com a turma antiga
      // desapareceria da tela da professora nova.
      const atual = await tx.ecoSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { turmaId },
      });
      const etapa = await this.etapaDaTurma(tx, escolaId, turmaId);
      const resultado = regra(paraEstado(atual), etapa);
      if (!resultado.ok) throw erroDeJogo(resultado.codigo);
      if (resultado.mudou || Object.keys(extra).length > 0) {
        await tx.ecoSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          data: { ...paraColunas(resultado.estado), ...extra },
        });
      }
      if (depois) await depois(tx);
      return publico(resultado.estado, etapa);
    }, escolaId);
  }
}
