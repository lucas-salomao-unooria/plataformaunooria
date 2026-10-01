import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Prisma, type Exp04ef1bSessao } from "@prisma/client";
import { z } from "zod";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { computadoresDaMontagem, mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades } from "../equipes/regras";
import { EvidenciasService, type ContextoDaAtividade } from "../evidencias/evidencias.service";
import type { Nivel } from "../evidencias/regras";
import { logger } from "../observabilidade/logger";
import { ehUuid } from "../motor/guardas";
import { PrismaService } from "../prisma/prisma.service";
import { BLOCOS_DA_CHAVE, noticiasPadrao } from "./catalogo";
import { NoticiaDoPacoteSchema, type NoticiaDoPacote } from "./contrato-de-rotas";
import { DiagramacaoService } from "./diagramacao.service";
import { erroDeJogo } from "./erros";
import { ordemDaBandeja } from "./regras/bandeja";
import { corrigirChave } from "./regras/chave";
import {
  MARCADOR_DA_CHAVE,
  MARCADOR_DA_EDICAO_2,
  MARCADOR_DAS_PISTAS,
  nivelDaChave,
  nivelDaEdicao2,
  nivelDasPistas,
} from "./regras/evidencia";
import {
  ETAPA_INICIAL,
  aguardandoOProfessor,
  normalizarEtapa,
  normalizarPasso,
  passoAntes,
  passoEfetivo,
  pedirPasso,
  proximaEtapa,
  publicouAPrimeira,
  transicaoDoGate,
  type Etapa,
  type PassoPedido,
} from "./regras/passos";
import { faseDoPasso, paresAbertos, pistasDaLinha, pistasDaTela, registrarPista } from "./regras/pistas";
import { edicaoComResultado, vagasMarcadas, verificadasDa } from "./regras/resultado";
import {
  EXP_ID,
  IDS_DE_NOTICIA,
  ID_DE_NOTICIA_RE,
  MOTIVOS,
  TAMANHO_DA_CHAVE,
  TAMANHO_DA_EDICAO,
  type IdDeBloco,
  type IdDeNoticia,
  type Layout,
  type Motivo,
  type OrigemDoLayout,
  type OrigemDoPacote,
  type TipoDePista,
} from "./vocabulario";

export { EXP_ID } from "./vocabulario";

/**
 * Persistência e regras aplicadas da exp04ef1b — Jornal da Escola: A Edição
 * de Bento.
 *
 * Molde: `a-selecao/a-selecao.service.ts` (o funil, os locks, o gate da turma,
 * atividade × rodada, o painel por computador). Assinaturas recebem
 * `escolaId`/`estudanteId` explícitos, não o request: toda query leva
 * `escola_id` no `where` ALÉM da RLS que o `comTenancy` arma (regra inviolável
 * nº 1, defesa em profundidade).
 *
 * **A atividade é o pacote, a rodada é o "Zerar".** O gate da turma diz qual
 * (pacote, rodada) está em andamento, e a sessão do estudante é a DAQUELA
 * dupla: zerar abre uma sessão nova e a antiga fica (ADR-112), pacote novo
 * abre a rodada 1 de outra atividade.
 *
 * **O gabarito não desce antes da hora.** A notícia do estudante sai por
 * `noticiaPublica`, uma ALLOWLIST; o texto das pistas desce no `POST pista`
 * (com registro); a consequência, só no `GET resultado` com o portão aberto; o
 * pilar em falta, só depois da Chave; e o conjunto certo da Chave, nunca.
 *
 * **A IA em sala só diagrama** (`diagramacao.service.ts`), fora de qualquer
 * transação, e nunca derruba a resposta.
 */

type NoticiaPublica = {
  id: IdDeNoticia;
  meio: NoticiaDoPacote["meio"];
  veiculo: string;
  falante: string | null;
  manchete: string;
  resumo: string;
  corpo: string;
  legenda: string | null;
  imagem: { url: string | null; alt: string } | null;
};

export interface PacoteLido {
  id: string;
  escolaId: string;
  turmaId: string;
  disciplina: string;
  tema: string;
  topicos: string | null;
  origem: OrigemDoPacote;
  noticias: NoticiaDoPacote[];
  midia: Partial<Record<IdDeNoticia, string>>;
}

interface GateLido {
  pacoteId: string;
  rodada: number;
  etapa: Etapa;
  atualizadoEm: Date;
}

/** O que o funil do estudante devolve: tudo que as rotas dele leem. */
interface ContextoDoEstudante {
  turmaId: string;
  gate: GateLido;
  pacote: PacoteLido;
  sessao: Exp04ef1bSessao;
}

type Publicacao = { slots: IdDeNoticia[]; layout: Layout; origemDoLayout: OrigemDoLayout };

const SELECAO_DO_PACOTE = {
  id: true,
  escolaId: true,
  turmaId: true,
  disciplina: true,
  tema: true,
  topicos: true,
  origem: true,
  noticias: true,
  midia: true,
} satisfies Prisma.Exp04ef1bPacoteSelect;

const ListaDeNoticiasSchema = z.array(NoticiaDoPacoteSchema).length(IDS_DE_NOTICIA.length);

/** As notícias na ordem da mesa (os ids são a posição). */
function emOrdemDaMesa<T extends { id: string }>(noticias: readonly T[]): T[] {
  const posicao = (id: string) => (IDS_DE_NOTICIA as readonly string[]).indexOf(id);
  return [...noticias].sort((a, b) => posicao(a.id) - posicao(b.id));
}

/**
 * Lê as oito notícias do `Json` do pacote. A homologação validou na ESCRITA,
 * mas uma linha gravada por outro caminho chegaria aqui torta — e a aula tem
 * de correr: cai no banco padrão, com um log que impede o "a mesa mudou
 * sozinha" de ser mudo para quem diagnostica. Os ids são os mesmos nos dois,
 * então vagas e pistas gravadas continuam coerentes.
 */
function noticiasDaLinha(bruto: Prisma.JsonValue, contexto: { escolaId: string; pacoteId: string }): NoticiaDoPacote[] {
  const lido = ListaDeNoticiasSchema.safeParse(bruto);
  if (lido.success) {
    const noticias = emOrdemDaMesa(lido.data);
    if (noticias.map((n) => n.id).join(",") === IDS_DE_NOTICIA.join(",")) return noticias;
  }
  logger.warn(
    { codigo: "exp04ef1b-pacote-invalido", ...contexto },
    "pacote com forma inesperada; a turma segue com o banco padrão",
  );
  return noticiasPadrao();
}

/** As URLs de imagem do pacote, só com chave de notícia conhecida e valor texto. */
function midiaDaLinha(bruto: Prisma.JsonValue): Partial<Record<IdDeNoticia, string>> {
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const midia: Partial<Record<IdDeNoticia, string>> = {};
  for (const [id, url] of Object.entries(bruto)) {
    if (ID_DE_NOTICIA_RE.test(id) && typeof url === "string" && url.length > 0) midia[id as IdDeNoticia] = url;
  }
  return midia;
}

function pacoteDaLinha(linha: Prisma.Exp04ef1bPacoteGetPayload<{ select: typeof SELECAO_DO_PACOTE }>): PacoteLido {
  return {
    id: linha.id,
    escolaId: linha.escolaId,
    turmaId: linha.turmaId,
    disciplina: linha.disciplina,
    tema: linha.tema,
    topicos: linha.topicos,
    origem: linha.origem === "ia" ? "ia" : "padrao",
    noticias: noticiasDaLinha(linha.noticias, { escolaId: linha.escolaId, pacoteId: linha.id }),
    midia: midiaDaLinha(linha.midia),
  };
}

