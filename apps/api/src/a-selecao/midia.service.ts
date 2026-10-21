import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { AssetsService } from "../assets/assets.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { EXP_ID, ASelecaoService, postsQuePedemImagem } from "./a-selecao.service";
import type { IdDePost } from "./catalogo";
import { erroDeJogo } from "./erros";
import { VERSAO_DO_PEDIDO_DE_IMAGEM, promptDaImagem } from "./prompts";

/**
 * As IMAGENS dos posts: geradas pelo professor no preparo, servidas a todos.
 *
 * Molde: o `midia.service.ts` do Eco no Grupo (retirado pela ADR-113) — o
 * preparo idempotente, o `emPreparo`, o custo estimado e o `falharam[]`. Com
 * uma diferença que o BFF impôs: **o preparo é INCREMENTAL**. Doze imagens não
 * cabem nos 30 s que o BFF do hub dá a uma chamada; cada `POST gerar-midia`
 * gera ALGUMAS, grava as URLs na cobertura e devolve o progresso — e o cliente
 * repete enquanto `completo` for falso e a chamada anterior tiver andado.
 *
 * **Sem imagem a missão roda igual**: o post chega com `imagem.url: null`, e a
 * experiência desenha o card com a descrição (o `alt`), que já é a leitura
 * acessível do post. Os posts de métricas do banco curado nem pedem imagem: a
 * experiência desenha o gráfico a partir dos números do catálogo.
 *
 * **O arquivo é o hash da DESCRIÇÃO**, em `experiencias/exp07ef1b/selecao/`
 * (fora do prefixo que o Eco usava no bucket, para não colidir com a mídia
 * dele, que ainda está lá). Duas consequências boas: a mesma cena gerada uma
 * vez serve a todas as escolas do contrato (o banco curado é o mesmo para a
 * rede inteira), e uma descrição editada pela professora é outro arquivo — a
 * foto não fica dizendo o que o texto já não diz.
 */

/** Quantas imagens NOVAS por chamada. Cada uma leva de 5 a 10 s; o BFF corta em 30. */
export const IMAGENS_POR_CHAMADA = 2;

/**
 * Custo estimado por imagem, em tokens, para o orçamento não ficar cego: a
 * geração de imagem é cobrada por imagem e não devolve contagem. Debitar zero
 * faria a quota do professor mentir.
 */
export const CUSTO_ESTIMADO_POR_IMAGEM = 2_000;

/** O lado da imagem gravada — 600×600, o que o brief pede (§2.1, "1080 exportado em 600"). */
export const LADO_DA_IMAGEM = 600;

/**
 * Preparos em andamento NESTE processo, por cobertura: dois cliques do mesmo
 * professor (ou duas abas) não geram a mesma imagem duas vezes. Lock de
 * processo, e não `pg_advisory_lock`, pelo mesmo motivo do Eco: segurar uma
 * transação — e a conexão do pool — pelos segundos da geração sairia mais caro
 * que a corrida rara. Em duas instâncias, o pior caso é gerar duas vezes e
 * sobrescrever com conteúdo equivalente.
 */
const emPreparo = new Map<string, Promise<ProgressoDaMidia>>();

/** As regerações em andamento, por cobertura e post (o mesmo lock, um post por vez). */
const regerando = new Map<string, Promise<{ coberturaId: string; postId: IdDePost; url: string }>>();

export interface ProgressoDaMidia {
  coberturaId: string;
  total: number;
  prontas: number;
  faltam: number;
  geradas: IdDePost[];
  falharam: IdDePost[];
  completo: boolean;
  midia: Record<string, string>;
}

/**
 * O nome do arquivo no bucket, abaixo de `experiencias/exp07ef1b/`.
 *
 * `variacao` é a imagem REGERADA (ADR-146): o professor recusou a da
 * descrição, e a nova não pode cair no mesmo arquivo — sobrescrevê-lo trocaria
 * a imagem de toda cobertura que herdou aquela descrição, inclusive a que uma
 * turma está jogando. Sem variação, o nome continua sendo só o da descrição.
 */
export function nomeDaImagem(descricao: string, variacao?: string): string {
  const chave = [VERSAO_DO_PEDIDO_DE_IMAGEM, descricao.trim(), ...(variacao ? [variacao] : [])].join("|");
  const hash = createHash("sha256").update(chave).digest("hex");
  return `selecao/${hash.slice(0, 32)}.webp`;
}

