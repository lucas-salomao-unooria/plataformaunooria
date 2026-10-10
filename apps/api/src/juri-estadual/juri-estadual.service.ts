import { randomBytes } from "node:crypto";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Prisma, type Exp06ef1bSessao } from "@prisma/client";
import { z } from "zod";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { computadoresDaMontagem, mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades } from "../equipes/regras";
import { EvidenciasService, type ContextoDaAtividade } from "../evidencias/evidencias.service";
import { apagarEvidenciaDaAtividade } from "../evidencias/apagar-da-atividade";
import type { Nivel } from "../evidencias/regras";
import { ehUuid } from "../motor/guardas";
import { logger } from "../observabilidade/logger";
import { gravarFalasDoPodcast } from "../podcast/podcast.service";
import type { FalasDoTema } from "../podcast/roteiro";
import { PrismaService } from "../prisma/prisma.service";
import {
  ASSUNTOS_DO_BANCO_PADRAO,
  DISCIPLINA_DO_BANCO_PADRAO,
  conteudoDoBancoPadrao,
  ehConteudoDoBancoPadrao as ehDoBancoPadrao,
} from "./banco-padrao";
import { CARTOES_DE_ATITUDE, CARTOES_DE_MECANISMO, CASO_MARIANA } from "./conteudo";
import { AreaSchema, ProjetoDoPacoteSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import {
  aplicarCurtida,
  aplicarPermanencia,
  aplicarSalvamento,
  areaDominante,
  cedulaLiberada,
  embaralhar,
  feedCompleto,
  fimDoFeed,
  invisibilidade,
  projetoFoiExibido,
  projetosOcultos,
  servirAte,
  tempoDoFeedEsgotado,
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
import {
  areasBuscadas,
  auditoriaDaLinha,
  feedDaLinha,
  ocultosAbertos,
  ordemDaGaleria,
  registrarAcao,
  type AcaoDaGaleria,
} from "./regras/galeria";
import { blocosDaSessao, idsDaSessao, ordemCertaDaCadeia, ordemConfere } from "./regras/ordem";
import { mediaDasTaxas, ociosoNaCedula, votosPorArea } from "./regras/painel";
import { parSimulado } from "./regras/par";
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
  ORIGENS_DO_PACOTE,
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

function ehOrigem(valor: string): valor is OrigemDoPacote {
  return (ORIGENS_DO_PACOTE as readonly string[]).includes(valor);
}

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
    origem: ehOrigem(linha.origem) ? linha.origem : "ia",
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

/** O que a tela MEDIU no feed — o corpo de `EventosDoFeedSchema`. */
type EventosMedidos = {
  curtidas: { postId: string; curtiu: boolean }[];
  salvamentos: { postId: string; salvou: boolean }[];
  permanencias: string[];
  proximo: boolean;
};

/**
 * Aplica curtidas, salvos e permanências sobre um feed. Post que o feed não
 * serviu é recusado (400): o cliente não inventa post.
 */
function aplicarEventos(antes: EstadoDoFeed, eventos: EventosMedidos): EstadoDoFeed {
  const tocados = [
    ...eventos.curtidas.map((c) => c.postId),
    ...eventos.salvamentos.map((c) => c.postId),
    ...eventos.permanencias,
  ];
  if (tocados.some((id) => !antes.servidos.includes(id))) throw erroDeJogo("post-desconhecido");
  let estado = antes;
  for (const c of eventos.curtidas) estado = aplicarCurtida(estado, c.postId, c.curtiu);
  for (const c of eventos.salvamentos) estado = aplicarSalvamento(estado, c.postId, c.salvou);
  for (const p of eventos.permanencias) estado = aplicarPermanencia(estado, p);
  return estado;
}

/**
 * O início do preparo que a tela mandou (EVT-P01), se for plausível: no
 * passado e nas últimas 24 h. Fora disso, o instante da homologação.
 */
function inicioDoPreparo(enviado: string | undefined, agora: Date): Date {
  if (!enviado) return agora;
  const t = new Date(enviado).getTime();
  if (Number.isNaN(t) || t > agora.getTime() || agora.getTime() - t > 86_400_000) return agora;
  return new Date(t);
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
   * O passo que a criança PEDE: "Acessar Feed da Mostra" (da credencial para o
   * feed, com a ABERTURA — um post de cada área — no MESMO update) e o
   * "avançar" depois da revisão (de `revisada` para a `cadeia`). Pedir de novo
   * devolve o estado como está.
   */
  async pedirPasso(escolaId: string, estudanteId: string, turmaId: string | null, para: PassoPedido) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      const r = pedirPasso(atual, para);
      if (!r.ok) throw erroDeJogo(r.codigo);
      if (para === "cadeia") {
        if (r.passo !== atual) {
          await tx.exp06ef1bSessao.updateMany({
            where: { id: ctx.sessao.id, escolaId, passo: "revisada" },
            data: { passo: "cadeia" },
          });
        }
        return { passo: passoEfetivo(r.passo, ctx.gate.etapa), etapa: ctx.gate.etapa };
      }
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
      return this.feedPublico(ctx.pacote, estado, ctx.sessao.feedIniciadoEm);
    }, escolaId);
  }

  /**
   * O que a tela MEDIU desde a última chamada — curtidas e salvos (estado) e
   * permanências (fato) —, e o próximo post quando ela chegou ao fim do que foi
   * servido. A ordem importa: as curtidas entram ANTES de o motor escolher o
   * próximo, porque é a curtida que afunila.
   *
   * O primeiro `proximo: true` é a 1ª ROLAGEM: grava `feed_iniciado_em`, e daí
   * contam os 8 minutos do feed (melhoria 9) — no SERVIDOR, então o F5 não
   * zera. Com o tempo esgotado, o feed não serve mais post: a cédula abre.
   */
  async eventosDoFeed(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    eventos: EventosMedidos,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const atual = normalizarPasso(ctx.sessao.passo);
      if (ctx.sessao.votadoEm || votou(atual)) throw erroDeJogo("voto-ja-lacrado");
      if (atual !== "feed") throw erroDeJogo("passo-invalido");

      const agora = new Date();
      const iniciadoEm = ctx.sessao.feedIniciadoEm ?? (eventos.proximo ? agora : null);
      const antes = feedDaLinha(ctx.sessao);
      let estado = aplicarEventos(antes, eventos);
      if (eventos.proximo && !tempoDoFeedEsgotado(iniciadoEm, agora)) {
        estado = {
          ...estado,
          servidos: servirAte(projetosDoMotor(ctx.pacote), estado, ctx.sessao.semente, estado.servidos.length + 1),
        };
      }

      const iniciouAgora = ctx.sessao.feedIniciadoEm === null && iniciadoEm !== null;
      if (iniciouAgora || canonico(estado) !== canonico(antes)) {
        await tx.exp06ef1bSessao.update({
          where: { id: ctx.sessao.id },
          data: {
            postsServidos: [...estado.servidos],
            curtidos: [...estado.curtidos],
            salvos: [...estado.salvos],
            permanencias: [...estado.permanencias],
            ...(iniciouAgora ? { feedIniciadoEm: iniciadoEm } : {}),
          },
        });
      }
      return this.feedPublico(ctx.pacote, estado, iniciadoEm, agora);
    }, escolaId);
  }

  /**
   * O BATIMENTO da cédula aberta (melhoria 8): a cada 15 s, há quantos segundos
   * não há toque nela. Grava o instante do batimento e o do último toque; o
   * painel do professor acende o ícone de ocioso com mais de 60 s
   * (`regras/painel.ts#ociosoNaCedula`). `aberta: false` apaga a marca. Só no
   * feed, antes do voto: depois dele, responde sem gravar (o batimento atrasado
   * não acende ninguém).
   */
  async batimentoDaCedula(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    batimento: { aberta: boolean; segundosSemToque: number },
  ): Promise<void> {
    await this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      if (normalizarPasso(ctx.sessao.passo) !== "feed") return;
      const agora = new Date();
      await tx.exp06ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, passo: "feed" },
        data: batimento.aberta
          ? {
              cedulaBatimentoEm: agora,
              cedulaInativaDesde: new Date(agora.getTime() - batimento.segundosSemToque * 1000),
            }
          : { cedulaBatimentoEm: null, cedulaInativaDesde: null },
      });
    }, escolaId);
  }

  /**
   * A cédula — O LATCH 1. Projeto e certeza, carimbo e o passo `lacrada` no
   * MESMO update (os CHECKs valem por statement). A cédula abre com os dez posts
   * OU com os 8 minutos do feed esgotados; o projeto tem de ter aparecido no
   * feed desta criança. O batimento da cédula se apaga no mesmo update.
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
      if (!cedulaLiberada(feed, ctx.sessao.feedIniciadoEm, new Date())) throw erroDeJogo("feed-incompleto");
      if (!projetoFoiExibido(feed.servidos, voto.projetoId)) throw erroDeJogo("projeto-fora-do-feed");

      const { count } = await tx.exp06ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, votadoEm: null, passo: "feed" },
        data: {
          votoProjeto: voto.projetoId,
          conviccao: voto.conviccao,
          votadoEm: new Date(),
          passo: "lacrada",
          cedulaBatimentoEm: null,
          cedulaInativaDesde: null,
        },
      });
      if (count === 0) throw erroDeJogo("voto-ja-lacrado");
      const sessao = await tx.exp06ef1bSessao.findUniqueOrThrow({ where: { id: ctx.sessao.id } });
      return this.estado(sessao, ctx.gate);
    }, escolaId);
  }

  /**
   * A Galeria Oculta: os dezesseis estandes, os que NÃO chegaram ao feed
   * primeiro, e a taxa REAL desta sessão — o número do badge e o tamanho da
   * grade. Só com o passo efetivo `galeria` ou além — o voto lacrado E a etapa
   * liberada pelo professor. `podeManter` diz se o "Manter meu voto inicial"
   * já vale (abriu ao menos um oculto).
   */
  async galeria(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const efetivo = passoEfetivo(normalizarPasso(ctx.sessao.passo), ctx.gate.etapa);
      if (!passoNoMinimo(efetivo, "galeria")) throw erroDeJogo("galeria-nao-liberada");
      const { servidos } = feedDaLinha(ctx.sessao);
      const porId = new Map(ctx.pacote.conteudo.projetos.map((p) => [p.id, p]));
      const ocultos = projetosOcultos(projetosDoMotor(ctx.pacote), servidos);
      const abertos = ocultosAbertos(auditoriaDaLinha(ctx.sessao.auditoria), ocultos);
      return {
        invisibilidade: invisibilidade(servidos),
        projetos: ordemDaGaleria(servidos)
          .map((id) => porId.get(id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => projetoDaGaleria(p, ctx.pacote.midia, projetoFoiExibido(servidos, p.id))),
        ocultosAbertos: abertos,
        podeManter: abertos >= 1,
      };
    }, escolaId);
  }

  /**
   * Abrir a ficha de um estande ou buscar — o registro da EF06CO10 e da
   * EF06CO01, lido no latch da revisão. Só na galeria (antes, a porta está
   * fechada; depois da revisão, a medida já foi tomada). Da busca, só o tipo e
   * a área que casou.
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
   * "Manter meu voto inicial" ou "Confirmar Voto Revisado" — O LATCH 2, só da
   * galeria. `manter` exige ao menos UM estande oculto aberto (409
   * `galeria-sem-inspecao`, melhoria 6); `trocar` aceita qualquer um dos
   * dezesseis, menos o voto lacrado. Ação, voto FINAL, carimbo e o passo
   * `revisada` no mesmo update, e as marcas da EF06CO10 (`auditoria`) e da
   * EF06CO01 (`classificacao`) na mesma transação — com os status gravados
   * também na sessão (PRD §11.1). A régua que devolve `null` não marca.
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

      const feed = feedDaLinha(ctx.sessao);
      const auditoria = auditoriaDaLinha(ctx.sessao.auditoria);
      const ocultos = projetosOcultos(projetosDoMotor(ctx.pacote), feed.servidos);
      let final = voto;
      if (revisao.acao === "trocar") {
        if (!revisao.projetoId || revisao.projetoId === voto) throw erroDeJogo("payload-invalido");
        final = revisao.projetoId;
      } else if (ocultosAbertos(auditoria, ocultos) < 1) {
        throw erroDeJogo("galeria-sem-inspecao");
      }
      const gate = await this.gateDaSessao(tx, escolaId, ctx);

      const nivelCo10 = nivelDaAuditoria(auditoria, ocultos);
      const nivelCo01 = nivelDaClassificacao(auditoria, ocultos, areaDominante(feed));
      const { count } = await tx.exp06ef1bSessao.updateMany({
        where: { id: ctx.sessao.id, escolaId, revisadoEm: null, passo: "lacrada" },
        data: {
          revisaoAcao: revisao.acao,
          votoRevisado: final,
          revisadoEm: new Date(),
          passo: "revisada",
          auditoriaStatus: nivelCo10,
          classificacaoStatus: nivelCo01,
        },
      });
      if (count === 0) throw erroDeJogo("voto-ja-revisado");

      await this.marcar(tx, ctx, gate, MARCADOR_DA_AUDITORIA, nivelCo10);
      await this.marcar(tx, ctx, gate, MARCADOR_DA_CLASSIFICACAO, nivelCo01);
      const sessao = await tx.exp06ef1bSessao.findUniqueOrThrow({ where: { id: ctx.sessao.id } });
      return this.estado(sessao, gate);
    }, escolaId);
  }

  /**
   * Uma tentativa de montar a cadeia (EF06CO03): Interações → Dados →
   * Algoritmo → Bolha. Cada envio conta. A ordem ERRADA responde **422**
   * `ordem-incorreta` (PRD §12.1) — e a tentativa é gravada ANTES: a transação
   * devolve o resultado e o erro é lançado fora dela, senão o rollback
   * apagaria a contagem. Na certa, o passo anda e a habilidade é marcada pelas
   * tentativas. Com a cadeia já montada, responde certa sem contar.
   */
  async montarCadeia(escolaId: string, estudanteId: string, turmaId: string | null, ordem: readonly string[]) {
    const r = await this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const s = ctx.sessao;
      if (s.cadeiaMontadaEm) {
        return { correta: true as const, tentativas: s.cadeiaTentativas, passo: this.estado(s, ctx.gate).passo };
      }
      if (normalizarPasso(s.passo) !== "cadeia") throw erroDeJogo("passo-invalido");
      const certa = ordemCertaDaCadeia(s.semente);
      if (!idsDaSessao(ordem, certa)) throw erroDeJogo("payload-invalido");
      const gate = await this.gateDaSessao(tx, escolaId, ctx);

      const tentativas = s.cadeiaTentativas + 1;
      if (!ordemConfere(ordem, certa)) {
        await tx.exp06ef1bSessao.update({ where: { id: s.id }, data: { cadeiaTentativas: tentativas } });
        return { correta: false as const, tentativas };
      }

      const nivel = nivelPorTentativas(tentativas);
      const { count } = await tx.exp06ef1bSessao.updateMany({
        where: { id: s.id, escolaId, cadeiaMontadaEm: null, passo: "cadeia" },
        data: { cadeiaTentativas: tentativas, cadeiaMontadaEm: new Date(), passo: "mariana", logicaStatus: nivel },
      });
      /* Sem linha atualizada, já estava montada: não conta nem marca de novo. */
      if (count > 0) await this.marcar(tx, ctx, gate, MARCADOR_DA_CADEIA, nivel);
      const depois = await tx.exp06ef1bSessao.findUniqueOrThrow({ where: { id: s.id } });
      return { correta: true as const, tentativas: depois.cadeiaTentativas, passo: this.estado(depois, gate).passo };
    }, escolaId);
    if (!r.correta) throw erroDeJogo("ordem-incorreta", { tentativas: r.tentativas });
    return r;
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

      /* EVT-P04: cada leitura do painel conta (o hub o lê no polling da aula). */
      await tx.exp06ef1bPacote.updateMany({
        where: { id: gate.pacoteId, escolaId },
        data: { painelVistoEm: new Date(), painelVistas: { increment: 1 } },
      });
      const agora = new Date();
      const linhas = estudantes.map((e) => {
        const s = e.juriSessoes[0];
        const auditoria = auditoriaDaLinha(s?.auditoria ?? null);
        const passoGravado = s ? normalizarPasso(s.passo) : ("credencial" as Passo);
        return {
          estudanteId: e.id,
          nome: e.displayName,
          usuario: e.username,
          entrou: Boolean(s),
          /* O passo EFETIVO, o mesmo da tela da criança. */
          passo: s ? passoEfetivo(normalizarPasso(s.passo), gate.etapa) : ("credencial" as Passo),
          votou: Boolean(s?.votadoEm),
          ocioso:
            passoGravado === "feed" && ociosoNaCedula(s?.cedulaBatimentoEm ?? null, s?.cedulaInativaDesde ?? null, agora),
          abriuAGaleria: auditoria.abertos.length > 0,
          buscou: auditoria.buscas.length > 0,
          categoriasBuscadas: areasBuscadas(auditoria),
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
          /* O `complementar` das sessões da 0.3.0 manteve o voto: conta como manter. */
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
          ociosos: saida.filter((u) => u.ocioso).length,
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
   * O botão único do painel: "Liberar Auditoria" (a Galeria Oculta).
   * Idempotente, uma etapa por vez, sem voltar (`regras/passos.ts#transicaoDoGate`),
   * com o lock EXCLUSIVO da turma — que espera as jogadas em voo (elas pegam o
   * compartilhado). Grava quando o portão abriu e, a cada etapa liberada, uma
   * linha em `exp06ef1b_gates_historico` (EVT-P05).
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
        const linha = await tx.exp06ef1bGateTurma.update({
          where: { turmaId, escolaId },
          data: { etapa: para, galeriaLiberadaEm: para === "galeria" ? agora : null, desvioLiberadoEm: null },
          select: { atualizadoEm: true },
        });
        await tx.exp06ef1bGateHistorico.create({ data: { escolaId, turmaId, etapa: para, liberadaEm: agora } });
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
   * "Zerar a turma" — a segunda aplicação: sobe a rodada e volta à
   * exploração, e APAGA a evidência pedagógica do pacote, de todas as rodadas
   * (ADR-155) — a turma recomeça do zero no painel de habilidades. As sessões
   * da rodada anterior ficam, com os votos e o que cada criança fez na
   * galeria. O carimbo da galeria volta a nulo (CHECK).
   */
  async zerar(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const { gate } = await this.exigirPacote(tx, escolaId, turmaId);
      await apagarEvidenciaDaAtividade(tx, { escolaId, turmaId, expId: EXP_ID, atividadeId: gate.pacoteId });
      const linha = await tx.exp06ef1bGateTurma.update({
        where: { turmaId, escolaId },
        data: { rodada: gate.rodada + 1, etapa: ETAPA_INICIAL, galeriaLiberadaEm: null, desvioLiberadoEm: null },
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
          origem: ehOrigem(p.origem) ? p.origem : ("ia" as const),
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
      const gate = { pacoteId, rodada, etapa: ETAPA_INICIAL, galeriaLiberadaEm: null, desvioLiberadoEm: null };
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
      /** As três falas do podcast que o professor revisou na criação (ADR-150, ADR-151). */
      podcast: FalasDoTema;
      /** Quando o professor abriu o preparo (EVT-P01); sem ele, agora. */
      preparoIniciadoEm?: string;
    },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const gravarFalas = (atividadeId: string) =>
        gravarFalasDoPodcast(tx, { escolaId, expId: EXP_ID, atividadeId, falas: corpo.podcast, aprovadoPor: criadoPor });

      const recentes = await tx.exp06ef1bPacote.findMany({
        where: { escolaId, turmaId },
        orderBy: { criadoEm: "desc" },
        take: 5,
        select: { ...SELECAO_DO_PACOTE, ativo: true },
      });
      const { parametros } = corpo;
      const conteudo = this.emOrdem(corpo.conteudo);
      const contexto = parametros.contexto?.trim() || null;
      /* O rascunho que é o banco padrão intocado (o fallback sem cota, homologado
         como veio) é um pacote `padrao`: o podcast dele é o roteiro fixo. */
      const origem: OrigemDoPacote = ehDoBancoPadrao(conteudo) ? "padrao" : "ia";

      const [ultimo] = recentes;
      if (
        ultimo &&
        ultimo.disciplina === parametros.disciplina &&
        ultimo.assuntos === parametros.assuntos &&
        ultimo.contexto === contexto &&
        canonico(ultimo.conteudo) === canonico(conteudo)
      ) {
        /* O segundo clique pode trazer as falas do podcast editadas: elas
           valem, mesmo sem atividade nova (ADR-150). */
        await gravarFalas(ultimo.id);
        return {
          id: ultimo.id,
          disciplina: parametros.disciplina,
          tema: ultimo.tema,
          origem: ehOrigem(ultimo.origem) ? ultimo.origem : origem,
          ativo: ultimo.ativo,
        };
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

      const agora = new Date();
      const novo = await tx.exp06ef1bPacote.create({
        data: {
          escolaId,
          turmaId,
          origem,
          disciplina: parametros.disciplina,
          /* O tema da mostra é o que o estudante LÊ: o do conteúdo. */
          tema: conteudo.tema,
          assuntos: parametros.assuntos,
          contexto,
          conteudo: conteudo as unknown as Prisma.InputJsonValue,
          midia: herdada,
          ativo: false,
          criadoPor,
          /* A telemetria docente (PRD §13, EVT-P01 e EVT-P03). */
          preparoIniciadoEm: inicioDoPreparo(corpo.preparoIniciadoEm, agora),
          aprovadoEm: agora,
          aprovadoPor: criadoPor,
        },
        select: { id: true, tema: true },
      });
      await gravarFalas(novo.id);
      return { id: novo.id, disciplina: parametros.disciplina, tema: novo.tema, origem, ativo: false };
    }, escolaId);
  }

  /**
   * "Usar Banco Padrão Oficial" (E0-PROF-02, RF-007) — o caminho curto do
   * professor: sem IA, sem curadoria e sem imagem gerada. Cria (ou reaproveita,
   * se a turma já tem) o pacote `padrao` com os dezesseis projetos do 01e, já
   * com as imagens APROVADAS (os estandes usam a arte procedural, que não muda),
   * e com `porNoAr` o põe em andamento na mesma transação — o "Usar Banco
   * Padrão e Pôr no ar" de dois toques (Anexo §9a). O podcast dele é o roteiro
   * fixo do sheet (`podcast.ts`): não há falas a gravar.
   */
  async usarBancoPadrao(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    criadoPor: string,
    porNoAr: boolean,
  ) {
    const pacote = await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const conteudo = this.emOrdem(conteudoDoBancoPadrao());
      const existentes = await tx.exp06ef1bPacote.findMany({
        where: { escolaId, turmaId, origem: "padrao" },
        orderBy: { criadoEm: "desc" },
        select: { id: true, tema: true, ativo: true, conteudo: true },
      });
      const igual = existentes.find((p) => canonico(p.conteudo) === canonico(conteudo));
      if (igual) return { id: igual.id, tema: igual.tema, ativo: igual.ativo };
      const agora = new Date();
      const novo = await tx.exp06ef1bPacote.create({
        data: {
          escolaId,
          turmaId,
          origem: "padrao",
          disciplina: DISCIPLINA_DO_BANCO_PADRAO,
          tema: conteudo.tema,
          assuntos: ASSUNTOS_DO_BANCO_PADRAO,
          contexto: null,
          conteudo: conteudo as unknown as Prisma.InputJsonValue,
          midia: {},
          imagensAprovadasEm: agora,
          ativo: false,
          criadoPor,
          preparoIniciadoEm: agora,
          aprovadoEm: agora,
          aprovadoPor: criadoPor,
        },
        select: { id: true, tema: true, ativo: true },
      });
      return novo;
    }, escolaId);
    const emAndamento = porNoAr ? await this.colocarEmAndamento(escolaId, turmaId, professorId, pacote.id) : null;
    return {
      id: pacote.id,
      disciplina: DISCIPLINA_DO_BANCO_PADRAO,
      tema: pacote.tema,
      origem: "padrao" as const,
      ativo: emAndamento ? true : pacote.ativo,
    };
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
   * O pacote do podcast de recapitulação (ADR-150, ADR-151): o pedido — desta
   * turma — ou o em andamento sem pedido. Ao contrário de `pacoteParaMidia`,
   * vale DEPOIS das imagens aprovadas: o podcast se gera para a atividade
   * pronta ou no ar. A guarda de turma (404) e o "sem atividade" (403) são os
   * mesmos.
   */
  async pacoteParaPodcast(
    escolaId: string,
    turmaId: string,
    professorId?: string,
    pacoteId?: string,
  ): Promise<{ id: string; tema: string; padrao: boolean }> {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const id = pacoteId ?? (await this.exigirPacote(tx, escolaId, turmaId)).pacote.id;
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, id);
      /* O banco padrão INTOCADO tem o podcast fixo do sheet (aud-exp06ef1b-01). */
      return { id: linha.id, tema: linha.tema, padrao: linha.origem === "padrao" && ehDoBancoPadrao(linha.conteudo) };
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

  /** Os posts de uma lista, pela allowlist. */
  private postsPublicos(pacote: PacoteLido, servidos: readonly string[]) {
    return servidos
      .map((id) => postPublico(id, pacote.conteudo.projetos, pacote.midia as Midia))
      .filter((p): p is PostPublico => p !== null);
  }

  /** O feed como a tela o desenha: os posts servidos, pela allowlist, e o relógio dos 8 minutos. */
  private feedPublico(pacote: PacoteLido, estado: EstadoDoFeed, iniciadoEm: Date | null, agora = new Date()) {
    const fim = fimDoFeed(iniciadoEm);
    return {
      posts: this.postsPublicos(pacote, estado.servidos),
      curtidos: [...estado.curtidos],
      salvos: [...estado.salvos],
      completo: feedCompleto(estado),
      tempoEsgotado: tempoDoFeedEsgotado(iniciadoEm, agora),
      encerraEm: fim ? fim.toISOString() : null,
      cedulaLiberada: cedulaLiberada(estado, iniciadoEm, agora),
    };
  }

  /** A sessão inteira do estudante (`SessaoSchema`): cada bloco do fim só do passo dele em diante. */
  private sessaoPublica(ctx: ContextoDoEstudante) {
    const { sessao, gate, pacote } = ctx;
    const passo = normalizarPasso(sessao.passo);
    const efetivo = passoEfetivo(passo, gate.etapa);
    const feed = feedDaLinha(sessao);
    const acao = sessao.revisaoAcao;

    return {
      pacoteId: sessao.pacoteId,
      rodada: sessao.rodada,
      passo: efetivo,
      passoDoEstudante: passo,
      etapa: gate.etapa,
      aguardandoOProfessor: aguardandoOProfessor(passo, gate.etapa),
      tema: pacote.conteudo.tema,
      categorias: pacote.conteudo.categorias.map((c) => ({ area: c.area, nome: c.nome, hashtag: c.hashtag })),
      feed: this.feedPublico(pacote, feed, sessao.feedIniciadoEm),
      voto:
        sessao.votoProjeto && sessao.conviccao
          ? { projetoId: sessao.votoProjeto, conviccao: sessao.conviccao as Conviccao }
          : null,
      revisao:
        acao === "manter" || acao === "trocar" || acao === "complementar"
          ? { acao, projetoId: acao === "trocar" ? sessao.votoRevisado : null }
          : null,
      cadeia: passoNoMinimo(efetivo, "cadeia")
        ? {
            blocos: blocosDaSessao(sessao.semente),
            tentativas: sessao.cadeiaTentativas,
            montada: sessao.cadeiaMontadaEm !== null,
            parSimulado: parSimulado(feed, sessao.semente),
          }
        : null,
      mariana: passoNoMinimo(efetivo, "mariana")
        ? {
            caso: CASO_MARIANA,
            /* Os cinco juntos, embaralhados pela sessão: o certo não é sempre o primeiro. `certo` não desce. */
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
    status: Nivel | null,
  ): Promise<void> {
    /* `null` é AUSÊNCIA (a criança não fez a ação): não há marca, e a pergunta da habilidade decide. */
    if (status === null) return;
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
