import { randomUUID } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import type { AiProvider } from '../ai/provider';
import type { AssetsService } from '../assets/assets.service';
import { CONCORRENCIA, DIVISOR_TESE, PERFIS } from '../comum/insta/defaults';
import { antagonismoSchema, type Antagonismo, type LoteSpec } from '../comum/insta/tipos';
import { PrismaService } from '../prisma/prisma.service';

import {
  likesDoPost,
  likesDosComentarios,
  rotuloDeTempo,
  rotuloDeTempoComentario,
  sorteiaVerificado,
} from './metricas';
import { totalDeNeutros, type Proporcoes } from './plano';
import { promptDeImagem } from './prompts/imagem';
import { gerarPersonas } from './prompts/personas';
import { gerarLotePosts, type AutorDisponivel } from './prompts/posts';
import { validarPost } from './validacao';

/**
 * Worker in-process (doc 07): personas → lotes de texto → métricas procedurais
 * → fila de imagens (com fallback) → validação final. Fila persistida em
 * generation_jobs, então o painel do professor sobrevive a um F5 e o worker
 * pode ser retomado.
 *
 * Diferenças para o `lib/geracao/worker.ts` do origem — só o acoplamento:
 * - o client Prisma, o provider de IA e o serviço de assets chegam por
 *   parâmetro na criação (`GeracaoWorker`), nada aqui importa singleton;
 * - TODA leitura/escrita de banco corre dentro de `prisma.comTenancy(fn,
 *   escolaId)` (RLS armada) E filtra `escola_id` explicitamente (regra 1 do
 *   CLAUDE.md) — por isso alguns `update`/`findUnique` viraram
 *   `updateMany`/`findFirst`, que aceitam o filtro composto;
 * - a imagem sai por `provider.generateImage` + `AssetsService.salvarImagemDePost`
 *   (URL pública ABSOLUTA em `posts.image_url`) em vez do filesystem local;
 * - multi-instância: ver o lock consultivo em `reservarJob`.
 */

const MAX_TENTATIVAS = 2;

/**
 * O registro de execuções vive no globalThis: em dev, cada route handler carrega
 * seu próprio instance do módulo, e um Map local fazia `/progress` disparar um
 * segundo worker por cima do primeiro — que devolvia jobs "rodando" para a fila
 * e gravava os mesmos lotes duas vezes (proporções fora do doc 04).
 */
const registroGlobal = globalThis as unknown as { instanooriaWorkers?: Map<string, Promise<void>> };
registroGlobal.instanooriaWorkers ??= new Map<string, Promise<void>>();
const emExecucao = registroGlobal.instanooriaWorkers;

/** Só jobs travados há mais de 5 min voltam para a fila (job em voo é preservado). */
const MINUTOS_PARA_RECICLAR = 5;

/**
 * Módulo-nível de propósito (o registro é global): `progresso.filaOrfa` decide
 * retomar a fila sem precisar da instância do worker.
 */
export function workerAtivo(activityId: string): boolean {
  return emExecucao.has(activityId);
}

export interface DepsDaGeracao {
  prisma: PrismaService;
  provider: AiProvider;
  assets: AssetsService;
}

export interface LoteSpecPayload extends LoteSpec {
  /** Lote de reposição: não gera nova reposição (evita laço infinito). */
  reposicao?: boolean;
  /** Regeneração de texto: o post antigo sai quando o novo entra. */
  substituiPostId?: string;
}

export class GeracaoWorker {
  constructor(private readonly deps: DepsDaGeracao) {}

  workerAtivo(activityId: string): boolean {
    return workerAtivo(activityId);
  }

  /** Dispara (ou retoma) o processamento da fila da atividade. */
  dispararWorker(escolaId: string, activityId: string): void {
    if (emExecucao.has(activityId)) return;

    const execucao = this.executar(escolaId, activityId)
      .catch((erro) => {
        console.error('[worker]', activityId, erro);
      })
      .finally(() => {
        emExecucao.delete(activityId);
      });

    emExecucao.set(activityId, execucao);
  }