/**
 * A notícia como o ESTUDANTE a recebe — ALLOWLIST. Campo novo no pacote nasce
 * fora daqui até alguém decidir o contrário: é o que faz o gabarito, as pistas
 * e a consequência não caberem na resposta, em vez de "lembrar de apagar".
 */
export function noticiaPublica(n: NoticiaDoPacote, midia: Partial<Record<IdDeNoticia, string>>): NoticiaPublica {
  return {
    id: n.id,
    meio: n.meio,
    veiculo: n.veiculo,
    falante: n.falante,
    manchete: n.manchete,
    resumo: n.resumo,
    corpo: n.corpo,
    legenda: n.legenda,
    imagem: n.descricaoImagem === null ? null : { url: midia[n.id] ?? null, alt: n.descricaoImagem },
  };
}

/** As notícias que pedem imagem — sem descrição, o cartão se desenha pelo meio. */
export function noticiasQuePedemImagem(noticias: readonly NoticiaDoPacote[]): NoticiaDoPacote[] {
  return noticias.filter((n) => n.descricaoImagem !== null);
}

function resumoDaMidia(pacote: PacoteLido): { total: number; prontas: number } {
  const pedem = noticiasQuePedemImagem(pacote.noticias);
  return { total: pedem.length, prontas: pedem.filter((n) => pacote.midia[n.id]).length };
}

function slotsDaLinha(slots: readonly string[]): IdDeNoticia[] | null {
  const ids = slots.filter((s): s is IdDeNoticia => ID_DE_NOTICIA_RE.test(s));
  return ids.length === TAMANHO_DA_EDICAO ? ids : null;
}

function layoutDaLinha(valor: string | null): Layout {
  return valor === "hero-image" || valor === "columns" ? valor : "classic";
}

function edicaoDaLinha(slots: readonly string[], layout: string | null, origem: string | null, em: Date | null) {
  const ids = slotsDaLinha(slots);
  if (!em || !ids) return null;
  return {
    slots: ids,
    layout: layoutDaLinha(layout),
    origemDoLayout: (origem === "ia" ? "ia" : "modelo") as OrigemDoLayout,
    publicadaEm: em.toISOString(),
  };
}

function ehMotivo(valor: string | null): valor is Motivo {
  return valor !== null && (MOTIVOS as readonly string[]).includes(valor);
}

/**
 * JSON com as chaves em ordem: o JSONB do Postgres reordena as chaves, então a
 * comparação de conteúdo não pode depender da ordem em que a tela as mandou.
 */
function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor !== null && typeof valor === "object") {
    const chaves = Object.keys(valor as Record<string, unknown>).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(valor) ?? "null";
}

/**
 * O peso de uma linha na escolha do REPRESENTANTE do computador: quem publicou
 * a 1ª edição vem antes de quem só entrou, e entre iguais o mais recente. Sem a
 * primeira regra, o colega que abriu a missão no mesmo computador DEPOIS da
 * publicação viraria o representante, e o painel diria que a tela não publicou.
 */
function pesoDaLinha(publicada1Em: Date | null, atualizadoEm: Date | null): number {
  const recencia = (publicada1Em ?? atualizadoEm)?.getTime() ?? 0;
  return (publicada1Em ? 1e13 : 0) + recencia;
}

