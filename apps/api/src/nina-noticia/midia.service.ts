import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { AssetsService } from "../assets/assets.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { promptDaImagem } from "./conteudo";
import { erroDeJogo } from "./erros";
import {
  imagensDoPacote,
  itensDasCenasFixas,
  itensDoPacote,
  nomeDaImagem,
  type ChaveDaMidia,
} from "./regras/imagens";
import { NinaNoticiaService } from "./nina-noticia.service";
import { CHAVES_DAS_IMAGENS, EXP_ID, type ChaveDaImagem } from "./vocabulario";

/**
 * As IMAGENS do pacote — as três cenas das reportagens e o cartaz — geradas
 * pela professora no preparo (E0-PROF-04), servidas a todos. Molde:
 * `juri-estadual/midia.service.ts` — INCREMENTAL, idempotente, com o custo
 * estimado e o `falharam[]`.
 *
 * - **O arquivo é o hash do PEDIDO** (`regras/imagens.ts#nomeDaImagem`): o que
 *   já está no bucket entra DE GRAÇA. As CENAS FIXAS (o caso novo e o Desafio
 *   Extra) são do banco, geradas pelo `admin`: aqui só entram se já existirem.
 * - **A professora VÊ e APROVA as imagens antes da turma** (ADR-146): gerar e
 *   refazer só valem com `imagens_aprovadas_em` nulo
 *   (`NinaNoticiaService.pacoteParaMidia`, 409 `imagens-ja-aprovadas`). A tela
 *   destaca a do TELÃO ("confira se o pátio aparece"): o prompt dela exige o
 *   pátio (`conteudo.ts#EXIGENCIA_DO_SUPORTE`), e K1 depende disso.
 * - **Sem imagem a missão roda igual**: `imagem.url: null`, e a experiência
 *   desenha a ilustração SVG local.
 */

/** Todas as quatro do pacote cabem numa chamada: saem em paralelo, ~10 s. */
export const IMAGENS_POR_CHAMADA = 4;

/** Custo estimado por imagem, em tokens: a geração não devolve contagem, e debitar zero faria a quota mentir. */
export const CUSTO_ESTIMADO_POR_IMAGEM = 2_000;

/** 800×600 (4:3), a foto da reportagem. */
export const TAMANHO_DA_IMAGEM = { largura: 800, altura: 600 } as const;

export interface ProgressoDaMidia {
  pacoteId: string;
  total: number;
  prontas: number;
  faltam: number;
  geradas: ChaveDaImagem[];
  falharam: ChaveDaImagem[];
  completo: boolean;
  imagens: Partial<Record<ChaveDaImagem, string>>;
}

export interface ImagemRefeita {
  pacoteId: string;
  chave: ChaveDaImagem;
  url: string;
}

/** Preparos em andamento NESTE processo, por pacote: dois cliques não geram a mesma imagem duas vezes. */
const emPreparo = new Map<string, Promise<ProgressoDaMidia>>();
/** As regerações em andamento, por pacote e chave. */
const refazendo = new Map<string, Promise<ImagemRefeita>>();