@Injectable()
export class MidiaDaExp07ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
    private readonly quota: QuotaService,
    private readonly selecao: ASelecaoService,
  ) {}

  /**
   * Gera as próximas imagens que faltam na cobertura em andamento da turma.
   * Idempotente: o que já está na cobertura é pulado, e o que já está no bucket
   * (a mesma descrição, noutra turma ou noutra cobertura) entra DE GRAÇA, sem
   * contar no lote da chamada.
   */
  async gerar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    usuarioId: string,
    perfil: Perfil,
    /** A atividade PRONTA sendo preparada; sem ela, a em andamento (ADR-130). */
    coberturaId?: string,
  ): Promise<ProgressoDaMidia> {
    const cobertura = await this.selecao.coberturaParaMidia(escolaId, turmaId, professorId, coberturaId);
    const emCurso = emPreparo.get(cobertura.id);
    if (emCurso) return emCurso;

    const trabalho = this.gerarDeVerdade(escolaId, usuarioId, perfil, cobertura).finally(() => {
      emPreparo.delete(cobertura.id);
    });
    emPreparo.set(cobertura.id, trabalho);
    return trabalho;
  }

  /**
   * "GERAR OUTRA IMAGEM" (ADR-146): o professor viu a imagem no card do post e
   * ela não serve. Uma imagem nova, SEMPRE paga (o arquivo é novo: a variação
   * entra no nome), e só enquanto as imagens estão em validação.
   *
   * Uma por chamada, e no mesmo lock de processo da geração em lote, pela
   * mesma razão: dois cliques não pagam duas imagens.
   */
  async regerar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    usuarioId: string,
    perfil: Perfil,
    coberturaId: string,
    postId: IdDePost,
  ): Promise<{ coberturaId: string; postId: IdDePost; url: string }> {
    const cobertura = await this.selecao.coberturaEmValidacao(escolaId, turmaId, professorId, coberturaId);
    const post = postsQuePedemImagem(cobertura.posts).find((p) => p.id === postId);
    if (!post) throw erroDeJogo("post-sem-imagem");

    const chave = `${cobertura.id}:${postId}`;
    const emCurso = regerando.get(chave);
    if (emCurso) return emCurso;
    const trabalho = (async () => {
      if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) throw erroDeJogo("sem-saldo-de-ia");
      const nome = nomeDaImagem(post.descricaoImagem, randomUUID());
      const bytes = await this.ia.generateImage(promptDaImagem(post.descricaoImagem), { proporcao: "1:1" });
      const url = await this.assets.salvarMidiaDeExperiencia({
        expId: EXP_ID,
        nome,
        bytes,
        contentType: "image/webp",
        imagem: { largura: LADO_DA_IMAGEM, altura: LADO_DA_IMAGEM },
      });
      await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_IMAGEM);
      await this.selecao.registrarMidia(escolaId, cobertura.id, postId, url);
      return { coberturaId: cobertura.id, postId, url };
    })().finally(() => regerando.delete(chave));
    regerando.set(chave, trabalho);
    return trabalho;
  }

  private async gerarDeVerdade(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    cobertura: Awaited<ReturnType<ASelecaoService["coberturaParaMidia"]>>,
  ): Promise<ProgressoDaMidia> {
    const pedem = postsQuePedemImagem(cobertura.posts);
    const midia = { ...cobertura.midia };
    const pendentes = pedem.filter((p) => !midia[p.id]);

    if (pendentes.length > 0 && !(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      throw erroDeJogo("sem-saldo-de-ia");
    }

    const geradas: IdDePost[] = [];
    const falharam: IdDePost[] = [];
    let novas = 0;
    for (const post of pendentes) {
      if (novas >= IMAGENS_POR_CHAMADA) break;
      const nome = nomeDaImagem(post.descricaoImagem);
      try {
        let url: string;
        if (await this.assets.midiaDeExperienciaExiste(EXP_ID, nome)) {
          url = this.assets.urlDaMidiaDeExperiencia(EXP_ID, nome);
        } else {
          novas += 1;
          const bytes = await this.ia.generateImage(promptDaImagem(post.descricaoImagem), { proporcao: "1:1" });
          url = await this.assets.salvarMidiaDeExperiencia({
            expId: EXP_ID,
            nome,
            bytes,
            contentType: "image/webp",
            imagem: { largura: LADO_DA_IMAGEM, altura: LADO_DA_IMAGEM },
          });
          await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_IMAGEM);
        }
        await this.selecao.registrarMidia(escolaId, cobertura.id, post.id, url);
        midia[post.id] = url;
        geradas.push(post.id);
      } catch {
        /* Sem `err` no log: a mensagem do provider pode carregar trecho do
           pedido, e o pedido carrega a descrição que a professora escreveu. */
        logger.warn(
          { codigo: "exp07ef1b-midia-falhou", escolaId, post: post.id },
          "imagem não gerada — o post segue com o card da descrição",
        );
        falharam.push(post.id);
      }
    }

    const prontas = pedem.filter((p) => midia[p.id]).length;
    return {
      coberturaId: cobertura.id,
      total: pedem.length,
      prontas,
      faltam: pedem.length - prontas,
      geradas,
      falharam,
      completo: prontas === pedem.length,
      midia,
    };
  }
}
