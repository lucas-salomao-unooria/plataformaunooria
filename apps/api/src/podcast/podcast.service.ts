import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { AssetsService } from "../assets/assets.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import { erroDoPodcast } from "./erros";
import type { AtividadeDoPodcast, FonteDoPodcast } from "./fonte";
import { concatenarMp3 } from "./mp3";
import {
  falasGravadas,
  nomeDoEpisodio,
  nomeDoTrecho,
  type FalasDoTema,
  type TrechoDoRoteiro,
} from "./roteiro";

/**
 * O PODCAST DE RECAPITULAÇÃO de toda missão (ADR-150): gerado pelo
 * professor, servido ao professor. Nasceu na A Seleção (ADR-119) e virou
 * recurso da plataforma quando o 4º e o 5º ano o ganharam — cada missão só
 * registra a sua `FonteDoPodcast`.
 *
 * Duas coisas que o áudio impôs:
 *
 * - **Um TRECHO por chamada.** O episódio tem cinco blocos e cerca de 3m30s a
 *   3m45s; a síntese de tudo de uma vez não cabe no teto que o BFF do hub dá a
 *   uma chamada. Cada `POST gerar` sintetiza o próximo bloco que falta, e o
 *   cliente repete até `completo`.
 * - **Os trechos se EMENDAM num arquivo.** Com todos prontos, a mesma chamada
 *   lê os trechos do bucket, emenda (`mp3.ts`) e grava o episódio: um `src` só
 *   para o player, e um arquivo que o professor baixa e toca sem internet.
 *
 * **Os blocos fixos saem uma vez por CONTRATO.** O nome de cada trecho é o
 * hash do texto e do pedido de voz (`roteiro.ts#nomeDoTrecho`): o bloco sem
 * vaga é igual em toda turma, e só o bloco com uma fala reescrita custa
 * síntese nova.
 *
 * Sem áudio, nada quebra: o roteiro inteiro é a transcrição, e ela está sempre
 * na tela. O mock falha fechado (`ai/AGENTS.md`).
 */

export interface EstadoDoPodcast {
  atividadeId: string;
  tema: string;
  titulo: string;
  descricao: string;
  roteiro: TrechoDoRoteiro[];
  trechos: { total: number; prontos: number };
  url: string | null;
}

export interface ProgressoDoPodcast extends EstadoDoPodcast {
  gerado: string | null;
  falhou: string | null;
  completo: boolean;
}

/** Custo estimado por trecho, em tokens (a síntese é cobrada por caractere e não devolve contagem). */
export const CUSTO_ESTIMADO_POR_TRECHO = 3_000;

/** Preparos em andamento NESTE processo, por episódio: duas abas não sintetizam o mesmo trecho duas vezes. */
const emPreparo = new Map<string, Promise<ProgressoDoPodcast>>();

/**
 * Grava as falas APROVADAS de uma atividade, dentro da transação da
 * homologação da missão (o `tx` dela já tem a escola no contexto da RLS).
 * Aprovar de novo a mesma atividade — o segundo clique em "Criar atividade" —
 * substitui. As falas chegam validadas pelo Zod da homologação
 * (`falasDoTemaSchema` com as vagas da missão).
 *
 * Função livre sobre o `tx`, e não método do serviço — o desenho de
 * `equipes/consulta.ts`: a missão chama da transação dela sem injetar nada.
 */
export async function gravarFalasDoPodcast(
  tx: Prisma.TransactionClient,
  linha: { escolaId: string; expId: string; atividadeId: string; falas: FalasDoTema; aprovadoPor: string },
): Promise<void> {
  const falas = Object.fromEntries(Object.entries(linha.falas).map(([vaga, texto]) => [vaga, texto.trim()]));
  const dados = { falas, aprovadoPor: linha.aprovadoPor, aprovadoEm: new Date() };
  await tx.podcastRoteiro.upsert({
    where: {
      escolaId_expId_atividadeId: { escolaId: linha.escolaId, expId: linha.expId, atividadeId: linha.atividadeId },
    },
    create: { escolaId: linha.escolaId, expId: linha.expId, atividadeId: linha.atividadeId, ...dados },
    update: dados,
  });
}

