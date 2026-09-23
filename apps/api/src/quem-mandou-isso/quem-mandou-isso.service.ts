import { Injectable } from "@nestjs/common";
import { Prisma, type Exp05ef1bSessao } from "@prisma/client";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import {
  GATILHOS,
  GRUPO,
  IDS_DE_MENSAGEM,
  LOTE_DEFAULT,
  MOLDE_DO_LOTE,
  MURAL,
  ORIGENS_DO_LOTE,
  PERGUNTA_DA_REFLEXAO,
  PISO_DA_REFLEXAO,
  PISO_DE_ENCAMINHAMENTOS,
  PODCAST,
  TEMA_DEFAULT,
  TETO_DA_REFLEXAO,
  TIPOS_DE_MENSAGEM,
  TONS,
  TOTAL_DE_MENSAGENS,
  VERACIDADES,
  mensagensPublicas,
  type Gatilho,
  type MensagemDoLote,
  type OrigemDoLote,
  type Veracidade,
} from "./catalogo";
import { erroDeJogo } from "./erros";
import { contaDaTurma, estadoDaCuradoria, type SinteseDaSala } from "./regras/curadoria";
import {
  ETAPA_DA_ACAO,
  ETAPA_INICIAL,
  PASSO_INICIAL,
  aguardandoATurma,
  avancarAte,
  etapaAntesDe,
  normalizarEtapa,
  normalizarPasso,
  passoEfetivo,
  type AcaoDoGate,
  type Etapa,
  type Passo,
} from "./regras/passos";

/**
 * Persistência e regras aplicadas da exp05ef1b.
 *
 * Molde: `rastro-boato.service.ts` (o funil, o lock, o gate da turma) e
 * `manifesto-ia.service.ts` (o conteúdo homologado por turma). Assinaturas
 * recebem `escolaId`/`estudanteId` explícitos, não o request: toda query leva
 * `escola_id` no `where` ALÉM da RLS que o `comTenancy` arma (regra inviolável
 * nº 1, defesa em profundidade).
 *
 * **A aula é 100% determinística.** A única superfície de IA da missão é o
 * preparo PRÉ-AULA (`preparo.service.ts`), e ele não passa por aqui: o que este
 * serviço lê é o lote que a professora HOMOLOGOU. Nenhum token é gasto com a
 * turma na sala, e nenhuma criança espera o Vertex responder.
 *
 * **O gabarito não desce ao cliente antes do telão.** `publico()` só monta o
 * campo `revelacao` quando a etapa da turma passou de `exploracao`; antes disso
 * ele é `null` e `veracidade`/`tom`/`explicacao` não existem na resposta. O
 * lote do estudante sai sempre por `mensagensPublicas`, que é um `Omit` — o
 * vazamento pelo lote reprova no `tsc`, não no DevTools de uma criança.
 */

/** O id que a guarda de liberação (ADR-69) e o manifesto compartilham. */
export const EXP_ID = "exp05ef1b";

/**
 * Minutos sem ação para o painel marcar ociosidade. O alerta é para a docente
 * ir até a carteira, não para punir.
 */
export const MINUTOS_PARA_OCIOSO = 3;

/**
 * O gatilho com que o BANCO CURADO se apresenta na tela do preparo.
 *
 * O `LOTE_DEFAULT` é anterior ao campo: ele foi escrito à mão, não gerado a
 * partir de um gatilho. `urgencia` é a leitura honesta do que está lá (a
 * `msg-2` abre com "URGENTE GENTE!!" e a `msg-3` pede pressa), e o rascunho tem
 * de nascer com o rótulo que descreve o lote que a professora está vendo — um
 * campo vazio faria o `select` da tela aparecer sem seleção e voltar `null` na
 * homologação, que o Zod recusa.
 */
const GATILHO_DO_BANCO_CURADO: Gatilho = "urgencia";

// ───────────────────────────────────────────────────────── estado da sessão

interface EstadoSessao {
  passo: Passo;
  entrouEm: Date | null;
  primeiroEncaminhamentoEm: Date | null;
  leuTudo: boolean;
  midiasAbertas: string[];
  confirmadoEm: Date | null;
  concluidoEm: Date | null;
}

const ESTADO_INICIAL: EstadoSessao = {
  passo: PASSO_INICIAL,
  entrouEm: null,
  primeiroEncaminhamentoEm: null,
  leuTudo: false,
  midiasAbertas: [],
  confirmadoEm: null,
  concluidoEm: null,
};

type LinhaDaSessao = Pick<
  Exp05ef1bSessao,
  | "passo"
  | "entrouEm"
  | "primeiroEncaminhamentoEm"
  | "leuTudo"
  | "midiasAbertas"
  | "confirmadoEm"
  | "concluidoEm"
>;

function paraEstado(linha: LinhaDaSessao | null | undefined): EstadoSessao {
  if (!linha) return { ...ESTADO_INICIAL };
  return {
    passo: normalizarPasso(linha.passo),
    entrouEm: linha.entrouEm,
    primeiroEncaminhamentoEm: linha.primeiroEncaminhamentoEm,
    leuTudo: linha.leuTudo,
    midiasAbertas: linha.midiasAbertas,
    confirmadoEm: linha.confirmadoEm,
    concluidoEm: linha.concluidoEm,
  };
}

/** O que a revelação entrega ao estudante — só existe depois do telão. */
interface RevelacaoPublica {
  totalConfirmados: number;
  mensagens: Array<{
    id: string;
    veracidade: Veracidade;
    explicacao: string;
    total: number;
    percentual: number;
  }>;
  sintese: SinteseDaSala;
}

/**
 * O estado como o CLIENTE o recebe.
 *
 * `revelacao` é o ÚNICO campo daqui que carrega gabarito, e ele é `null` até a
 * professora acender o telão. Não há `veracidade` solta em lugar nenhum: a tela
 * pinta o selo do balão a partir de `revelacao.mensagens`, e antes disso não há
 * o que pintar.
 */
export interface EstadoPublico {
  passo: Passo;
  passoDoEstudante: Passo;
  aguardandoATurma: boolean;
  preparada: boolean;
  encaminhadas: string[];
  totalEncaminhadas: number;
  atingiuPiso: boolean;
  faltam: number;
  leuTudo: boolean;
  podeConfirmar: boolean;
  encaminhouTudo: boolean;
  confirmou: boolean;
  confirmadoEm: string | null;
  midiasAbertas: string[];
  entregouReflexao: boolean;
  concluidoEm: string | null;
  turma: { etapa: Etapa };
  revelacao: RevelacaoPublica | null;
}

