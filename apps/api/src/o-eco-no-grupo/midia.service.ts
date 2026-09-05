import { Inject, Injectable } from "@nestjs/common";
import sharp from "sharp";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { AssetsService } from "../assets/assets.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { erroDeJogo } from "./erros";
import { EXP_ID, MIDIA, ORDEM_DE_PREPARO, type Midia, type MidiaDeFoto } from "./midia";

/**
 * A mídia da exp-07: gerada uma vez, servida a todo mundo.
 *
 * **Quem prepara é o PROFESSOR, no preparo da aula** — não o primeiro estudante
 * que abre a missão. Três razões, e nenhuma é técnica:
 *
 * - a quota diária do professor é 2 milhões de tokens contra 300 mil do
 *   estudante (regra 5), e não faz sentido a criança pagar pela voz que a
 *   turma inteira vai ouvir;
 * - gerar leva dezenas de segundos, e ninguém deve esperar isso no meio da
 *   aula com 30 pessoas olhando;
 * - o preparo é o momento em que o professor confere se a missão está pronta,
 *   e a ficha dele já pede isso ("conferir som ou fones").
 *
 * **Sem mídia preparada a missão roda igual.** O áudio cai na transcrição, que
 * já está sempre na tela por acessibilidade, e a foto cai na ilustração
 * procedural. Isso não é degradação silenciosa: `GET /midia` devolve `null` no
 * que falta, e `null` é o sinal explícito para o cliente não esperar arquivo.
 */

/**
 * Custo estimado por item, em tokens, só para o ORÇAMENTO não ficar cego.
 *
 * Nem a síntese de voz nem a geração de imagem devolvem contagem de tokens — a
 * primeira é cobrada por caractere, a segunda por imagem. Debitar zero faria a
 * quota mentir; debitar uma estimativa mantém o teto diário com significado.
 * Os números são a ordem de grandeza do que o vendor cobra, não uma medição.
 */
const CUSTO_ESTIMADO = { voz: 3_000, foto: 2_000 } as const;

/**
 * Preparos em andamento NESTE processo, para dois cliques do mesmo professor
 * não gerarem a mesma voz duas vezes.
 *
 * É um lock de processo, no espírito do `Map` que o worker da geração guarda no
 * `globalThis` — e não um `pg_advisory_lock`, de propósito: o preparo leva
 * dezenas de segundos, e segurar uma transação (e a conexão do pool) todo esse
 * tempo por uma corrida rara sairia mais caro que a corrida. Em duas
 * instâncias, o pior caso é gerar duas vezes e sobrescrever com conteúdo
 * equivalente.
 */
const emPreparo = new Map<string, Promise<PreparoDaMidia>>();

export interface PreparoDaMidia {
  urls: Record<string, string | null>;
  geradas: string[];
  falharam: string[];
}