@Injectable()
export class PodcastService {
  private readonly fontes = new Map<string, FonteDoPodcast>();

  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
    private readonly quota: QuotaService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * O gancho da missão, chamado na subida (`onModuleInit`). Registrar de novo
   * substitui — é o que o teste faz.
   */
  registrarFonte(fonte: FonteDoPodcast): void {
    this.fontes.set(fonte.expId, fonte);
  }

  /** A fonte da missão, ou 404 — `:expId` é parâmetro de rota, e qualquer texto chega aqui. */
  fonte(expId: string): FonteDoPodcast {
    const fonte = this.fontes.get(expId);
    if (!fonte) throw erroDoPodcast("experiencia-sem-podcast");
    return fonte;
  }

  /** O roteiro e o estado do áudio da atividade pedida, ou da em andamento sem pedido. NÃO gera nada. */
  async estado(
    expId: string,
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    atividadeId: string | undefined,
  ): Promise<EstadoDoPodcast> {
    const fonte = this.fonte(expId);
    const atividade = await fonte.atividade(escolaId, turmaId, professorId, atividadeId);
    const roteiro = fonte.roteiro(await this.falasDa(fonte, escolaId, atividade));
    const prontos = await this.trechosProntos(fonte, roteiro);
    return {
      ...this.cabecalho(fonte, atividade),
      roteiro,
      trechos: { total: roteiro.length, prontos: prontos.filter(Boolean).length },
      url: await this.urlDoEpisodio(fonte, roteiro),
    };
  }

  /**
   * Sintetiza o próximo trecho que falta e, com todos prontos, emenda o
   * episódio. Idempotente: com tudo pronto, a chamada só devolve a URL.
   */
  async gerar(
    expId: string,
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    usuarioId: string,
    perfil: Perfil,
    atividadeId: string | undefined,
  ): Promise<ProgressoDoPodcast> {
    const fonte = this.fonte(expId);
    const atividade = await fonte.atividade(escolaId, turmaId, professorId, atividadeId);
    const roteiro = fonte.roteiro(await this.falasDa(fonte, escolaId, atividade));
    const chave = nomeDoEpisodio(fonte.voz, roteiro);
    const emCurso = emPreparo.get(chave);
    if (emCurso) return { ...(await emCurso), ...this.cabecalho(fonte, atividade) };

    const trabalho = this.gerarDeVerdade(fonte, escolaId, usuarioId, perfil, atividade, roteiro).finally(() => {
      emPreparo.delete(chave);
    });
    emPreparo.set(chave, trabalho);
    return trabalho;
  }

  /**
   * As falas do tema da atividade: as da própria missão (a A Seleção), as
   * aprovadas na tabela, ou as do sheet quando a atividade é o banco padrão.
   * Atividade da IA sem linha foi criada antes do podcast: não há o que tocar.
   */
  private async falasDa(fonte: FonteDoPodcast, escolaId: string, atividade: AtividadeDoPodcast): Promise<FalasDoTema> {
    if (atividade.falasProprias) return atividade.falasProprias;
    const linha = await this.prisma.comTenancy(
      (tx) =>
        tx.podcastRoteiro.findUnique({
          where: { escolaId_expId_atividadeId: { escolaId, expId: fonte.expId, atividadeId: atividade.id } },
          select: { falas: true },
        }),
      escolaId,
    );
    if (linha) {
      const falas = falasGravadas(fonte.vagas, linha.falas);
      if (falas) return falas;
      logger.warn(
        { codigo: "podcast-falas-invalidas", expId: fonte.expId, escolaId, atividadeId: atividade.id },
        "falas do podcast com forma inesperada",
      );
    }
    if (atividade.padrao) return { ...fonte.falasPadrao };
    throw erroDoPodcast("roteiro-indisponivel");
  }