/** O lote da turma, COM gabarito, já normalizado a partir do `Json` da linha. */
interface ConteudoDaTurma {
  tema: string;
  gatilho: Gatilho;
  origem: OrigemDoLote;
  mensagens: MensagemDoLote[];
  aprovadoPorProfessor: boolean;
  atualizadoEm: string | null;
}

function minutosDesde(quando: Date, agora: Date): number {
  return Math.floor((agora.getTime() - quando.getTime()) / 60_000);
}

function ehTexto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0;
}

function ehDaLista(valor: unknown, lista: readonly string[]): boolean {
  return typeof valor === "string" && lista.includes(valor);
}

/**
 * Lê as 8 mensagens do `Json` da linha, ou `null` se a forma não bate.
 *
 * O `Json` do Prisma é `unknown` na prática: o Zod validou na ESCRITA, mas uma
 * linha gravada por uma versão anterior do schema — ou por um `psql` de
 * migração — chegaria aqui com a forma velha. A lição é a do `conteudoDaLinha`
 * da exp08ef4b, com uma diferença que muda o desfecho: lá o pacote torto cai no
 * banco curado e a aula corre; **aqui não há queda**, porque o lote é do TEMA
 * que a professora escolheu e mostrar outro faria a criança ler mensagens sobre
 * um acontecimento que não existiu na escola dela. Linha torta = turma não
 * preparada = tela de espera, e o log abaixo é o que impede esse "não
 * preparada" de ser mudo para quem for diagnosticar.
 */
function mensagensValidas(bruto: Prisma.JsonValue | undefined): MensagemDoLote[] | null {
  if (!Array.isArray(bruto) || bruto.length !== TOTAL_DE_MENSAGENS) return null;

  const mensagens: MensagemDoLote[] = [];
  for (const item of bruto) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const m = item as Record<string, unknown>;
    const obrigatorios =
      ehDaLista(m.id, IDS_DE_MENSAGEM) &&
      ehTexto(m.remetente) &&
      ehTexto(m.hora) &&
      ehDaLista(m.tipo, TIPOS_DE_MENSAGEM) &&
      ehTexto(m.corpo) &&
      ehDaLista(m.veracidade, VERACIDADES) &&
      ehDaLista(m.tom, TONS) &&
      ehTexto(m.explicacao);
    if (!obrigatorios) return null;
    mensagens.push(m as unknown as MensagemDoLote);
  }

  /* Ids repetidos passariam por tudo acima e produziriam duas barras com o
     mesmo id no telão — e um `Map` que conta as duas no mesmo balde. */
  if (new Set(mensagens.map((m) => m.id)).size !== mensagens.length) return null;
  return mensagens;
}

/**
 * Rótulos do preparo vindos do banco. O CHECK da migration já restringe os
 * valores; o fallback existe porque o tipo que o Prisma entrega é `string`, e
 * cair num rótulo errado é infinitamente melhor que derrubar a tela da
 * professora por um `as` que mente.
 */
function gatilhoDaLinha(valor: string): Gatilho {
  return (GATILHOS as readonly string[]).includes(valor)
    ? (valor as Gatilho)
    : GATILHO_DO_BANCO_CURADO;
}

function origemDaLinha(valor: string): OrigemDoLote {
  return (ORIGENS_DO_LOTE as readonly string[]).includes(valor)
    ? (valor as OrigemDoLote)
    : "padrao";
}

/** O banco curado da Unooria, como rascunho editável para a tela do preparo. */
function conteudoCurado(): ConteudoDaTurma {
  return {
    tema: TEMA_DEFAULT,
    gatilho: GATILHO_DO_BANCO_CURADO,
    origem: "padrao",
    mensagens: LOTE_DEFAULT.map((m) => ({ ...m })),
    // Rascunho: nada foi gravado, então nada está aprovado.
    aprovadoPorProfessor: false,
    atualizadoEm: null,
  };
}

