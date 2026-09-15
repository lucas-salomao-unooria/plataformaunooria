import PptxGenJS from "pptxgenjs";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { prepararImagem, RAIZ } from "./preparar-imagem.mjs";

/**
 * O deck, montado A PARTIR DOS MANIFESTOS que as suítes escrevem.
 *
 * Antes existia um `roteiro.mjs` de 66 KB mantido à mão, com a descrição de
 * cada slide escrita separada do teste que tirava o print. Ele divergiu do que
 * os scripts faziam: descrevia telas que já não eram fotografadas e omitia
 * passos novos. A descrição agora nasce onde o passo nasce — no `registrar()`
 * de cada suíte — e este arquivo só desenha.
 *
 *   node scripts/e2e/ferramentas/gerar-deck.mjs
 *
 * A saída é `testes/Unooria-Testes-Ponta-a-Ponta.pptx`.
 */
const PAPEIS = [
  { id: "publico", nome: "Público", descricao: "o que existe antes de qualquer credencial" },
  { id: "estudante", nome: "Estudante", descricao: "as quatro missões, de ponta a ponta" },
  { id: "professor", nome: "Professor", descricao: "preparar, conduzir e ler a aula" },
  { id: "gestor_escola", nome: "Gestor", descricao: "as pessoas e as turmas de uma escola" },
  { id: "gestor_contrato", nome: "Admin de contrato", descricao: "a rede inteira, e só ela" },
];

const NAVY = "2F4F7F";
const NAVY_CLARO = "49699F";
const TEAL = "1B7A82";
const TINTA = "22272A";
const CINZA = "617379";
const LINHA = "CBD4D6";
const FUNDO = "F5F7F8";
const VERMELHO = "B3261E";
const VERDE = "1A7F37";
const AMBAR = "8A6100";
const F = "Open Sans";
const MONO = "Courier New";

// ── carrega os manifestos ────────────────────────────────────────────────
function manifestos() {
  const encontrados = [];
  for (const papel of PAPEIS) {
    const pasta = join(RAIZ, "testes", papel.id);
    if (!existsSync(pasta)) continue;
    for (const suite of readdirSync(pasta).sort()) {
      const arquivo = join(pasta, suite, "passos.json");
      if (!existsSync(arquivo)) continue;
      encontrados.push({ ...JSON.parse(readFileSync(arquivo, "utf8")), papelNome: papel.nome });
    }
  }
  return encontrados;
}

const secoes = manifestos();
if (secoes.length === 0) {
  console.error("Nenhum manifesto em testes/<papel>/<suite>/passos.json — rode `node scripts/e2e/rodar.mjs` antes.");
  process.exit(1);
}

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE"; // 13,333 × 7,5 pol
pres.author = "Plataforma Unooria";
pres.title = "Testes de ponta a ponta";

let numero = 0;
const novo = (fundo = "FFFFFF") => {
  const s = pres.addSlide();
  s.background = { color: fundo };
  numero += 1;
  return s;
};

const rodape = (s, esquerda) => {
  s.addShape(pres.ShapeType.line, { x: 0.45, y: 6.95, w: 12.45, h: 0, line: { color: LINHA, width: 0.75 } });
  s.addText(esquerda, { x: 0.45, y: 7.0, w: 11.2, h: 0.3, fontSize: 9, fontFace: MONO, color: CINZA });
  s.addText(String(numero), { x: 11.7, y: 7.0, w: 1.2, h: 0.3, fontSize: 9, fontFace: F, color: CINZA, align: "right" });
};

/** Encaixa a imagem numa moldura, mantendo a proporção e centralizando. */
const encaixar = (img, cx, cy, cw, ch) => {
  const escala = Math.min(cw / img.largura, ch / img.altura);
  const w = img.largura * escala;
  const h = img.altura * escala;
  return { x: cx + (cw - w) / 2, y: cy + (ch - h) / 2, w, h };
};

