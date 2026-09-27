import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { AssetsService } from "../assets/assets.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { erroDeJogo } from "./erros";
import { JornalEscolaService, noticiasQuePedemImagem, type PacoteLido } from "./jornal-escola.service";
import { VERSAO_DO_PEDIDO_DE_IMAGEM, promptDaImagem } from "./prompts";
import { EXP_ID, type IdDeNoticia } from "./vocabulario";

/**
 * As IMAGENS das notícias: geradas pelo professor no preparo, servidas a todos.
 *
 * Molde: `a-selecao/midia.service.ts` — INCREMENTAL (até duas novas por
 * chamada: o BFF do hub corta em 30 s), idempotente, com o custo estimado e o
 * `falharam[]`.
 *
 * **Sem imagem a missão roda igual**: a notícia chega com `imagem.url: null`, e
 * a experiência desenha o cartão pelo MEIO (e o `alt` é a descrição). As
 * notícias sem descrição (a mensagem, o blog do banco padrão) nem pedem imagem.
 *
 * **O arquivo é o hash da DESCRIÇÃO**, em `experiencias/exp04ef1b/jornal/` —
 * fora de `exp04ef1b/videos/`, onde o UnooTube arquivado deixou os vídeos dele
 * (ADR-116). A mesma cena gerada uma vez serve a todas as escolas do contrato
 * (o banco padrão é o mesmo para a rede inteira), e uma descrição editada pela
 * professora é outro arquivo.
 */

/** Quantas imagens NOVAS por chamada. Cada uma leva de 5 a 10 s; o BFF corta em 30. */
export const IMAGENS_POR_CHAMADA = 2;

/**
 * Custo estimado por imagem, em tokens: a geração de imagem é cobrada por
 * imagem e não devolve contagem, e debitar zero faria a quota mentir.
 */
export const CUSTO_ESTIMADO_POR_IMAGEM = 2_000;

/** 640×360 (16:9), o cabeçalho do cartão de notícia (brief §2.1). */
export const TAMANHO_DA_IMAGEM = { largura: 640, altura: 360 } as const;

/**
 * Preparos em andamento NESTE processo, por pacote: dois cliques do mesmo
 * professor (ou duas abas) não geram a mesma imagem duas vezes. Lock de
 * processo, e não `pg_advisory_lock`: segurar uma transação pelos segundos da
 * geração sairia mais caro que a corrida rara entre instâncias (o pior caso é
 * gerar duas vezes e sobrescrever com conteúdo equivalente).
 */
const emPreparo = new Map<string, Promise<ProgressoDaMidia>>();

export interface ProgressoDaMidia {
  pacoteId: string;
  total: number;
  prontas: number;
  faltam: number;
  geradas: IdDeNoticia[];
  falharam: IdDeNoticia[];
  completo: boolean;
  imagens: Record<string, string>;
}

/** O nome do arquivo no bucket, abaixo de `experiencias/exp04ef1b/`. */
export function nomeDaImagem(descricao: string): string {
  const hash = createHash("sha256").update(`${VERSAO_DO_PEDIDO_DE_IMAGEM}|${descricao.trim()}`).digest("hex");
  return `jornal/${hash.slice(0, 32)}.webp`;
}

@Injectable()
export class MidiaDaExp04ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
    private readonly quota: QuotaService,
    private readonly jornal: JornalEscolaService,
  ) {}

  /**
   * Gera as próximas imagens que faltam no pacote em andamento da turma.
   * Idempotente: o que já está no pacote é pulado, e o que já está no bucket
   * (a mesma descrição, noutra turma) entra DE GRAÇA, sem contar no lote.
   */
  async gerar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    usuarioId: string,
    perfil: Perfil,
  ): Promise<ProgressoDaMidia> {
    const pacote = await this.jornal.pacoteParaMidia(escolaId, turmaId, professorId);
    const emCurso = emPreparo.get(pacote.id);
    if (emCurso) return emCurso;

    const trabalho = this.gerarDeVerdade(escolaId, usuarioId, perfil, pacote).finally(() => {
      emPreparo.delete(pacote.id);
    });
    emPreparo.set(pacote.id, trabalho);
    return trabalho;
  }

  private async gerarDeVerdade(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    pacote: PacoteLido,
  ): Promise<ProgressoDaMidia> {
    const pedem = noticiasQuePedemImagem(pacote.noticias);
    const midia: Record<string, string> = {};
    for (const [id, url] of Object.entries(pacote.midia)) if (url) midia[id] = url;
    const pendentes = pedem.filter((n) => !midia[n.id]);

    if (pendentes.length > 0 && !(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      throw erroDeJogo("sem-saldo-de-ia");
    }

    const geradas: IdDeNoticia[] = [];
    const falharam: IdDeNoticia[] = [];
    let novas = 0;
    for (const noticia of pendentes) {
      if (novas >= IMAGENS_POR_CHAMADA) break;
      const descricao = noticia.descricaoImagem ?? "";
      const nome = nomeDaImagem(descricao);
      try {
        let url: string;
        if (await this.assets.midiaDeExperienciaExiste(EXP_ID, nome)) {
          url = this.assets.urlDaMidiaDeExperiencia(EXP_ID, nome);
        } else {
          novas += 1;
          const bytes = await this.ia.generateImage(promptDaImagem(descricao), { proporcao: "16:9" });
          url = await this.assets.salvarMidiaDeExperiencia({
            expId: EXP_ID,
            nome,
            bytes,
            contentType: "image/webp",
            imagem: { ...TAMANHO_DA_IMAGEM },
          });
          await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_IMAGEM);
        }
        await this.jornal.registrarMidia(escolaId, pacote.id, noticia.id, url);
        midia[noticia.id] = url;
        geradas.push(noticia.id);
      } catch {
        /* Sem `err` no log: a mensagem do provider pode carregar trecho do
           pedido, e o pedido carrega a descrição que a professora escreveu. */
        logger.warn(
          { codigo: "exp04ef1b-midia-falhou", escolaId, noticia: noticia.id },
          "imagem não gerada — o cartão segue desenhado pelo meio",
        );
        falharam.push(noticia.id);
      }
    }

    const prontas = pedem.filter((n) => midia[n.id]).length;
    return {
      pacoteId: pacote.id,
      total: pedem.length,
      prontas,
      faltam: pedem.length - prontas,
      geradas,
      falharam,
      completo: prontas === pedem.length,
      imagens: midia,
    };
  }
}
