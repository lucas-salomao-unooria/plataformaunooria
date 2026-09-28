import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { AssetsService } from "../assets/assets.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { EXP_ID, ASelecaoService } from "./a-selecao.service";
import { erroDeJogo } from "./erros";
import {
  CUSTO_ESTIMADO_POR_TRECHO,
  DIRECAO_DO_PODCAST,
  FALANTES_DO_PODCAST,
  nomeDoEpisodio,
  nomeDoTrecho,
  roteiroDoPodcast,
  type BlocoDoPodcast,
  type TrechoDoRoteiro,
} from "./podcast";
import { concatenarMp3 } from "./regras/mp3";

/**
 * O PODCAST de recapitulação: gerado pelo professor, servido ao professor.
 *
 * Molde: `midia.service.ts` (as imagens) — o preparo idempotente, o custo
 * estimado, a trava de processo e o incremento por chamada. Com duas
 * diferenças que o áudio impôs:
 *
 * - **Um TRECHO por chamada.** O episódio tem cinco blocos e cerca de 3m45s; a
 *   síntese de tudo de uma vez não cabe nos 30 s que o BFF do hub dá a uma
 *   chamada. Cada `POST gerar-podcast` sintetiza o próximo bloco que falta (o
 *   maior tem ~75 s de fala), e o cliente repete até `completo`.
 * - **Os trechos se EMENDAM num arquivo.** Quando os cinco existem, a mesma
 *   chamada lê os cinco do bucket, emenda (`regras/mp3.ts`) e grava o episódio:
 *   é um `src` só para o player, e um arquivo que a professora baixa e toca na
 *   sala sem internet.
 *
 * **Os blocos fixos saem uma vez por CONTRATO.** O nome de cada trecho é o hash
 * do texto e do pedido de voz (`podcast.ts#nomeDoTrecho`): os Blocos 1, 3, 4 e 5
 * são iguais em toda turma, e só o Bloco 2 de um tema da IA custa uma síntese
 * nova. O arquivo que já está no bucket entra de graça.
 *
 * Sem áudio, nada quebra: o roteiro inteiro é a transcrição, e ela está sempre
 * na tela. O mock falha fechado (`ai/AGENTS.md`), então em dev e na e2e o
 * caminho que roda é o da transcrição com o botão desabilitado.
 */

/** Preparos em andamento NESTE processo, por episódio: duas abas não sintetizam o mesmo trecho duas vezes. */
const emPreparo = new Map<string, Promise<ProgressoDoPodcast>>();

export interface EstadoDoPodcast {
  coberturaId: string;
  tema: string;
  roteiro: TrechoDoRoteiro[];
  trechos: { total: number; prontos: number };
  url: string | null;
}

export interface ProgressoDoPodcast extends EstadoDoPodcast {
  gerado: BlocoDoPodcast | null;
  falhou: BlocoDoPodcast | null;
  completo: boolean;
}