const quando = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const totalDePassos = secoes.reduce((n, s) => n + s.passos.length, 0);
const totalDeVerificacoes = secoes.reduce(
  (n, s) => n + s.verificacoes.filter((v) => !v.ressalva).length,
  0,
);
const vermelhas = secoes.filter((s) => s.status !== "verde");

// ── 1. capa ──────────────────────────────────────────────────────────────
{
  const s = novo(NAVY);
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.22, fill: { color: NAVY_CLARO } });
  s.addText("PLATAFORMA UNOORIA  ·  EDUCAÇÃO MIDIÁTICA E SOCIOEMOCIONAL", {
    x: 1.1, y: 1.3, w: 11, h: 0.4, fontSize: 12, fontFace: F, color: "9DB4D8", charSpacing: 3, bold: true,
  });
  s.addText("Testes de ponta a ponta, papel por papel", {
    x: 1.05, y: 1.75, w: 11.2, h: 1.1, fontSize: 40, fontFace: F, color: "FFFFFF", bold: true,
  });
  s.addText(
    "Cada tela do produto, percorrida por quem a usa de verdade — em navegadores reais, com o " +
      "banco real e a IA real. Este documento é gerado dos próprios testes: cada slide é um print " +
      "que aconteceu, com a regra do projeto que ele defende.",
    { x: 1.05, y: 2.95, w: 10.8, h: 1.1, fontSize: 15, fontFace: F, color: "D6E0F0", lineSpacing: 24 },
  );
  s.addShape(pres.ShapeType.line, { x: 1.1, y: 4.2, w: 3.2, h: 0, line: { color: TEAL, width: 2.5 } });
  s.addText(
    [
      { text: `${secoes.length} suítes`, options: { bold: true, color: "FFFFFF" } },
      { text: "   ·   " },
      { text: `${totalDePassos} telas fotografadas`, options: { bold: true, color: "FFFFFF" } },
      { text: "   ·   " },
      { text: `${totalDeVerificacoes} verificações`, options: { bold: true, color: "FFFFFF" } },
      { text: "   ·   " },
      { text: `${PAPEIS.length} papéis` },
    ],
    { x: 1.1, y: 4.5, w: 11, h: 0.4, fontSize: 12.5, fontFace: F, color: "9DB4D8" },
  );
  s.addText(
    `Gerado de testes/<papel>/<suíte>/passos.json  ·  última execução em ${quando(
      secoes.map((s) => s.quando).sort().at(-1),
    )}`,
    { x: 1.1, y: 6.3, w: 11, h: 0.3, fontSize: 11, fontFace: MONO, color: "7E97C4" },
  );
}

// ── 2. como ler este documento ───────────────────────────────────────────
{
  const s = novo();
  s.addText("Como ler este documento", {
    x: 0.45, y: 0.5, w: 12.4, h: 0.5, fontSize: 28, fontFace: F, color: NAVY, bold: true,
  });
  s.addText(
    "Typecheck verde não pega ícone que virou texto, iframe vazio, feed sem posts nem uma cor " +
      "ilegível. Estes testes abrem o produto num navegador de verdade, com uma pessoa de verdade " +
      "logada, e fotografam cada passo. Cada slide traz o que está na tela e a regra do projeto " +
      "que aquele passo defende.",
    { x: 0.45, y: 1.08, w: 12.4, h: 0.9, fontSize: 13.5, fontFace: F, color: TINTA, lineSpacing: 22 },
  );
  const cartoes = [
    [
      "Navegador real, dado real",
      "Chromium e Chrome do sistema, contra a mesma api e o mesmo Postgres do dia a dia. A IA é a de produção: quando um plano de aula é gerado aqui, ele foi gerado mesmo.",
      NAVY,
    ],
    [
      "Duas pontas quando a aula tem duas",
      "As missões conduzidas pelo professor sobem DOIS navegadores: um com ele no relógio da turma, outro com o estudante no aparelho. Metade das travas só se prova assim.",
      TEAL,
    ],
    [
      "Asserção, não só print",
      "Cada passo cobra contagem de elementos, cor computada, texto na tela e ausência de erro no console e na api. Print bonito com feed vazio não passa.",
      NAVY,
    ],
    [
      "O erro provocado é parte do teste",
      "Quando o roteiro exercita uma trava — ativar com conteúdo de menos, entrar com senha errada, subir um documento adulterado — o erro que aparece é a prova, e vem rotulado como tal.",
      VERDE,
    ],
  ];
  cartoes.forEach(([titulo, texto, cor], i) => {
    const x = 0.45 + (i % 2) * 6.3;
    const y = 2.25 + Math.floor(i / 2) * 2.25;
    s.addShape(pres.ShapeType.rect, { x, y, w: 6.0, h: 2.05, fill: { color: FUNDO }, line: { color: LINHA, width: 0.75 } });
    s.addShape(pres.ShapeType.rect, { x, y, w: 0.08, h: 2.05, fill: { color: cor } });
    s.addText(titulo, { x: x + 0.3, y: y + 0.18, w: 5.5, h: 0.35, fontSize: 15, fontFace: F, color: NAVY, bold: true });
    s.addText(texto, { x: x + 0.3, y: y + 0.58, w: 5.4, h: 1.35, fontSize: 11.5, fontFace: F, color: TINTA, lineSpacing: 18 });
  });
  rodape(s, "método");
}

