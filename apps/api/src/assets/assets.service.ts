import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { logger } from "../observabilidade/logger";
import sharp from "sharp";

/**
 * Imagens geradas — a saída do filesystem local do projeto origem
 * (`public/generated/`, incompatível com Cloud Run multi-instância).
 *
 * Dois drivers pela env `ASSETS_DRIVER`:
 *  - `local` (dev): grava em `storage/` e a própria api serve em `/assets/*`
 *    (express.static no main.ts);
 *  - `gcs` (prod): bucket `{contrato}-assets` atrás da CDN (docs/INFRA.md).
 *
 * O banco guarda a URL PÚBLICA ABSOLUTA (`posts.image_url`) — a experiência
 * não resolve nada, só renderiza o que o feed devolve.
 */

/** 1080×1350 lógico — a proporção 4:5 do card. Exportadas porque a MESMA
 *  proporção é pedida ao modelo de imagem (`PROPORCAO_IMAGEM`): se mudarem
 *  aqui sem mudar lá, o corte volta a comer a composição. */
export const LARGURA = 1080;
export const ALTURA = 1350;

@Injectable()
export class AssetsService {
  constructor(private readonly config: ConfigService) {}

  private driver(): "local" | "gcs" {
    return this.config.get("ASSETS_DRIVER") === "gcs" ? "gcs" : "local";
  }

  private caminhoRelativo(escolaId: string, activityId: string, postId?: string): string {
    return `atividades/${escolaId}/${activityId}${postId ? `/${postId}.webp` : ""}`;
  }

  private urlPublica(relativo: string): string {
    const base =
      this.config.get<string>("ASSETS_PUBLIC_URL") ??
      `http://localhost:${this.config.get("PORT") ?? 3001}/assets`;
    return `${base.replace(/\/$/, "")}/${relativo}`;
  }

  dirLocal(): string {
    return this.config.get<string>("ASSETS_LOCAL_DIR") ?? path.join(process.cwd(), "storage");
  }

  /** Converte para webp 4:5 (cover) e publica. Devolve a URL pública absoluta. */
  async salvarImagemDePost(opts: {
    escolaId: string;
    activityId: string;
    postId: string;
    bytes: Buffer;
  }): Promise<string> {
    const webp = await sharp(opts.bytes)
      .resize(LARGURA, ALTURA, { fit: "cover", position: "attention" })
      .webp({ quality: 78 })
      .toBuffer();

    const relativo = this.caminhoRelativo(opts.escolaId, opts.activityId, opts.postId);

    if (this.driver() === "gcs") {
      const { Storage } = await import("@google-cloud/storage");
      const bucket = new Storage().bucket(this.config.getOrThrow<string>("ASSETS_BUCKET"));
      await bucket.file(relativo).save(webp, { contentType: "image/webp", resumable: false });
    } else {
      const destino = path.join(this.dirLocal(), relativo);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, webp);
    }