@Injectable()
export class PodcastDaExp07ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
    private readonly quota: QuotaService,
    private readonly selecao: ASelecaoService,
  ) {}

  /** O roteiro e o estado do áudio da cobertura em andamento. NÃO gera nada. */
  async estado(escolaId: string, turmaId: string, professorId?: string): Promise<EstadoDoPodcast> {
    const cobertura = await this.selecao.coberturaParaMidia(escolaId, turmaId, professorId);
    const roteiro = roteiroDoPodcast(cobertura.podcast);
    const prontos = await this.trechosProntos(roteiro);
    return {
      coberturaId: cobertura.id,
      tema: cobertura.tema,
      roteiro,
      trechos: { total: roteiro.length, prontos: prontos.filter(Boolean).length },
      url: await this.urlDoEpisodio(roteiro),
    };
  }

  /**
   * Sintetiza o próximo trecho que falta e, com os cinco prontos, emenda o
   * episódio. Idempotente: com tudo pronto, a chamada só devolve a URL.
   */
  async gerar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    usuarioId: string,
    perfil: Perfil,
  ): Promise<ProgressoDoPodcast> {
    const cobertura = await this.selecao.coberturaParaMidia(escolaId, turmaId, professorId);
    const roteiro = roteiroDoPodcast(cobertura.podcast);
    const chave = nomeDoEpisodio(roteiro);
    const emCurso = emPreparo.get(chave);
    if (emCurso) return { ...(await emCurso), coberturaId: cobertura.id, tema: cobertura.tema };

    const trabalho = this.gerarDeVerdade(escolaId, usuarioId, perfil, cobertura.id, cobertura.tema, roteiro).finally(
      () => {
        emPreparo.delete(chave);
      },
    );
    emPreparo.set(chave, trabalho);
    return trabalho;
  }

  private async gerarDeVerdade(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    coberturaId: string,
    tema: string,
    roteiro: TrechoDoRoteiro[],
  ): Promise<ProgressoDoPodcast> {
    const prontos = await this.trechosProntos(roteiro);
    let url = await this.urlDoEpisodio(roteiro);
    let gerado: BlocoDoPodcast | null = null;
    let falhou: BlocoDoPodcast | null = null;

    const indice = prontos.indexOf(false);
    if (url === null && indice >= 0) {
      if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) throw erroDeJogo("sem-saldo-de-ia");
      const trecho = roteiro[indice] as TrechoDoRoteiro;
      try {
        const bytes = await this.ia.generateSpeech({
          turnos: trecho.falas.map((f) => ({ falante: f.falante, texto: f.texto })),
          falantes: FALANTES_DO_PODCAST,
          direcao: DIRECAO_DO_PODCAST,
          idioma: "pt-BR",
        });
        await this.assets.salvarMidiaDeExperiencia({
          expId: EXP_ID,
          nome: nomeDoTrecho(trecho),
          bytes,
          contentType: "audio/mpeg",
        });
        await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_TRECHO);
        prontos[indice] = true;
        gerado = trecho.bloco;
      } catch {
        /* Sem `err` no log: a mensagem do provider pode carregar trecho do
           roteiro, e o Bloco 2 foi escrito pela professora. */
        logger.warn(
          { codigo: "exp07ef1b-podcast-trecho-falhou", escolaId, bloco: trecho.bloco },
          "trecho do podcast não sintetizado — a transcrição segue na tela",
        );
        falhou = trecho.bloco;
      }
    }

    if (url === null && prontos.every(Boolean)) url = await this.emendar(escolaId, roteiro);

    return {
      coberturaId,
      tema,
      roteiro,
      trechos: { total: roteiro.length, prontos: prontos.filter(Boolean).length },
      url,
      gerado,
      falhou,
      completo: url !== null,
    };
  }

  /**
   * Lê os cinco trechos do bucket, emenda e grava o episódio. Falha aqui não
   * perde trecho nenhum: a próxima chamada tenta emendar de novo, sem síntese.
   */
  private async emendar(escolaId: string, roteiro: TrechoDoRoteiro[]): Promise<string | null> {
    try {
      const partes = await Promise.all(
        roteiro.map((trecho) => this.assets.lerMidiaDeExperiencia(EXP_ID, nomeDoTrecho(trecho))),
      );
      return await this.assets.salvarMidiaDeExperiencia({
        expId: EXP_ID,
        nome: nomeDoEpisodio(roteiro),
        bytes: concatenarMp3(partes),
        contentType: "audio/mpeg",
      });
    } catch {
      logger.warn({ codigo: "exp07ef1b-podcast-emenda-falhou", escolaId }, "episódio do podcast não emendado");
      return null;
    }
  }

  private trechosProntos(roteiro: readonly TrechoDoRoteiro[]): Promise<boolean[]> {
    return Promise.all(roteiro.map((trecho) => this.assets.midiaDeExperienciaExiste(EXP_ID, nomeDoTrecho(trecho))));
  }

  private async urlDoEpisodio(roteiro: readonly TrechoDoRoteiro[]): Promise<string | null> {
    const nome = nomeDoEpisodio(roteiro);
    return (await this.assets.midiaDeExperienciaExiste(EXP_ID, nome))
      ? this.assets.urlDaMidiaDeExperiencia(EXP_ID, nome)
      : null;
  }
}