// ── 3. sumário ───────────────────────────────────────────────────────────
{
  const s = novo();
  s.addText("As suítes, por papel", {
    x: 0.45, y: 0.4, w: 12.4, h: 0.5, fontSize: 28, fontFace: F, color: NAVY, bold: true,
  });
  s.addText(
    "A ordem é a da execução: o público não depende de nada, o estudante produz o estado que o " +
      "professor lê, e a administração vem por último porque mexe em gente.",
    { x: 0.45, y: 0.92, w: 12.4, h: 0.35, fontSize: 13, fontFace: F, color: CINZA },
  );

  const porColuna = Math.ceil(secoes.length / 2);
  secoes.forEach((sec, i) => {
    const col = Math.floor(i / porColuna);
    const row = i % porColuna;
    const x = 0.45 + col * 6.35;
    const y = 1.45 + row * 0.72;
    const cor = sec.status === "verde" ? VERDE : VERMELHO;

    s.addShape(pres.ShapeType.rect, { x, y, w: 6.1, h: 0.64, fill: { color: FUNDO }, line: { color: LINHA, width: 0.5 } });
    s.addShape(pres.ShapeType.rect, { x, y, w: 0.06, h: 0.64, fill: { color: cor } });
    s.addText(sec.papelNome, {
      x: x + 0.18, y: y + 0.07, w: 1.5, h: 0.22, fontSize: 8.5, fontFace: F, color: NAVY_CLARO, bold: true, charSpacing: 1,
    });
    s.addText(sec.titulo, { x: x + 0.18, y: y + 0.28, w: 4.2, h: 0.28, fontSize: 12, fontFace: F, color: TINTA, bold: true });
    s.addText(`${sec.passos.length} telas`, {
      x: x + 4.5, y: y + 0.2, w: 1.45, h: 0.3, fontSize: 10.5, fontFace: F, color: TEAL, align: "right", bold: true,
    });
  });
  rodape(s, "sumário");
}

