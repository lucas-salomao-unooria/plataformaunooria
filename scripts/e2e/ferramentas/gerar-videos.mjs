import sharp from "sharp";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { prepararImagem, RAIZ } from "./preparar-imagem.mjs";

/**
 * Os vídeos das evidências: um por papel, e um por MISSÃO no caso do estudante.
 *
 * Por que por missão e não um do estudante inteiro: as quatro missões são
 * produtos diferentes, com públicos e durações diferentes. Um vídeo único de
 * "o estudante" teria vinte minutos e ninguém o assistiria até a Vila do Lume,
 * que é justamente a parte que mais precisa ser vista em movimento.
 *
 *   node scripts/e2e/ferramentas/gerar-videos.mjs
 *
 * CODEC: usa o ffmpeg que o Playwright já baixou — nenhuma dependência nova. O
 * build dele só traz VP8, então a saída é `.webm` (abre em qualquer navegador e
 * no VLC). Se houver um `ffmpeg` completo no PATH, sai `.mp4` (H.264) junto,
 * que é o que PowerPoint e Keynote esperam.
 */
const LARGURA = 1920;
const ALTURA = 1080;
/** Segundos por tela. Tempo de ler o título e a legenda sem congelar a leitura. */
const SEGUNDOS_POR_TELA = 4.5;
const SEGUNDOS_DE_CARTELA = 3;

const PAPEIS = {
  publico: "Público",
  estudante: "Estudante",
  professor: "Professor",
  gestor: "Gestor",
  "gestor_contrato": "Admin de contrato",
};

const NAVY = "#2F4F7F";
const TINTA = "#22272A";
const CINZA = "#617379";
const FUNDO = "#F5F7F8";

// ── o ffmpeg ─────────────────────────────────────────────────────────────
function ffmpegDoPlaywright() {
  const cache = join(homedir(), "Library", "Caches", "ms-playwright");
  const alternativo = join(homedir(), ".cache", "ms-playwright");
  for (const base of [cache, alternativo]) {
    if (!existsSync(base)) continue;
    const pasta = readdirSync(base).find((d) => d.startsWith("ffmpeg-"));
    if (!pasta) continue;
    for (const nome of ["ffmpeg-mac", "ffmpeg-linux", "ffmpeg-win64.exe"]) {
      const caminho = join(base, pasta, nome);
      if (existsSync(caminho)) return caminho;
    }
  }
  return null;
}