@Injectable()
export class QuemMandouIssoService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────── leitura da sessão

  /**
   * Boot da experiência — READ-ONLY: sem linha, devolve o estado inicial.
   *
   * O lote sai por `mensagensPublicas`, sem `veracidade`, `tom` e `explicacao`,
   * e é `null` enquanto a professora não homologou: a missão NASCE VAZIA, e sem
   * lote a tela do estudante é de espera. Não há banco curado de reserva aqui —
   * ver `mensagensValidas`.
   */
  async sessao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const estudante = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const [linha, etapa, encaminhadas, reflexao, conteudo] = await Promise.all([
        tx.exp05ef1bSessao.findUnique({ where: { escolaId_estudanteId: { escolaId, estudanteId } } }),
        this.etapaDaTurma(tx, escolaId, turmaId),
        this.idsEncaminhados(tx, escolaId, estudanteId),
        tx.exp05ef1bReflexao.findUnique({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
        }),
        this.loteDaTurma(tx, escolaId, turmaId),
      ]);

      const estado = paraEstado(linha);
      const snapshots = await this.snapshotsConfirmados(tx, escolaId, turmaId, etapa, conteudo);

      return {
        ...this.publico(estado, encaminhadas, etapa, conteudo, snapshots, Boolean(reflexao)),
        lote: conteudo
          ? {
              tema: conteudo.tema,
              grupo: { ...GRUPO },
              mural: { ...MURAL },
              // O `Omit` do catálogo: o gabarito não tem onde caber aqui.
              mensagens: mensagensPublicas(conteudo.mensagens),
            }
          : null,
        constantes: {
          pisoDeEncaminhamentos: PISO_DE_ENCAMINHAMENTOS,
          totalDeMensagens: TOTAL_DE_MENSAGENS,
          perguntaDaReflexao: PERGUNTA_DA_REFLEXAO,
          pisoDaReflexao: PISO_DA_REFLEXAO,
          tetoDaReflexao: TETO_DA_REFLEXAO,
          // A transcrição vem da api, e não do bundle, para que corrigir uma
          // fala do episódio não exija republicar um caminho imutável no bucket.
          podcast: PODCAST,
        },
        reflexao: reflexao ? { texto: reflexao.texto } : null,
        estudante: { nome: estudante.displayName },
      };
    }, escolaId);
  }

  /**
   * O polling do gate (~5 s, ADR-93) — leve de propósito: sem lote e sem
   * histograma. É o que deixa a docente conduzir 30 telas.
   *
   * **Passa pelo mesmo funil das outras rotas de estudante**, e isso é decisão,
   * não simetria: `estudanteDaEscola` é quem chama `exigirMissaoLiberada`, que
   * por sua vez chama `exigirRecursoDisponivel` — as regras invioláveis 7
   * (ADR-69) e 8 (ADR-87). Sem ela, um estudante de turma sem liberação
   * descobria a etapa e o `preparada` da turma dele, e o `@Contrato` publicado
   * no OpenAPI afirmava uma guarda que a api não executava. A exp06ef2b, a exp07ef1b
   * e a exp08ef4b deixam o `gate` fora do funil; aqui ele entra, e o preço é uma
   * leitura por chave primária em `users` mais a de `liberacoes`, dentro do
   * mesmo `comTenancy` que já lia a etapa.
   *
   * **O passo vem da LINHA da sessão, não do cliente.** A rota recebia
   * `?passo=` e reconciliava o que a tela mandasse: quem editasse a query dizia
   * ao servidor em que ponto da missão estava, e `passoEfetivo` /
   * `aguardandoATurma` — que são o que move a tela — saíam calculados sobre uma
   * afirmação do navegador. O estrago era pequeno (nada de gabarito sai daqui)
   * e o hábito, não: toda mutação já grava o passo, então a resposta autoritária
   * estava a uma leitura por chave primária de distância. A linha pode não
   * existir ainda — quem abriu o iframe e não tocou em "Entrar no grupo" — e aí
   * vale `PASSO_INICIAL`, que é o mesmo que a tela mostra.
   */
  async gate(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const [etapa, preparada, sessao] = await Promise.all([
        this.etapaDaTurma(tx, escolaId, turmaId),
        this.turmaPreparada(tx, escolaId, turmaId),
        tx.exp05ef1bSessao.findUnique({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          select: { passo: true },
        }),
      ]);
      const passo = normalizarPasso(sessao?.passo ?? PASSO_INICIAL);
      return {
        etapa: etapa ?? ETAPA_INICIAL,
        passoEfetivo: passoEfetivo(passo, etapa),
        aguardandoATurma: aguardandoATurma(passo, etapa),
        preparada,
        // O instante é do SERVIDOR: o relógio da máquina da escola atrasa, e
        // não é ele que decide o momento da aula.
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  // ─────────────────────────────────────────────────────────── as mutações

  /**
   * "Entrar no grupo" — sai da fala de contexto e abre a `Turma 5ºB`.
   *
   * `entrouEm` é carimbado AQUI, e não no `criadoEm` da linha: o relógio da
   * impulsividade (a subtração que vira o indicativo do painel) começa quando a
   * primeira mensagem aparece na tela, não quando o iframe abriu. Idempotente —
   * um F5 não reinicia esse relógio, senão o número do painel mediria a última
   * recarga em vez da primeira leitura.
   */
  async entrar(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado, contexto) => {
      if (!contexto.conteudo) throw erroDeJogo("conteudo-nao-publicado");
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");

      const passo = avancarAte(estado.passo, "curadoria");
      const entrouEm = estado.entrouEm ?? new Date();
      const novo: EstadoSessao = { ...estado, passo, entrouEm };
      if (passo !== estado.passo || entrouEm !== estado.entrouEm) {
        await tx.exp05ef1bSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          data: { passo, entrouEm },
        });
      }
      return this.montarEstado(tx, escolaId, estudanteId, novo, contexto);
    });
  }

  /**
   * Encaminhar uma mensagem para o Mural da Turma.
   *
   * Idempotente: tocar duas vezes na mesma setinha devolve 200 com
   * `novo: false`. O UNIQUE da tabela é quem decide, e não uma leitura anterior
   * — dois toques rápidos numa sala com trinta tablets chegam como duas
   * requisições em paralelo, que é o caminho normal, não a exceção.
   */
  async encaminhar(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    mensagemId: string,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado, contexto) => {
      const conteudo = this.exigirCuradoriaAberta(estado, contexto);
      /* Contra o LOTE DA TURMA, não contra o enum: a professora homologou oito
         mensagens específicas, e um id que não está nelas é uma tela velha
         falando com um lote novo. */
      if (!conteudo.mensagens.some((m) => m.id === mensagemId)) {
        throw erroDeJogo("mensagem-desconhecida");
      }

      const { count } = await tx.exp05ef1bEncaminhamento.createMany({
        data: [{ escolaId, estudanteId, mensagemId }],
        skipDuplicates: true,
      });
      const novoRegistro = count > 0;

      /* O primeiro encaminhamento é o dado central da missão: com `entrouEm`
         ele vira "quantos segundos entre ver o grupo e repassar". Só o PRIMEIRO
         carimba — reencaminhar depois não reabre a contagem. */
      let primeiro = estado.primeiroEncaminhamentoEm;
      if (novoRegistro && primeiro === null) {
        primeiro = new Date();
        await tx.exp05ef1bSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          data: { primeiroEncaminhamentoEm: primeiro },
        });
      }

      const estadoAtual = await this.montarEstado(
        tx,
        escolaId,
        estudanteId,
        { ...estado, primeiroEncaminhamentoEm: primeiro },
        contexto,
      );
      return { ...estadoAtual, novo: novoRegistro };
    });
  }

  /**
   * "Apagar para todos" — tira a mensagem do Mural antes da confirmação.
   *
   * Existe porque a curadoria é revisível ATÉ o latch: a criança que repassou
   * no impulso e voltou atrás fez exatamente o que a missão ensina, e tirar do
   * Mural é o gesto que ela conhece do aplicativo real. Depois do latch, não.
   */
  async desencaminhar(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    mensagemId: string,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado, contexto) => {
      const conteudo = this.exigirCuradoriaAberta(estado, contexto);
      if (!conteudo.mensagens.some((m) => m.id === mensagemId)) {
        throw erroDeJogo("mensagem-desconhecida");
      }

      const { count } = await tx.exp05ef1bEncaminhamento.deleteMany({
        where: { escolaId, estudanteId, mensagemId },
      });
      const estadoAtual = await this.montarEstado(tx, escolaId, estudanteId, estado, contexto);
      /* `novo` diz "mudou alguma coisa": apagar o que não estava lá é 200 com
         `false`, pela mesma razão que encaminhar duas vezes é. */
      return { ...estadoAtual, novo: count > 0 };
    });
  }

  /**
   * Rolou até a 8ª mensagem.
   *
   * Junto com o piso de 3, é o que libera "Confirmar envio": sem isto a criança
   * fecha o Mural com as três primeiras e nunca lê o esclarecimento do
   * professor, que é a `msg-7` — a mensagem que muda a leitura do grupo inteiro.
   * Idempotente, e sem volta: ter lido não se desfaz.
   */
  async leituraIntegral(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado, contexto) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      if (!estado.leuTudo) {
        await tx.exp05ef1bSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          data: { leuTudo: true },
        });
      }
      return this.montarEstado(tx, escolaId, estudanteId, { ...estado, leuTudo: true }, contexto);
    });
  }

  /**
   * Abriu a transcrição do áudio ou o card do link.
   *
   * INDICATIVO de leitura, nunca mérito: nada no produto depende deste array, e
   * o painel o mostra como conduta ("ouviu o áudio"), não como acerto. Por isso
   * ele não recusa id fora do lote da turma como o encaminhamento faz — o enum
   * da rota e o CHECK da coluna já restringem o valor, e um 400 aqui viraria
   * erro na tela por um dado que não decide nada.
   */
  async midia(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    mensagemId: string,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado, contexto) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      if (estado.midiasAbertas.includes(mensagemId)) {
        return this.montarEstado(tx, escolaId, estudanteId, estado, contexto);
      }
      const midiasAbertas = [...estado.midiasAbertas, mensagemId];
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { midiasAbertas },
      });
      return this.montarEstado(tx, escolaId, estudanteId, { ...estado, midiasAbertas }, contexto);
    });
  }

  /**
   * "Confirmar envio" — O LATCH. É o gesto que a missão mede.
   *
   * A partir daqui o Mural não muda mais e esta linha entra na conta da turma.
   * As duas condições são checadas SEPARADAS de propósito: "faltam mensagens" e
   * "falta ler o resto do grupo" são coisas diferentes na cabeça da criança, e
   * a frase de cada uma é outra (`erros.ts`). O botão da tela já fica inerte —
   * a regra vale aqui porque `/quem-mandou-isso/confirmar` é endereço
   * alcançável, como manda a regra inviolável nº 3.
   */
  async confirmar(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado, contexto) => {
      /* A ordem importa: quem JÁ confirmou lê "seu envio já foi confirmado",
         não "o Mural fechou para todo mundo". A segunda frase o faria pensar
         que perdeu o próprio envio. */
      if (estado.confirmadoEm) throw erroDeJogo("curadoria-confirmada");
      if (this.turmaJaRevelou(contexto.etapa)) throw erroDeJogo("revelacao-iniciada");
      if (!contexto.conteudo) throw erroDeJogo("conteudo-nao-publicado");

      const encaminhadas = await this.idsEncaminhados(tx, escolaId, estudanteId);
      const curadoria = estadoDaCuradoria(encaminhadas, estado.leuTudo);
      if (!curadoria.atingiuPiso) throw erroDeJogo("piso-nao-atingido");
      if (!curadoria.leuTudo) throw erroDeJogo("leitura-incompleta");

      const confirmadoEm = new Date();
      const passo = avancarAte(estado.passo, "espera");
      /* Carimbo e passo no MESMO statement: o CHECK do latch
         (`confirmado_em IS NULL OR passo <> 'contexto'`) vale por statement, e
         dois UPDATEs deixariam o intermediário reprovar no meio da aula. */
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { confirmadoEm, passo },
      });
      return this.montarEstado(
        tx,
        escolaId,
        estudanteId,
        { ...estado, confirmadoEm, passo },
        contexto,
      );
    });
  }

  /**
   * Do Mural revelado para a pergunta do tio.
   *
   * O avanço é do ESTUDANTE, não da professora: ela libera a etapa, ele decide
   * quando sai da leitura dos selos. Sem a etapa aberta responde 409
   * `reflexao-nao-liberada`, que é uma tarja de espera — a criança não fez nada
   * errado.
   */
  async avancarParaReflexao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado, contexto) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      if (contexto.etapa !== "reflexao") throw erroDeJogo("reflexao-nao-liberada");

      const passo = avancarAte(estado.passo, "reflexao");
      if (passo !== estado.passo) {
        await tx.exp05ef1bSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
          data: { passo },
        });
      }
      return this.montarEstado(tx, escolaId, estudanteId, { ...estado, passo }, contexto);
    });
  }

  /**
   * A resposta ao dilema do áudio do tio — LATCH e FIM da missão.
   *
   * `texto` é caixa livre de menor de idade, e o dado mais sensível daqui: não
   * vai a log, não vai à telemetria analítica, e a única rota que o devolve é o
   * painel do professor DA TURMA dela (LGPD art. 14).
   *
   * **Exige o carimbo da confirmação**: o par (snapshot do Mural, reflexão) é o
   * que a missão mede, e uma reflexão sem Mural fechado é uma resposta sobre
   * uma cena que a criança não completou. Quem perdeu a janela não fica sem
   * saída — `voltar-exploracao` no painel reabre a curadoria para a sala, e é
   * isso que o `curadoria-nao-confirmada` manda pedir.
   */
  async reflexao(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    texto: string,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado, contexto) => {
      if (estado.concluidoEm) throw erroDeJogo("reflexao-ja-enviada");
      if (contexto.etapa !== "reflexao") throw erroDeJogo("reflexao-nao-liberada");
      if (!estado.confirmadoEm) throw erroDeJogo("curadoria-nao-confirmada");

      const concluidoEm = new Date();
      await tx.exp05ef1bReflexao.create({
        data: { escolaId, estudanteId, texto, charsCount: texto.length },
      });
      /* Passo e conclusão juntos: o CHECK da migration cobra a equivalência
         (`passo = 'fim'`) = (`concluido_em IS NOT NULL`), e ela vale por
         statement. */
      await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { passo: "fim", concluidoEm },
      });
      return this.montarEstado(
        tx,
        escolaId,
        estudanteId,
        { ...estado, passo: "fim", concluidoEm },
        contexto,
      );
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
   * O painel da turma — a barra de prontidão e o telão.
   *
   * Parte de `users`, e NÃO de `matriculas`, pela razão que a exp08ef4b registrou
   * e a suíte de Postgres reprovou: a verdade do enturmamento é `matriculas`,
   * mas `users.turma_id` é o que o resto do runtime lê, e uma criança cuja
   * matrícula ainda não existe **tem sala na prática e entra na missão**. Se a
   * porta a deixa entrar e o painel não a mostra, a professora fica com uma tela
   * que nega o que a aula está fazendo. `users`/`turmas` estão fora da RLS: o
   * `escolaId` no `where` é a tranca, não defesa em profundidade.
   *
   * **Sem nenhuma coluna de acerto por criança** (PED-11 e `PROIBIDO_NO_PAINEL`,
   * que tem o teste que cobra a ausência). Com o gabarito a um JOIN de
   * distância, "quantas falsas cada um encaminhou" é a coluna que se escreve
   * sozinha — e ela é um ranking de quem caiu no boato. O que existe é o
   * histograma da SALA, anonimizado, por mensagem.
   *
   * `reflexaoTexto` sai NESTA rota e só nela — e, dentro dela, só para quem
   * LECIONA a turma. Gestor recebe a linha inteira com o campo em `null`.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const agora = new Date();

      const [estudantes, etapa, conteudo] = await Promise.all([
        tx.user.findMany({
          where: { escolaId, turmaId, role: "estudante" },
          select: {
            id: true,
            displayName: true,
            username: true,
            quemMandouSessoes: {
              where: { escolaId },
              take: 1,
              select: {
                passo: true,
                entrouEm: true,
                primeiroEncaminhamentoEm: true,
                leuTudo: true,
                midiasAbertas: true,
                confirmadoEm: true,
                atualizadoEm: true,
                concluidoEm: true,
              },
            },
          },
          orderBy: { displayName: "asc" },
        }),
        this.etapaDaTurma(tx, escolaId, turmaId, true),
        this.loteDaTurma(tx, escolaId, turmaId),
      ]);

      const ids = estudantes.map((e) => e.id);
      /* Uma query para os encaminhamentos de todos e outra para as reflexões —
         nunca uma por criança. O painel é lido em polling com a turma inteira na
         tela, e um N+1 aqui seria trinta round-trips a cada 5 s. */
      const [porEstudante, reflexoes] = await Promise.all([
        ids.length
          ? tx.exp05ef1bEncaminhamento.findMany({
              where: { escolaId, estudanteId: { in: ids } },
              select: { estudanteId: true, mensagemId: true },
            })
          : Promise.resolve([]),
        ids.length
          ? tx.exp05ef1bReflexao.findMany({
              where: { escolaId, estudanteId: { in: ids } },
              select: { estudanteId: true, texto: true },
            })
          : Promise.resolve([]),
      ]);

      const encaminhadasDe = new Map<string, string[]>();
      for (const e of porEstudante) {
        const lista = encaminhadasDe.get(e.estudanteId);
        if (lista) lista.push(e.mensagemId);
        else encaminhadasDe.set(e.estudanteId, [e.mensagemId]);
      }
      const reflexaoDe = new Map(reflexoes.map((r) => [r.estudanteId, r.texto]));

      /* A referência de TIPO para "ouviu o áudio" e "abriu o link" é o lote da
         turma quando ele existe, e o MOLDE quando não: a professora pode ter
         homologado um lote em que a posição do áudio mudou, e o molde é o que
         resta quando o painel abre antes do preparo. */
      const referencia = conteudo?.mensagens ?? MOLDE_DO_LOTE;
      /* `Set<string>`, e não `Set<IdDeMensagem>`: o que se compara com ele é
         `midias_abertas`, que o Prisma entrega como `string[]` — o CHECK da
         coluna é quem restringe os valores, e o banco não devolve o literal. */
      const idsDeAudio = new Set<string>(
        referencia.filter((m) => m.tipo === "audio").map((m) => m.id),
      );
      const idsDeLink = new Set<string>(
        referencia.filter((m) => m.tipo === "link").map((m) => m.id),
      );

      const linhas = estudantes.map((e) => {
        const sessao = e.quemMandouSessoes[0];
        const estado = paraEstado(sessao);
        const encaminhadas = encaminhadasDe.get(e.id) ?? [];
        const texto = reflexaoDe.get(e.id) ?? null;
        return {
          estudanteId: e.id,
          nome: e.displayName,
          usuario: e.username,
          iniciou: Boolean(sessao),
          /* O passo EFETIVO, o mesmo que a criança tem na tela — nunca o cru
             da coluna. Depois de "Iniciar revelação coletiva" a etapa empurra
             para `revelado` quem ainda estava curando, e o banco só muda na
             próxima escrita daquela sessão: a coluna continua dizendo
             `curadoria` para quem já está olhando o telão. O painel é lido em
             polling COM a sala na frente, e a professora leria ali que metade
             da turma não avançou enquanto todas as telas já avançaram. */
          passo: passoEfetivo(estado.passo, etapa),
          totalEncaminhadas: new Set(encaminhadas).size,
          leuTudo: estado.leuTudo,
          ouviuAudio: estado.midiasAbertas.some((id) => idsDeAudio.has(id)),
          abriuLink: estado.midiasAbertas.some((id) => idsDeLink.has(id)),
          segundosAteOPrimeiroEncaminhamento: segundosEntre(
            estado.entrouEm,
            estado.primeiroEncaminhamentoEm,
          ),
          confirmou: Boolean(estado.confirmadoEm),
          /* A ENTREGA é de todo mundo; o TEXTO é só de quem dá aula.
             O gestor precisa saber que a criança respondeu (é acompanhamento
             de progresso); ler o que ela escreveu é outra coisa. */
          entregouReflexao: texto !== null,
          /**
           * Caixa livre de MENOR, e `professorId` é o que separa quem a lê.
           *
           * `professorDoToken` devolve `undefined` para quem não é professor —
           * e `professorLeciona` responde `true` a `undefined`, porque gestor vê
           * a escola inteira. O efeito combinado era que `gestor_escola`,
           * `gestor_contrato` e `admin` liam o parágrafo de qualquer criança de
           * qualquer turma, enquanto cinco comentários deste módulo afirmavam
           * que "quem a lê é o professor da turma dela" (LGPD art. 14).
           *
           * Era a afirmação que estava errada, e a escolha foi torná-la
           * verdadeira em vez de reescrevê-la: o gestor continua com a linha
           * inteira de progresso — inclusive `entregouReflexao` —, e só o texto
           * some. Acompanhar a turma não exige ler o que cada criança escreveu.
           *
           * **A exp06ef2b e a exp08ef4b fazem o contrário** (`rastro-boato.service.ts`
           * e `manifesto-ia.service.ts` devolvem o texto a qualquer gestor, com
           * a mesma afirmação no comentário). A divergência é deliberada e está
           * registrada no `AGENTS.md` deste módulo — apertar as duas é frente
           * própria, porque muda o que a tela do gestor delas mostra hoje.
           */
          reflexaoTexto: professorId ? texto : null,
          /* `null` para quem ESPERA a turma. O ocioso existe para a professora
             achar quem travou, e quem confirmou o Mural antes do telão não
             travou: ele está parado porque ELA ainda não acendeu. Contá-lo
             enchia a coluna de minutos exatamente na janela em que a sala toda
             espera — o sinal aparecia mais forte quanto mais a aula ia bem. */
          ociosoMin:
            sessao && !estado.concluidoEm && !aguardandoATurma(estado.passo, etapa)
              ? minutosDesde(sessao.atualizadoEm, agora)
              : null,
        };
      });

      /* O telão sai da MESMA função pura que o estudante vê, com os mesmos
         snapshots: dois cálculos separados poderiam divergir, e a professora
         estaria narrando um histograma que a tela da criança não mostra. */
      const snapshots = linhas
        .filter((l) => l.confirmou)
        .map((l) => encaminhadasDe.get(l.estudanteId) ?? []);
      const conta = contaDaTurma(conteudo?.mensagens ?? [], snapshots);

      const total = linhas.length;
      const confirmaram = linhas.filter((l) => l.confirmou).length;
      return {
        turma: { ...turma, etapa: etapa ?? ETAPA_INICIAL, preparada: conteudo !== null },
        estudantes: linhas,
        resumo: {
          total,
          iniciaram: linhas.filter((l) => l.iniciou).length,
          confirmaram,
          // A barra de prontidão do PRD: é ela que diz à professora quando o
          // telão pode acender. Sem ninguém na sala, 0 — nunca uma divisão por
          // zero virando `NaN` no meio da aula.
          percentualConfirmados: total === 0 ? 0 : Math.round((confirmaram / total) * 100),
          entregaram: linhas.filter((l) => l.entregouReflexao).length,
          ociosos: linhas.filter((l) => (l.ociosoMin ?? 0) >= MINUTOS_PARA_OCIOSO).length,
          histograma: conta.histograma,
          sintese: conta.sintese,
        },
      };
    }, escolaId);
  }

  /**
   * O lote da turma COM o gabarito. Professor-only.
   *
   * Sem linha homologada devolve o BANCO CURADO com `aprovadoPorProfessor:
   * false` — é o rascunho que a tela do preparo abre para editar, e o que ela
   * aprova com um clique quando não quer gerar nada. Repare que a tela do
   * ESTUDANTE não tem essa queda: lá, sem homologação, é espera.
   */
  async conteudoParaOProfessor(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await tx.exp05ef1bConteudoTurma.findUnique({
        where: { escolaId_turmaId: { escolaId, turmaId } },
      });
      const mensagens = mensagensValidas(linha?.mensagensJson);
      if (!linha || !mensagens) return conteudoCurado();
      return {
        tema: linha.tema,
        gatilho: gatilhoDaLinha(linha.gatilho),
        origem: origemDaLinha(linha.origem),
        mensagens,
        aprovadoPorProfessor: linha.aprovadoPorProfessor,
        atualizadoEm: linha.atualizadoEm.toISOString(),
      } satisfies ConteudoDaTurma;
    }, escolaId);
  }

  /**
   * "Aprovar e liberar para a turma" — a curadoria humana do RF-001.
   *
   * Grava o lote INTEIRO como a professora o deixou depois de editar, e é **o
   * único lugar que liga `aprovado_por_professor`**: a rota de geração com IA
   * devolve rascunho e não escreve nada. Idempotente — homologar duas vezes é
   * exatamente o clique que uma docente nervosa dá.
   */
  async homologar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    lote: { tema: string; gatilho: Gatilho; origem: OrigemDoLote; mensagens: MensagemDoLote[] },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const dados = {
        tema: lote.tema,
        gatilho: lote.gatilho,
        origem: lote.origem,
        mensagensJson: lote.mensagens as unknown as Prisma.InputJsonValue,
        aprovadoPorProfessor: true,
      };
      const linha = await tx.exp05ef1bConteudoTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        update: dados,
        create: { escolaId, turmaId, ...dados },
      });
      return {
        tema: linha.tema,
        gatilho: gatilhoDaLinha(linha.gatilho),
        origem: origemDaLinha(linha.origem),
        mensagens: lote.mensagens,
        aprovadoPorProfessor: linha.aprovadoPorProfessor,
        atualizadoEm: linha.atualizadoEm.toISOString(),
      } satisfies ConteudoDaTurma;
    }, escolaId);
  }

  /**
   * Os dois botões mestres e o inverso: "Iniciar revelação coletiva",
   * "Liberar reflexão final" e "Voltar para a exploração".
   *
   * IDEMPOTENTE de propósito: apertar duas vezes é exatamente o clique que se
   * dá duas vezes, e a segunda não pode derrubar nada. O `voltar-exploracao`
   * não é um "zerar" — nada é apagado, os snapshots confirmados continuam
   * confirmados, e quem já entregou a reflexão fica em `fim`.
   */
  async mudarGate(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    acao: AcaoDoGate,
  ) {
    const etapa = ETAPA_DA_ACAO[acao];
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      /* Lock por TURMA: dois docentes na mesma sala (ou dois cliques) não podem
         intercalar escrita no mesmo gate. */
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`quem-mandou:${escolaId}:${turmaId}`}, 0))`;
      const linha = await tx.exp05ef1bGateTurma.upsert({
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
   * "Zerar turma" — a segunda aplicação.
   *
   * Apaga as sessões (encaminhamentos e reflexões caem por CASCADE da FK) e
   * devolve o gate a `exploracao`, senão a turma nova nasceria com o telão já
   * aceso. **PRESERVA `exp05ef1b_conteudo_turma`**: o preparo custou tempo da
   * professora, e apagá-lo obrigaria a refazer a curadoria para reaplicar a
   * missão na turma seguinte no mesmo dia. **Preserva `telemetria_eventos`**,
   * que é a trilha analítica imutável.
   *
   * A reflexão vai junto, e isso é deliberado: refazer a missão com a resposta
   * da turma do ano passado na tela seria um portfólio que mistura duas turmas.
   */
  async zerarTurma(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const { count } = await tx.exp05ef1bSessao.deleteMany({ where: { escolaId, turmaId } });
      await tx.exp05ef1bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, etapa: ETAPA_INICIAL },
        update: { etapa: ETAPA_INICIAL },
      });
      return { sucesso: true as const, registrosApagados: count };
    }, escolaId);
  }

  // ────────────────────────────────────────────────────────────── privados

  /**
   * A projeção pública do estado.
   *
   * O ponto mais delicado da missão mora aqui: `revelacao` só é montada quando a
   * etapa da turma passou de `exploracao`. Antes disso o campo é `null` e
   * NENHUM pedaço do gabarito existe na resposta — não é "a tela não mostra",
   * é "o dado não desceu" (regra inviolável nº 3).
   */
  private publico(
    estado: EstadoSessao,
    encaminhadas: readonly string[],
    etapa: Etapa | null,
    conteudo: ConteudoDaTurma | null,
    snapshots: ReadonlyArray<readonly string[]>,
    entregouReflexao: boolean,
  ): EstadoPublico {
    const curadoria = estadoDaCuradoria(encaminhadas, estado.leuTudo);
    const revelar = this.turmaJaRevelou(etapa) && conteudo !== null;
    const conta = revelar ? contaDaTurma(conteudo.mensagens, snapshots) : null;

    return {
      passo: passoEfetivo(estado.passo, etapa),
      passoDoEstudante: estado.passo,
      aguardandoATurma: aguardandoATurma(estado.passo, etapa),
      preparada: conteudo !== null,
      encaminhadas: curadoria.encaminhadas,
      totalEncaminhadas: curadoria.total,
      atingiuPiso: curadoria.atingiuPiso,
      faltam: curadoria.faltam,
      leuTudo: curadoria.leuTudo,
      podeConfirmar: curadoria.podeConfirmar,
      encaminhouTudo: curadoria.encaminhouTudo,
      confirmou: estado.confirmadoEm !== null,
      confirmadoEm: estado.confirmadoEm?.toISOString() ?? null,
      midiasAbertas: estado.midiasAbertas,
      entregouReflexao,
      concluidoEm: estado.concluidoEm?.toISOString() ?? null,
      turma: { etapa: etapa ?? ETAPA_INICIAL },
      /* Só os cinco campos do selo. O histograma do telão carrega remetente,
         tipo e resumo para a professora narrar a barra; a tela da criança já
         tem a mensagem na mão e não precisa deles. */
      revelacao: conta
        ? {
            totalConfirmados: conta.totalConfirmados,
            mensagens: conta.histograma.map((b) => ({
              id: b.id,
              veracidade: b.veracidade,
              explicacao: b.explicacao,
              total: b.total,
              percentual: b.percentual,
            })),
            sintese: conta.sintese,
          }
        : null,
    };
  }

  /** Remonta o estado público depois de uma mutação, relendo o que mudou. */
  private async montarEstado(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    estado: EstadoSessao,
    contexto: ContextoDaMutacao,
  ): Promise<EstadoPublico> {
    const encaminhadas = await this.idsEncaminhados(tx, escolaId, estudanteId);
    const snapshots = await this.snapshotsConfirmados(
      tx,
      escolaId,
      contexto.turmaId,
      contexto.etapa,
      contexto.conteudo,
    );
    /* A entrega é DERIVADA de `concluido_em`, não recebida: os dois nascem no
       mesmo latch (a linha de `exp05ef1b_reflexoes` e o carimbo), e o CHECK da
       migration cobra a equivalência com `passo = 'fim'`. Um parâmetro com
       default `false` só abriria a chance de uma rota esquecer de passá-lo — e
       dizer a quem já respondeu que não respondeu. */
    return this.publico(
      estado,
      encaminhadas,
      contexto.etapa,
      contexto.conteudo,
      snapshots,
      estado.concluidoEm !== null,
    );
  }

  /** A turma já passou da exploração? É o que abre a revelação e fecha o Mural. */
  private turmaJaRevelou(etapa: Etapa | null): boolean {
    return etapa !== null && etapaAntesDe(ETAPA_INICIAL, etapa);
  }

  /** As duas recusas que o Mural aberto tem em comum, e o lote que sobrou. */
  private exigirCuradoriaAberta(
    estado: EstadoSessao,
    contexto: ContextoDaMutacao,
  ): ConteudoDaTurma {
    if (estado.confirmadoEm) throw erroDeJogo("curadoria-confirmada");
    if (this.turmaJaRevelou(contexto.etapa)) throw erroDeJogo("revelacao-iniciada");
    if (!contexto.conteudo) throw erroDeJogo("conteudo-nao-publicado");
    return contexto.conteudo;
  }

  /** Os ids já encaminhados por este estudante, na ordem em que foram ao Mural. */
  private async idsEncaminhados(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<string[]> {
    const linhas = await tx.exp05ef1bEncaminhamento.findMany({
      where: { escolaId, estudanteId },
      orderBy: { id: "asc" },
      select: { mensagemId: true },
    });
    return linhas.map((l) => l.mensagemId);
  }

  /**
   * Os Murais dos estudantes da turma que CONFIRMARAM — a matéria-prima do
   * telão.
   *
   * Uma query só, com o `include` fazendo o join: um `findMany` por criança
   * seria N+1 dentro de um polling de 5 s com trinta telas abertas.
   *
   * Quem não confirmou não entra: mostrar à turma uma escolha que a criança
   * ainda podia desfazer seria contar outra coisa. E antes do telão ninguém
   * entra — a leitura nem acontece, porque `revelacao` seria `null` de todo
   * jeito e ler snapshots à toa é custo por polling.
   *
   * Estudante SEM TURMA volta com lista vazia, não com erro: ele não tem
   * revelação SOCIAL (não há sala de quem contar), mas continua precisando ver
   * o que era verdade — e `contaDaTurma(lote, [])` dá exatamente isso, selos com
   * `totalConfirmados: 0`. Hoje a guarda de liberação já o recusou antes daqui;
   * o ramo existe pela razão de `regras/passos.ts` — um beco sem saída nunca
   * pode nascer de um `null` que ninguém previu.
   */
  private async snapshotsConfirmados(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
    etapa: Etapa | null,
    conteudo: ConteudoDaTurma | null,
  ): Promise<string[][]> {
    if (!turmaId || conteudo === null || !this.turmaJaRevelou(etapa)) return [];
    const sessoes = await tx.exp05ef1bSessao.findMany({
      where: { escolaId, turmaId, confirmadoEm: { not: null } },
      select: { encaminhamentos: { select: { mensagemId: true } } },
    });
    return sessoes.map((s) => s.encaminhamentos.map((e) => e.mensagemId));
  }

  /**
   * O lote que vale para esta turma — `null` sem homologação.
   *
   * **Rascunho não conta**: `aprovado_por_professor: false` é conteúdo que a
   * professora ainda não aprovou por inteiro, e o RF-001 diz que ele não chega
   * ao estudante.
   */
  private async loteDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
  ): Promise<ConteudoDaTurma | null> {
    if (!turmaId) return null;
    const linha = await tx.exp05ef1bConteudoTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
    });
    if (!linha?.aprovadoPorProfessor) return null;

    const mensagens = mensagensValidas(linha.mensagensJson);
    if (!mensagens) {
      /* Sem isto o sintoma seria uma turma homologada em que a missão insiste em
         "ainda estamos organizando o grupo" — e nada, em lugar nenhum, diria
         por quê. Nenhum texto de mensagem vai ao log: só o que identifica a
         linha. */
      logger.warn(
        { codigo: "exp05ef1b-lote-invalido", escolaId, turmaId },
        "lote homologado com forma inesperada; a turma segue como não preparada",
      );
      return null;
    }

    return {
      tema: linha.tema,
      gatilho: gatilhoDaLinha(linha.gatilho),
      origem: origemDaLinha(linha.origem),
      mensagens,
      aprovadoPorProfessor: true,
      atualizadoEm: linha.atualizadoEm.toISOString(),
    };
  }

  /** O booleano do gate, sem trazer as oito mensagens junto (o polling é de 5 s). */
  private async turmaPreparada(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
  ): Promise<boolean> {
    if (!turmaId) return false;
    const linha = await tx.exp05ef1bConteudoTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      select: { aprovadoPorProfessor: true },
    });
    return linha?.aprovadoPorProfessor ?? false;
  }

  /**
   * A etapa da turma. `null` quando o estudante não tem turma — e `null` NÃO é
   * `exploracao`: sem turma não há gate (`regras/passos.ts`). `criarSeFaltar` só
   * na visão do professor, que precisa de uma linha para escrever depois.
   */
  private async etapaDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
    criarSeFaltar = false,
  ): Promise<Etapa | null> {
    if (!turmaId) return null;
    const linha = await tx.exp05ef1bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      select: { etapa: true },
    });
    if (linha) return normalizarEtapa(linha.etapa);
    if (!criarSeFaltar) return ETAPA_INICIAL;
    const criada = await tx.exp05ef1bGateTurma.create({
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
   * Dois toques rápidos em "Confirmar envio" viram duas transações em fila, e a
   * segunda relê o estado com a primeira aplicada — daí o `curadoria-confirmada`
   * em vez de dois latches. Os CHECKs do banco são a rede final.
   *
   * A etapa e o lote são lidos UMA vez aqui e viajam no `contexto`: toda mutação
   * precisa dos dois (para recusar depois do telão e para conferir o id contra o
   * lote), e relê-los em cada método seria a mesma query três vezes na mesma
   * transação.
   */
  private comSessao<T>(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    trabalho: (
      tx: Prisma.TransactionClient,
      estado: EstadoSessao,
      contexto: ContextoDaMutacao,
    ) => Promise<T>,
  ): Promise<T> {
    return this.prisma.comTenancy(async (tx) => {
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`quem-mandou:${escolaId}:${estudanteId}`}, 0))`;
      await tx.$executeRaw`
        INSERT INTO exp05ef1b_sessoes (escola_id, estudante_id, turma_id)
        VALUES (${escolaId}, ${estudanteId}::uuid, ${turmaId}::uuid)
        ON CONFLICT DO NOTHING`;
      /* A turma pode ter mudado depois da primeira visita (transferência no
         meio do ano): o painel lê por turma, e uma linha com a turma antiga
         desapareceria da tela da professora nova. */
      const atual = await tx.exp05ef1bSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { turmaId },
      });
      const [etapa, conteudo] = await Promise.all([
        this.etapaDaTurma(tx, escolaId, turmaId),
        this.loteDaTurma(tx, escolaId, turmaId),
      ]);
      return trabalho(tx, paraEstado(atual), { turmaId, etapa, conteudo });
    }, escolaId);
  }
}

/** O que a turma diz, lido uma vez por mutação (ver `comSessao`). */
interface ContextoDaMutacao {
  turmaId: string | null;
  etapa: Etapa | null;
  conteudo: ConteudoDaTurma | null;
}

/**
 * O indicativo de impulsividade do painel, em segundos.
 *
 * `null` quando falta uma das pontas, e não zero: "entrou e repassou no mesmo
 * segundo" e "não dá para saber" são leituras opostas para quem conduz a aula.
 * O CHECK da migration garante a ordem quando as duas existem.
 */
function segundosEntre(inicio: Date | null, fim: Date | null): number | null {
  if (!inicio || !fim) return null;
  return Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 1000));
}
