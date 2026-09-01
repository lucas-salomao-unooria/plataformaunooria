import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CACHE = join(RAIZ, "testes", ".imagens");
mkdirSync(CACHE, { recursive: true });

/**
 * Prepara UM print para o slide ou para o vídeo: comprime e, quando a captura é
 * de página inteira (muito mais alta que larga), corta em colunas lado a lado.
 *
 * Sem isso, um print de 2800×5402 entra no slide com 1,5 cm de largura e não se
 * lê nada — o que transforma o deck num álbum de retângulos cinza.
 *
 * O cache fica em `testes/.imagens/` para não sujar as pastas de evidência: o
 * que está em `testes/<papel>/<suite>/` é a evidência crua, do tamanho que o
 * navegador produziu.
 */
export async function prepararImagem(pastaDaSuite, arquivo, opcoes = {}) {
  const origem = join(RAIZ, "testes", pastaDaSuite, arquivo);
  const destino = join(CACHE, `${pastaDaSuite.replace(/\//g, "__")}__${arquivo.replace(/\.png$/, "")}.jpg`);
  const larguraAlvo = opcoes.largura ?? 1600;

  const meta = await sharp(origem).metadata();
  const razao = meta.height / meta.width;
  const fatias = razao >= 3.2 ? 3 : razao >= 1.95 ? 2 : 1;

  if (fatias === 1) {
    const info = await sharp(origem)
      .resize({ width: larguraAlvo, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(destino);
    return { caminho: destino, largura: info.width, altura: info.height, fatias };
  }

  const alturaFatia = Math.ceil(meta.height / fatias);
  const larguraFatia = 900;
  const pedacos = [];
  for (let i = 0; i < fatias; i += 1) {
    const top = i * alturaFatia;
    const height = Math.min(alturaFatia, meta.height - top);
    pedacos.push(
      await sharp(origem)
        .extract({ left: 0, top, width: meta.width, height })
        .resize({ width: larguraFatia })
        .toBuffer({ resolveWithObject: true }),
    );
  }
  const alturaMax = Math.max(...pedacos.map((p) => p.info.height));
  const gap = 18;
  const larguraTotal = fatias * larguraFatia + (fatias - 1) * gap;
  const info = await sharp({
    create: { width: larguraTotal, height: alturaMax, channels: 3, background: "#cbd4d6" },
  })
    .composite(pedacos.map((p, i) => ({ input: p.data, left: i * (larguraFatia + gap), top: 0 })))
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(destino);
  return { caminho: destino, largura: info.width, altura: info.height, fatias };
}

export { CACHE as PASTA_DE_IMAGENS, RAIZ };
