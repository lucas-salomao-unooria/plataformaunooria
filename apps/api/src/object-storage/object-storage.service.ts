import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Object storage PRIVADO — documentos autorais (planos de aula), que nunca
 * podem ir para o bucket de assets (leitura pública atrás da CDN).
 *
 * Dois drivers pela env `PLANOS_DRIVER`, o mesmo desenho do `AssetsService`:
 *  - `local` (dev): grava em `storage-privado/` — fora de `storage/`, que o
 *    `main.ts` serve estaticamente em `/assets`;
 *  - `gcs` (prod): bucket `{contrato}-planos` (docs/INFRA.md), sem CDN, com
 *    versionamento de objetos ligado (histórico barato de cada Salvar).
 *
 * Ninguém recebe URL daqui: a api lê o objeto e devolve o conteúdo no JSON,
 * sempre atrás do OidcGuard + posse. Sem signed URLs.
 */
@Injectable()
export class ObjectStorageService {
  constructor(private readonly config: ConfigService) {}

  private driver(): "local" | "gcs" {
    return this.config.get("PLANOS_DRIVER") === "gcs" ? "gcs" : "local";
  }

  dirLocal(): string {
    return this.config.get<string>("PLANOS_LOCAL_DIR") ?? path.join(process.cwd(), "storage-privado");
  }

  private async bucket() {
    const { Storage } = await import("@google-cloud/storage");
    return new Storage().bucket(this.config.getOrThrow<string>("PLANOS_BUCKET"));
  }

  /** Caminhos são relativos e SEM `..`: quem monta o caminho é a api, nunca o cliente. */
  private validar(caminho: string): string {
    if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(caminho) || caminho.includes("..")) {
      throw new Error(`caminho de objeto inválido: ${caminho}`);
    }
    return caminho;
  }

  async salvar(caminho: string, conteudo: Buffer | string, contentType: string): Promise<void> {
    const relativo = this.validar(caminho);
    const bytes = typeof conteudo === "string" ? Buffer.from(conteudo, "utf8") : conteudo;
    if (this.driver() === "gcs") {
      const bucket = await this.bucket();
      await bucket.file(relativo).save(bytes, { contentType, resumable: false });
      return;
    }
    const destino = path.join(this.dirLocal(), relativo);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, bytes);
  }

  /** `null` quando o objeto não existe (plano ainda gerando, ou apagado). */
  async ler(caminho: string): Promise<Buffer | null> {
    const relativo = this.validar(caminho);
    try {
      if (this.driver() === "gcs") {
        const bucket = await this.bucket();
        const [bytes] = await bucket.file(relativo).download();
        return bytes;
      }
      return await readFile(path.join(this.dirLocal(), relativo));
    } catch (falha) {
      if (ehNaoEncontrado(falha)) return null;
      throw falha;
    }
  }

  async lerTexto(caminho: string): Promise<string | null> {
    const bytes = await this.ler(caminho);
    return bytes ? bytes.toString("utf8") : null;
  }

  /**
   * Remove tudo sob o prefixo — chamado DEPOIS do commit da exclusão (padrão
   * do `AssetsService`): falha aqui deixa órfãos recuperáveis, nunca derruba
   * a operação.
   */
  async apagarPrefixo(prefixo: string): Promise<void> {
    const relativo = this.validar(prefixo);
    try {
      if (this.driver() === "gcs") {
        const bucket = await this.bucket();
        await bucket.deleteFiles({ prefix: `${relativo}/` });
      } else {
        await rm(path.join(this.dirLocal(), relativo), { recursive: true, force: true });
      }
    } catch (falha) {
      console.error("[storage] objetos não removidos — órfãos recuperáveis", prefixo, falha);
    }
  }
}

function ehNaoEncontrado(falha: unknown): boolean {
  if (typeof falha !== "object" || falha === null) return false;
  const codigo = (falha as { code?: unknown }).code;
  return codigo === "ENOENT" || codigo === 404;
}