  private cabecalho(fonte: FonteDoPodcast, atividade: AtividadeDoPodcast) {
    return { atividadeId: atividade.id, tema: atividade.tema, titulo: fonte.titulo, descricao: fonte.descricao };
  }

  private async gerarDeVerdade(
    fonte: FonteDoPodcast,
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    atividade: AtividadeDoPodcast,
    roteiro: TrechoDoRoteiro[],
  ): Promise<ProgressoDoPodcast> {
    const prontos = await this.trechosProntos(fonte, roteiro);
    let url = await this.urlDoEpisodio(fonte, roteiro);
    let gerado: string | null = null;
    let falhou: string | null = null;

    const indice = prontos.indexOf(false);
    if (url === null && indice >= 0) {
      if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) throw erroDoPodcast("sem-saldo-de-ia");
      const trecho = roteiro[indice] as TrechoDoRoteiro;
      try {
        const bytes = await this.ia.generateSpeech({
          turnos: trecho.falas.map((f) => ({ falante: f.falante, texto: f.texto })),
          falantes: fonte.falantes,
          direcao: fonte.voz.direcao,
          idioma: "pt-BR",
        });
        await this.assets.salvarMidiaDeExperiencia({
          expId: fonte.expId,
          nome: nomeDoTrecho(fonte.voz, trecho),
          bytes,
          contentType: "audio/mpeg",
        });
        await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_TRECHO);
        prontos[indice] = true;
        gerado = trecho.bloco;
      } catch {
        /* Sem `err` no log: a mensagem do provider pode carregar trecho do
           roteiro, e as falas do tema foram escritas pelo professor. */
        logger.warn(
          { codigo: "podcast-trecho-falhou", expId: fonte.expId, escolaId, bloco: trecho.bloco },
          "trecho do podcast não sintetizado — a transcrição segue na tela",
        );
        falhou = trecho.bloco;
      }
    }

    if (url === null && prontos.every(Boolean)) url = await this.emendar(fonte, escolaId, roteiro);

    return {
      ...this.cabecalho(fonte, atividade),
      roteiro,
      trechos: { total: roteiro.length, prontos: prontos.filter(Boolean).length },
      url,
      gerado,
      falhou,
      completo: url !== null,
    };
  }

  /**
   * Lê os trechos do bucket, emenda e grava o episódio. Falha aqui não perde
   * trecho nenhum: a próxima chamada tenta emendar de novo, sem síntese.
   */
  private async emendar(fonte: FonteDoPodcast, escolaId: string, roteiro: TrechoDoRoteiro[]): Promise<string | null> {
    try {
      const partes = await Promise.all(
        roteiro.map((trecho) => this.assets.lerMidiaDeExperiencia(fonte.expId, nomeDoTrecho(fonte.voz, trecho))),
      );
      return await this.assets.salvarMidiaDeExperiencia({
        expId: fonte.expId,
        nome: nomeDoEpisodio(fonte.voz, roteiro),
        bytes: concatenarMp3(partes),
        contentType: "audio/mpeg",
      });
    } catch {
      logger.warn({ codigo: "podcast-emenda-falhou", expId: fonte.expId, escolaId }, "episódio do podcast não emendado");
      return null;
    }
  }

  private trechosProntos(fonte: FonteDoPodcast, roteiro: readonly TrechoDoRoteiro[]): Promise<boolean[]> {
    return Promise.all(
      roteiro.map((trecho) => this.assets.midiaDeExperienciaExiste(fonte.expId, nomeDoTrecho(fonte.voz, trecho))),
    );
  }

  private async urlDoEpisodio(fonte: FonteDoPodcast, roteiro: readonly TrechoDoRoteiro[]): Promise<string | null> {
    const nome = nomeDoEpisodio(fonte.voz, roteiro);
    return (await this.assets.midiaDeExperienciaExiste(fonte.expId, nome))
      ? this.assets.urlDaMidiaDeExperiencia(fonte.expId, nome)
      : null;
  }
}