    return this.urlPublica(relativo);
  }

  /**
   * Mídia FIXA de uma experiência — a que ela gera uma vez e serve a todo
   * mundo (nasceu com as vozes e as fotos do Eco no Grupo, retirado pela ADR-113).
   *
   * Três diferenças em relação a `salvarImagemDePost`, e as três são de
   * natureza do dado:
   *
   * - **Não leva `escola_id` no caminho.** Esta mídia é do CONTRATO, não de uma
   *   escola: o personagem é o MESMO para toda a rede, e uma cópia por escola
   *   multiplicaria o custo de geração por cem sem nenhum ganho — e faria duas
   *   turmas verem mídias diferentes na mesma missão.
   * - **Aceita qualquer tipo**, porque áudio existe: `image/webp` era o único
   *   `contentType` que este serviço sabia produzir.
   * - **A conversão é opcional.** Com `imagem`, converte para webp no tamanho
   *   pedido; sem, grava os bytes como vieram (é o caminho do MP3).
   */
  async salvarMidiaDeExperiencia(opts: {
    expId: string;
    /** Nome do arquivo COM extensão (`dona-lucia-boato.mp3`). */
    nome: string;
    bytes: Buffer;
    contentType: string;
    imagem?: { largura: number; altura: number };
  }): Promise<string> {
    const conteudo = opts.imagem
      ? await sharp(opts.bytes)
          .resize(opts.imagem.largura, opts.imagem.altura, { fit: "cover", position: "attention" })
          .webp({ quality: 82 })
          .toBuffer()
      : opts.bytes;
    const relativo = this.caminhoDaMidia(opts.expId, opts.nome);

    if (this.driver() === "gcs") {
      const { Storage } = await import("@google-cloud/storage");
      const bucket = new Storage().bucket(this.config.getOrThrow<string>("ASSETS_BUCKET"));
      await bucket.file(relativo).save(conteudo, { contentType: opts.contentType, resumable: false });
    } else {
      const destino = path.join(this.dirLocal(), relativo);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, conteudo);
    }

    return this.urlPublica(relativo);
  }

  /**
   * A mídia já está publicada? É o que torna o preparo IDEMPOTENTE: preparar
   * duas vezes não regera nada, e a segunda chamada é de graça.
   *
   * Falha de rede aqui responde `false`, e o pior caso é gerar de novo uma
   * mídia que já existia — sobrescrever é inofensivo, e o contrário (dizer que
   * existe o que não existe) deixaria o estudante com um player quebrado.
   */
  async midiaDeExperienciaExiste(expId: string, nome: string): Promise<boolean> {
    const relativo = this.caminhoDaMidia(expId, nome);
    try {
      if (this.driver() === "gcs") {
        const { Storage } = await import("@google-cloud/storage");
        const bucket = new Storage().bucket(this.config.getOrThrow<string>("ASSETS_BUCKET"));
        const [existe] = await bucket.file(relativo).exists();
        return existe;
      }
      await access(path.join(this.dirLocal(), relativo));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lê de volta uma mídia publicada, pelo MESMO driver que a gravou.
   *
   * Existe porque a derivada (o print recortado) precisa dos bytes da origem, e
   * buscá-los pela URL pública não funciona: em dev ela aponta para a api que
   * está servindo `/assets`, que pode ser outro processo com outro
   * `ASSETS_LOCAL_DIR` — e o recorte falha com 404 num arquivo que existe no
   * disco ao lado. Medido.
   */
  async lerMidiaDeExperiencia(expId: string, nome: string): Promise<Buffer> {
    const relativo = this.caminhoDaMidia(expId, nome);
    if (this.driver() === "gcs") {
      const { Storage } = await import("@google-cloud/storage");
      const bucket = new Storage().bucket(this.config.getOrThrow<string>("ASSETS_BUCKET"));
      const [bytes] = await bucket.file(relativo).download();
      return bytes;
    }
    return readFile(path.join(this.dirLocal(), relativo));
  }

  /** A URL que o `<audio src>` e o `<img src>` vão usar. Pública de propósito:
   *  esses elementos não mandam o bearer, então uma rota autenticada aqui daria
   *  um player mudo e uma imagem quebrada. */
  urlDaMidiaDeExperiencia(expId: string, nome: string): string {
    return this.urlPublica(this.caminhoDaMidia(expId, nome));
  }

  private caminhoDaMidia(expId: string, nome: string): string {
    return `experiencias/${expId}/${nome}`;
  }

  /**
   * Remove as imagens de uma atividade — chamado DEPOIS do commit da exclusão
   * (padrão do origem): falha aqui deixa órfãos recuperáveis, nunca derruba a
   * operação.
   */
  async removerAtividade(escolaId: string, activityId: string): Promise<void> {
    const prefixo = this.caminhoRelativo(escolaId, activityId);
    try {
      if (this.driver() === "gcs") {
        const { Storage } = await import("@google-cloud/storage");
        const bucket = new Storage().bucket(this.config.getOrThrow<string>("ASSETS_BUCKET"));
        await bucket.deleteFiles({ prefix: `${prefixo}/` });
      } else {
        await rm(path.join(this.dirLocal(), prefixo), { recursive: true, force: true });
      }
    } catch (falha) {
      logger.error({ err: falha, codigo: "assets.remocao-falhou" }, "imagens não removidas — órfãos recuperáveis");
    }
  }
}