@Injectable()
export class JornalEscolaService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly diagramacao: DiagramacaoService,
  ) {}

  /**
   * O contexto da evidência pedagógica: é por ele que P1/P2
   * (`/evidencias/exp04ef1b/perguntas/:id/resposta`) caem na atividade e na
   * rodada certas, sem o cliente dizer quais. No teste, quem chama isto é a
   * suíte.
   */
  onModuleInit(): void {
    this.evidencias.registrarContexto(EXP_ID, (tx, escolaId, estudanteId) =>
      this.contextoDaAtividade(tx, escolaId, estudanteId),
    );
  }

  /**
   * A atividade em andamento para P1/P2 — ou `null`.
   *
   * A turma sai da sessão MAIS RECENTE do estudante, porque o resolvedor não
   * recebe o token. E `null` em dois casos, os dois de propósito:
   *   - o passo está antes de `transferencia`: o Desafio Final vem depois do
   *     comparativo, e uma resposta mandada por fora da tela não fura a fila;
   *   - a sessão não é do (pacote, rodada) que o gate diz: o professor zerou ou
   *     trocou o pacote, e a resposta atrasada cairia numa rodada que acabou.
   */
  async contextoDaAtividade(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<ContextoDaAtividade | null> {
    const sessao = await tx.exp04ef1bSessao.findFirst({
      where: { escolaId, estudanteId },
      orderBy: { criadoEm: "desc" },
      select: { turmaId: true, pacoteId: true, rodada: true, passo: true },
    });
    if (!sessao || passoAntes(normalizarPasso(sessao.passo), "transferencia")) return null;
    const gate = await tx.exp04ef1bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId: sessao.turmaId } },
      select: { pacoteId: true, rodada: true },
    });
    if (!gate || gate.pacoteId !== sessao.pacoteId || gate.rodada !== sessao.rodada) return null;
    return { turmaId: sessao.turmaId, atividadeId: sessao.pacoteId, rodada: sessao.rodada };
  }

  // ───────────────────────────────────────────────────── rotas do estudante

  /**
   * Boot da experiência e o F5. Na PRIMEIRA entrada da turma nascem o pacote
   * `padrao` e o gate; na primeira do estudante na rodada, a sessão. As
   * notícias saem na ORDEM DA MESA e sem gabarito; os blocos da Chave, só
   * quando a revisão já abriu para esta criança.
   */
  async sessao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const estado = this.estado(ctx.sessao, ctx.gate, ctx.pacote);
      const comChave = !passoAntes(estado.passo, "chave");
      return {
        ...estado,
        pacote: {
          tema: ctx.pacote.tema,
          noticias: ctx.pacote.noticias.map((n) => noticiaPublica(n, ctx.pacote.midia)),
        },
        blocos: comChave ? ordemDaBandeja(ctx.sessao.id).map((id) => ({ id, ...BLOCOS_DA_CHAVE[id] })) : null,
        limites: { edicao: TAMANHO_DA_EDICAO, chave: TAMANHO_DA_CHAVE },
      };
    }, escolaId);
  }

  /**
   * O polling do gate (~5 s, ADR-93) — MAGRO de propósito: sem notícias, sem
   * contagem da sala, sem JOIN. Passa pelo funil de liberação (regras 7 e 8) e
   * NÃO escreve: o gate e a sessão nascem no `GET sessao`.
   */
  async gate(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      if (!turmaId) throw erroDeJogo("sem-turma");
      const gate = await tx.exp04ef1bGateTurma.findUnique({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        select: { pacoteId: true, rodada: true, etapa: true },
      });
      const etapa = normalizarEtapa(gate?.etapa ?? ETAPA_INICIAL);
      const sessao = gate
        ? await tx.exp04ef1bSessao.findUnique({
            where: {
              escolaId_turmaId_estudanteId_pacoteId_rodada: {
                escolaId,
                turmaId,
                estudanteId,
                pacoteId: gate.pacoteId,
                rodada: gate.rodada,
              },
            },
            select: { passo: true },
          })
        : null;
      const passo = normalizarPasso(sessao?.passo);
      return {
        etapa,
        rodada: gate?.rodada ?? null,
        pacoteId: gate?.pacoteId ?? null,
        passoEfetivo: passoEfetivo(passo, etapa),
        aguardandoOProfessor: aguardandoOProfessor(passo, etapa),
        // O instante é do SERVIDOR: o relógio da máquina da escola atrasa.
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  /** Os passos que a própria criança pede: a mesa e o Desafio Final. */
  async pedirPasso(escolaId: string, estudanteId: string, turmaId: string | null, para: PassoPedido) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      const r = pedirPasso(atual, para);
      if (!r.ok) throw erroDeJogo(r.codigo);
      if (r.passo === atual) return this.estado(ctx.sessao, ctx.gate, ctx.pacote);
      const sessao = await tx.exp04ef1bSessao.update({ where: { id: ctx.sessao.id }, data: { passo: r.passo } });
      return this.estado(sessao, ctx.gate, ctx.pacote);
    }, escolaId);
  }

  /**
   * Abre uma pista — e é o REGISTRO que mede a EF15CO04. Só na mesa (fase 1) e
   * na mesa de revisão (fase 2); idempotente por par na mesma fase. O texto sai
   * do pacote, no servidor.
   */
  async abrirPista(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    par: { noticiaId: IdDeNoticia; tipo: TipoDePista },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const fase = faseDoPasso(passoEfetivo(normalizarPasso(ctx.sessao.passo), ctx.gate.etapa));
      if (fase === null) throw erroDeJogo("passo-invalido");
      const noticia = ctx.pacote.noticias.find((n) => n.id === par.noticiaId);
      if (!noticia) throw erroDeJogo("payload-invalido");

      const r = registrarPista(pistasDaLinha(ctx.sessao.pistas), par, fase, new Date());
      if (r.nova) {
        await tx.exp04ef1bSessao.update({
          where: { id: ctx.sessao.id },
          data: { pistas: r.pistas as unknown as Prisma.InputJsonValue },
        });
      }
      return { ...par, fase, texto: noticia.pistas[par.tipo], abertas: paresAbertos(r.pistas).length };
    }, escolaId);
  }

  /**
   * A página diagramada com as três vagas de agora. A transação só confere o
   * funil e o passo; a IA (até ~6 s) corre FORA dela — segurar a conexão do
   * pool esse tempo, com 30 crianças montando a página, pararia a sala.
   */
  async diagramar(escolaId: string, estudanteId: string, turmaId: string | null, slots: readonly IdDeNoticia[]) {
    const { pacoteId, vagas } = await this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const efetivo = passoEfetivo(normalizarPasso(ctx.sessao.passo), ctx.gate.etapa);
      if (efetivo !== "mesa" && efetivo !== "revisao") throw erroDeJogo("passo-invalido");
      const porId = new Map(ctx.pacote.noticias.map((n) => [n.id, n]));
      const vagas = slots.map((id) => porId.get(id)).filter((n): n is NoticiaDoPacote => Boolean(n));
      if (vagas.length !== TAMANHO_DA_EDICAO) throw erroDeJogo("payload-invalido");
      return { pacoteId: ctx.pacote.id, vagas };
    }, escolaId);
    return this.diagramacao.diagramar(escolaId, estudanteId, pacoteId, vagas);
  }

  /**
   * "Distribuir Jornal Agora" — O LATCH da 1ª edição.
   *
   * As verificadas são calculadas AQUI, contra o gabarito do pacote (o cliente
   * manda três ids), e gravadas com as vagas, o layout, o carimbo e o passo
   * `motivo` no MESMO update (os CHECKs valem por statement). A resposta NÃO
   * traz o resultado: ele só desce no `GET resultado`, com o portão aberto e o
   * motivo respondido.
   *
   * Concorrente: dois toques chegam como duas requisições, o lock por
   * estudante as põe em fila, e a segunda relê a sessão já publicada — 409
   * `edicao-ja-publicada`. O `WHERE publicada1_em IS NULL` é a segunda tranca,
   * e o CHECK, a terceira. O lock COMPARTILHADO da turma (depois do do
   * estudante) e a releitura do gate fecham a corrida com o "Zerar": a marca da
   * EF15CO04 não cai numa rodada que já acabou.
   */
  async publicar(escolaId: string, estudanteId: string, turmaId: string | null, pub: Publicacao) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      if (ctx.sessao.publicada1Em || publicouAPrimeira(atual)) throw erroDeJogo("edicao-ja-publicada");
      if (atual !== "mesa") throw erroDeJogo("passo-invalido");
      const gate = await this.gateDaSessao(tx, escolaId, ctx);

      const { count } = await tx.exp04ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, publicada1Em: null },
        data: {
          slotsEd1: pub.slots,
          layoutEd1: pub.layout,
          origemLayoutEd1: pub.origemDoLayout,
          verificadasEd1: verificadasDa(pub.slots, ctx.pacote.noticias),
          publicada1Em: new Date(),
          passo: "motivo",
        },
      });
      if (count === 0) throw erroDeJogo("edicao-ja-publicada");

      await this.marcar(tx, ctx, gate, MARCADOR_DAS_PISTAS, nivelDasPistas(pistasDaLinha(ctx.sessao.pistas)));
      const sessao = await tx.exp04ef1bSessao.findUniqueOrThrow({ where: { id: ctx.sessao.id } });
      return this.estado(sessao, gate, ctx.pacote);
    }, escolaId);
  }

  /**
   * A pergunta de motivo, DEPOIS do latch e antes do resultado — uma vez só. É
   * da criança com qualquer etapa (`passoEfetivo`): a resposta tem de sair
   * antes de ela ver o que a edição causou.
   */
  async responderMotivo(escolaId: string, estudanteId: string, turmaId: string | null, motivo: Motivo) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      if (!ctx.sessao.publicada1Em) throw erroDeJogo("edicao-nao-publicada");
      if (ctx.sessao.motivoEd1 !== null || normalizarPasso(ctx.sessao.passo) !== "motivo") {
        throw erroDeJogo("motivo-ja-respondido");
      }
      const { count } = await tx.exp04ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, motivoEd1: null, passo: "motivo" },
        data: { motivoEd1: motivo, passo: "publicada" },
      });
      if (count === 0) throw erroDeJogo("motivo-ja-respondido");
      const sessao = await tx.exp04ef1bSessao.findUniqueOrThrow({ where: { id: ctx.sessao.id } });
      return this.estado(sessao, ctx.gate, ctx.pacote);
    }, escolaId);
  }

  /**
   * O resultado da 1ª edição: as verificadas e a reação de um leitor por vaga
   * — só das notícias ESCOLHIDAS (PDF §7). Três portões, nesta ordem: a edição
   * publicada, o motivo respondido e a etapa `resultado` liberada pelo
   * professor.
   */
  async resultado(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const edicao1 = edicaoDaLinha(ctx.sessao.slotsEd1, ctx.sessao.layoutEd1, ctx.sessao.origemLayoutEd1, ctx.sessao.publicada1Em);
      if (!edicao1) throw erroDeJogo("edicao-nao-publicada");
      if (ctx.sessao.motivoEd1 === null) throw erroDeJogo("motivo-pendente");
      if (ctx.gate.etapa === ETAPA_INICIAL) throw erroDeJogo("resultado-nao-liberado");
      return { edicao1: edicaoComResultado(edicao1, ctx.pacote.noticias) };
    }, escolaId);
  }

  /**
   * Uma tentativa da Chave do Editor. Só com o passo efetivo `chave` (a revisão
   * liberada para quem já respondeu o motivo); cada envio conta; o sucesso é o
   * CONJUNTO {fonte, data, autoria}, corrigido aqui (`regras/chave.ts`). No
   * sucesso, o passo vai a `revisao` e a EF15CO02 é marcada pelas tentativas.
   * Com a Chave já formada, responde sucesso sem contar — o F5 e o toque
   * duplo não viram tentativa. Com `tentativaDaTela` já contada, também não
   * conta: devolve o resultado daquela tentativa.
   */
  async tentarChave(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    blocos: readonly IdDeBloco[],
    tentativaDaTela?: number,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      if (ctx.sessao.chaveFormadaEm) {
        return {
          sucesso: true,
          tentativas: ctx.sessao.chaveTentativas,
          devolvidos: [],
          estado: this.estado(ctx.sessao, ctx.gate, ctx.pacote),
        };
      }
      if (passoEfetivo(normalizarPasso(ctx.sessao.passo), ctx.gate.etapa) !== "chave") {
        throw erroDeJogo("revisao-nao-liberada");
      }
      const gate = await this.gateDaSessao(tx, escolaId, ctx);

      const correcao = corrigirChave(blocos);
      /* O REENVIO: a tela diz que número está mandando, e um número já contado
         é a mesma tentativa chegando de novo (a resposta perdida na rede, o toque
         duplo). Devolve o resultado sem somar — a EF15CO02 sai daqui. Lido depois
         do lock do estudante, então dois reenvios simultâneos contam UMA vez. Os
         `devolvidos` daquela tentativa não são gravados; saem dos blocos enviados. */
      if (tentativaDaTela !== undefined && tentativaDaTela <= ctx.sessao.chaveTentativas) {
        return {
          sucesso: false,
          tentativas: ctx.sessao.chaveTentativas,
          devolvidos: correcao.devolvidos,
          estado: this.estado(ctx.sessao, gate, ctx.pacote),
        };
      }
      const tentativas = ctx.sessao.chaveTentativas + 1;
      if (!correcao.sucesso) {
        const sessao = await tx.exp04ef1bSessao.update({
          where: { id: ctx.sessao.id },
          data: { chaveTentativas: tentativas },
        });
        return { sucesso: false, tentativas, devolvidos: correcao.devolvidos, estado: this.estado(sessao, gate, ctx.pacote) };
      }

      const { count } = await tx.exp04ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, chaveFormadaEm: null, passo: "publicada" },
        data: { chaveTentativas: tentativas, chaveFormadaEm: new Date(), passo: "revisao" },
      });
      /* Sem linha atualizada, a Chave já estava formada: não conta nem marca de novo. */
      if (count > 0) await this.marcar(tx, ctx, gate, MARCADOR_DA_CHAVE, nivelDaChave(tentativas));
      const sessao = await tx.exp04ef1bSessao.findUniqueOrThrow({ where: { id: ctx.sessao.id } });
      return {
        sucesso: true,
        tentativas: sessao.chaveTentativas,
        devolvidos: [],
        estado: this.estado(sessao, gate, ctx.pacote),
      };
    }, escolaId);
  }

  /** A mesa de revisão: o marcador de cada vaga da 1ª edição — só depois da Chave. */
  async revisao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const slots = slotsDaLinha(ctx.sessao.slotsEd1);
      if (!ctx.sessao.chaveFormadaEm || !slots) throw erroDeJogo("chave-nao-formada");
      return { vagas: vagasMarcadas(slots, ctx.pacote.noticias) };
    }, escolaId);
  }

  /**
   * "Publicar 2ª Edição Revisada" — O LATCH da 2ª. Pode repetir as três da 1ª:
   * quem acertou de primeira confirma, sem trocar à força (PDF §9). Marca a
   * EF04CO08 (`edicao-2`) pelas pistas das duas fases e as verificadas da 2ª.
   */
  async republicar(escolaId: string, estudanteId: string, turmaId: string | null, pub: Publicacao) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      if (ctx.sessao.publicada2Em) throw erroDeJogo("edicao-ja-publicada");
      if (!ctx.sessao.chaveFormadaEm) throw erroDeJogo("chave-nao-formada");
      if (normalizarPasso(ctx.sessao.passo) !== "revisao") throw erroDeJogo("passo-invalido");
      const gate = await this.gateDaSessao(tx, escolaId, ctx);

      const verificadas2 = verificadasDa(pub.slots, ctx.pacote.noticias);
      const { count } = await tx.exp04ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, publicada2Em: null },
        data: {
          slotsEd2: pub.slots,
          layoutEd2: pub.layout,
          origemLayoutEd2: pub.origemDoLayout,
          verificadasEd2: verificadas2,
          publicada2Em: new Date(),
          passo: "comparativo",
        },
      });
      if (count === 0) throw erroDeJogo("edicao-ja-publicada");

      await this.marcar(tx, ctx, gate, MARCADOR_DA_EDICAO_2, nivelDaEdicao2(pistasDaLinha(ctx.sessao.pistas), verificadas2));
      const sessao = await tx.exp04ef1bSessao.findUniqueOrThrow({ where: { id: ctx.sessao.id } });
      return this.estado(sessao, gate, ctx.pacote);
    }, escolaId);
  }

  /** O antes e o depois (PDF §9), com o pilar que faltava em cada notícia das duas edições. */
  async comparativo(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const s = ctx.sessao;
      const e1 = edicaoDaLinha(s.slotsEd1, s.layoutEd1, s.origemLayoutEd1, s.publicada1Em);
      const e2 = edicaoDaLinha(s.slotsEd2, s.layoutEd2, s.origemLayoutEd2, s.publicada2Em);
      if (!e1 || !e2) throw erroDeJogo("edicao-nao-publicada");
      const todas = [...new Set([...e1.slots, ...e2.slots])];
      return {
        edicao1: edicaoComResultado(e1, ctx.pacote.noticias),
        edicao2: edicaoComResultado(e2, ctx.pacote.noticias),
        vagas: vagasMarcadas(todas, ctx.pacote.noticias),
      };
    }, escolaId);
  }

  /** "Concluir Missão" — de `transferencia` para `fim`; idempotente em `fim`. */
  async concluir(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      if (atual === "fim") return this.estado(ctx.sessao, ctx.gate, ctx.pacote);
      if (atual !== "transferencia") throw erroDeJogo("passo-invalido");
      /* Passo e carimbo no mesmo update: o CHECK `fim ⇔ concluida_em` vale por statement. */
      const sessao = await tx.exp04ef1bSessao.update({
        where: { id: ctx.sessao.id },
        data: { passo: "fim", concluidaEm: new Date() },
      });
      return this.estado(sessao, ctx.gate, ctx.pacote);
    }, escolaId);
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
        turmas: turmas.map((t) => ({ id: t.id, nome: t.nome, serie: t.serie, estudantes: t._count.estudantes })),
      };
    }, escolaId);
  }

  /**
   * O painel da aula — POR COMPUTADOR, como na A Seleção.
   *
   * Parte de `users.turma_id` (quem não entrou também aparece; `users` está
   * fora da RLS, e o `escolaId` no `where` é a tranca). As linhas passam por
   * `colapsarEmUnidades` sobre o `mapaDeEquipes` lido DENTRO do `comTenancy`;
   * o representante do computador é quem PUBLICOU a 1ª edição. "X de Y
   * computadores publicaram": o Y vem da MONTAGEM (`computadoresDaMontagem`),
   * porque o colapso conta também quem faltou.
   *
   * **Só progresso por linha** (`PROIBIDO_NA_LINHA_DO_PAINEL`): as verificadas
   * aparecem só no histograma ANÔNIMO, e o nível mora no painel de habilidades.
   * Esta missão não tem texto livre de menor, então não há recorte de gestor a
   * aplicar — o gestor lê o mesmo painel. A leitura do PROFESSOR conta o
   * EVT-P04 no pacote.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const { gate, pacote } = await this.exigirPacote(tx, escolaId, turmaId);
      if (professorId) {
        await tx.exp04ef1bPacote.updateMany({
          where: { id: pacote.id, escolaId },
          data: { painelVistoEm: new Date(), painelVistas: { increment: 1 } },
        });
      }

      const [estudantes, mapa, computadores] = await Promise.all([
        tx.user.findMany({
          where: { escolaId, turmaId, role: "estudante" },
          select: {
            id: true,
            displayName: true,
            username: true,
            jornalSessoes: {
              where: { escolaId, turmaId, pacoteId: gate.pacoteId, rodada: gate.rodada },
              take: 1,
            },
          },
          orderBy: { displayName: "asc" },
        }),
        /* A equipe é da ATIVIDADE (ADR-130): a deste pacote. */
        mapaDeEquipes(tx, escolaId, turmaId, EXP_ID, gate.pacoteId),
        computadoresDaMontagem(tx, escolaId, turmaId, EXP_ID, gate.pacoteId),
      ]);

      const linhas = estudantes.map((e) => {
        const s = e.jornalSessoes[0];
        return {
          estudanteId: e.id,
          nome: e.displayName,
          usuario: e.username,
          /* `entrou` = tem sessão nesta rodada; `iniciou` = publicou a 1ª edição. */
          entrou: Boolean(s),
          iniciou: Boolean(s?.publicada1Em),
          /* O passo EFETIVO, o mesmo da tela da criança. */
          passo: s ? passoEfetivo(normalizarPasso(s.passo), gate.etapa) : ("desafio" as const),
          pistasAbertas: s ? paresAbertos(pistasDaLinha(s.pistas)).length : 0,
          publicouAPrimeira: Boolean(s?.publicada1Em),
          chaveFormada: Boolean(s?.chaveFormadaEm),
          publicouASegunda: Boolean(s?.publicada2Em),
          concluiu: Boolean(s?.concluidaEm),
          _sessao: s ?? null,
          _peso: pesoDaLinha(s?.publicada1Em ?? null, s?.atualizadoEm ?? null),
        };
      });

      /* O candidato a representante é quem ENTROU, e o peso põe quem publicou
         na frente: sem ninguém que publicou, o computador ainda é representado
         por quem abriu a missão, e não pelo colega que não entrou. */
      const unidades = colapsarEmUnidades(
        linhas,
        (l) => l.estudanteId,
        mapa,
        (l) => l.entrou,
        (l) => l._peso,
      );

      const histograma1 = [0, 0, 0, 0];
      const histograma2 = [0, 0, 0, 0];
      const motivos = { visual: 0, checagem: 0 };
      const naEdicao1 = new Map<string, number>();
      const naEdicao2 = new Map<string, number>();
      for (const { linha } of unidades) {
        const s = linha._sessao;
        if (!s) continue;
        const ed1 = s.publicada1Em ? slotsDaLinha(s.slotsEd1) : null;
        const ed2 = s.publicada2Em ? slotsDaLinha(s.slotsEd2) : null;
        if (ed1 && s.verificadasEd1 !== null) histograma1[s.verificadasEd1] = (histograma1[s.verificadasEd1] ?? 0) + 1;
        if (ed2 && s.verificadasEd2 !== null) histograma2[s.verificadasEd2] = (histograma2[s.verificadasEd2] ?? 0) + 1;
        if (ehMotivo(s.motivoEd1)) motivos[s.motivoEd1] += 1;
        for (const id of ed1 ?? []) naEdicao1.set(id, (naEdicao1.get(id) ?? 0) + 1);
        for (const id of ed2 ?? []) naEdicao2.set(id, (naEdicao2.get(id) ?? 0) + 1);
      }

      const saida = unidades.map(({ linha, equipe }) => {
        const { _sessao: _s, _peso: _p, ...resto } = linha;
        return { ...resto, equipe: equipe ? { id: equipe.id, nome: equipe.nome } : null };
      });
      const publicaram1 = saida.filter((u) => u.publicouAPrimeira).length;

      return {
        turma,
        pacote: {
          id: pacote.id,
          disciplina: pacote.disciplina,
          tema: pacote.tema,
          origem: pacote.origem,
          midia: resumoDaMidia(pacote),
        },
        rodada: gate.rodada,
        etapa: gate.etapa,
        proximaEtapa: proximaEtapa(gate.etapa),
        linhas: saida,
        resumo: {
          total: saida.length,
          iniciaram: saida.filter((u) => u.iniciou).length,
          publicaramAPrimeira: publicaram1,
          formaramAChave: saida.filter((u) => u.chaveFormada).length,
          publicaramASegunda: saida.filter((u) => u.publicouASegunda).length,
          concluiram: saida.filter((u) => u.concluiu).length,
          computadores: { publicaram: publicaram1, total: computadores ?? saida.length },
          porComputador: mapa.size > 0,
          histograma: { edicao1: histograma1, edicao2: histograma2 },
          motivos,
          radar: pacote.noticias.map((n) => ({
            noticiaId: n.id,
            manchete: n.manchete,
            meio: n.meio,
            publicavel: n.gabarito.publicavel,
            pilarEmFalta: n.gabarito.publicavel ? null : n.gabarito.pilarEmFalta,
            naEdicao1: naEdicao1.get(n.id) ?? 0,
            naEdicao2: naEdicao2.get(n.id) ?? 0,
          })),
        },
      };
    }, escolaId);
  }

  /**
   * O botão único do painel: a etapa de DESTINO. Idempotente, uma etapa por
   * vez, sem pular nem voltar (`regras/passos.ts#transicaoDoGate`), com o lock
   * EXCLUSIVO da turma — que espera as publicações em voo (elas pegam o
   * compartilhado). Grava o carimbo do portão que abriu (EVT-P05).
   */
  async mudarEtapa(escolaId: string, turmaId: string, professorId: string | undefined, para: Etapa) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const { gate } = await this.exigirPacote(tx, escolaId, turmaId);

      const r = transicaoDoGate(gate.etapa, para);
      if (!r.ok) throw erroDeJogo(r.codigo, { etapaAtual: gate.etapa, proximaEtapa: proximaEtapa(gate.etapa) });

      let atualizadoEm = gate.atualizadoEm;
      if (r.mudou) {
        const agora = new Date();
        const linha = await tx.exp04ef1bGateTurma.update({
          where: { escolaId_turmaId: { escolaId, turmaId } },
          data: {
            etapa: para,
            ...(para === "resultado" ? { resultadoLiberadoEm: agora } : {}),
            ...(para === "revisao" ? { revisaoLiberadaEm: agora } : {}),
          },
          select: { atualizadoEm: true },
        });
        atualizadoEm = linha.atualizadoEm;
      }
      return {
        turma,
        pacoteId: gate.pacoteId,
        rodada: gate.rodada,
        etapa: para,
        proximaEtapa: proximaEtapa(para),
        atualizadoEm: atualizadoEm.toISOString(),
      };
    }, escolaId);
  }

  /**
   * "Zerar a turma" — a segunda aplicação, SEM apagar nada: sobe a rodada e
   * volta à exploração. As sessões da rodada anterior ficam, com as edições e
   * as pistas: é a rodada passada que o painel de habilidades mostra (ADR-112).
   * Os carimbos dos portões são da rodada, e voltam a nulo (CHECK).
   */
  async zerar(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const { gate } = await this.exigirPacote(tx, escolaId, turmaId);
      const linha = await tx.exp04ef1bGateTurma.update({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        data: { rodada: gate.rodada + 1, etapa: ETAPA_INICIAL, resultadoLiberadoEm: null, revisaoLiberadaEm: null },
        select: { pacoteId: true, rodada: true, etapa: true },
      });
      return { pacoteId: linha.pacoteId, rodada: linha.rodada, etapa: normalizarEtapa(linha.etapa) };
    }, escolaId);
  }

  /**
   * As ATIVIDADES da turma (ADR-130): o pacote em andamento inteiro, com o
   * gabarito, e a lista de todos — que é a lista de atividades da ficha e o
   * seletor `?pacote=` do painel de habilidades. `ativo` é `null` quando o
   * professor ainda não pôs nenhum em andamento: a plataforma não cria atividade.
   */
  async pacotes(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const emAndamento = await tx.exp04ef1bGateTurma.findUnique({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        include: { pacote: { select: SELECAO_DO_PACOTE } },
      });
      const [todos, rodadas] = await Promise.all([
        tx.exp04ef1bPacote.findMany({
          where: { escolaId, turmaId },
          select: { id: true, disciplina: true, tema: true, origem: true, ativo: true, criadoEm: true },
          orderBy: { criadoEm: "desc" },
        }),
        tx.exp04ef1bSessao.groupBy({ by: ["pacoteId"], where: { escolaId, turmaId }, _max: { rodada: true } }),
      ]);
      const maiorRodada = new Map(rodadas.map((r) => [r.pacoteId, r._max.rodada ?? 0]));
      return {
        ativo: emAndamento
          ? {
              ...this.pacoteParaATela(pacoteDaLinha(emAndamento.pacote)),
              rodada: emAndamento.rodada,
              etapa: normalizarEtapa(emAndamento.etapa),
            }
          : null,
        historico: todos.map((p) => ({
          id: p.id,
          disciplina: p.disciplina,
          tema: p.tema,
          origem: p.origem === "ia" ? ("ia" as const) : ("padrao" as const),
          ativo: p.ativo,
          criadoEm: p.criadoEm.toISOString(),
          rodadas: maiorRodada.get(p.id) ?? 0,
        })),
      };
    }, escolaId);
  }

  /**
   * UM pacote, inteiro e com o gabarito — a página da atividade, esteja ou não
   * em andamento. É de onde o professor prepara as imagens de uma atividade
   * PRONTA antes de pô-la no ar.
   */
  async pacote(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      const [gate, rodadas] = await Promise.all([
        this.lerGate(tx, escolaId, turmaId),
        tx.exp04ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } }),
      ]);
      const emAndamento = gate?.pacoteId === pacoteId;
      return {
        ...this.pacoteParaATela(pacoteDaLinha(linha)),
        ativo: emAndamento,
        rodada: emAndamento && gate ? gate.rodada : null,
        etapa: emAndamento && gate ? gate.etapa : null,
        criadoEm: linha.criadoEm.toISOString(),
        rodadas: rodadas._max.rodada ?? 0,
      };
    }, escolaId);
  }

  /**
   * "USAR ESTA ATIVIDADE AGORA" (ADR-130): o professor escolhe, na lista, qual
   * atividade a turma faz. O pacote que estava em andamento volta a ser PRONTO
   * — fica, com as sessões e as rodadas —, e o gate passa a apontar o escolhido,
   * com os portões fechados.
   *
   * A RODADA: o pacote que nunca rodou começa na 1; o que já rodou abre a
   * SEGUINTE à última — retomar a mesma depois do resultado liberado seria o
   * "voltar" que o botão único proíbe. Nada se perde: as rodadas anteriores
   * continuam no painel de habilidades (ADR-112).
   *
   * Idempotente: pôr no ar o que já está no ar não muda nada.
   */
  async colocarEmAndamento(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);

      const atual = await this.lerGate(tx, escolaId, turmaId);
      if (atual?.pacoteId === pacoteId) {
        return { pacoteId, rodada: atual.rodada, etapa: atual.etapa, mudou: false };
      }

      const ultima = await tx.exp04ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } });
      const rodada = (ultima._max.rodada ?? 0) + 1;
      await tx.exp04ef1bPacote.updateMany({ where: { escolaId, turmaId, ativo: true }, data: { ativo: false } });
      await tx.exp04ef1bPacote.update({ where: { id: pacoteId }, data: { ativo: true } });
      const gate = { pacoteId, rodada, etapa: ETAPA_INICIAL, resultadoLiberadoEm: null, revisaoLiberadaEm: null };
      await tx.exp04ef1bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, ...gate },
        update: gate,
      });
      return { pacoteId, rodada, etapa: ETAPA_INICIAL, mudou: true };
    }, escolaId);
  }

  /** O pacote como as telas do professor o mostram, com o gabarito. */
  private pacoteParaATela(pacote: PacoteLido) {
    const imagens: Record<string, string> = {};
    for (const [id, url] of Object.entries(pacote.midia)) if (url) imagens[id] = url;
    return {
      id: pacote.id,
      disciplina: pacote.disciplina,
      tema: pacote.tema,
      origem: pacote.origem,
      topicos: pacote.topicos,
      noticias: pacote.noticias,
      midia: resumoDaMidia(pacote),
      imagens,
    };
  }

  /** O pacote desta turma, ou 404 — o de outra turma não tem a existência confirmada. */
  private async pacoteDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacoteId: string) {
    const linha = ehUuid(pacoteId)
      ? await tx.exp04ef1bPacote.findFirst({
          where: { id: pacoteId, escolaId, turmaId },
          select: { ...SELECAO_DO_PACOTE, criadoEm: true },
        })
      : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  /**
   * "Criar atividade" — a curadoria humana (ADR-66/67), e o ÚNICO lugar que
   * liga `aprovado`.
   *
   * Pacote novo é ATIVIDADE nova, e ela nasce PRONTA, não no ar (ADR-130):
   * quem escolhe o que a turma faz é o professor, na lista de atividades
   * (`colocarEmAndamento`). O em andamento continua em andamento — criar a
   * próxima aula não pode tirar do ar a de agora.
   *
   * As imagens de notícia com a MESMA descrição de um pacote recente da turma
   * são herdadas: o arquivo no bucket é o hash da descrição.
   */
  async homologar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    aprovadoPor: string,
    corpo: { disciplina: string; tema: string; topicos?: string; origem: OrigemDoPacote; noticias: NoticiaDoPacote[] },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");

      const recentes = await tx.exp04ef1bPacote.findMany({
        where: { escolaId, turmaId },
        orderBy: { criadoEm: "desc" },
        take: 5,
        select: { ...SELECAO_DO_PACOTE, ativo: true },
      });
      const noticias = emOrdemDaMesa(corpo.noticias);

      /* O MESMO conteúdo do pacote mais recente não é atividade nova: é o
         segundo clique em "Criar atividade". Sem isto, cada toque criaria uma
         entrada na lista de atividades. */
      const [ultimo] = recentes;
      if (ultimo && this.mesmoConteudo(pacoteDaLinha(ultimo), corpo.origem, corpo.tema, noticias)) {
        const lido = pacoteDaLinha(ultimo);
        return {
          id: lido.id,
          disciplina: lido.disciplina,
          tema: lido.tema,
          origem: lido.origem,
          ativo: ultimo.ativo,
          noticias: lido.noticias,
        };
      }

      const urlDaDescricao = new Map<string, string>();
      for (const velho of recentes.map(pacoteDaLinha).reverse()) {
        for (const n of velho.noticias) {
          const url = velho.midia[n.id];
          if (n.descricaoImagem && url) urlDaDescricao.set(n.descricaoImagem, url);
        }
      }
      const herdada: Record<string, string> = {};
      for (const n of noticias) {
        const url = n.descricaoImagem ? urlDaDescricao.get(n.descricaoImagem) : undefined;
        if (url) herdada[n.id] = url;
      }

      const novo = await tx.exp04ef1bPacote.create({
        data: {
          escolaId,
          turmaId,
          disciplina: corpo.disciplina,
          tema: corpo.tema,
          topicos: corpo.topicos?.trim() || null,
          origem: corpo.origem,
          noticias: noticias as unknown as Prisma.InputJsonValue,
          midia: herdada,
          aprovadoPor,
          aprovadoEm: new Date(),
          ativo: false,
        },
        select: { id: true, disciplina: true, tema: true, origem: true },
      });
      return {
        id: novo.id,
        disciplina: novo.disciplina,
        tema: novo.tema,
        origem: novo.origem === "ia" ? ("ia" as const) : ("padrao" as const),
        ativo: false,
        noticias,
      };
    }, escolaId);
  }

  /** A guarda de turma, sozinha — a do preparo, ANTES de gastar token. */
  async exigirTurmaVisivel(escolaId: string, turmaId: string, professorId?: string): Promise<void> {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
  }

  /**
   * O EVT-P02: uma geração de rascunho (ou regeneração) que chamou a IA, e o
   * que custou. O rascunho não persiste, então a conta vai no pacote que estava
   * em sala — a soma dos pacotes da turma é o total que o PRD mede (T16, T20).
   * Sem pacote em andamento (a primeira atividade da turma sendo criada), não
   * há onde contar, e a geração não é contada.
   */
  async registrarGeracao(escolaId: string, turmaId: string, tokens: number): Promise<void> {
    try {
      await this.prisma.comTenancy(async (tx) => {
        const gate = await this.lerGate(tx, escolaId, turmaId);
        if (!gate) return;
        await tx.exp04ef1bPacote.updateMany({
          where: { id: gate.pacoteId, escolaId },
          data: { geracoes: { increment: 1 }, tokensUsados: { increment: Math.max(0, Math.round(tokens)) } },
        });
      }, escolaId);
    } catch {
      /* Telemetria do preparo não pode derrubar o rascunho que a professora espera. */
      logger.warn({ codigo: "exp04ef1b-geracao-nao-contada", escolaId }, "EVT-P02 não gravado");
    }
  }

  /**
   * O pacote das imagens (`midia.service.ts`): o pedido, ou o em andamento sem
   * pedido. O pedido é a atividade PRONTA que o professor prepara antes de pôr
   * no ar (ADR-130).
   */
  async pacoteParaMidia(escolaId: string, turmaId: string, professorId?: string, pacoteId?: string): Promise<PacoteLido> {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      if (pacoteId) return pacoteDaLinha(await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId));
      return (await this.exigirPacote(tx, escolaId, turmaId)).pacote;
    }, escolaId);
  }

  /**
   * Grava a URL de UMA imagem no pacote. Concatenação de JSONB no próprio
   * UPDATE (`midia || {n1: url}`), e não ler-modificar-gravar: duas abas do
   * preparo gravando imagens diferentes não podem apagar uma à outra.
   */
  async registrarMidia(escolaId: string, pacoteId: string, noticiaId: IdDeNoticia, url: string): Promise<void> {
    await this.prisma.comTenancy(
      (tx) => tx.$executeRaw`
        UPDATE exp04ef1b_pacotes
           SET midia = midia || jsonb_build_object(${noticiaId}::text, ${url}::text),
               atualizado_em = now()
         WHERE id = ${pacoteId}::uuid AND escola_id = ${escolaId}`,
      escolaId,
    );
  }

  /**
   * A notícia COMO ESTAVA, para "Regenerar notícia" quando a IA não respondeu
   * (`usouIa: false`). O corpo da regeneração só traz o contexto das outras
   * (sem o texto), então ela sai do pacote ATIVO da turma — ou do banco padrão
   * — pelo id, preferindo a que tem o mesmo meio e papel da vaga pedida.
   */
  async noticiaComoEstava(
    escolaId: string,
    turmaId: string,
    alvo: { id: IdDeNoticia; meio: NoticiaDoPacote["meio"]; gabarito: { publicavel: boolean; pilarEmFalta: TipoDePista | null } },
  ): Promise<NoticiaDoPacote> {
    const ativo = await this.prisma.comTenancy(
      (tx) => tx.exp04ef1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true }, select: SELECAO_DO_PACOTE }),
      escolaId,
    );
    const candidatas = [
      ...(ativo ? pacoteDaLinha(ativo).noticias : []),
      ...noticiasPadrao(),
    ].filter((n) => n.id === alvo.id);
    const mesmaVaga = candidatas.find(
      (n) =>
        n.meio === alvo.meio &&
        n.gabarito.publicavel === alvo.gabarito.publicavel &&
        (n.gabarito.publicavel || n.gabarito.pilarEmFalta === alvo.gabarito.pilarEmFalta),
    );
    const escolhida = mesmaVaga ?? candidatas[0];
    if (!escolhida) throw erroDeJogo("payload-invalido");
    return escolhida;
  }

  // ────────────────────────────────────────────────────────────── privados

  /** O pacote que chega tem a MESMA origem, o mesmo tema e as mesmas notícias do ativo? */
  private mesmoConteudo(ativo: PacoteLido, origem: OrigemDoPacote, tema: string, noticias: readonly NoticiaDoPacote[]): boolean {
    return (
      ativo.origem === origem &&
      ativo.tema.trim() === tema.trim() &&
      canonico(ativo.noticias) === canonico(emOrdemDaMesa(noticias))
    );
  }

  /** O estado público da sessão — o que toda rota do estudante devolve. */
  private estado(sessao: Exp04ef1bSessao, gate: GateLido, pacote: PacoteLido) {
    const passo = normalizarPasso(sessao.passo);
    const porId = new Map(pacote.noticias.map((n) => [n.id, n]));
    return {
      sessaoId: sessao.id,
      pacoteId: sessao.pacoteId,
      rodada: sessao.rodada,
      etapa: gate.etapa,
      passo: passoEfetivo(passo, gate.etapa),
      passoDoEstudante: passo,
      aguardandoOProfessor: aguardandoOProfessor(passo, gate.etapa),
      edicao1: edicaoDaLinha(sessao.slotsEd1, sessao.layoutEd1, sessao.origemLayoutEd1, sessao.publicada1Em),
      motivoRespondido: sessao.motivoEd1 !== null,
      chaveFormada: sessao.chaveFormadaEm !== null,
      chaveTentativas: sessao.chaveTentativas,
      edicao2: edicaoDaLinha(sessao.slotsEd2, sessao.layoutEd2, sessao.origemLayoutEd2, sessao.publicada2Em),
      pistasAbertas: pistasDaTela(pistasDaLinha(sessao.pistas)).map((p) => ({
        ...p,
        texto: porId.get(p.noticiaId)?.pistas[p.tipo] ?? "",
      })),
      iniciadaEm: sessao.criadoEm.toISOString(),
      concluidaEm: sessao.concluidaEm?.toISOString() ?? null,
    };
  }

  /**
   * A MARCA de uma ação na ficha, DENTRO da transação da jogada: cai junto se
   * ela cair. A cópia para os colegas de computador é da própria porta
   * `marcar` (E14).
   *
   * **Ação que a revelação entrega não mede duas vezes** (ADR-120): na rodada
   * nova do MESMO pacote, quem já foi avaliada numa anterior já viu o
   * resultado, a Chave e o comparativo — refazer mede memória. Então a missão
   * pergunta antes `jaAvaliadaAntes` e, se sim, não marca; quem faltou é medida
   * na primeira vez que joga.
   */
  private async marcar(
    tx: Prisma.TransactionClient,
    ctx: ContextoDoEstudante,
    gate: GateLido,
    marcador: string,
    status: Nivel,
  ): Promise<void> {
    const marca = {
      escolaId: ctx.pacote.escolaId,
      expId: EXP_ID,
      atividadeId: gate.pacoteId,
      rodada: gate.rodada,
      estudanteId: ctx.sessao.estudanteId,
      marcador,
    };
    if (await this.evidencias.jaAvaliadaAntes(tx, marca)) return;
    await this.evidencias.marcar(tx, { ...marca, turmaId: ctx.turmaId, status });
  }

  /**
   * O lock COMPARTILHADO da turma e a releitura do gate — depois do lock, e é a
   * leitura que vale. O zerar e a homologação pegam o EXCLUSIVO: uma jogada em
   * voo termina antes, e a que chega depois vê a rodada nova (409
   * `rodada-mudou`, e a tela recarrega).
   */
  private async gateDaSessao(tx: Prisma.TransactionClient, escolaId: string, ctx: ContextoDoEstudante): Promise<GateLido> {
    await this.travarTurma(tx, escolaId, ctx.turmaId, "compartilhado");
    const gate = await this.lerGate(tx, escolaId, ctx.turmaId);
    if (!gate || gate.pacoteId !== ctx.sessao.pacoteId || gate.rodada !== ctx.sessao.rodada) {
      throw erroDeJogo("rodada-mudou");
    }
    return gate;
  }

  /** O gate, sem criar — `null` sem gate. */
  private async lerGate(tx: Prisma.TransactionClient, escolaId: string, turmaId: string): Promise<GateLido | null> {
    const linha = await tx.exp04ef1bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      select: { pacoteId: true, rodada: true, etapa: true, atualizadoEm: true },
    });
    return linha
      ? { pacoteId: linha.pacoteId, rodada: linha.rodada, etapa: normalizarEtapa(linha.etapa), atualizadoEm: linha.atualizadoEm }
      : null;
  }

  /**
   * O gate da turma e o pacote EM ANDAMENTO — ou 403 `atividade-nao-preparada`.
   *
   * **A plataforma nunca cria a atividade** (ADR-130): a missão é o esqueleto
   * narrativo, e o pacote é o que o professor criou e PÔS EM ANDAMENTO na lista
   * de atividades. Antes, a primeira entrada da turma criava sozinha o pacote
   * da Feira de Ciências; agora o banco da Unooria é só o ponto de partida do
   * preparo. O 403 é a porta fechada que a experiência já sabe dizer.
   */
  private async exigirPacote(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
  ): Promise<{ gate: GateLido; pacote: PacoteLido }> {
    const linha = await tx.exp04ef1bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      include: { pacote: { select: SELECAO_DO_PACOTE } },
    });
    if (!linha) throw erroDeJogo("atividade-nao-preparada");
    return {
      gate: {
        pacoteId: linha.pacoteId,
        rodada: linha.rodada,
        etapa: normalizarEtapa(linha.etapa),
        atualizadoEm: linha.atualizadoEm,
      },
      pacote: pacoteDaLinha(linha.pacote),
    };
  }

  /**
   * O FUNIL de toda rota de estudante que lê ou escreve a sessão: escola do
   * token, missão liberada (ADR-69) e disponível (ADR-87), turma, gate e a
   * sessão desta rodada — criada se faltar, e travada por estudante.
   *
   * `exigirMissaoLiberada` mora AQUI, e não em cada rota, pela razão do
   * `AGENTS.md` da raiz: a guarda tem de estar no funil, nunca só na leitura.
   */
  private async garantirSessao(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
  ): Promise<ContextoDoEstudante> {
    await this.estudanteDaEscola(tx, escolaId, estudanteId);
    if (!turmaId) throw erroDeJogo("sem-turma");
    const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true } });
    if (!turma) throw erroDeJogo("turma-nao-encontrada");

    const { gate, pacote } = await this.exigirPacote(tx, escolaId, turmaId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`jornal-escola:estudante:${escolaId}:${estudanteId}`}, 0))`;
    const chave = { escolaId, turmaId, estudanteId, pacoteId: gate.pacoteId, rodada: gate.rodada };
    /* `createMany` com `skipDuplicates` é um INSERT ... ON CONFLICT DO NOTHING:
       o F5 e a segunda aba não abortam a transação com um P2002. */
    await tx.exp04ef1bSessao.createMany({ data: [chave], skipDuplicates: true });
    const sessao = await tx.exp04ef1bSessao.findUniqueOrThrow({
      where: { escolaId_turmaId_estudanteId_pacoteId_rodada: chave },
    });
    return { turmaId, gate, pacote, sessao };
  }

  /** `users` está fora da RLS: a escola do token precisa bater com a do usuário. */
  private async estudanteDaEscola(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({ where: { id: estudanteId }, select: { escolaId: true } });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
  }

  /** Escola do token E matrícula na turma quando quem pede é professor. 404, nunca 403. */
  private async turmaVisivel(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, professorId?: string) {
    const turma = await tx.turma.findFirst({
      where: { id: turmaId, escolaId },
      select: { id: true, nome: true, serie: true },
    });
    if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) {
      throw erroDeJogo("turma-nao-encontrada");
    }
    return turma;
  }

  /**
   * O lock consultivo da TURMA. Exclusivo para quem muda a aula inteira (o
   * botão, zerar, homologar, criar o gate); compartilhado para as jogadas que
   * marcam evidência, que só precisam não cruzar com a troca de rodada.
   */
  private async travarTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    modo: "exclusivo" | "compartilhado",
  ): Promise<void> {
    const chave = `jornal-escola:turma:${escolaId}:${turmaId}`;
    if (modo === "exclusivo") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chave}, 0))`;
    } else {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${chave}, 0))`;
    }
  }
}