function ffmpegCompleto() {
  try {
    return execFileSync("which", ["ffmpeg"], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

const FFMPEG = ffmpegDoPlaywright();
const FFMPEG_H264 = ffmpegCompleto();
if (!FFMPEG && !FFMPEG_H264) {
  console.error(
    "Nenhum ffmpeg encontrado. O do Playwright vem com `pnpm exec playwright install chromium`.",
  );
  process.exit(1);
}

// ── texto: SVG, porque sharp compõe SVG e não desenha texto sozinho ─────
const escapar = (texto) =>
  String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Quebra em linhas por contagem de caracteres — suficiente para legenda. */
function quebrar(texto, porLinha, maximoDeLinhas) {
  const palavras = String(texto).split(/\s+/);
  const linhas = [];
  let atual = "";
  for (const palavra of palavras) {
    if ((atual + " " + palavra).trim().length > porLinha) {
      linhas.push(atual.trim());
      atual = palavra;
      if (linhas.length === maximoDeLinhas) break;
    } else {
      atual = `${atual} ${palavra}`;
    }
  }
  if (linhas.length < maximoDeLinhas && atual.trim()) linhas.push(atual.trim());
  if (linhas.length === maximoDeLinhas && palavras.join(" ").length > linhas.join(" ").length + 2) {
    linhas[maximoDeLinhas - 1] = `${linhas[maximoDeLinhas - 1].replace(/[.,;]$/, "")}…`;
  }
  return linhas;
}

/** A cartela que abre cada vídeo e cada suíte dentro dele. */
function cartela({ sobre, titulo, subtitulo, rodape }) {
  const linhasTitulo = quebrar(titulo, 34, 3);
  const svg = `<svg width="${LARGURA}" height="${ALTURA}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${LARGURA}" height="${ALTURA}" fill="${NAVY}"/>
    <rect x="0" y="0" width="${LARGURA}" height="10" fill="#49699F"/>
    <text x="150" y="330" font-family="Open Sans, Helvetica, Arial" font-size="30"
          fill="#9DB4D8" letter-spacing="6" font-weight="700">${escapar(sobre.toUpperCase())}</text>
    ${linhasTitulo
      .map(
        (linha, i) =>
          `<text x="150" y="${430 + i * 84}" font-family="Open Sans, Helvetica, Arial" font-size="72" fill="#FFFFFF" font-weight="700">${escapar(linha)}</text>`,
      )
      .join("")}
    <rect x="152" y="${450 + linhasTitulo.length * 84}" width="180" height="6" fill="#1B7A82"/>
    ${quebrar(subtitulo, 70, 2)
      .map(
        (linha, i) =>
          `<text x="150" y="${520 + linhasTitulo.length * 84 + i * 46}" font-family="Open Sans, Helvetica, Arial" font-size="34" fill="#D6E0F0">${escapar(linha)}</text>`,
      )
      .join("")}
    <text x="150" y="${ALTURA - 90}" font-family="Courier New, monospace" font-size="26"
          fill="#7E97C4">${escapar(rodape)}</text>
  </svg>`;
  return Buffer.from(svg);
}

/** O quadro de uma tela: print centralizado + faixa de legenda embaixo. */
async function quadro({ imagem, indice, total, papel, suite, passo }) {
  const FAIXA = 250;
  const areaImagem = { largura: LARGURA - 120, altura: ALTURA - FAIXA - 100 };
  const redimensionada = await sharp(imagem.caminho)
    .resize({
      width: areaImagem.largura,
      height: areaImagem.altura,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer({ resolveWithObject: true });

  const esquerda = Math.round((LARGURA - redimensionada.info.width) / 2);
  const topo = Math.round((ALTURA - FAIXA - redimensionada.info.height) / 2);

  const legenda = quebrar(passo.mostra || passo.prova || "", 118, 2);
  const svg = `<svg width="${LARGURA}" height="${ALTURA}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${LARGURA}" height="${ALTURA}" fill="${FUNDO}"/>
    <rect x="0" y="${ALTURA - FAIXA}" width="${LARGURA}" height="${FAIXA}" fill="#FFFFFF"/>
    <rect x="0" y="${ALTURA - FAIXA}" width="${LARGURA}" height="4" fill="${NAVY}"/>
    <text x="70" y="${ALTURA - FAIXA + 58}" font-family="Open Sans, Helvetica, Arial" font-size="24"
          fill="#49699F" letter-spacing="3" font-weight="700">${escapar(
            `${papel.toUpperCase()}  ·  ${suite.toUpperCase()}  ·  ${indice} DE ${total}` +
              (passo.contexto ? `  ·  ${passo.contexto.toUpperCase()}` : ""),
          )}</text>
    <text x="70" y="${ALTURA - FAIXA + 112}" font-family="Open Sans, Helvetica, Arial" font-size="44"
          fill="${NAVY}" font-weight="700">${escapar(quebrar(passo.titulo, 62, 1)[0] ?? "")}</text>
    ${legenda
      .map(
        (linha, i) =>
          `<text x="70" y="${ALTURA - FAIXA + 162 + i * 38}" font-family="Open Sans, Helvetica, Arial" font-size="27" fill="${TINTA}">${escapar(linha)}</text>`,
      )
      .join("")}
    ${
      passo.detalhe
        ? `<text x="70" y="${ALTURA - 24}" font-family="Courier New, monospace" font-size="22" fill="${CINZA}">${escapar(
            quebrar(passo.detalhe, 150, 1)[0] ?? "",
          )}</text>`
        : ""
    }
  </svg>`;

  return sharp({ create: { width: LARGURA, height: ALTURA, channels: 3, background: FUNDO } })
    .composite([
      { input: Buffer.from(svg), top: 0, left: 0 },
      { input: redimensionada.data, top: Math.max(40, topo), left: esquerda },
    ])
    /* JPEG, não PNG: o ffmpeg do Playwright traz UM decoder de imagem, o
       mjpeg. Mandar PNG por pipe faz ele fechar o stdin na hora, e o sintoma
       que chega aqui é um EPIPE sem explicação nenhuma. */
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

// ── monta um vídeo a partir de uma lista de suítes ───────────────────────
async function montar(nome, suites, cabecalho) {
  const trabalho = join(RAIZ, "testes", ".video", nome);
  rmSync(trabalho, { recursive: true, force: true });
  mkdirSync(trabalho, { recursive: true });

  const frames = [];
  const anotar = (arquivo, segundos) => frames.push({ arquivo, segundos });

  // cartela do vídeo
  const abertura = join(trabalho, "0000.jpg");
  await sharp(cartela(cabecalho)).jpeg({ quality: 92 }).toFile(abertura);
  anotar(abertura, SEGUNDOS_DE_CARTELA);

  let n = 1;
  for (const suite of suites) {
    const cartelaDaSuite = join(trabalho, String(n).padStart(4, "0") + ".jpg");
    await sharp(
      cartela({
        sobre: suite.papelNome,
        titulo: suite.titulo,
        subtitulo: suite.subtitulo,
        rodape: `${suite.passos.length} telas  ·  ${suite.comando}`,
      }),
    )
      .jpeg({ quality: 92 })
      .toFile(cartelaDaSuite);
    anotar(cartelaDaSuite, SEGUNDOS_DE_CARTELA);
    n += 1;

    for (const [i, passo] of suite.passos.entries()) {
      let imagem;
      try {
        imagem = await prepararImagem(suite.slug, passo.arq, { largura: 1800 });
      } catch {
        continue;
      }
      const arquivo = join(trabalho, String(n).padStart(4, "0") + ".jpg");
      const buffer = await quadro({
        imagem,
        indice: i + 1,
        total: suite.passos.length,
        papel: suite.papelNome,
        suite: suite.titulo,
        passo,
      });
      writeFileSync(arquivo, buffer);
      anotar(arquivo, SEGUNDOS_POR_TELA);
      n += 1;
    }
  }

  /**
   * O ffmpeg que vem com o Playwright é MINIMALISTA: ele existe para gravar a
   * tela do navegador em webm, e não traz o demuxer `concat` — só `image2pipe`.
   * Então os quadros vão por PIPE, repetidos numa grade fixa de meio segundo:
   * uma tela de 4,5 s é o mesmo PNG nove vezes.
   *
   * Parece desperdício e não é: o PNG é escrito uma vez em memória e repetido
   * no fluxo, o VP8 comprime quadros idênticos a quase nada, e a alternativa
   * seria pedir ao usuário que instalasse um ffmpeg completo só para ver as
   * evidências.
   */
  const PASSO_DA_GRADE = 0.5;
  const saidas = [];
  mkdirSync(join(RAIZ, "testes", "videos"), { recursive: true });

  const escrever = (fluxo, dados) =>
    new Promise((pronto) => (fluxo.write(dados) ? pronto() : fluxo.once("drain", pronto)));

  const codificar = async (destino, argumentos) => {
    const processo = spawn(argumentos[0], argumentos.slice(1), { stdio: ["pipe", "ignore", "pipe"] });
    /* Sem este handler, um stdin fechado pelo ffmpeg vira `Unhandled 'error'
       event` e derruba o processo com um EPIPE que não diz nada. Com ele, a
       causa real (que está no stderr) chega ao terminal. */
    processo.stdin.on("error", () => {});
    let erro = "";
    processo.stderr.on("data", (pedaco) => (erro += pedaco.toString().slice(0, 2000)));
    const terminou = new Promise((pronto, falhou) => {
      processo.on("close", (codigo) =>
        codigo === 0 ? pronto() : falhou(new Error(`ffmpeg saiu ${codigo}: ${erro.slice(-600)}`)),
      );
    });
    for (const quadroDoVideo of frames) {
      const vezes = Math.max(1, Math.round(quadroDoVideo.segundos / PASSO_DA_GRADE));
      const dados = readFileSync(quadroDoVideo.arquivo);
      for (let i = 0; i < vezes; i += 1) await escrever(processo.stdin, dados);
    }
    processo.stdin.end();
    await terminou;
    saidas.push(destino);
  };

  if (FFMPEG) {
    const destinoWebm = join(RAIZ, "testes", "videos", `${nome}.webm`);
    await codificar(destinoWebm, [
      FFMPEG, "-y", "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", String(1 / PASSO_DA_GRADE), "-i", "pipe:0",
      "-c:v", "libvpx", "-b:v", "2M", "-pix_fmt", "yuv420p", "-r", "30", destinoWebm,
    ]);
  }
  if (FFMPEG_H264) {
    const destinoMp4 = join(RAIZ, "testes", "videos", `${nome}.mp4`);
    await codificar(destinoMp4, [
      FFMPEG_H264, "-y", "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", String(1 / PASSO_DA_GRADE), "-i", "pipe:0",
      "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30", destinoMp4,
    ]);
  }
  rmSync(trabalho, { recursive: true, force: true });

  const duracao = frames.reduce((n, f) => n + f.segundos, 0);
  console.log(
    `  ✓ ${nome.padEnd(34)} ${String(frames.length).padStart(3)} quadros · ${Math.round(duracao)}s · ` +
      saidas.map((s) => s.replace(RAIZ + "/", "")).join(" + "),
  );
}

// ── carrega os manifestos e decide os vídeos ─────────────────────────────
function manifestosDe(papel) {
  const pasta = join(RAIZ, "testes", papel);
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .sort()
    .map((suite) => join(pasta, suite, "passos.json"))
    .filter(existsSync)
    .map((arquivo) => ({ ...JSON.parse(readFileSync(arquivo, "utf8")), papelNome: PAPEIS[papel] }));
}

/* `--amostra` grava UM quadro em JPEG e sai. Existe para conferir o layout —
   fonte cortada, legenda sobrepondo o print, imagem descentralizada — sem
   esperar nove vídeos serem codificados para descobrir. */
if (process.argv.includes("--amostra")) {
  const [primeiro] = Object.keys(PAPEIS).flatMap(manifestosDe);
  const passo = primeiro.passos[Math.min(1, primeiro.passos.length - 1)];
  const imagem = await prepararImagem(primeiro.slug, passo.arq, { largura: 1800 });
  const destino = join(RAIZ, "testes", ".imagens", "amostra-de-quadro.jpg");
  writeFileSync(
    destino,
    await quadro({
      imagem,
      indice: passo.n,
      total: primeiro.passos.length,
      papel: primeiro.papelNome,
      suite: primeiro.titulo,
      passo,
    }),
  );
  console.log(`amostra: ${destino.replace(RAIZ + "/", "")}`);
  process.exit(0);
}

console.log("\n── vídeos das evidências ──\n");
rmSync(join(RAIZ, "testes", ".video"), { recursive: true, force: true });

for (const [papel, nomeDoPapel] of Object.entries(PAPEIS)) {
  const suites = manifestosDe(papel);
  if (suites.length === 0) continue;

  if (papel === "estudante") {
    /* UM POR MISSÃO. As quatro são produtos diferentes: um vídeo único teria
       vinte minutos, e a Vila do Lume — a que mais precisa ser vista em
       movimento — ficaria no fim, onde ninguém chega. */
    for (const suite of suites) {
      await montar(`estudante-${suite.slug.split("/")[1]}`, [suite], {
        sobre: nomeDoPapel,
        titulo: suite.titulo,
        subtitulo: suite.subtitulo,
        rodape: `${suite.passos.length} telas  ·  ${suite.comando}`,
      });
    }
    continue;
  }

  await montar(papel, suites, {
    sobre: "Plataforma Unooria · testes de ponta a ponta",
    titulo: nomeDoPapel,
    subtitulo: suites.map((s) => s.titulo).join(" · "),
    rodape: `${suites.length} suítes  ·  ${suites.reduce((n, s) => n + s.passos.length, 0)} telas`,
  });
}

console.log(
  `\n✓ vídeos em testes/videos/` +
    (FFMPEG_H264 ? " (webm e mp4)" : " (webm — instale o ffmpeg no PATH para sair mp4 também)"),
);
