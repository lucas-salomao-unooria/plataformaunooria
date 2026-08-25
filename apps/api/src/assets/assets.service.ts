import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
      console.error("[assets] imagens não removidas — órfãos recuperáveis", falha);
    }
  }
}