@Injectable()
export class MidiaDaExp03ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
    private readonly quota: QuotaService,
    private readonly missao: NinaNoticiaService,
  ) {}

  /** Gera as que faltam no pacote (até `IMAGENS_POR_CHAMADA`) e devolve o progresso. */
  async gerar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    usuarioId: string,
    perfil: Perfil,
    pacoteId?: string,
  ): Promise<ProgressoDaMidia> {
    const pacote = await this.missao.pacoteParaMidia(escolaId, turmaId, professorId, pacoteId);
    const emCurso = emPreparo.get(pacote.id);
    if (emCurso) return emCurso;
    const trabalho = this.gerarDeVerdade(escolaId, usuarioId, perfil, pacote).finally(() => emPreparo.delete(pacote.id));
    emPreparo.set(pacote.id, trabalho);
    return trabalho;
  }

  /**
   * "Refazer imagem": uma imagem nova para UMA chave, SEMPRE paga, num arquivo
   * novo (a variação entra no nome). A falha do provedor é 503 e a reportagem
   * fica com a imagem que tinha.
   */
  async refazer(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    usuarioId: string,
    perfil: Perfil,
    pacoteId: string,
    chave: ChaveDaImagem,
  ): Promise<ImagemRefeita> {
    const pacote = await this.missao.pacoteParaMidia(escolaId, turmaId, professorId, pacoteId);
    const trava = `${pacote.id}:${chave}`;
    const emCurso = refazendo.get(trava);
    if (emCurso) return emCurso;
    const trabalho = (async () => {
      if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) throw erroDeJogo("sem-saldo-de-ia");
      const prompt = promptDaImagem(chave, pacote.conteudo);
      let bytes: Buffer;
      try {
        bytes = await this.ia.generateImage(prompt, { proporcao: "4:3" });
      } catch {
        logger.warn({ codigo: "exp03ef1b-midia-falhou", escolaId, chave }, "imagem não refeita — segue a que tinha");
        throw erroDeJogo("ia-indisponivel");
      }
      const url = await this.assets.salvarMidiaDeExperiencia({
        expId: EXP_ID,
        nome: nomeDaImagem(prompt, randomUUID()),
        bytes,
        contentType: "image/webp",
        imagem: { ...TAMANHO_DA_IMAGEM },
      });
      await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_IMAGEM);
      await this.missao.registrarMidia(escolaId, pacote.id, chave, url);
      return { pacoteId: pacote.id, chave, url };
    })().finally(() => refazendo.delete(trava));
    refazendo.set(trava, trabalho);
    return trabalho;
  }

  private async gerarDeVerdade(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    pacote: Awaited<ReturnType<NinaNoticiaService["pacoteParaMidia"]>>,
  ): Promise<ProgressoDaMidia> {
    const midia: Partial<Record<ChaveDaMidia, string>> = { ...pacote.midia };

    /* As cenas fixas do banco: de graça, se o `admin` já as gerou. Nunca pagas aqui. */
    for (const item of itensDasCenasFixas()) {
      if (midia[item.chave]) continue;
      if (await this.assets.midiaDeExperienciaExiste(EXP_ID, item.nome)) {
        const url = this.assets.urlDaMidiaDeExperiencia(EXP_ID, item.nome);
        await this.missao.registrarMidia(escolaId, pacote.id, item.chave, url);
        midia[item.chave] = url;
      }
    }

    const pendentes = itensDoPacote(pacote.conteudo).filter((i) => !midia[i.chave]);
    const geradas: ChaveDaImagem[] = [];
    const falharam: ChaveDaImagem[] = [];
    const novas: typeof pendentes = [];
    for (const item of pendentes) {
      if (await this.assets.midiaDeExperienciaExiste(EXP_ID, item.nome)) {
        const url = this.assets.urlDaMidiaDeExperiencia(EXP_ID, item.nome);
        await this.missao.registrarMidia(escolaId, pacote.id, item.chave, url);
        midia[item.chave] = url;
        geradas.push(item.chave as ChaveDaImagem);
      } else if (novas.length < IMAGENS_POR_CHAMADA) {
        novas.push(item);
      }
    }

    if (novas.length > 0 && !(await this.quota.temSaldo(escolaId, usuarioId, perfil))) throw erroDeJogo("sem-saldo-de-ia");

    const resultados = await Promise.allSettled(
      novas.map(async (item) => {
        const bytes = await this.ia.generateImage(item.prompt, { proporcao: "4:3" });
        const url = await this.assets.salvarMidiaDeExperiencia({
          expId: EXP_ID,
          nome: item.nome,
          bytes,
          contentType: "image/webp",
          imagem: { ...TAMANHO_DA_IMAGEM },
        });
        await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_IMAGEM);
        await this.missao.registrarMidia(escolaId, pacote.id, item.chave, url);
        return url;
      }),
    );
    resultados.forEach((r, k) => {
      const item = novas[k]!;
      const chave = item.chave as ChaveDaImagem;
      if (r.status === "fulfilled") {
        midia[chave] = r.value;
        geradas.push(chave);
      } else {
        /* Sem `err` no log: a mensagem do provider pode carregar trecho do pedido. */
        logger.warn({ codigo: "exp03ef1b-midia-falhou", escolaId, chave }, "imagem não gerada — segue a ilustração local");
        falharam.push(chave);
      }
    });

    const prontas = CHAVES_DAS_IMAGENS.filter((c) => midia[c]).length;
    return {
      pacoteId: pacote.id,
      total: CHAVES_DAS_IMAGENS.length,
      prontas,
      faltam: CHAVES_DAS_IMAGENS.length - prontas,
      geradas,
      falharam,
      completo: prontas === CHAVES_DAS_IMAGENS.length,
      imagens: imagensDoPacote(midia),
    };
  }
}
