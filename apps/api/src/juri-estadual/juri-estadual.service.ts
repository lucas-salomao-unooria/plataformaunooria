import { randomBytes } from "node:crypto";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Prisma, type Exp06ef1bSessao } from "@prisma/client";
import { z } from "zod";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { computadoresDaMontagem, mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades } from "../equipes/regras";
import { EvidenciasService, type ContextoDaAtividade } from "../evidencias/evidencias.service";
import type { Nivel } from "../evidencias/regras";
import { ehUuid } from "../motor/guardas";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import { CARTOES_DE_ATITUDE, CARTOES_DE_MECANISMO, CASO_MARIANA } from "./conteudo";
import { AreaSchema, ProjetoDoPacoteSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import {
  aplicarCurtida,
  aplicarPermanencia,
  embaralhar,
  feedCompleto,
  invisibilidade,
  projetoFoiExibido,
  projetosOcultos,
  servirAte,
  type EstadoDoFeed,
  type ProjetoDoMotor,
} from "./regras/afunilamento";
import {
  MARCADOR_DA_AUDITORIA,
  MARCADOR_DA_CADEIA,
  MARCADOR_DA_CLASSIFICACAO,
  nivelDaAuditoria,
  nivelDaClassificacao,
  nivelPorTentativas,
} from "./regras/evidencia";
import { auditoriaDaLinha, feedDaLinha, ordemDaGaleria, registrarAcao, type AcaoDaGaleria } from "./regras/galeria";
import { blocosDaSessao, idsDaSessao, ordemCertaDaCadeia, ordemConfere } from "./regras/ordem";
import { mediaDasTaxas, votosPorArea } from "./regras/painel";
import {
  ETAPA_INICIAL,
  aguardandoOProfessor,
  normalizarEtapa,
  normalizarPasso,
  passoAntes,
  passoEfetivo,
  passoNoMinimo,
  pedirPasso,
  proximaEtapa,
  transicaoDoGate,
  votou,
  type Etapa,
  type Passo,
  type PassoPedido,
} from "./regras/passos";
import type { ConteudoDoPacote } from "./regras/preparo";
import { postPublico, projetoDaGaleria, type Midia, type PostPublico } from "./regras/publico";
import {
  AREAS,
  DISCIPLINAS,
  EXP_ID,
  IDS_DE_PROJETO,
  ID_DE_PROJETO_RE,
  POSTS_DE_ABERTURA,
  VERSAO_DO_INSTRUMENTO,
  areaDoProjeto,
  type AcaoDaRevisao,
  type Conviccao,
  type Disciplina,
  type OrigemDoPacote,
} from "./vocabulario";

export { EXP_ID } from "./vocabulario";

/**
 * Persistência e regras aplicadas da exp06ef1b — O Júri Estadual de Projetos.
 *
 * Molde: `jornal-escola/jornal-escola.service.ts` (o funil, os locks, o gate da
 * turma, atividade × rodada, o painel por computador). Assinaturas recebem
 * `escolaId`/`estudanteId` explícitos, não o request: toda query leva
 * `escola_id` no `where` ALÉM da RLS que o `comTenancy` arma (regra inviolável
 * nº 1, defesa em profundidade).
 *
 * **O motor do feed roda AQUI** (`regras/afunilamento.ts`): o cliente mede
 * (curtiu, ficou mais de 5 s) e o servidor decide o próximo post. O bundle
 * nunca recebe o acervo nem a regra: antes da galeria, só os posts que o feed
 * serviu descem (`regras/publico.ts`, uma allowlist), e a Galeria Oculta — os
 * dezesseis, com a taxa REAL desta sessão — só com a etapa `galeria` aberta.
 *
 * **A ordem certa dos blocos nunca desce**: os itens chegam com
 * ids OPACOS e embaralhados pela semente da sessão, e quem confere é o
 * servidor (`regras/ordem.ts`, regra 3).
 */

/** Como o pacote é LIDO do JSONB: a forma, sem a régua da homologação. */
const LeituraDoConteudoSchema = z.object({
  tema: z.string(),
  categorias: z.array(z.object({ area: AreaSchema, nome: z.string(), hashtag: z.string() })).length(AREAS.length),
  projetos: z.array(ProjetoDoPacoteSchema).length(IDS_DE_PROJETO.length),
});

export interface PacoteLido {
  id: string;
  escolaId: string;
  turmaId: string;
  disciplina: Disciplina;
  tema: string;
  assuntos: string;
  contexto: string | null;
  origem: OrigemDoPacote;
  conteudo: ConteudoDoPacote;
  midia: Record<string, string>;
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
  sessao: Exp06ef1bSessao;
}

const SELECAO_DO_PACOTE = {
  id: true,
  escolaId: true,
  turmaId: true,
  origem: true,
  disciplina: true,
  tema: true,
  assuntos: true,
  contexto: true,
  conteudo: true,
  midia: true,
} satisfies Prisma.Exp06ef1bPacoteSelect;

/**
 * Lê o conteúdo do `Json` do pacote. A homologação validou na ESCRITA, com a
 * régua inteira; aqui só a forma, porque uma régua que apertou depois (um termo
 * proibido novo) não pode derrubar a aula de um pacote que já foi aprovado. Uma
 * linha torta de verdade não tem banco padrão para onde cair (não há acervo
 * padrão nesta missão): vira a porta fechada, com o log que impede o "a missão
 * sumiu" de ser mudo.
 */
function conteudoDaLinha(bruto: Prisma.JsonValue, contexto: { escolaId: string; pacoteId: string }): ConteudoDoPacote {
  const lido = LeituraDoConteudoSchema.safeParse(bruto);
  if (lido.success) {
    const porId = new Map(lido.data.projetos.map((p) => [p.id, p]));
    const projetos = IDS_DE_PROJETO.map((id) => porId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const categorias = AREAS.map((a) => lido.data.categorias.find((c) => c.area === a)).filter(
      (c): c is NonNullable<typeof c> => Boolean(c),
    );
    if (projetos.length === IDS_DE_PROJETO.length && categorias.length === AREAS.length) {
      return { tema: lido.data.tema, categorias, projetos };
    }
  }
  logger.warn({ codigo: "exp06ef1b-pacote-invalido", ...contexto }, "pacote com forma inesperada; a turma fica sem atividade");
  throw erroDeJogo("atividade-nao-preparada");
}

/** As URLs de imagem do pacote, só com chave de projeto conhecida e valor texto. */
function midiaDaLinha(bruto: Prisma.JsonValue): Record<string, string> {
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const midia: Record<string, string> = {};
  for (const [id, url] of Object.entries(bruto)) {
    if (ID_DE_PROJETO_RE.test(id) && typeof url === "string" && url.length > 0) midia[id] = url;
  }
  return midia;
}

function ehDisciplina(valor: string): valor is Disciplina {
  return (DISCIPLINAS as readonly string[]).includes(valor);
}

function pacoteDaLinha(linha: Prisma.Exp06ef1bPacoteGetPayload<{ select: typeof SELECAO_DO_PACOTE }>): PacoteLido {
  return {
    id: linha.id,
    escolaId: linha.escolaId,
    turmaId: linha.turmaId,
    disciplina: ehDisciplina(linha.disciplina) ? linha.disciplina : "projeto-interdisciplinar",
    tema: linha.tema,
    assuntos: linha.assuntos,
    contexto: linha.contexto,
    origem: "ia",
    conteudo: conteudoDaLinha(linha.conteudo, { escolaId: linha.escolaId, pacoteId: linha.id }),
    midia: midiaDaLinha(linha.midia),
  };
}

/** O que o motor precisa de cada projeto: o id e a área. */
function projetosDoMotor(pacote: PacoteLido): ProjetoDoMotor[] {
  return pacote.conteudo.projetos.map((p) => ({ id: p.id, area: areaDoProjeto(p.id) }));
}

function resumoDaMidia(pacote: PacoteLido): { total: number; prontas: number } {
  const projetos = pacote.conteudo.projetos;
  return { total: projetos.length, prontas: projetos.filter((p) => pacote.midia[p.id]).length };
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
 * O peso de uma linha na escolha do REPRESENTANTE do computador: quem VOTOU vem
 * antes de quem só entrou, e entre iguais o mais recente. Sem a primeira regra,
 * o colega que abriu a missão no mesmo computador DEPOIS do voto viraria o
 * representante, e a lousa do pico perderia o voto daquela tela.
 */
function pesoDaLinha(votadoEm: Date | null, atualizadoEm: Date | null): number {
  const recencia = (votadoEm ?? atualizadoEm)?.getTime() ?? 0;
  return (votadoEm ? 1e13 : 0) + recencia;
}

/** A semente da sessão: aleatória, de servidor, e fixa depois de gravada. */
function novaSemente(): string {
  return randomBytes(12).toString("base64url");
}

@Injectable()
export class JuriEstadualService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
  ) {}

  /**
   * O contexto da evidência pedagógica: é por ele que P1–P3
   * (`/evidencias/exp06ef1b/perguntas/:id/resposta`) caem na atividade e na
   * rodada certas, sem o cliente dizer quais. No teste, quem chama isto é a
   * suíte.
   */
  onModuleInit(): void {
    this.evidencias.registrarContexto(EXP_ID, (tx, escolaId, estudanteId) =>
      this.contextoDaAtividade(tx, escolaId, estudanteId),
    );
  }

  /**
   * A atividade em andamento para as enquetes — ou `null`.
   *
   * A turma sai da sessão MAIS RECENTE do estudante, porque o resolvedor não
   * recebe o token. E `null` em dois casos, os dois de propósito:
   *   - o passo está antes de `enquetes`: as enquetes vêm depois do caso
   *     Mariana, e uma resposta mandada por fora da tela não fura a fila (quem
   *     responde antes de ver a galeria e a cadeia mede outra coisa);
   *   - a sessão não é do (pacote, rodada) que o gate diz: o professor zerou ou
   *     trocou a atividade, e a resposta atrasada cairia numa rodada que acabou.
   */
  async contextoDaAtividade(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<ContextoDaAtividade | null> {
    const sessao = await tx.exp06ef1bSessao.findFirst({
      where: { escolaId, estudanteId },
      orderBy: { criadoEm: "desc" },
      select: { turmaId: true, pacoteId: true, rodada: true, passo: true },
    });
    if (!sessao || passoAntes(normalizarPasso(sessao.passo), "enquetes")) return null;
    const gate = await tx.exp06ef1bGateTurma.findUnique({
      where: { turmaId: sessao.turmaId, escolaId },
      select: { pacoteId: true, rodada: true },
    });
    if (!gate || gate.pacoteId !== sessao.pacoteId || gate.rodada !== sessao.rodada) return null;
    return { turmaId: sessao.turmaId, atividadeId: sessao.pacoteId, rodada: sessao.rodada };
  }

  // ───────────────────────────────────────────────────── rotas do estudante

  /**
   * Boot da experiência e o F5. Na primeira entrada do estudante na rodada,
   * nasce a sessão (com a semente). Cada bloco do fim da missão (`cadeia`,
   * `mariana`) só vem do passo dele em diante.
   */
  async sessao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      return this.sessaoPublica(ctx);
    }, escolaId);
  }

  /**
   * O polling da espera (~3 s) — MAGRO de propósito: sem acervo, sem contagem
   * da sala, sem JOIN. Passa pelo funil de liberação (regras 7 e 8) e NÃO
   * escreve: a sessão nasce no `GET sessao`.
   */
  async gate(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      if (!turmaId) throw erroDeJogo("sem-turma");
      const gate = await this.lerGate(tx, escolaId, turmaId);
      if (!gate) throw erroDeJogo("atividade-nao-preparada");
      return { pacoteId: gate.pacoteId, rodada: gate.rodada, etapa: gate.etapa };
    }, escolaId);
  }

  /**
   * "Acessar o feed da mostra": da credencial para o feed. Grava o passo e, com
   * o feed vazio, serve a ABERTURA (um post de cada área) no MESMO update.
   * Pedir de novo devolve o feed como está.
   */
  async pedirPasso(escolaId: string, estudanteId: string, turmaId: string | null, para: PassoPedido) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      const r = pedirPasso(atual, para);
      if (!r.ok) throw erroDeJogo(r.codigo);
      let estado = feedDaLinha(ctx.sessao);
      if (r.passo === "feed" && (atual !== "feed" || estado.servidos.length === 0)) {
        const servidos =
          estado.servidos.length === 0
            ? servirAte(projetosDoMotor(ctx.pacote), estado, ctx.sessao.semente, POSTS_DE_ABERTURA)
            : estado.servidos;
        await tx.exp06ef1bSessao.update({
          where: { id: ctx.sessao.id },
          data: { passo: "feed", postsServidos: servidos },
        });
        estado = { ...estado, servidos };
      }
      return this.feedPublico(ctx.pacote, estado);
    }, escolaId);
  }

  /**
   * O que a tela MEDIU desde a última chamada — curtidas (estado) e
   * permanências (fato) —, e o próximo post quando ela chegou ao fim do que foi
   * servido. A ordem importa: as curtidas entram ANTES de o motor escolher o
   * próximo, porque é a curtida que afunila.
   */
  async eventosDoFeed(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    eventos: { curtidas: { postId: string; curtiu: boolean }[]; permanencias: string[]; proximo: boolean },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      if (ctx.sessao.votadoEm || votou(atual)) throw erroDeJogo("voto-ja-lacrado");
      if (atual !== "feed") throw erroDeJogo("passo-invalido");

      const antes = feedDaLinha(ctx.sessao);
      const tocados = [...eventos.curtidas.map((c) => c.postId), ...eventos.permanencias];
      if (tocados.some((id) => !antes.servidos.includes(id))) throw erroDeJogo("post-desconhecido");

      let estado: EstadoDoFeed = antes;
      for (const c of eventos.curtidas) estado = aplicarCurtida(estado, c.postId, c.curtiu);
      for (const p of eventos.permanencias) estado = aplicarPermanencia(estado, p);
      if (eventos.proximo) {
        estado = {
          ...estado,
          servidos: servirAte(projetosDoMotor(ctx.pacote), estado, ctx.sessao.semente, estado.servidos.length + 1),
        };
      }

      if (canonico(estado) !== canonico(antes)) {
        await tx.exp06ef1bSessao.update({
          where: { id: ctx.sessao.id },
          data: {
            postsServidos: [...estado.servidos],
            curtidos: [...estado.curtidos],
            permanencias: [...estado.permanencias],
          },
        });
      }
      return this.feedPublico(ctx.pacote, estado);
    }, escolaId);
  }

  /**
   * A cédula — O LATCH 1. Projeto, convicção, carimbo e o passo `lacrada` no
   * MESMO update (os CHECKs valem por statement).
   *
   * Concorrente: dois toques chegam como duas requisições, o lock por
   * estudante as põe em fila, e a segunda relê a sessão já votada — 409
   * `voto-ja-lacrado`. O `WHERE votado_em IS NULL` é a segunda tranca, e o
   * CHECK, a terceira.
   */
  async votar(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    voto: { projetoId: string; conviccao: Conviccao },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      if (ctx.sessao.votadoEm || votou(atual)) throw erroDeJogo("voto-ja-lacrado");
      if (atual !== "feed") throw erroDeJogo("passo-invalido");
      const feed = feedDaLinha(ctx.sessao);
      if (!feedCompleto(feed)) throw erroDeJogo("feed-incompleto");
      if (!projetoFoiExibido(feed.servidos, voto.projetoId)) throw erroDeJogo("projeto-fora-do-feed");

      const { count } = await tx.exp06ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, votadoEm: null, passo: "feed" },
        data: { votoProjeto: voto.projetoId, conviccao: voto.conviccao, votadoEm: new Date(), passo: "lacrada" },
      });
      if (count === 0) throw erroDeJogo("voto-ja-lacrado");
      const sessao = await tx.exp06ef1bSessao.findUniqueOrThrow({ where: { id: ctx.sessao.id } });
      return this.estado(sessao, ctx.gate);
    }, escolaId);
  }

  /**
   * A Galeria Oculta: os dezesseis estandes, os que NÃO chegaram ao feed
   * primeiro, e a taxa REAL desta sessão. Só com o passo efetivo `galeria` ou
   * além — o voto lacrado E a etapa liberada pelo professor; quem ainda não
   * votou não a abre nem com a etapa aberta (a taxa dele precisa do voto).
   */
  async galeria(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const efetivo = passoEfetivo(normalizarPasso(ctx.sessao.passo), ctx.gate.etapa);
      if (!passoNoMinimo(efetivo, "galeria")) throw erroDeJogo("galeria-nao-liberada");
      const { servidos } = feedDaLinha(ctx.sessao);
      const porId = new Map(ctx.pacote.conteudo.projetos.map((p) => [p.id, p]));
      return {
        invisibilidade: invisibilidade(servidos),
        projetos: ordemDaGaleria(servidos)
          .map((id) => porId.get(id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => projetoDaGaleria(p, ctx.pacote.midia, projetoFoiExibido(servidos, p.id))),
      };
    }, escolaId);
  }

  /**
   * Abrir a ficha de um estande ou buscar — o registro da EF06CO10 e da
   * EF06CO01, lido no latch da revisão. Só na galeria (antes, a porta está fechada; depois da
   * revisão, a medida já foi tomada). Da busca, só o tipo e a área que casou.
   */
  async acaoDaGaleria(escolaId: string, estudanteId: string, turmaId: string | null, acao: AcaoDaGaleria): Promise<void> {
    await this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const efetivo = passoEfetivo(normalizarPasso(ctx.sessao.passo), ctx.gate.etapa);
      if (efetivo !== "galeria") {
        throw erroDeJogo(passoAntes(efetivo, "galeria") ? "galeria-nao-liberada" : "passo-invalido");
      }
      const r = registrarAcao(auditoriaDaLinha(ctx.sessao.auditoria), acao);
      if (r.mudou) {
        await tx.exp06ef1bSessao.update({
          where: { id: ctx.sessao.id },
          data: { auditoria: r.auditoria as unknown as Prisma.InputJsonValue },
        });
      }
    }, escolaId);
  }

  /**
   * Manter ou trocar o voto — O LATCH 2. Só da galeria. `trocar` aceita
   * qualquer um dos dezesseis (a galeria mostrou todos), menos o voto lacrado.
   * Ação, voto FINAL, carimbo e o passo `cadeia` no mesmo update, e as marcas
   * da EF06CO10 (`auditoria`) e da EF06CO01 (`classificacao`) na mesma
   * transação, sobre o que a criança fez na galeria ANTES de decidir.
   *
   * O lock COMPARTILHADO da turma e a releitura do gate fecham a corrida com o
   * "Zerar": a marca não cai numa rodada que já acabou (409 `rodada-mudou`).
   */
  async revisar(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    revisao: { acao: AcaoDaRevisao; projetoId?: string },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      if (ctx.sessao.revisadoEm) throw erroDeJogo("voto-ja-revisado");
      const efetivo = passoEfetivo(normalizarPasso(ctx.sessao.passo), ctx.gate.etapa);
      if (efetivo === "lacrada") throw erroDeJogo("galeria-nao-liberada");
      if (efetivo !== "galeria") throw erroDeJogo("passo-invalido");
      const voto = ctx.sessao.votoProjeto;
      if (!voto) throw erroDeJogo("passo-invalido");
      const final = revisao.acao === "trocar" ? revisao.projetoId : voto;
      if (!final || (revisao.acao === "trocar" && final === voto)) throw erroDeJogo("payload-invalido");
      const gate = await this.gateDaSessao(tx, escolaId, ctx);

      const { count } = await tx.exp06ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, revisadoEm: null, passo: "lacrada" },
        data: { revisaoAcao: revisao.acao, votoRevisado: final, revisadoEm: new Date(), passo: "cadeia" },
      });
      if (count === 0) throw erroDeJogo("voto-ja-revisado");

      const { servidos } = feedDaLinha(ctx.sessao);
      const auditoria = auditoriaDaLinha(ctx.sessao.auditoria);
      const ocultos = projetosOcultos(projetosDoMotor(ctx.pacote), servidos);
      await this.marcar(tx, ctx, gate, MARCADOR_DA_AUDITORIA, nivelDaAuditoria(auditoria, ocultos));
      await this.marcar(
        tx,
        ctx,
        gate,
        MARCADOR_DA_CLASSIFICACAO,
        nivelDaClassificacao(auditoria, ocultos, areaDoProjeto(voto)),
      );
      const sessao = await tx.exp06ef1bSessao.findUniqueOrThrow({ where: { id: ctx.sessao.id } });
      return this.estado(sessao, gate);
    }, escolaId);
  }

  /**
   * Uma tentativa de montar a cadeia (EF06CO03): Interações → Dados →
   * Algoritmo → Bolha — a doutrina da Chave do Jornal: cada envio conta; a
   * resposta é certa ou não, nunca qual vaga errou; na certa, o passo anda e a
   * habilidade é marcada pelas tentativas. Com a cadeia já montada, responde
   * certa sem contar — o F5 e o toque duplo não viram tentativa.
   */
  async montarCadeia(escolaId: string, estudanteId: string, turmaId: string | null, ordem: readonly string[]) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const s = ctx.sessao;
      if (s.cadeiaMontadaEm) {
        return { correta: true, tentativas: s.cadeiaTentativas, passo: this.estado(s, ctx.gate).passo };
      }
      if (normalizarPasso(s.passo) !== "cadeia") throw erroDeJogo("passo-invalido");
      const certa = ordemCertaDaCadeia(s.semente);
      if (!idsDaSessao(ordem, certa)) throw erroDeJogo("payload-invalido");
      const gate = await this.gateDaSessao(tx, escolaId, ctx);

      const tentativas = s.cadeiaTentativas + 1;
      if (!ordemConfere(ordem, certa)) {
        await tx.exp06ef1bSessao.update({ where: { id: s.id }, data: { cadeiaTentativas: tentativas } });
        return { correta: false, tentativas, passo: "cadeia" as const };
      }

      const { count } = await tx.exp06ef1bSessao.updateMany({
        where: { id: s.id, escolaId, cadeiaMontadaEm: null, passo: "cadeia" },
        data: { cadeiaTentativas: tentativas, cadeiaMontadaEm: new Date(), passo: "mariana" },
      });
      /* Sem linha atualizada, já estava montada: não conta nem marca de novo. */
      if (count > 0) await this.marcar(tx, ctx, gate, MARCADOR_DA_CADEIA, nivelPorTentativas(tentativas));
      const depois = await tx.exp06ef1bSessao.findUniqueOrThrow({ where: { id: s.id } });
      return { correta: true, tentativas: depois.cadeiaTentativas, passo: this.estado(depois, gate).passo };
    }, escolaId);
  }

  /**
   * O caso Mariana: um cartão de mecanismo e um de atitude. Grava a escolha e
   * o passo `enquetes`; não marca evidência e não diz qual é o certo (é a
   * transferência, conversada na plenária). Escolher de novo devolve o estado,
   * sem trocar a primeira escolha.
   */
  async escolherCartoes(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    cartoes: { mecanismo: string; atitude: string },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      if (ctx.sessao.cartoesEm) return this.estado(ctx.sessao, ctx.gate);
      if (normalizarPasso(ctx.sessao.passo) !== "mariana") throw erroDeJogo("passo-invalido");
      const { count } = await tx.exp06ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, cartoesEm: null, passo: "mariana" },
        data: { mecanismo: cartoes.mecanismo, atitude: cartoes.atitude, cartoesEm: new Date(), passo: "enquetes" },
      });
      if (count === 0) throw erroDeJogo("passo-invalido");
      const sessao = await tx.exp06ef1bSessao.findUniqueOrThrow({ where: { id: ctx.sessao.id } });
      return this.estado(sessao, ctx.gate);
    }, escolaId);
  }

  /** O crachá homologado — de `enquetes` para `fim`; idempotente em `fim`. */
  async concluir(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      if (atual === "fim") return this.estado(ctx.sessao, ctx.gate);
      if (atual !== "enquetes") throw erroDeJogo("passo-invalido");
      /* Passo e carimbo no mesmo update: o CHECK `fim ⇔ concluida_em` vale por statement. */
      const sessao = await tx.exp06ef1bSessao.update({
        where: { id: ctx.sessao.id },
        data: { passo: "fim", concluidaEm: new Date() },
      });
      return this.estado(sessao, ctx.gate);
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
   * O painel da aula — POR COMPUTADOR, como no Jornal.
   *
   * Parte de `users.turma_id` (quem não entrou também aparece; `users` está
   * fora da RLS, e o `escolaId` no `where` é a tranca). As linhas passam por
   * `colapsarEmUnidades` sobre o `mapaDeEquipes` lido DENTRO do `comTenancy`;
   * o representante do computador é quem VOTOU. "X de Y computadores votaram":
   * o Y vem da MONTAGEM (`computadoresDaMontagem`).
   *
   * **Só progresso por linha** (`regras/painel.ts#PROIBIDO_NA_LINHA_DO_PAINEL`):
   * o painel é projetado na lousa no pico (PED-07), então o voto, a taxa e o
   * nível de cada um não estão na linha. A lousa lê o RESUMO, anônimo: votos por
   * área (o inicial e o revisado), a taxa média, quantos mantiveram e trocaram.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const { gate, pacote } = await this.exigirPacote(tx, escolaId, turmaId);

      const [estudantes, mapa, computadores] = await Promise.all([
        tx.user.findMany({
          where: { escolaId, turmaId, role: "estudante" },
          select: {
            id: true,
            displayName: true,
            username: true,
            juriSessoes: {
              where: { escolaId, pacoteId: gate.pacoteId, rodada: gate.rodada },
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
        const s = e.juriSessoes[0];
        const auditoria = auditoriaDaLinha(s?.auditoria ?? null);
        return {
          estudanteId: e.id,
          nome: e.displayName,
          usuario: e.username,
          entrou: Boolean(s),
          /* O passo EFETIVO, o mesmo da tela da criança. */
          passo: s ? passoEfetivo(normalizarPasso(s.passo), gate.etapa) : ("credencial" as Passo),
          votou: Boolean(s?.votadoEm),
          abriuAGaleria: auditoria.abertos.length > 0,
          buscou: auditoria.buscas.length > 0,
          revisou: Boolean(s?.revisadoEm),
          concluiu: Boolean(s?.concluidaEm),
          _sessao: s ?? null,
          _peso: pesoDaLinha(s?.votadoEm ?? null, s?.atualizadoEm ?? null),
        };
      });

      /* O candidato a representante é quem ENTROU, e o peso põe quem votou na
         frente: sem ninguém que votou, o computador ainda é representado por
         quem abriu a missão, e não pelo colega que não entrou. */
      const unidades = colapsarEmUnidades(
        linhas,
        (l) => l.estudanteId,
        mapa,
        (l) => l.entrou,
        (l) => l._peso,
      );

      const iniciais: string[] = [];
      const revisados: string[] = [];
      const taxas: number[] = [];
      const revisao = { mantiveram: 0, trocaram: 0 };
      for (const { linha } of unidades) {
        const s = linha._sessao;
        if (!s?.votadoEm || !s.votoProjeto) continue;
        iniciais.push(s.votoProjeto);
        taxas.push(invisibilidade(feedDaLinha(s).servidos).percentual);
        if (s.revisadoEm && s.votoRevisado) {
          revisados.push(s.votoRevisado);
          if (s.revisaoAcao === "trocar") revisao.trocaram += 1;
          else revisao.mantiveram += 1;
        }
      }
      const porArea = votosPorArea(iniciais);
      const porAreaRevisado = votosPorArea(revisados);

      const saida = unidades.map(({ linha, equipe }) => {
        const { _sessao: _s, _peso: _p, ...resto } = linha;
        return { ...resto, equipe: equipe ? { id: equipe.id, nome: equipe.nome } : null };
      });
      const votaram = saida.filter((u) => u.votou).length;

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
          entraram: saida.filter((u) => u.entrou).length,
          votaram,
          revisaram: saida.filter((u) => u.revisou).length,
          concluiram: saida.filter((u) => u.concluiu).length,
          computadores: { votaram, total: computadores ?? saida.length },
          porComputador: mapa.size > 0,
          votosPorArea: pacote.conteudo.categorias.map((c) => ({ ...c, votos: porArea[c.area] })),
          invisibilidadeMedia: mediaDasTaxas(taxas),
          revisao,
          votosRevisadosPorArea: pacote.conteudo.categorias.map((c) => ({ ...c, votos: porAreaRevisado[c.area] })),
        },
      };
    }, escolaId);
  }

  /**
   * O botão único do painel: "Liberar a Galeria Oculta". Idempotente, uma
   * etapa por vez, sem voltar (`regras/passos.ts#transicaoDoGate`), com o lock
   * EXCLUSIVO da turma — que espera as jogadas em voo (elas pegam o
   * compartilhado). Grava quando o portão abriu.
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
        const linha = await tx.exp06ef1bGateTurma.update({
          where: { turmaId, escolaId },
          data: { etapa: para, galeriaLiberadaEm: para === "galeria" ? new Date() : null },
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
   * volta à exploração. As sessões da rodada anterior ficam, com os votos e o
   * que cada criança fez na galeria: é a rodada passada que o painel de
   * habilidades mostra (ADR-112). O carimbo da galeria volta a nulo (CHECK).
   */
  async zerar(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const { gate } = await this.exigirPacote(tx, escolaId, turmaId);
      const linha = await tx.exp06ef1bGateTurma.update({
        where: { turmaId, escolaId },
        data: { rodada: gate.rodada + 1, etapa: ETAPA_INICIAL, galeriaLiberadaEm: null },
        select: { pacoteId: true, rodada: true, etapa: true },
      });
      return { pacoteId: linha.pacoteId, rodada: linha.rodada, etapa: normalizarEtapa(linha.etapa) };
    }, escolaId);
  }

  /**
   * As ATIVIDADES da turma (ADR-130): o pacote em andamento inteiro e a lista
   * de todos — que é a lista de atividades da ficha e o seletor do painel de
   * habilidades. `ativo` é `null` quando o professor ainda não pôs nenhum em
   * andamento: a plataforma não cria atividade.
   */
  async pacotes(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const emAndamento = await tx.exp06ef1bGateTurma.findUnique({
        where: { turmaId, escolaId },
        include: { pacote: { select: SELECAO_DO_PACOTE } },
      });
      const [todos, rodadas] = await Promise.all([
        tx.exp06ef1bPacote.findMany({
          where: { escolaId, turmaId },
          select: {
            id: true,
            disciplina: true,
            tema: true,
            origem: true,
            ativo: true,
            criadoEm: true,
            imagensAprovadasEm: true,
          },
          orderBy: { criadoEm: "desc" },
        }),
        tx.exp06ef1bSessao.groupBy({ by: ["pacoteId"], where: { escolaId, turmaId }, _max: { rodada: true } }),
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
          disciplina: ehDisciplina(p.disciplina) ? p.disciplina : ("projeto-interdisciplinar" as const),
          tema: p.tema,
          origem: "ia" as const,
          ativo: p.ativo,
          criadoEm: p.criadoEm.toISOString(),
          rodadas: maiorRodada.get(p.id) ?? 0,
          imagensAprovadas: p.imagensAprovadasEm !== null,
        })),
      };
    }, escolaId);
  }

  /**
   * UM pacote, inteiro — a página da atividade, esteja ou não em andamento. É
   * de onde o professor prepara as imagens de uma atividade PRONTA antes de
   * pô-la no ar.
   */
  async pacote(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      const [gate, rodadas] = await Promise.all([
        this.lerGate(tx, escolaId, turmaId),
        tx.exp06ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } }),
      ]);
      const emAndamento = gate?.pacoteId === pacoteId;
      return {
        ...this.pacoteParaATela(pacoteDaLinha(linha)),
        ativo: emAndamento,
        rodada: emAndamento && gate ? gate.rodada : null,
        etapa: emAndamento && gate ? gate.etapa : null,
        criadoEm: linha.criadoEm.toISOString(),
        rodadas: rodadas._max.rodada ?? 0,
        imagensAprovadasEm: linha.imagensAprovadasEm?.toISOString() ?? null,
      };
    }, escolaId);
  }

  /**
   * A SEGUNDA FASE da aprovação (o pedido do PO, no molde da exp07ef1b,
   * ADR-146): o professor viu a imagem de cada estande, refez a que não servia,
   * e aprova. Só depois disto a atividade vai ao ar (`colocarEmAndamento`
   * cobra), e depois disto as imagens não mudam mais.
   *
   * Sem exigir imagem em todo estande: a geração pode falhar ou a quota acabar,
   * e o estande segue com a arte procedural — que o professor VIU marcada como
   * "sem imagem" na grade antes de aprovar. Quem segura o botão até a geração
   * terminar é a tela. Idempotente: a segunda aprovação devolve o carimbo da
   * primeira.
   */
  async aprovarImagens(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      const carimbo =
        linha.imagensAprovadasEm ??
        (
          await tx.exp06ef1bPacote.update({
            where: { id: linha.id },
            data: { imagensAprovadasEm: new Date() },
            select: { imagensAprovadasEm: true },
          })
        ).imagensAprovadasEm;
      return { pacoteId: linha.id, imagensAprovadasEm: (carimbo ?? new Date()).toISOString() };
    }, escolaId);
  }

  /**
   * "USAR ESTA ATIVIDADE AGORA" (ADR-130): o pacote que estava em andamento
   * volta a ser PRONTO — fica, com as sessões e as rodadas —, e o gate passa a
   * apontar o escolhido, com o portão fechado. O pacote que nunca rodou começa
   * na 1; o que já rodou abre a SEGUINTE à última — retomar a mesma depois da
   * galeria liberada seria o "voltar" que o botão único proíbe.
   *
   * Idempotente: pôr no ar o que já está no ar não muda nada.
   */
  async colocarEmAndamento(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const escolhido = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      /* As duas fases da aprovação passaram? Sem a das imagens, a turma abriria
         com imagem que ninguém viu (o pedido do PO, como na exp07ef1b). */
      if (!escolhido.imagensAprovadasEm) throw erroDeJogo("imagens-nao-aprovadas");

      const atual = await this.lerGate(tx, escolaId, turmaId);
      if (atual?.pacoteId === pacoteId) {
        return { pacoteId, rodada: atual.rodada, etapa: atual.etapa, mudou: false };
      }

      const ultima = await tx.exp06ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } });
      const rodada = (ultima._max.rodada ?? 0) + 1;
      await tx.exp06ef1bPacote.updateMany({ where: { escolaId, turmaId, ativo: true }, data: { ativo: false } });
      await tx.exp06ef1bPacote.updateMany({ where: { id: pacoteId, escolaId }, data: { ativo: true } });
      const gate = { pacoteId, rodada, etapa: ETAPA_INICIAL, galeriaLiberadaEm: null };
      await tx.exp06ef1bGateTurma.upsert({
        where: { turmaId, escolaId },
        create: { escolaId, turmaId, ...gate },
        update: gate,
      });
      return { pacoteId, rodada, etapa: ETAPA_INICIAL, mudou: true };
    }, escolaId);
  }

  /**
   * "Criar atividade" — a curadoria humana (ADR-66/67): grava a mostra como o
   * professor a deixou, numa atividade que nasce PRONTA, não no ar (ADR-130).
   *
   * É a PRIMEIRA fase da aprovação: os textos. O pacote nasce com
   * `imagensAprovadasEm` nulo — as imagens se geram em seguida, e só a segunda
   * fase (`aprovarImagens`) o deixa ir ao ar.
   * O em andamento continua em andamento — criar a próxima aula não pode tirar
   * do ar a de agora.
   *
   * O MESMO conteúdo do pacote mais recente não é atividade nova: é o segundo
   * clique em "Criar atividade" (idempotente). As imagens de projeto com a
   * MESMA descrição de um pacote recente da turma são herdadas: o arquivo no
   * bucket é o hash da descrição.
   */
  async homologar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    criadoPor: string,
    corpo: {
      parametros: { disciplina: Disciplina; tema: string; assuntos: string; contexto?: string };
      conteudo: ConteudoDoPacote;
    },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");

      const recentes = await tx.exp06ef1bPacote.findMany({
        where: { escolaId, turmaId },
        orderBy: { criadoEm: "desc" },
        take: 5,
        select: { ...SELECAO_DO_PACOTE, ativo: true },
      });
      const { parametros } = corpo;
      const conteudo = this.emOrdem(corpo.conteudo);
      const contexto = parametros.contexto?.trim() || null;

      const [ultimo] = recentes;
      if (
        ultimo &&
        ultimo.disciplina === parametros.disciplina &&
        ultimo.assuntos === parametros.assuntos &&
        ultimo.contexto === contexto &&
        canonico(ultimo.conteudo) === canonico(conteudo)
      ) {
        return { id: ultimo.id, disciplina: parametros.disciplina, tema: ultimo.tema, origem: "ia" as const, ativo: ultimo.ativo };
      }

      const urlDaDescricao = new Map<string, string>();
      for (const velho of [...recentes].reverse()) {
        const midia = midiaDaLinha(velho.midia);
        const lido = LeituraDoConteudoSchema.safeParse(velho.conteudo);
        if (!lido.success) continue;
        for (const p of lido.data.projetos) {
          const url = midia[p.id];
          if (url) urlDaDescricao.set(p.imagem.descricao, url);
        }
      }
      const herdada: Record<string, string> = {};
      for (const p of conteudo.projetos) {
        const url = urlDaDescricao.get(p.imagem.descricao);
        if (url) herdada[p.id] = url;
      }

      const novo = await tx.exp06ef1bPacote.create({
        data: {
          escolaId,
          turmaId,
          origem: "ia",
          disciplina: parametros.disciplina,
          /* O tema da mostra é o que o estudante LÊ: o do conteúdo. */
          tema: conteudo.tema,
          assuntos: parametros.assuntos,
          contexto,
          conteudo: conteudo as unknown as Prisma.InputJsonValue,
          midia: herdada,
          ativo: false,
          criadoPor,
        },
        select: { id: true, tema: true },
      });
      return { id: novo.id, disciplina: parametros.disciplina, tema: novo.tema, origem: "ia" as const, ativo: false };
    }, escolaId);
  }

  /** A guarda de turma, sozinha — a do preparo, ANTES de gastar token. */
  async exigirTurmaVisivel(escolaId: string, turmaId: string, professorId?: string): Promise<void> {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
  }

  /**
   * Uma geração de rascunho (ou regeneração) que chamou a IA, e o que custou.
   * O rascunho não persiste, então a conta vai no pacote que estava em sala —
   * a soma dos pacotes da turma é o total. Sem pacote em andamento (a primeira
   * atividade da turma sendo criada), não há onde contar.
   */
  async registrarGeracao(escolaId: string, turmaId: string, tokens: number): Promise<void> {
    try {
      await this.prisma.comTenancy(async (tx) => {
        const gate = await this.lerGate(tx, escolaId, turmaId);
        if (!gate) return;
        await tx.exp06ef1bPacote.updateMany({
          where: { id: gate.pacoteId, escolaId },
          data: { iaGeracoes: { increment: 1 }, iaTokens: { increment: Math.max(0, Math.round(tokens)) } },
        });
      }, escolaId);
    } catch {
      /* A contagem do preparo não pode derrubar o rascunho que o professor espera. */
      logger.warn({ codigo: "exp06ef1b-geracao-nao-contada", escolaId }, "geração do preparo não contada");
    }
  }

  /**
   * O pacote das imagens (`midia.service.ts`): o pedido, ou o em andamento sem
   * pedido. O pedido é a atividade PRONTA que o professor prepara antes de pôr
   * no ar (ADR-130).
   *
   * Só enquanto as imagens estão EM VALIDAÇÃO: depois de aprovadas, gerar a que
   * falta ou refazer uma levaria à turma uma imagem que o professor não viu —
   * o que o PO pediu para acabar. 409 `imagens-ja-aprovadas`, e o estande sem
   * imagem segue com a arte procedural.
   */
  async pacoteParaMidia(escolaId: string, turmaId: string, professorId?: string, pacoteId?: string): Promise<PacoteLido> {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = pacoteId
        ? await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId)
        : await this.pacoteDaTurma(tx, escolaId, turmaId, (await this.exigirPacote(tx, escolaId, turmaId)).pacote.id);
      if (linha.imagensAprovadasEm) throw erroDeJogo("imagens-ja-aprovadas");
      return pacoteDaLinha(linha);
    }, escolaId);
  }

  /**
   * Grava a URL de UMA imagem no pacote. Concatenação de JSONB no próprio
   * UPDATE (`midia || {proj-a1: url}`), e não ler-modificar-gravar: duas abas do
   * preparo gravando imagens diferentes não podem apagar uma à outra.
   */
  async registrarMidia(escolaId: string, pacoteId: string, projetoId: string, url: string): Promise<void> {
    await this.prisma.comTenancy(
      (tx) => tx.$executeRaw`
        UPDATE exp06ef1b_pacotes
           SET midia = midia || jsonb_build_object(${projetoId}::text, ${url}::text),
               atualizado_em = now()
         WHERE id = ${pacoteId}::uuid AND escola_id = ${escolaId}`,
      escolaId,
    );
  }

  // ────────────────────────────────────────────────────────────── privados

  /** O conteúdo com categorias e projetos na ordem do vocabulário: a comparação e o banco não dependem da tela. */
  private emOrdem(conteudo: ConteudoDoPacote): ConteudoDoPacote {
    const posicao = (id: string) => (IDS_DE_PROJETO as readonly string[]).indexOf(id);
    return {
      tema: conteudo.tema,
      categorias: [...conteudo.categorias].sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area)),
      projetos: [...conteudo.projetos].sort((a, b) => posicao(a.id) - posicao(b.id)),
    };
  }

  /** O feed como a tela o desenha: os posts servidos, pela allowlist. */
  private feedPublico(pacote: PacoteLido, estado: EstadoDoFeed) {
    return {
      posts: estado.servidos
        .map((id) => postPublico(id, pacote.conteudo.projetos, pacote.midia as Midia))
        .filter((p): p is PostPublico => p !== null),
      curtidos: [...estado.curtidos],
      completo: feedCompleto(estado),
    };
  }

  /** A sessão inteira do estudante (`SessaoSchema`): cada bloco do fim só do passo dele em diante. */
  private sessaoPublica(ctx: ContextoDoEstudante) {
    const { sessao, gate, pacote } = ctx;
    const passo = normalizarPasso(sessao.passo);
    const efetivo = passoEfetivo(passo, gate.etapa);
    const feed = feedDaLinha(sessao);
    const voto = sessao.votoProjeto && sessao.conviccao ? { projetoId: sessao.votoProjeto, conviccao: sessao.conviccao } : null;

    return {
      pacoteId: sessao.pacoteId,
      rodada: sessao.rodada,
      passo: efetivo,
      passoDoEstudante: passo,
      etapa: gate.etapa,
      aguardandoOProfessor: aguardandoOProfessor(passo, gate.etapa),
      tema: pacote.conteudo.tema,
      categorias: pacote.conteudo.categorias.map((c) => ({ area: c.area, nome: c.nome, hashtag: c.hashtag })),
      feed: this.feedPublico(pacote, feed),
      voto,
      revisao: sessao.revisaoAcao
        ? {
            acao: sessao.revisaoAcao as AcaoDaRevisao,
            projetoId: sessao.revisaoAcao === "trocar" ? sessao.votoRevisado : null,
          }
        : null,
      cadeia: passoNoMinimo(efetivo, "cadeia")
        ? {
            blocos: blocosDaSessao(sessao.semente),
            tentativas: sessao.cadeiaTentativas,
            montada: sessao.cadeiaMontadaEm !== null,
          }
        : null,
      mariana: passoNoMinimo(efetivo, "mariana")
        ? {
            caso: CASO_MARIANA,
            /* Embaralhados pela sessão: o certo não é sempre o primeiro. `certo` não desce. */
            mecanismos: embaralhar(CARTOES_DE_MECANISMO, sessao.semente, "mecanismos").map((c) => ({ id: c.id, texto: c.texto })),
            atitudes: embaralhar(CARTOES_DE_ATITUDE, sessao.semente, "atitudes").map((c) => ({ id: c.id, texto: c.texto })),
            escolha: sessao.mecanismo && sessao.atitude ? { mecanismo: sessao.mecanismo, atitude: sessao.atitude } : null,
          }
        : null,
      concluida: sessao.concluidaEm !== null,
    };
  }

  /** O estado curto que as rotas de passo devolvem (`EstadoSchema`). */
  private estado(sessao: Exp06ef1bSessao, gate: GateLido) {
    return { passo: passoEfetivo(normalizarPasso(sessao.passo), gate.etapa), etapa: gate.etapa };
  }

  /** O pacote como as telas do professor o mostram. */
  private pacoteParaATela(pacote: PacoteLido) {
    return {
      id: pacote.id,
      disciplina: pacote.disciplina,
      tema: pacote.tema,
      origem: pacote.origem,
      assuntos: pacote.assuntos,
      conteudo: pacote.conteudo,
      midia: resumoDaMidia(pacote),
      imagens: { ...pacote.midia },
    };
  }

  /** O pacote desta turma, ou 404 — o de outra turma não tem a existência confirmada. */
  private async pacoteDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacoteId: string) {
    const linha = ehUuid(pacoteId)
      ? await tx.exp06ef1bPacote.findFirst({
          where: { id: pacoteId, escolaId, turmaId },
          select: { ...SELECAO_DO_PACOTE, criadoEm: true, imagensAprovadasEm: true },
        })
      : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  /**
   * A MARCA de uma ação na ficha, DENTRO da transação da jogada: cai junto se
   * ela cair. A cópia para os colegas de computador é da própria porta
   * `marcar` (E14).
   *
   * **Toda rodada mede de novo** (ADR-145, que substitui a regra "uma vez
   * por criança e pacote" da ADR-120): o resultado da atividade é a melhor
   * rodada de cada habilidade, então medir outra vez só pode subir o nível.
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
    await this.evidencias.marcar(tx, { ...marca, turmaId: ctx.turmaId, status });
  }

  /**
   * O lock COMPARTILHADO da turma e a releitura do gate — depois do lock, e é a
   * leitura que vale. O zerar e a troca de atividade pegam o EXCLUSIVO: uma
   * jogada em voo termina antes, e a que chega depois vê a rodada nova (409
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
    const linha = await tx.exp06ef1bGateTurma.findUnique({
      where: { turmaId, escolaId },
      select: { pacoteId: true, rodada: true, etapa: true, atualizadoEm: true },
    });
    return linha
      ? { pacoteId: linha.pacoteId, rodada: linha.rodada, etapa: normalizarEtapa(linha.etapa), atualizadoEm: linha.atualizadoEm }
      : null;
  }

  /**
   * O gate da turma e o pacote EM ANDAMENTO — ou 403 `atividade-nao-preparada`.
   * A plataforma nunca cria a atividade (ADR-130), e esta missão nem tem acervo
   * padrão: o pacote é o que o professor gerou, homologou e PÔS EM ANDAMENTO.
   */
  private async exigirPacote(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
  ): Promise<{ gate: GateLido; pacote: PacoteLido }> {
    const linha = await tx.exp06ef1bGateTurma.findUnique({
      where: { turmaId, escolaId },
      include: { pacote: { select: SELECAO_DO_PACOTE } },
    });
    if (!linha) throw erroDeJogo("atividade-nao-preparada");
    return {
      gate: { pacoteId: linha.pacoteId, rodada: linha.rodada, etapa: normalizarEtapa(linha.etapa), atualizadoEm: linha.atualizadoEm },
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
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`juri-estadual:estudante:${escolaId}:${estudanteId}`}, 0))`;
    const chave = { pacoteId: gate.pacoteId, rodada: gate.rodada, estudanteId };
    /* `createMany` com `skipDuplicates` é um INSERT ... ON CONFLICT DO NOTHING:
       o F5 e a segunda aba não abortam a transação com um P2002. A semente só
       vale na linha que entrou de fato. */
    await tx.exp06ef1bSessao.createMany({
      data: [{ ...chave, escolaId, turmaId, semente: novaSemente(), versaoInstrumento: VERSAO_DO_INSTRUMENTO }],
      skipDuplicates: true,
    });
    const sessao = await tx.exp06ef1bSessao.findUniqueOrThrow({
      where: { pacoteId_rodada_estudanteId: chave, escolaId },
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
   * botão, zerar, homologar, pôr no ar); compartilhado para as jogadas que
   * marcam evidência, que só precisam não cruzar com a troca de rodada.
   */
  private async travarTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    modo: "exclusivo" | "compartilhado",
  ): Promise<void> {
    const chave = `juri-estadual:turma:${escolaId}:${turmaId}`;
    if (modo === "exclusivo") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chave}, 0))`;
    } else {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${chave}, 0))`;
    }
  }
}