  /** Cria a fila de jobs da atividade e marca status = gerando. */
  async enfileirarGeracao(escolaId: string, activityId: string, lotes: LoteSpec[]): Promise<void> {
    await this.deps.prisma.comTenancy(async (tx) => {
      await tx.generationJob.deleteMany({
        where: { escolaId, activityId, status: { in: ['pendente', 'erro'] } },
      });
      await tx.generationJob.create({ data: { escolaId, activityId, tipo: 'personas', payload: {} } });
      await tx.generationJob.createMany({
        data: lotes.map((lote) => ({
          escolaId,
          activityId,
          tipo: 'posts_lote',
          payload: lote as unknown as Prisma.InputJsonValue,
        })),
      });
      await tx.generationJob.create({ data: { escolaId, activityId, tipo: 'validacao', payload: {} } });
      await tx.activity.updateMany({ where: { id: activityId, escolaId }, data: { status: 'gerando' } });
    }, escolaId);
  }

  // ---------------------------------------------------------------- orquestração

  private async executar(escolaId: string, activityId: string): Promise<void> {
    // Resíduo de execução interrompida (restart/deploy) volta para a fila — mas só
    // o que está travado há tempo, para nunca duplicar um job em voo.
    await this.deps.prisma.comTenancy(
      (tx) =>
        tx.generationJob.updateMany({
          where: {
            escolaId,
            activityId,
            status: 'rodando',
            updatedAt: { lt: new Date(Date.now() - MINUTOS_PARA_RECICLAR * 60_000) },
          },
          data: { status: 'pendente' },
        }),
      escolaId,
    );

    const textoTerminou = { valor: false };

    const texto = (async () => {
      try {
        await this.rodarJobsDeTexto(escolaId, activityId);
      } finally {
        textoTerminou.valor = true;
      }
    })();

    await Promise.all([texto, this.drenarImagens(escolaId, activityId, textoTerminou)]);
    await this.rodarValidacaoFinal(escolaId, activityId);
  }

  private async rodarJobsDeTexto(escolaId: string, activityId: string): Promise<void> {
    // 1) personas primeiro: os lotes dependem dos autores.
    //    `reservarJob` devolvendo null pode ser fila vazia OU o lock consultivo
    //    com outro dono naquele instante — só o contador de pendentes separa os
    //    dois casos (mesmo padrão que `drenarImagens` já usava no origem).
    for (;;) {
      const job = await this.reservarJob(escolaId, activityId, 'personas');
      if (!job) {
        if ((await this.contarPendentes(escolaId, activityId, 'personas')) === 0) break;
        await esperar(300);
        continue;
      }
      await this.executarComRetentativa(escolaId, job, () =>
        this.processarPersonas(escolaId, activityId),
      );
    }

    // 2) lotes de posts, com concorrência de texto.
    for (;;) {
      await poolDeTrabalhadores(CONCORRENCIA.texto, async () => {
        const lote = await this.reservarJob(escolaId, activityId, 'posts_lote');
        if (!lote) return false;
        await this.executarComRetentativa(escolaId, lote, () =>
          this.processarLote(escolaId, activityId, lote.payload as unknown as LoteSpecPayload),
        );
        return true;
      });
      // O pool esvaziou — mas pode ter sido o lock, não a fila (ver acima).
      if ((await this.contarPendentes(escolaId, activityId, 'posts_lote')) === 0) return;
      await esperar(300);
    }
  }

  /** Pendentes do tipo — separa "fila vazia" de "lock com outro dono". */
  private contarPendentes(escolaId: string, activityId: string, tipo: string): Promise<number> {
    return this.deps.prisma.comTenancy(
      (tx) => tx.generationJob.count({ where: { escolaId, activityId, tipo, status: 'pendente' } }),
      escolaId,
    );
  }

  private async drenarImagens(
    escolaId: string,
    activityId: string,
    textoTerminou: { valor: boolean },
  ): Promise<void> {
    // Imagens correm em paralelo ao texto: o lote recém-gravado já vira fila.
    for (;;) {
      const processou = await poolDeTrabalhadores(CONCORRENCIA.imagem, async () => {
        const job = await this.reservarJob(escolaId, activityId, 'imagem');
        if (!job) return false;
        const { postId } = (job.payload ?? {}) as { postId?: string };
        await this.executarComRetentativa(
          escolaId,
          job,
          () => this.processarImagem(escolaId, activityId, postId!),
          () => this.marcarImagemComoFallback(escolaId, postId!),
        );
        return true;
      });

      if (!processou && textoTerminou.valor) {
        const restantes = await this.contarPendentes(escolaId, activityId, 'imagem');
        if (restantes === 0) return;
      }
      if (!processou) await esperar(500);
    }
  }