// ── 4. uma seção por suíte ───────────────────────────────────────────────
for (const sec of secoes) {
  // divisor
  {
    const s = novo();
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: NAVY } });
    s.addText(sec.papelNome.toUpperCase(), {
      x: 0.8, y: 0.7, w: 6, h: 0.4, fontSize: 13, fontFace: F, color: NAVY_CLARO, bold: true, charSpacing: 3,
    });
    s.addText(sec.titulo, { x: 0.8, y: 1.2, w: 11.8, h: 0.8, fontSize: 32, fontFace: F, color: NAVY, bold: true });
    s.addText(sec.subtitulo, { x: 0.82, y: 2.0, w: 11.8, h: 0.4, fontSize: 15, fontFace: F, color: CINZA });
    s.addText(sec.contexto, {
      x: 0.82, y: 2.6, w: 7.0, h: 2.0, fontSize: 12.5, fontFace: F, color: TINTA, lineSpacing: 21, fit: "shrink",
    });

    s.addShape(pres.ShapeType.rect, { x: 8.2, y: 2.55, w: 4.65, h: 3.6, fill: { color: FUNDO }, line: { color: LINHA, width: 0.75 } });
    s.addShape(pres.ShapeType.rect, { x: 8.2, y: 2.55, w: 0.08, h: 3.6, fill: { color: TEAL } });
    s.addText("O QUE ESTA SUÍTE COMPROVA", {
      x: 8.45, y: 2.72, w: 4.2, h: 0.3, fontSize: 10, fontFace: F, color: TEAL, bold: true, charSpacing: 1.5,
    });
    s.addText(
      sec.prova.map((t) => ({ text: t, options: { bullet: { characterCode: "2022" } } })),
      { x: 8.45, y: 3.08, w: 4.2, h: 3.0, fontSize: 11, fontFace: F, color: TINTA, lineSpacing: 18, paraSpaceAfter: 8, fit: "shrink" },
    );

    s.addText("COMO REPRODUZIR", {
      x: 0.82, y: 4.9, w: 7.0, h: 0.3, fontSize: 10, fontFace: F, color: NAVY, bold: true, charSpacing: 1.5,
    });
    s.addShape(pres.ShapeType.rect, { x: 0.82, y: 5.25, w: 7.0, h: 0.55, fill: { color: "1E2A38" } });
    s.addText(sec.comando, { x: 0.98, y: 5.32, w: 6.7, h: 0.4, fontSize: 10.5, fontFace: MONO, color: "D6E0F0" });

    const reprovadas = sec.verificacoes.filter((v) => !v.ok).length;
    s.addText(
      [
        { text: sec.status === "verde" ? "✓ verde" : "✗ vermelha", options: { bold: true, color: sec.status === "verde" ? VERDE : VERMELHO } },
        { text: `   ·   ${sec.passos.length} telas   ·   ${sec.verificacoes.filter((v) => v.ok && !v.ressalva).length} verificações` },
        ...(reprovadas ? [{ text: `   ·   ${reprovadas} reprovadas`, options: { color: VERMELHO, bold: true } }] : []),
        { text: `   ·   ${Math.round(sec.duracaoMs / 1000)}s   ·   ${quando(sec.quando)}` },
      ],
      { x: 0.82, y: 5.95, w: 7.2, h: 0.3, fontSize: 11, fontFace: F, color: CINZA },
    );
    rodape(s, `testes/${sec.slug}/`);
  }

  // um slide por passo
  for (const [i, passo] of sec.passos.entries()) {
    let img;
    try {
      img = await prepararImagem(sec.slug, passo.arq);
    } catch (erro) {
      console.warn(`  ! ${sec.slug}/${passo.arq}: ${erro.message}`);
      continue;
    }

    const s = novo();
    s.addText(
      `${sec.papelNome.toUpperCase()}  ·  ${sec.titulo.toUpperCase()}  ·  TELA ${i + 1} DE ${sec.passos.length}` +
        (passo.contexto ? `  ·  ${passo.contexto.toUpperCase()}` : ""),
      { x: 0.45, y: 0.28, w: 9.5, h: 0.3, fontSize: 9.5, fontFace: F, color: NAVY_CLARO, bold: true, charSpacing: 1.5 },
    );
    s.addText(passo.titulo, { x: 0.45, y: 0.55, w: 9.5, h: 0.45, fontSize: 23, fontFace: F, color: NAVY, bold: true });

    const moldura = { x: 0.45, y: 1.15, w: 7.8, h: 5.65 };
    s.addShape(pres.ShapeType.rect, { ...moldura, fill: { color: FUNDO }, line: { color: LINHA, width: 0.5 } });
    const pos = encaixar(img, moldura.x, moldura.y, moldura.w, moldura.h);
    s.addImage({
      path: img.caminho,
      ...pos,
      shadow: { type: "outer", blur: 8, offset: 2, angle: 90, color: "9AA5AA", opacity: 0.35 },
    });
    if (img.fatias > 1) {
      s.addText(`captura de página inteira, cortada em ${img.fatias} colunas para caber no slide`, {
        x: moldura.x, y: 6.62, w: moldura.w, h: 0.25, fontSize: 8.5, fontFace: F, color: CINZA, align: "center", italic: true,
      });
    }

    s.addShape(pres.ShapeType.rect, { x: 8.45, y: 1.15, w: 4.4, h: 2.3, fill: { color: FUNDO }, line: { color: LINHA, width: 0.75 } });
    s.addShape(pres.ShapeType.rect, { x: 8.45, y: 1.15, w: 0.07, h: 2.3, fill: { color: TEAL } });
    s.addText("NA TELA", { x: 8.68, y: 1.28, w: 4.0, h: 0.25, fontSize: 10, fontFace: F, color: TEAL, bold: true, charSpacing: 1.5 });
    s.addText(passo.mostra || "—", {
      x: 8.68, y: 1.58, w: 4.05, h: 1.75, fontSize: 11.5, fontFace: F, color: TINTA, lineSpacing: 18, valign: "top", fit: "shrink",
    });

    s.addShape(pres.ShapeType.rect, { x: 8.45, y: 3.6, w: 4.4, h: 2.55, fill: { color: FUNDO }, line: { color: LINHA, width: 0.75 } });
    s.addShape(pres.ShapeType.rect, { x: 8.45, y: 3.6, w: 0.07, h: 2.55, fill: { color: NAVY } });
    s.addText("POR QUE ISSO IMPORTA", {
      x: 8.68, y: 3.75, w: 4.0, h: 0.25, fontSize: 10, fontFace: F, color: NAVY, bold: true, charSpacing: 1.5,
    });
    s.addText(passo.prova || "—", {
      x: 8.68, y: 4.08, w: 4.05, h: 1.95, fontSize: 11.5, fontFace: F, color: TINTA, lineSpacing: 18, valign: "top", fit: "shrink",
    });

    if (passo.detalhe) {
      s.addShape(pres.ShapeType.rect, { x: 8.45, y: 6.3, w: 4.4, h: 0.5, fill: { color: "1E2A38" } });
      s.addText(passo.detalhe, {
        x: 8.6, y: 6.38, w: 4.1, h: 0.35, fontSize: 9, fontFace: MONO, color: "D6E0F0", fit: "shrink",
      });
    }

    rodape(s, `testes/${sec.slug}/${passo.arq}${passo.url ? `  ·  ${passo.url}` : ""}`);
  }

  // as verificações da suíte, em uma folha
  {
    const s = novo();
    s.addText(`${sec.titulo} — o que foi verificado`, {
      x: 0.45, y: 0.4, w: 12.4, h: 0.5, fontSize: 24, fontFace: F, color: NAVY, bold: true,
    });
    const linhas = sec.verificacoes.map((v) => ({
      text: v.texto,
      options: {
        bullet: { characterCode: v.ressalva ? "00B7" : v.ok ? "2713" : "2717" },
        color: v.ressalva ? AMBAR : v.ok ? TINTA : VERMELHO,
        bold: !v.ok,
      },
    }));
    const colunas = linhas.length > 14 ? 2 : 1;
    const metade = Math.ceil(linhas.length / colunas);
    const partes = colunas === 2 ? [linhas.slice(0, metade), linhas.slice(metade)] : [linhas];
    partes.forEach((parte, i) => {
      s.addText(parte, {
        x: 0.45 + i * 6.35,
        y: 1.1,
        w: 6.0,
        h: 5.3,
        fontSize: 11,
        fontFace: F,
        lineSpacing: 17,
        paraSpaceAfter: 6,
        valign: "top",
        fit: "shrink",
      });
    });

    const rodapeExtra = [];
    if (sec.errosProvocados?.length) rodapeExtra.push(`${sec.errosProvocados.length} erro(s) provocados de propósito`);
    if (sec.pendenciasConhecidas?.length) rodapeExtra.push(`${sec.pendenciasConhecidas.length} pendência(s) conhecida(s)`);
    if (sec.errosDeConsole?.length) rodapeExtra.push(`${sec.errosDeConsole.length} erro(s) de console INESPERADOS`);
    if (rodapeExtra.length) {
      s.addText(rodapeExtra.join("  ·  "), {
        x: 0.45, y: 6.45, w: 12.4, h: 0.3, fontSize: 10.5, fontFace: F, color: CINZA,
      });
    }
    rodape(s, `testes/${sec.slug}/relatorio.md`);
  }
}