@Injectable()
export class MidiaDaExp07Service {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
    private readonly quota: QuotaService,
  ) {}

  /**
   * O mapa que o estudante recebe. NÃO gera nada: se a mídia não foi preparada,
   * o valor é `null` e a tela cai no fallback na hora, sem espera.
   */
  async urls(): Promise<Record<string, string | null>> {
    const pares = await Promise.all(
      Object.entries(MIDIA).map(async ([id, midia]) => {
        const existe = await this.assets.midiaDeExperienciaExiste(EXP_ID, midia.arquivo);
        return [id, existe ? this.assets.urlDaMidiaDeExperiencia(EXP_ID, midia.arquivo) : null] as const;
      }),
    );
    return Object.fromEntries(pares);
  }

  /**
   * Gera o que falta. Idempotente: o que já está no bucket é pulado, e preparar
   * duas vezes é de graça — é exatamente o clique que se dá duas vezes.
   *
   * Uma falha não derruba as outras: a lista `falharam` volta na resposta, o
   * professor vê o que não saiu, e a missão continua jogável com o resto.
   */
  async preparar(escolaId: string, usuarioId: string, perfil: Perfil): Promise<PreparoDaMidia> {
    const emCurso = emPreparo.get(EXP_ID);
    if (emCurso) return emCurso;

    const trabalho = this.prepararDeVerdade(escolaId, usuarioId, perfil).finally(() => {
      emPreparo.delete(EXP_ID);
    });
    emPreparo.set(EXP_ID, trabalho);
    return trabalho;
  }

  private async prepararDeVerdade(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
  ): Promise<PreparoDaMidia> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      throw erroDeJogo("teto-da-sessao");
    }

    const geradas: string[] = [];
    const falharam: string[] = [];
    // Os bytes de quem acabou de ser gerado, para o recorte não precisar
    // baixar de volta o que ainda está na memória.
    const recemGerados = new Map<string, Buffer>();

    for (const id of ORDEM_DE_PREPARO) {
      const midia = MIDIA[id];
      if (!midia) continue;
      if (await this.assets.midiaDeExperienciaExiste(EXP_ID, midia.arquivo)) continue;

      try {
        const bytes = await this.gerar(id, midia, recemGerados);
        recemGerados.set(id, bytes);
        await this.publicar(midia, bytes);
        await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO[midia.tipo]);
        geradas.push(id);
      } catch (falha) {
        // Sem `err` no log: a mensagem do provider pode carregar trecho do
        // roteiro, e roteiro é conteúdo da missão.
        logger.warn(
          { codigo: "exp07.midia-falhou", midia: id, tipo: midia.tipo },
          "mídia não gerada — a missão segue no fallback",
        );
        falharam.push(id);
      }
    }

    return { urls: await this.urls(), geradas, falharam };
  }

  private async gerar(id: string, midia: Midia, jaGerados: Map<string, Buffer>): Promise<Buffer> {
    if (midia.tipo === "voz") {
      return this.ia.generateSpeech({
        texto: midia.texto,
        turnos: midia.turnos,
        falantes: midia.falantes,
        direcao: midia.direcao,
      });
    }
    if (midia.recorteDe) return this.recortar(midia, jaGerados);
    return this.ia.generateImage(midia.prompt, { proporcao: midia.proporcao });
  }

  /**
   * O print viral é um RECORTE da foto da reportagem — não outra geração.
   *
   * É o que torna o par casado exato: mesma cena, mesmo instante, mesma luz. Se
   * as duas fossem geradas em separado, o estudante compararia duas fotos
   * parecidas, e a descoberta de que o print escondeu metade da praça viraria
   * "as imagens são diferentes". O corte que a missão denuncia é feito aqui, com
   * a mesma matemática que qualquer pessoa faria com o dedo na tela.
   */
  private async recortar(midia: MidiaDeFoto, jaGerados: Map<string, Buffer>): Promise<Buffer> {
    const recorte = midia.recorteDe!;
    const origem = jaGerados.get(recorte.origem) ?? (await this.baixarOrigem(recorte.origem));
    const imagem = sharp(origem);
    const meta = await imagem.metadata();
    const largura = meta.width ?? 0;
    const altura = meta.height ?? 0;
    if (largura === 0 || altura === 0) {
      throw new Error(`origem do recorte sem dimensões: ${recorte.origem}`);
    }
    return imagem
      .extract({
        left: Math.round(largura * recorte.x),
        top: Math.round(altura * recorte.y),
        width: Math.round(largura * recorte.largura),
        height: Math.round(altura * recorte.altura),
      })
      .toBuffer();
  }

  /**
   * A origem do recorte já está publicada (preparo anterior), então ela vem de
   * volta pelo MESMO driver que a gravou — não pela URL pública.
   *
   * A primeira versão buscava por HTTP, e falhou: em dev a URL aponta para a
   * api que serve `/assets`, que pode ser outro processo com outro
   * `ASSETS_LOCAL_DIR`. O recorte morria com 404 num arquivo que estava no
   * disco ao lado.
   */
  private baixarOrigem(id: string): Promise<Buffer> {
    const origem = MIDIA[id];
    if (!origem) throw new Error(`recorte aponta para mídia inexistente: ${id}`);
    return this.assets.lerMidiaDeExperiencia(EXP_ID, origem.arquivo);
  }

  private async publicar(midia: Midia, bytes: Buffer): Promise<void> {
    await this.assets.salvarMidiaDeExperiencia({
      expId: EXP_ID,
      nome: midia.arquivo,
      bytes,
      contentType: midia.tipo === "voz" ? "audio/mpeg" : "image/webp",
      ...(midia.tipo === "foto"
        ? { imagem: { largura: midia.largura, altura: midia.altura } }
        : {}),
    });
  }
}