  // ------------------------------------------------------------------ jobs

  /**
   * Reserva um job pendente.
   *
   * O origem era single-process e o claim otimista bastava. No Cloud Run pode
   * haver mais de uma instância com o worker da MESMA atividade acordado (o
   * registro no globalThis só deduplica dentro da instância). Por isso cada
   * ciclo adquire `pg_try_advisory_xact_lock('geracao:' + activityId)` DENTRO
   * da transação do claim: se outra instância é a dona do ciclo naquele
   * momento, esta pula em silêncio (devolve null, o pool trata como fila
   * vazia). O lock é local à transação — solto no commit —, então instância
   * morta não deixa lock preso; e o job que ela reservou e nunca terminou
   * volta pela reciclagem por `updatedAt` acima. Nenhum job roda duas vezes:
   * o claim (`updateMany` condicionado a status pendente) continua atômico.
   */
  private async reservarJob(escolaId: string, activityId: string, tipo: string): Promise<Job | null> {
    return this.deps.prisma.comTenancy(async (tx) => {
      const lock = await tx.$queryRaw<Array<{ dono: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${'geracao:' + activityId}, 0)) AS dono`;
      if (!lock[0]?.dono) return null;

      const candidatos = await tx.generationJob.findMany({
        where: { escolaId, activityId, tipo, status: 'pendente' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true, tipo: true, tentativa: true, payload: true },
      });

      for (const candidato of candidatos) {
        const { count } = await tx.generationJob.updateMany({
          where: { id: candidato.id, escolaId, status: 'pendente' },
          data: { status: 'rodando' },
        });
        if (count === 1) return candidato;
      }
      return null;
    }, escolaId);
  }

  private async executarComRetentativa(
    escolaId: string,
    job: Job,
    tarefa: () => Promise<void>,
    aoDesistir?: () => Promise<void>,
  ): Promise<void> {
    const atualizarJob = (data: Prisma.GenerationJobUpdateManyMutationInput) =>
      this.deps.prisma.comTenancy(
        (tx) => tx.generationJob.updateMany({ where: { id: job.id, escolaId }, data }),
        escolaId,
      );

    try {
      await tarefa();
      await atualizarJob({ status: 'ok', erro: null });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message.slice(0, 500) : 'erro desconhecido';
      const tentativa = job.tentativa + 1;

      if (tentativa < MAX_TENTATIVAS) {
        await atualizarJob({ status: 'pendente', tentativa, erro: mensagem });
        return;
      }

      await atualizarJob({ status: 'erro', tentativa, erro: mensagem });

      // A desistência não pode derrubar o pool (ex.: post apagado no meio da fila).
      if (aoDesistir) {
        try {
          await aoDesistir();
        } catch (falhaAoDesistir) {
          console.error('[worker] aoDesistir', job.id, falhaAoDesistir);
        }
      }
    }
  }

  // ------------------------------------------------------------------ etapas

  private async carregarAtividade(escolaId: string, activityId: string) {
    const atividade = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.activity.findFirstOrThrow({
          where: { id: activityId, escolaId },
          select: {
            id: true,
            disciplina: true,
            temaGeral: true,
            recorte: true,
            contextoAula: true,
            estiloVisual: true,
            categoriasNeutras: true,
            antagonismo: true,
          },
        }),
      escolaId,
    );

    const antagonismo: Antagonismo = antagonismoSchema.parse(atividade.antagonismo);
    return { ...atividade, antagonismo };
  }

  private async processarPersonas(escolaId: string, activityId: string): Promise<void> {
    const atividade = await this.carregarAtividade(escolaId, activityId);

    const personas = await gerarPersonas(this.deps.provider, {
      antagonismo: atividade.antagonismo,
      disciplina: atividade.disciplina,
      recorte: atividade.recorte,
      categoriasNeutras: atividade.categoriasNeutras,
    });

    await this.deps.prisma.comTenancy(
      (tx) =>
        tx.author.createMany({
          data: personas.map((persona) => ({
            escolaId,
            activityId,
            handle: persona.handle,
            displayName: persona.display_name,
            tipo: persona.tipo,
            lado: persona.lado,
            perfilAfim: persona.perfil_afim,
            bio: persona.bio,
            voz: persona.voz,
            verificado: sorteiaVerificado(),
          })),
          skipDuplicates: true,
        }),
      escolaId,
    );
  }

  private async processarLote(
    escolaId: string,
    activityId: string,
    spec: LoteSpecPayload,
  ): Promise<void> {
    const atividade = await this.carregarAtividade(escolaId, activityId);

    // Autores do lado do lote (neutros escrevem os neutros).
    const autores = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.author.findMany({
          where: { escolaId, activityId, lado: spec.lado },
          select: { id: true, handle: true, displayName: true, tipo: true, voz: true, perfilAfim: true },
        }),
      escolaId,
    );
    if (autores.length === 0) throw new Error(`sem autores do lado ${spec.lado}`);

    /**
     * Prioriza os autores cujo `perfilAfim` bate com o perfil do lote: a voz da
     * persona precisa combinar com a ficha de linguagem, senão o texto sai com
     * duas personalidades. Se não houver nenhum (base antiga, sem `perfilAfim`),
     * cai para todos os autores do lado — a geração não pode travar por isso.
     */
    const afins = autores.filter((autor) => autor.perfilAfim === spec.perfil);

    /**
     * Neutro DENTRO do tema precisa de autor com cara de quem publica fato: uma
     * página de lanches escrevendo sobre a carta de Caminha destrói a
     * verossimiliança que a regra de ouro 2 exige. Por isso o filtro extra por
     * `tipo` — e o fallback, porque base antiga pode não ter esses perfis.
     */
    const deFato = (lista: typeof autores) =>
      lista.filter((autor) => autor.tipo === 'checagem' || autor.tipo === 'pagina_tema');

    const ehNeutroNoTema = spec.lado === 'neutro' && spec.categoria === 'tema';
    const preferidos = ehNeutroNoTema
      ? [deFato(afins), deFato(autores), afins, autores]
      : [afins, autores];

    const escolhidos = preferidos.find((lista) => lista.length >= 2) ?? autores;

    const disponiveis: AutorDisponivel[] = escolhidos.map((autor) => ({
      handle: autor.handle,
      displayName: autor.displayName,
      tipo: autor.tipo,
      voz: autor.voz,
    }));

    const gerados = await gerarLotePosts(this.deps.provider, {
      spec,
      antagonismo: atividade.antagonismo,
      disciplina: atividade.disciplina,
      recorte: atividade.recorte,
      contextoAula: atividade.contextoAula,
      autores: disponiveis,
    });

    const handles = disponiveis.map((autor) => autor.handle);
    const idPorHandle = new Map(autores.map((autor) => [autor.handle, autor.id]));

    const aprovados = gerados.filter((post) => validarPost(post, handles).ok);

    const posts = aprovados.map((post) => {
      const id = randomUUID();
      return {
        id,
        dados: {
          id,
          escolaId,
          activityId,
          authorId: idPorHandle.get(post.author_handle)!,
          lado: spec.lado,
          /**
           * O perfil vem do LOTE: o prompt daquele lote carregou a ficha de
           * linguagem desse perfil (doc 05 §3), então o rótulo descreve de fato
           * como o texto foi escrito. Um lote nunca mistura perfis.
           */
          perfil: spec.perfil,
          intensidade: spec.intensidade,
          categoria: spec.categoria,
          formato: 'feed',
          caption: post.caption,
          hashtags: post.hashtags.map(normalizarHashtag),
          emotionalHook: post.emotional_hook,
          imageBrief: post.image_brief,
          imageStatus: 'pendente',
          likesCount: likesDoPost(spec.lado, spec.intensidade),
          timestampLabel: rotuloDeTempo(spec.intensidade, spec.lado),
        },
        comentarios: post.comments,
      };
    });

    if (posts.length > 0) {
      const comentarios = posts.flatMap((post) => {
        const likes = likesDosComentarios(post.comentarios.length);
        return post.comentarios.map((comentario, ordem) => ({
          escolaId,
          postId: post.id,
          handle: normalizarHandle(comentario.handle, ordem),
          texto: comentario.texto,
          // `?? 0`: `likes` tem exatamente `comentarios.length` posições.
          likesCount: likes[ordem] ?? 0,
          ordem,
          timestampLabel: rotuloDeTempoComentario(),
        }));
      });

      await this.deps.prisma.comTenancy(async (tx) => {
        await tx.post.createMany({ data: posts.map((post) => post.dados) });
        await tx.postComment.createMany({ data: comentarios });
        await tx.generationJob.createMany({
          data: posts.map((post) => ({
            escolaId,
            activityId,
            tipo: 'imagem',
            payload: { postId: post.id, imageBrief: post.dados.imageBrief },
          })),
        });
        // Regeneração de texto: o post antigo só sai depois que o novo entrou.
        if (spec.substituiPostId) {
          await tx.post.deleteMany({ where: { id: spec.substituiPostId, activityId, escolaId } });
        }
      }, escolaId);
    }

    // Reposição do que a validação reprovou (uma única vez por lote).
    const faltando = spec.quantidade - posts.length;
    if (faltando > 0 && !spec.reposicao) {
      await this.deps.prisma.comTenancy(
        (tx) =>
          tx.generationJob.create({
            data: {
              escolaId,
              activityId,
              tipo: 'posts_lote',
              payload: { ...spec, quantidade: faltando, reposicao: true } as unknown as Prisma.InputJsonValue,
            },
          }),
        escolaId,
      );
    }
  }

  private async processarImagem(escolaId: string, activityId: string, postId: string): Promise<void> {
    const post = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.post.findFirst({
          where: { id: postId, escolaId },
          select: { imageBrief: true, imageStatus: true, activity: { select: { estiloVisual: true } } },
        }),
      escolaId,
    );
    if (!post) throw new Error('post não encontrado');
    if (post.imageStatus === 'ok') return;

    // Origem: gerarEGravarImagem (bytes + webp + fs). Aqui o provider gera os
    // bytes e o AssetsService converte/publica e devolve a URL pública ABSOLUTA.
    const bytes = await this.deps.provider.generateImage(
      promptDeImagem(post.activity.estiloVisual, post.imageBrief),
    );
    const url = await this.deps.assets.salvarImagemDePost({ escolaId, activityId, postId, bytes });

    await this.deps.prisma.comTenancy(
      (tx) =>
        tx.post.updateMany({
          where: { id: postId, escolaId },
          data: { imageUrl: url, imageStatus: 'ok' },
        }),
      escolaId,
    );
  }

  /** Fallback obrigatório: o feed nunca quebra por falta de imagem (doc 05). */
  private async marcarImagemComoFallback(escolaId: string, postId: string): Promise<void> {
    await this.deps.prisma.comTenancy(
      (tx) =>
        tx.post.updateMany({
          where: { id: postId, escolaId },
          data: { imageStatus: 'fallback', imageUrl: null },
        }),
      escolaId,
    );
  }

  private async rodarValidacaoFinal(escolaId: string, activityId: string): Promise<void> {
    // Mesmo padrão dos jobs de texto: null pode ser o lock com outro dono, e a
    // validação não pode ficar para trás por causa de um claim concorrente.
    let job = await this.reservarJob(escolaId, activityId, 'validacao');
    while (!job) {
      if ((await this.contarPendentes(escolaId, activityId, 'validacao')) === 0) return;
      await esperar(300);
      job = await this.reservarJob(escolaId, activityId, 'validacao');
    }

    await this.executarComRetentativa(escolaId, job, async () => {
      await this.deps.prisma.comTenancy(async (tx) => {
        // Sem imagem pendente órfã: o que não virou imagem vira fallback.
        await tx.post.updateMany({
          where: { escolaId, activityId, imageStatus: 'pendente' },
          data: { imageStatus: 'fallback' },
        });

        /**
         * Doc 05 etapa 4. Mudou de "as proporções fecham?" para "a MATRIZ fecha?":
         * o que importa agora é cada célula (lado, perfil) ter conteúdo, porque uma
         * célula vazia significa que aquele estudante nunca receberia a linguagem que
         * mais fala com ele. O desvio fica registrado no job, para o professor ver
         * na revisão em vez de descobrir no feed.
         */
        const atividade = await tx.activity.findFirstOrThrow({
          where: { id: activityId, escolaId },
          select: { qtdPostsTese: true, proporcoes: true },
        });

        const porLado = await tx.post.groupBy({
          by: ['lado'],
          where: { escolaId, activityId },
          _count: { _all: true },
        });
        const porCelula = await tx.post.groupBy({
          by: ['lado', 'perfil'],
          where: { escolaId, activityId, lado: { in: ['A', 'B'] } },
          _count: { _all: true },
        });

        const total = porLado.reduce((soma, linha) => soma + linha._count._all, 0);
        const desvios: string[] = [];

        // Eixo A/B: 50/50 por construção (doc 05 §2), tolerância de 5 pontos.
        const contagem = (lado: string) =>
          porLado.find((linha) => linha.lado === lado)?._count._all ?? 0;
        const tese = contagem('A') + contagem('B');
        if (tese > 0) {
          const fracaoA = contagem('A') / tese;
          if (Math.abs(fracaoA - 0.5) > 0.05) {
            desvios.push(`equilíbrio A/B: ${Math.round(fracaoA * 100)}% do lado A (esperado 50%)`);
          }
        }

        // Cobertura da matriz: 8 células (2 lados × 4 perfis), mínimo de 90%.
        const esperadoPorCelula = Math.floor(atividade.qtdPostsTese / DIVISOR_TESE);
        for (const lado of ['A', 'B'] as const) {
          for (const perfil of PERFIS) {
            const obtido =
              porCelula.find((linha) => linha.lado === lado && linha.perfil === perfil)?._count
                ._all ?? 0;
            if (obtido === 0) {
              desvios.push(`célula VAZIA: lado ${lado} / ${perfil}`);
            } else if (obtido < esperadoPorCelula * 0.9) {
              desvios.push(`célula rasa: ${lado}/${perfil} com ${obtido} de ${esperadoPorCelula}`);
            }
          }
        }

        const alvoTotal = atividade.qtdPostsTese + totalDeNeutros(
          atividade.qtdPostsTese,
          (atividade.proporcoes as unknown as Proporcoes).neutros,
        );
        if (Math.abs(total - alvoTotal) > Math.ceil(alvoTotal * 0.1)) {
          desvios.push(`total: ${total} posts (alvo ${alvoTotal})`);
        }

        if (desvios.length > 0) {
          await tx.generationJob.updateMany({
            where: { id: job.id, escolaId },
            data: { erro: `proporções fora do alvo — ${desvios.join(' · ')}` },
          });
        }

        await tx.activity.updateMany({
          where: { id: activityId, escolaId },
          data: { status: 'revisao' },
        });
      }, escolaId);
    });
  }
}

// ------------------------------------------------------------------ pool

type Job = { id: string; tipo: string; tentativa: number; payload: unknown };

/** Roda `tarefa` em até `n` trabalhadores; devolve true se algo foi processado. */
async function poolDeTrabalhadores(n: number, tarefa: () => Promise<boolean>): Promise<boolean> {
  let processouAlgo = false;

  await Promise.all(
    Array.from({ length: n }, async () => {
      for (;;) {
        const processou = await tarefa();
        if (!processou) return;
        processouAlgo = true;
      }
    }),
  );

  return processouAlgo;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------------------ helpers

function normalizarHashtag(bruta: string): string {
  const limpa = bruta
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  return `#${limpa}`;
}

function normalizarHandle(bruto: string | undefined, ordem: number): string {
  const base = (bruto ?? '').trim().replace(/^@+/, '').replace(/\s+/g, '.').toLowerCase();
  if (base.length >= 3) return `@${base}`;
  return `@perfil.${ordem + 1}${Math.floor(Math.random() * 90 + 10)}`;
}