// ── 5. o placar e o que ficou aberto ─────────────────────────────────────
{
  const s = novo();
  s.addText("O placar desta execução", {
    x: 0.45, y: 0.4, w: 12.4, h: 0.5, fontSize: 28, fontFace: F, color: NAVY, bold: true,
  });

  const metricas = [
    [`${secoes.length - vermelhas.length}/${secoes.length}`, "suítes verdes", vermelhas.length ? VERMELHO : VERDE],
    [String(totalDePassos), "telas fotografadas", NAVY],
    [String(totalDeVerificacoes), "verificações", TEAL],
    [
      String(secoes.reduce((n, s) => n + (s.errosDeConsole?.length ?? 0), 0)),
      "erros de console inesperados",
      NAVY,
    ],
  ];
  metricas.forEach(([valor, rotulo, cor], i) => {
    const x = 0.45 + i * 3.15;
    s.addShape(pres.ShapeType.rect, { x, y: 1.15, w: 2.95, h: 1.5, fill: { color: FUNDO }, line: { color: LINHA, width: 0.75 } });
    s.addShape(pres.ShapeType.rect, { x, y: 1.15, w: 2.95, h: 0.07, fill: { color: cor } });
    s.addText(valor, { x: x + 0.2, y: 1.4, w: 2.6, h: 0.7, fontSize: 34, fontFace: F, color: cor, bold: true });
    s.addText(rotulo, { x: x + 0.2, y: 2.12, w: 2.6, h: 0.4, fontSize: 11, fontFace: F, color: CINZA });
  });

  const abertos = [];
  for (const sec of secoes) {
    for (const v of sec.verificacoes.filter((v) => !v.ok)) {
      abertos.push({ text: `[${sec.titulo}] ${v.texto}`, options: { color: VERMELHO, bullet: { characterCode: "2717" } } });
    }
  }
  for (const sec of secoes) {
    for (const p of sec.pendenciasConhecidas ?? []) {
      abertos.push({ text: `[${sec.titulo}] ${p}`, options: { color: AMBAR, bullet: { characterCode: "00B7" } } });
    }
  }
  for (const sec of secoes) {
    for (const v of sec.verificacoes.filter((v) => v.ressalva)) {
      abertos.push({ text: `[${sec.titulo}] ${v.texto}`, options: { color: CINZA, bullet: { characterCode: "00B7" } } });
    }
  }

  s.addText(abertos.length ? "O que ficou aberto" : "Nada ficou aberto nesta execução", {
    x: 0.45, y: 3.0, w: 12.4, h: 0.4, fontSize: 17, fontFace: F, color: NAVY, bold: true,
  });
  if (abertos.length) {
    s.addText(abertos.slice(0, 22), {
      x: 0.45, y: 3.5, w: 12.4, h: 3.0, fontSize: 11, fontFace: F, lineSpacing: 17, paraSpaceAfter: 5, valign: "top", fit: "shrink",
    });
  }
  rodape(s, "placar");
}

const saida = join(RAIZ, "testes", "Unooria-Testes-Ponta-a-Ponta.pptx");
await pres.writeFile({ fileName: saida });
console.log(`\n✓ deck com ${numero} slides: ${saida.replace(RAIZ + "/", "")}`);
