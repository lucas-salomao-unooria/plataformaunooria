import { Injectable } from "@nestjs/common";
import { Prisma, type RastroSessao } from "@prisma/client";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { PrismaService } from "../prisma/prisma.service";
import {
  AUDITORIAS_EXIGIDAS,
  CONVERSAS,
  CONVOCACAO,
  MENSAGENS,
  PERGUNTA_DO_PERCURSO,
  PODCAST,
  TETO_DA_REFLEXAO,
  blocosPublicos,
  chatDaMensagem,
  opcao,
  opcoesPublicas,
  type Desfecho,
  type IdDeOpcao,
} from "./catalogo";
import { erroDeJogo } from "./erros";
import { auditar, estadoDaAuditoria } from "./regras/auditoria";
import { validarCiclo } from "./regras/ciclo";
import {
  ETAPA_DA_ACAO,
  ETAPA_INICIAL,
  PASSO_INICIAL,
  aguardandoATurma,
  normalizarEtapa,
  normalizarPasso,
  passoEfetivo,
  type AcaoDoGate,
  type Etapa,
  type Passo,
} from "./regras/passos";
import { scoreDe } from "./regras/pontuacao";
import { curvas, topologiaDe, type Topologia } from "./regras/topologia";

/**
 * Persistência e regras aplicadas da exp06ef2b.
 *
 * Assinaturas recebem `escolaId`/`estudanteId` explícitos (não o request) — os
 * testes de integração chamam direto, e toda query leva `escola_id` no `where`
 * ALÉM da RLS que o `comTenancy` arma (regra inviolável nº 1, defesa em
 * profundidade).
 *
 * **Zero IA.** A missão é 100% determinística: reações, topologia e devolutiva
 * saem do catálogo e das regras puras. Nenhuma chamada ao `apps/api/src/ai`,
 * nenhum token de quota — e uma aula do 6º ano não depende de o Vertex estar
 * de pé.
 */

/** O id que a guarda de liberação (ADR-69) e o manifesto compartilham. */
export const EXP_ID = "exp06ef2b";

/** Minutos sem ação para o painel marcar ociosidade. O alerta é para a docente
 *  ir até a carteira, não para punir. */
export const MINUTOS_PARA_OCIOSO = 3;

// ───────────────────────────────────────────────────────── estado da sessão

interface EstadoSessao {
  passo: Passo;
  opcao: IdDeOpcao | null;
  latenciaSeg: number | null;
  houveInacao90s: boolean;
  ordemBlocos: string[];
  coerente: boolean | null;
  concluidoEm: Date | null;
}

const ESTADO_INICIAL: EstadoSessao = {
  passo: PASSO_INICIAL,
  opcao: null,
  latenciaSeg: null,
  houveInacao90s: false,
  ordemBlocos: [],
  coerente: null,
  concluidoEm: null,
};

type LinhaDaSessao = Pick<
  RastroSessao,
  "passo" | "opcao" | "latenciaSeg" | "houveInacao90s" | "ordemBlocos" | "coerente" | "concluidoEm"
>;

function paraEstado(linha: LinhaDaSessao | null | undefined): EstadoSessao {
  if (!linha) return { ...ESTADO_INICIAL };
  return {
    passo: normalizarPasso(linha.passo),
    opcao: (linha.opcao as IdDeOpcao | null) ?? null,
    latenciaSeg: linha.latenciaSeg,
    houveInacao90s: linha.houveInacao90s,
    ordemBlocos: linha.ordemBlocos,
    coerente: linha.coerente,
    concluidoEm: linha.concluidoEm,
  };
}

/**
 * O estado como o CLIENTE o recebe.
 *
 * `desfecho` é o campo que evita a tela comparar `opcao === "B"` — comparação
 * que iria legível para o bundle e entregaria a resposta certa no DevTools
 * antes de a criança responder (regra 3, e a mesma armadilha registrada na
 * exp07ef1b). Ele só existe DEPOIS do envio, quando a criança já viu a cena.
 */
export interface EstadoPublico {
  passo: Passo;
  passoDoEstudante: Passo;
  aguardandoATurma: boolean;
  auditadas: string[];
  totalAuditadas: number;
  cotaAtingida: boolean;
  faltamAuditar: number;
  opcao: IdDeOpcao | null;
  desfecho: Desfecho | null;
  /** A reação do grupo à intervenção — `null` antes do envio. */
  reacao: string | null;
  /** A rede desenhada, já agrupada em clusters. `null` antes do envio. */
  topologia: Topologia | null;
  ordemBlocos: string[];
  coerente: boolean | null;
  entregouPercurso: boolean;
  concluidoEm: string | null;
  turma: { etapa: Etapa };
}

function minutosDesde(quando: Date, agora: Date): number {
  return Math.floor((agora.getTime() - quando.getTime()) / 60_000);
}

@Injectable()
export class RastroBoatoService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────── leitura da sessão

  /** Boot da experiência — READ-ONLY: sem linha, devolve o estado inicial. */
  async sessao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const estudante = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const [linha, etapa, auditorias, reflexao] = await Promise.all([
        tx.rastroSessao.findUnique({ where: { escolaId_estudanteId: { escolaId, estudanteId } } }),
        this.etapaDaTurma(tx, escolaId, turmaId),
        this.idsAuditados(tx, escolaId, estudanteId),
        tx.rastroReflexao.findUnique({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
        }),
      ]);

      return {
        ...this.publico(paraEstado(linha), auditorias, etapa, Boolean(reflexao)),
        catalogo: {
          conversas: [...CONVERSAS],
          // O feed vem da api, e não do bundle, para que corrigir uma palavra
          // da copy não exija republicar um caminho imutável no bucket.
          mensagens: [...MENSAGENS],
          convocacao: { ...CONVOCACAO },
          // Sem `desfecho` e sem `reacao`: o tipo é `OpcaoPublica`, então o
          // gabarito é impossível aqui, não só ausente por descuido.
          opcoes: opcoesPublicas(),
          // Sem a ordem certa. O cliente embaralha e devolve a que montou.
          blocos: blocosPublicos(),
          auditoriasExigidas: AUDITORIAS_EXIGIDAS,
          perguntaDoPercurso: PERGUNTA_DO_PERCURSO,
          tetoDaReflexao: TETO_DA_REFLEXAO,
          podcast: PODCAST,
          curvas: curvas(),
        },
        reflexao: reflexao ? { texto: reflexao.texto } : null,
        estudante: { nome: estudante.displayName },
      };
    }, escolaId);
  }

  /** O polling do gate — leve de propósito: sem catálogo. */
  async gate(escolaId: string, turmaId: string | null, passoBruto?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const etapa = await this.etapaDaTurma(tx, escolaId, turmaId);
      const passo = normalizarPasso(passoBruto ?? PASSO_INICIAL);
      return {
        etapa: etapa ?? ETAPA_INICIAL,
        passoEfetivo: passoEfetivo(passo, etapa),
        // O instante é do SERVIDOR: o relógio da máquina da escola atrasa, e
        // não é ele que decide o momento da aula.
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  // ─────────────────────────────────────────────────────────── as mutações

  /**
   * Uma abertura do modal "Dados da mensagem".
   *
   * Idempotente: reabrir o mesmo balão é releitura — devolve 200 com
   * `novo: false`, e não conta de novo. Um 409 aqui transformaria reler (o
   * comportamento que a missão QUER) numa mensagem de erro na tela.
   */
  async auditoria(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    mensagemId: string,
    tempoLeituraS: number,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");

      const jaAuditadas = await this.idsAuditados(tx, escolaId, estudanteId);
      const resultado = auditar(jaAuditadas, mensagemId);
      if (!resultado.ok) throw erroDeJogo(resultado.codigo);

      if (resultado.novo) {
        await tx.rastroAuditoria.create({
          data: {
            escolaId,
            estudanteId,
            mensagemId,
            chatId: chatDaMensagem(mensagemId) ?? "",
            tempoLeituraS,
          },
        });
      }

      const ids = resultado.novo ? [...jaAuditadas, mensagemId] : jaAuditadas;
      const auditoria = estadoDaAuditoria(ids);

      /* A cota fechada é o que faz a crise chegar. O passo anda sozinho: sem
         isso o cliente precisaria pedir a transição, e uma tela que decide
         quando o pico começa é uma tela que pode pular o pico. */
      const passo: Passo =
        auditoria.cotaAtingida && estado.passo === "chats" ? "decisao" : estado.passo;
      if (passo !== estado.passo) {
        await tx.rastroSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          data: { passo },
        });
      }

      const etapa = await this.etapaDaTurma(tx, escolaId, turmaId);
      return {
        ...this.publico({ ...estado, passo }, ids, etapa, false),
        novo: resultado.novo,
      };
    });
  }

  /** O estudante entrou na lista de conversas: sai do contexto. */
  async abrirChats(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      const passo: Passo = estado.passo === "contexto" ? "chats" : estado.passo;
      if (passo !== estado.passo) {
        await tx.rastroSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          data: { passo },
        });
      }
      const [ids, etapa] = await Promise.all([
        this.idsAuditados(tx, escolaId, estudanteId),
        this.etapaDaTurma(tx, escolaId, turmaId),
      ]);
      return this.publico({ ...estado, passo }, ids, etapa, false);
    });
  }

  /**
   * A intervenção — LATCH. Uma vez enviada, não se troca (RF-003).
   *
   * A api corrige contra o catálogo e devolve o desfecho, a reação do grupo e
   * a topologia calculada. O cliente não sabe qual letra interrompe a corrente
   * até este momento.
   */
  async decisao(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    escolhida: IdDeOpcao,
    latenciaSeg: number,
    houveInacao90s: boolean,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      if (estado.opcao) throw erroDeJogo("decisao-ja-registrada");

      const ids = await this.idsAuditados(tx, escolaId, estudanteId);
      const auditoria = estadoDaAuditoria(ids);
      // A porta que a missão MEDE: decidir sem ter auditado 3 fontes.
      if (!auditoria.cotaAtingida) throw erroDeJogo("auditoria-insuficiente");

      const escolha = opcao(escolhida);
      const novo: EstadoSessao = {
        ...estado,
        passo: "breakpoint",
        opcao: escolhida,
        latenciaSeg,
        houveInacao90s,
      };

      await tx.rastroSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: {
          passo: novo.passo,
          opcao: escolhida,
          latenciaSeg,
          houveInacao90s,
          // O nível combina auditoria e escolha; `scoreDe` é a tradução dele
          // para o campo do `exp:concluir`. Nunca aceito do cliente.
          score: scoreDe(auditoria.cotaAtingida, escolhida),
        },
      });

      const etapa = await this.etapaDaTurma(tx, escolaId, turmaId);
      return { ...this.publico(novo, ids, etapa, false), reacao: escolha.reacao };
    });
  }

  /** O modelo do ciclo — LATCH, e sem nota (RF-007). */
  async modelagem(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    ordem: string[],
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      if (!estado.opcao) throw erroDeJogo("sem-decisao");
      if (estado.ordemBlocos.length > 0) throw erroDeJogo("modelo-ja-enviado");

      const resultado = validarCiclo(ordem);
      if (!resultado.ok) throw erroDeJogo(resultado.codigo);

      const novo: EstadoSessao = {
        ...estado,
        passo: "percurso",
        ordemBlocos: resultado.ordem,
        coerente: resultado.coerente,
      };
      await tx.rastroSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { passo: novo.passo, ordemBlocos: novo.ordemBlocos, coerente: novo.coerente },
      });

      const [ids, etapa] = await Promise.all([
        this.idsAuditados(tx, escolaId, estudanteId),
        this.etapaDaTurma(tx, escolaId, turmaId),
      ]);
      return this.publico(novo, ids, etapa, false);
    });
  }

  /**
   * O "Meu percurso" — LATCH e FIM da missão.
   *
   * `texto` é caixa livre de menor de idade: não vai a log, não vai à
   * telemetria analítica, e só o professor da turma dela o alcança.
   */
  async reflexao(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    texto: string,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("reflexao-ja-enviada");
      if (estado.ordemBlocos.length === 0) throw erroDeJogo("blocos-incompletos");

      const concluidoEm = new Date();
      await tx.rastroReflexao.create({
        data: { escolaId, estudanteId, texto, charsCount: texto.length },
      });
      await tx.rastroSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { passo: "fim", concluidoEm },
      });

      const [ids, etapa] = await Promise.all([
        this.idsAuditados(tx, escolaId, estudanteId),
        this.etapaDaTurma(tx, escolaId, turmaId),
      ]);
      return this.publico({ ...estado, passo: "fim", concluidoEm }, ids, etapa, true);
    });
  }

  // ─────────────────────────────────────────────────────── visão do professor

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
   * **Sem coluna de pontos e sem nível** (PED-07 e `PROIBIDO_NO_PAINEL`): a
   * leitura é de PROGRESSO. A distribuição A/B/C existe porque é o material do
   * debate, e aparece como contagem da turma — nunca como "quem errou".
   *
   * O texto da reflexão vai NESTA rota e só nela: é a leitura formativa do
   * professor da turma. Nenhuma rota de gestor o alcança.
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
          rastroSessoes: {
            where: { escolaId },
            take: 1,
            include: {
              reflexoes: true,
              _count: { select: { auditorias: true } },
            },
          },
        },
        orderBy: { displayName: "asc" },
      });

      const linhas = estudantes.map((a) => {
        const sessao = a.rastroSessoes[0];
        const estado = paraEstado(sessao);
        const reflexao = sessao?.reflexoes[0];
        const auditadas = sessao?._count.auditorias ?? 0;
        return {
          estudanteId: a.id,
          nome: a.displayName,
          usuario: a.username,
          iniciou: Boolean(sessao),
          passo: estado.passo,
          auditadas,
          auditouTudo: auditadas >= AUDITORIAS_EXIGIDAS,
          opcao: estado.opcao,
          houveInacao90s: estado.houveInacao90s,
          latenciaSeg: estado.latenciaSeg,
          modeloCoerente: estado.coerente,
          entregouPercurso: Boolean(reflexao),
          reflexaoTexto: reflexao?.texto ?? null,
          ociosoMin:
            sessao && !estado.concluidoEm ? minutosDesde(sessao.atualizadoEm, agora) : null,
        };
      });

      const responderam = linhas.filter((l) => l.opcao !== null);
      const distribuicao: Record<IdDeOpcao, number> = { A: 0, B: 0, C: 0 };
      for (const l of responderam) if (l.opcao) distribuicao[l.opcao] += 1;

      return {
        turma: { ...turma, etapa: await this.etapaDaTurma(tx, escolaId, turmaId, true) },
        estudantes: linhas,
        resumo: {
          total: linhas.length,
          iniciaram: linhas.filter((l) => l.iniciou).length,
          auditaramTudo: linhas.filter((l) => l.auditouTudo).length,
          responderam: responderam.length,
          entregaram: linhas.filter((l) => l.entregouPercurso).length,
          ociosos: linhas.filter((l) => (l.ociosoMin ?? 0) >= MINUTOS_PARA_OCIOSO).length,
          modelosCoerentes: linhas.filter((l) => l.modeloCoerente === true).length,
          estouraramOAlerta: linhas.filter((l) => l.houveInacao90s).length,
          distribuicao,
        },
      };
    }, escolaId);
  }

  /**
   * O gate da aula. IDEMPOTENTE de propósito: `liberar-aula2` duas vezes é
   * exatamente o clique que uma docente nervosa dá, e a segunda não pode
   * derrubar nada nem voltar a turma.
   *
   * `pausar-simulacao` volta para `aula1` — é para quem abriu a Aula 2 antes
   * da hora. Não é um "zerar": nada é apagado, e quem já terminou fica em
   * `fim` (o latch é do estudante, não da turma).
   */
  async mexerNoGate(escolaId: string, turmaId: string, acao: AcaoDoGate, professorId?: string) {
    const etapa = ETAPA_DA_ACAO[acao];
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      // Lock por TURMA: dois docentes na mesma sala (ou dois cliques) não podem
      // intercalar escrita no mesmo gate.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rastro:${escolaId}:${turmaId}`}, 0))`;
      const linha = await tx.rastroGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, etapa },
        update: { etapa },
      });
      return {
        turma,
        etapa: normalizarEtapa(linha.etapa),
        atualizadoEm: linha.atualizadoEm.toISOString(),
      };
    }, escolaId);
  }

  /**
   * "Zerar turma" — a segunda aplicação (PED-13).
   *
   * Apaga o estado transacional e o gate, e PRESERVA `telemetria_eventos`, que
   * é a trilha analítica imutável. A reflexão vai junto porque a FK é
   * `ON DELETE CASCADE` da sessão: refazer a missão com o percurso do ano
   * passado na tela seria um portfólio que mistura duas turmas.
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

      const apagadas = await tx.rastroSessao.deleteMany({
        where: { escolaId, estudanteId: { in: ids } },
      });
      await tx.rastroGateTurma.deleteMany({ where: { escolaId, turmaId } });
      return { sucesso: true as const, registrosApagados: apagadas.count };
    }, escolaId);
  }

  // ────────────────────────────────────────────────────────────── privados

  /** A projeção pública do estado, com o gabarito revelado só depois do envio. */
  private publico(
    estado: EstadoSessao,
    idsAuditados: readonly string[],
    etapa: Etapa | null,
    entregouPercurso: boolean,
  ): EstadoPublico {
    const auditoria = estadoDaAuditoria(idsAuditados);
    const escolha = estado.opcao ? opcao(estado.opcao) : null;
    return {
      passo: passoEfetivo(estado.passo, etapa),
      passoDoEstudante: estado.passo,
      aguardandoATurma: aguardandoATurma(estado.passo, etapa),
      auditadas: auditoria.auditadas,
      totalAuditadas: auditoria.total,
      cotaAtingida: auditoria.cotaAtingida,
      faltamAuditar: auditoria.faltam,
      opcao: estado.opcao,
      desfecho: escolha?.desfecho ?? null,
      reacao: escolha?.reacao ?? null,
      topologia: escolha ? topologiaDe(escolha.desfecho) : null,
      ordemBlocos: estado.ordemBlocos,
      coerente: estado.coerente,
      entregouPercurso,
      concluidoEm: estado.concluidoEm?.toISOString() ?? null,
      turma: { etapa: etapa ?? ETAPA_INICIAL },
    };
  }

  /** Os ids já auditados, na ordem em que foram abertos. */
  private async idsAuditados(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<string[]> {
    const linhas = await tx.rastroAuditoria.findMany({
      where: { escolaId, estudanteId },
      orderBy: { id: "asc" },
      select: { mensagemId: true },
    });
    return linhas.map((l) => l.mensagemId);
  }

  /**
   * A etapa da turma. `null` quando o estudante não tem turma — e `null` NÃO é
   * `aula1`: sem turma não há gate, e ele corre no próprio ritmo
   * (`regras/passos.ts`). `criarSeFaltar` só na visão do professor, que precisa
   * de uma linha para escrever depois.
   */
  private async etapaDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
    criarSeFaltar = false,
  ): Promise<Etapa | null> {
    if (!turmaId) return null;
    const linha = await tx.rastroGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      select: { etapa: true },
    });
    if (linha) return normalizarEtapa(linha.etapa);
    if (!criarSeFaltar) return ETAPA_INICIAL;
    const criada = await tx.rastroGateTurma.create({
      data: { escolaId, turmaId, etapa: ETAPA_INICIAL },
      select: { etapa: true },
    });
    return normalizarEtapa(criada.etapa);
  }

  /**
   * O FUNIL de toda rota de estudante: escola do token, missão liberada na
   * turma (ADR-69) e a existência da linha.
   *
   * `exigirMissaoLiberada` mora AQUI, e não em cada rota, pela razão do
   * `AGENTS.md` da raiz: a guarda tem de estar no funil, nunca só na leitura —
   * `/exp/:expId` é endereço adivinhável e o bundle é público.
   */
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
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
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
   * roda o trabalho sobre o estado lido já serializado.
   *
   * Dois toques rápidos em "enviar" viram duas transações em fila, e a segunda
   * relê o estado com a primeira aplicada — daí o `decisao-ja-registrada` em
   * vez de duas mensagens no grupo. Os CHECKs do banco são a rede final.
   */
  private comSessao<T>(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    trabalho: (tx: Prisma.TransactionClient, estado: EstadoSessao) => Promise<T>,
  ): Promise<T> {
    return this.prisma.comTenancy(async (tx) => {
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rastro:${escolaId}:${estudanteId}`}, 0))`;
      await tx.$executeRaw`
        INSERT INTO exp06ef2b_sessoes (escola_id, estudante_id, turma_id)
        VALUES (${escolaId}, ${estudanteId}::uuid, ${turmaId}::uuid)
        ON CONFLICT DO NOTHING`;
      /* A turma pode ter mudado depois da primeira visita (transferência no
         meio do ano): o painel lê por turma, e uma linha com a turma antiga
         desapareceria da tela da professora nova. */
      const atual = await tx.rastroSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { turmaId },
      });
      return trabalho(tx, paraEstado(atual));
    }, escolaId);
  }
}
