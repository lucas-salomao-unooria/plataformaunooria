#!/usr/bin/env node
/**
 * Gera a BASE DE CONHECIMENTO da Ajuda com avatar (ADR-132) a partir da
 * documentação de PRODUTO — o que o atendente sabe sobre a plataforma.
 *
 *   node scripts/gerar-base-da-ajuda.mjs              # reescreve o arquivo gerado
 *   node scripts/gerar-base-da-ajuda.mjs --verificar  # sai 1 se o gerado estiver velho
 *
 * Saída: `apps/api/src/ajuda/base/base-da-ajuda.gerada.ts` (versionado). Quem
 * muda o mapa de produto ou um guia e não regera fica vermelho no teste
 * `apps/api/tests/ajuda-base.spec.ts`, que roda o `--verificar`.
 *
 * O QUE ENTRA (decisão do dono do produto, 2026-10-02):
 *   - o mapa de produto (PU-PRD-001): `02-o-produto` e os épicos `e01`…`e14`,
 *     SÓ com o que está PRONTO ou PARCIAL. Feature ou história A FAZER ou
 *     ARQUIVADA fica fora — senão o atendente promete o que não existe.
 *     Fora também: `01-como-ler` (é sobre o documento), `03-mapa-dos-epicos`
 *     (o quadro de estados), `90-backlog`, `91-decisoes`, os apêndices
 *     (códigos técnicos, rastreabilidade, diagramas) e toda `\pendencia{}`.
 *   - os guias da aula das missões (`apps/hub/lib/entre-redes/guias/`), na
 *     ordem do registro (`index.ts`) — o arquivado (`backup-*`) não entra
 *     porque não está no registro. Os guias guardam o que não se diz à turma
 *     antes da hora; a Ajuda não abre para estudante, e ver isso nas mãos da
 *     coordenação foi aceito.
 *   - o catálogo das missões, dos `public/experiencia.json`.
 *
 * O QUE NÃO ENTRA NUNCA: documentação técnica (`secoes/`, `docs/`, AGENTS.md).
 * A lista de termos sensíveis abaixo barra a saída que vazar vocabulário dela.
 *
 * Os guias são TypeScript e são carregados direto pelo Node (o strip de tipos
 * do Node 24): eles só têm `import type`, que some na carga.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAPA = join(RAIZ, "documentacao-latex/produto/mapa-de-produto/capitulos");
const GUIAS = join(RAIZ, "apps/hub/lib/entre-redes/guias");
const EXPERIENCIAS = join(RAIZ, "apps/experiencias");
const SAIDA = join(RAIZ, "apps/api/src/ajuda/base/base-da-ajuda.gerada.ts");

/**
 * Vocabulário de ENGENHARIA que não pode chegar ao atendente. Se aparecer, a
 * geração falha: é sinal de que um texto técnico entrou na documentação de
 * produto, e a correção é lá, não aqui. (O mapa de produto é, por regra, sem
 * rota, tabela nem módulo — PU-PRD-001.)
 */
export const TERMOS_SENSIVEIS = [
  /escola_id/i,
  /\bRLS\b/,
  /\bJWT\b/,
  /\bBearer\b/,
  /gs:\/\//i,
  /unooria\.com/i,
  /run\.app/i,
  /\bprisma\b/i,
  /\bpostgres\b/i,
  /\bterraform\b/i,
  /\bsecret manager\b/i,
  /\bcloud run\b/i,
];

const CAPITULOS = [
  "02-o-produto",
  ...readdirSync(MAPA)
    .filter((f) => /^e\d{2}-.*\.tex$/.test(f))
    .sort()
    .map((f) => f.replace(/\.tex$/, "")),
];

// ------------------------------------------------------------------ LaTeX

/** Lê o argumento entre chaves que começa em `i` (que aponta para `{`). */
function argumento(texto, i) {
  if (texto[i] !== "{") return null;
  let nivel = 0;
  for (let j = i; j < texto.length; j += 1) {
    if (texto[j] === "\\") {
      j += 1;
      continue;
    }
    if (texto[j] === "{") nivel += 1;
    else if (texto[j] === "}") {
      nivel -= 1;
      if (nivel === 0) return { valor: texto.slice(i + 1, j), fim: j + 1 };
    }
  }
  return null;
}

/** Os N argumentos `{…}{…}` depois de um comando que termina em `i`. */
function argumentos(texto, i, n) {
  const valores = [];
  let pos = i;
  for (let k = 0; k < n; k += 1) {
    while (texto[pos] === " " || texto[pos] === "\n") pos += 1;
    const a = argumento(texto, pos);
    if (!a) return null;
    valores.push(a.valor);
    pos = a.fim;
  }
  return { valores, fim: pos };
}

/**
 * Troca cada ocorrência de `\nome{a}{b}…` pelo que `montar(args)` devolver,
 * respeitando chaves aninhadas — regex não dá conta de `\hu{…\enquote{…}…}`.
 */
function trocarComando(tex, nome, nArgs, montar) {
  const marca = `\\${nome}`;
  let saida = "";
  let i = 0;
  for (;;) {
    const j = tex.indexOf(marca, i);
    if (j < 0) {
      saida += tex.slice(i);
      return saida;
    }
    // `\idade` não é `\id`: a letra seguinte decide.
    if (/[a-zA-Z]/.test(tex[j + marca.length] ?? "")) {
      saida += tex.slice(i, j + marca.length);
      i = j + marca.length;
      continue;
    }
    const args = argumentos(tex, j + marca.length, nArgs);
    if (!args) {
      saida += tex.slice(i, j + marca.length);
      i = j + marca.length;
      continue;
    }
    saida += tex.slice(i, j) + montar(args.valores);
    i = args.fim;
  }
}

const ESTADO_DO_SELO = { "\\pronto": "pronto", "\\parcial": "parcial", "\\afazer": "afazer", "\\arquivada": "arquivada" };
function estadoDe(selo) {
  return ESTADO_DO_SELO[selo.replace(/\{\}/g, "").trim()] ?? "pronto";
}
const FICA = (estado) => estado === "pronto" || estado === "parcial";

function semComentarios(tex) {
  return tex
    .split("\n")
    .map((linha) => linha.replace(/(^|[^\\])%.*$/, "$1"))
    .join("\n");
}

/** Corta blocos `\begin{nome}…\end{nome}` inteiros. */
function semAmbiente(tex, nome) {
  return tex.replace(new RegExp(`\\\\begin\\{${nome}\\}[\\s\\S]*?\\\\end\\{${nome}\\}`, "g"), "");
}

/**
 * Tira do capítulo as features e as histórias que ainda não existem. A feature
 * vai do seu `\feature` até o próximo (ou o fim); a história é o ambiente.
 */
export function soOQueExiste(tex) {
  // Linha de tabela que lista uma feature que ainda não existe (o quadro de
  // features de cada épico): sem isto o nome dela ficaria na base, sem selo.
  tex = tex
    .split("\n")
    .filter((linha) => !(linha.includes("&") && /\\(afazer|arquivada)\b/.test(linha)))
    .join("\n");
  tex = tex.replace(/\\begin\{historia\}\{[^}]*\}\{[^}]*\}\{(\\[a-z]+)\{?\}?\}[\s\S]*?\\end\{historia\}/g, (bloco, selo) =>
    FICA(estadoDe(selo)) ? bloco : "",
  );
  return tex
    .split(/(?=\\feature\{)/)
    .filter((parte) => {
      const m = /^\\feature\{[^}]*\}\{[^}]*\}\{(\\[a-z]+)/.exec(parte);
      return !m || FICA(estadoDe(m[1]));
    })
    .join("");
}

/** LaTeX do mapa → texto corrido em Markdown leve. */
export function paraTexto(tex) {
  // `\{nome\}` é texto da tela ("Olá, {nome}"), não agrupamento: vira um
  // marcador que nenhuma regra de chave enxerga, e no fim vira `[nome]`.
  let t = tex.replace(/\\\{/g, "\u0002").replace(/\\\}/g, "\u0003");
  // Símbolos que moram DENTRO de títulos (`\chapter{E04 \textperiodcentered{} …}`)
  // saem antes da estrutura: a chave vazia deles cortaria o título no meio.
  t = t.replace(/\\textperiodcentered\{\}/g, "·").replace(/\\ldots(\{\})?/g, "…");
  t = t.replace(/\$\\times\$/g, "×").replace(/\$([^$]*)\$/g, "$1");
  t = semAmbiente(t, "tikzpicture");
  t = semAmbiente(t, "figure");
  for (const nome of ["pendencia", "label", "pageref", "ref", "id"]) t = trocarComando(t, nome, 1, () => "");

  // Estrutura.
  t = t.replace(/\\chapter\*?\{([^}]*)\}/g, (_, x) => `\n# ${x}\n`);
  t = t.replace(/\\section\*?\{([^}]*)\}/g, (_, x) => `\n## ${x}\n`);
  t = t.replace(/\\subsection\*?\{([^}]*)\}/g, (_, x) => `\n### ${x}\n`);
  t = trocarComando(t, "feature", 3, ([, nome, selo]) => `\n## ${nome}${estadoDe(selo) === "parcial" ? " (em parte)" : ""}\n`);
  t = t.replace(/\\begin\{historia\}/g, "\\historia");
  t = trocarComando(t, "historia", 3, ([, titulo, selo]) => `\n### ${titulo}${estadoDe(selo) === "parcial" ? " (em parte)" : ""}\n`);
  t = t.replace(/\\end\{historia\}/g, "\n");
  t = trocarComando(t, "hu", 3, ([quem, quer, para]) => `Quem: ${quem}. Quer: ${quer}. Para: ${para}.\n`);
  t = t.replace(/\\aceiteproposta\b/g, "\nComo vai funcionar (proposta):\n");
  t = t.replace(/\\aceite\b/g, "\nComo funciona:\n");
  // O "Estado" da ficha do épico é do quadro de acompanhamento, não da tela.
  t = t.replace(/\\item\[Estado\][\s\S]*?(?=\\item|\\end\{campos\})/g, "");
  t = t.replace(/\\item\[([^\]]*)\]/g, (_, x) => `\n${x}: `);
  t = t.replace(/\\item\b/g, "\n- ");

  // Tabelas: uma linha por linha da tabela, células separadas por " | ".
  t = t.replace(/\\(toprule|midrule|bottomrule|endhead|endfirsthead|hline|zebra|headrow)\b/g, "");
  t = t.replace(/\\begin\{(tabularx|longtable|tabular)\}(\{[^{}]*(\{[^{}]*\}[^{}]*)*\})*/g, "\n");
  t = t.replace(/\\end\{(tabularx|longtable|tabular)\}/g, "\n");
  t = t.replace(/\s*\\\\\s*/g, "\n");
  // `[ \t]` e não `\s`: o `\s` engolia a quebra de linha que separa as linhas
  // da tabela, e o quadro inteiro virava uma linha só.
  t = t.replace(/[ \t]*&[ \t]*/g, " | ");

  t = t.replace(/\\(begin|end)\{[^}]*\}(\[[^\]]*\])?/g, "\n");

  // Símbolos.
  t = t.replace(/\\yes\b/g, "sim").replace(/\\no\b/g, "não").replace(/\\seta\b/g, "→");
  t = t.replace(/\\pronto(\{\})?/g, "pronto").replace(/\\parcial(\{\})?/g, "em parte");
  t = t.replace(/---/g, "—").replace(/--/g, "–");
  t = trocarComando(t, "enquote", 1, ([x]) => `“${x}”`);

  // Comandos de formatação: fica o conteúdo (várias passadas, para os aninhados).
  for (let k = 0; k < 4; k += 1) {
    t = t.replace(/\\(textbf|emph|textit|cd|texttt|thd|small|footnotesize|num|mbox|text)\{([^{}]*)\}/g, "$2");
  }
  t = t.replace(/\\[%&_#$]/g, (m) => m.slice(1));
  t = t.replace(/\\[,;!]/g, " ").replace(/~/g, " ");
  t = t.replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, "");
  t = t.replace(/[{}]/g, "");

  t = t.replace(/\u0002/g, "[").replace(/\u0003/g, "]");
  return refluir(t);
}

/**
 * Junta as linhas que o LaTeX quebrou no meio da frase. Começa linha nova só
 * o que é estrutura: título, item de lista, linha de tabela, os rótulos
 * "Quem:" / "Como funciona" e o parágrafo depois de linha em branco.
 */
function refluir(t) {
  const NOVA = /^(#|- |\| |Quem: |Como funciona|Como vai funcionar|[A-ZÁÉÍÓÚ][^:]{0,30}: )/;
  const saida = [];
  for (const crua of t.split("\n")) {
    const linha = crua.replace(/[ \t]+/g, " ").trim().replace(/^\| /, "");
    if (!linha) {
      if (saida.length && saida[saida.length - 1] !== "") saida.push("");
      continue;
    }
    const anterior = saida[saida.length - 1];
    const ehTabela = linha.includes(" | ");
    if (anterior && anterior !== "" && !NOVA.test(linha) && !ehTabela && !anterior.startsWith("#") && !anterior.includes(" | ")) {
      saida[saida.length - 1] = `${anterior} ${linha}`;
    } else {
      saida.push(linha);
    }
  }
  return saida.join("\n").replace(/\(\s*\)/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

// ------------------------------------------------------------------ guias

async function guiasNaOrdemDoRegistro() {
  const indice = readFileSync(join(GUIAS, "index.ts"), "utf8");
  const imports = [...indice.matchAll(/import \{ (GUIA_[A-Z0-9_]+) \} from "\.\/([^"]+)";/g)];
  const guias = [];
  for (const [, nome, arquivo] of imports) {
    const mod = await import(pathToFileURL(join(GUIAS, `${arquivo}.ts`)).href);
    if (!mod[nome]) throw new Error(`guia ${nome} não exportado por ${arquivo}.ts`);
    guias.push(mod[nome]);
  }
  return guias;
}

const ROTULO_DO_NIVEL = {
  retomada: "Retomada",
  analise: "Análise",
  generalizacao: "Generalização",
  transferencia: "Transferência",
};

const lista = (itens) => itens.map((x) => `- ${x}`).join("\n");

function guiaParaTexto(guia, nomeDaMissao) {
  const p = [];
  p.push(`## Guia da aula: ${nomeDaMissao}`);
  p.push(guia.chamada);
  if (guia.avisos?.length) p.push("Avisos:\n" + lista(guia.avisos.map((a) => `${a.titulo}: ${a.texto}`)));
  p.push("Objetivos:\n" + lista(guia.objetivos));
  p.push("Habilidades da BNCC:\n" + lista(guia.bncc.map((h) => `${h.codigo} (${h.eixo}): ${h.texto}`)));
  p.push("Antes da aula — preparo técnico:\n" + lista(guia.antes.tecnico.map((x) => `${x.titulo}: ${x.texto}`)));
  p.push("Antes da aula — preparo pedagógico:\n" + lista(guia.antes.pedagogico.map((x) => `${x.titulo}: ${x.texto}`)));
  if (guia.antes.naoDiga.length) p.push("O que não dizer à turma antes da hora:\n" + lista(guia.antes.naoDiga));
  p.push(
    `Roteiro (${guia.roteiro.total}):\n` +
      lista(guia.roteiro.linhas.map((l) => `${l.tempo} — ${l.momento}: ${l.professor}${l.botao ? ` (botão: ${l.botao})` : ""}`)) +
      (guia.roteiro.nota ? `\n${guia.roteiro.nota}` : ""),
  );
  p.push(
    `Debate (${guia.debate.tempo}). Na lousa: ${guia.debate.aberturaNaLousa}\n` +
      lista(guia.debate.perguntas.map((q) => `${ROTULO_DO_NIVEL[q.nivel] ?? q.nivel}: ${q.pergunta} (${q.porQue})`)),
  );
  p.push("Mediação:\n" + lista(guia.mediacao.map((m) => `Quando ${m.quando}: ${m.faca}${m.naoFaca ? ` Evite: ${m.naoFaca}` : ""}`)));
  p.push("Depois da aula — síntese:\n" + lista(guia.depois.sintese));
  p.push(`Registro: ${guia.depois.registro}`);
  if (guia.depois.desdobramentos.length) p.push("Desdobramentos:\n" + lista(guia.depois.desdobramentos));
  if (guia.cuidados.length) p.push("Cuidados:\n" + lista(guia.cuidados));
  if (guia.adaptacoes.length) p.push("Adaptações:\n" + lista(guia.adaptacoes.map((a) => `${a.contexto}: ${a.comoAdaptar}`)));
  if (guia.duvidas.length) p.push("Dúvidas frequentes:\n" + lista(guia.duvidas.map((d) => `${d.pergunta} — ${d.resposta}`)));
  return p.join("\n\n");
}

// ------------------------------------------------------------------ catálogo

function serie(s) {
  const m = /^(\d)(EF|EM)$/.exec(s);
  if (!m) return s;
  return m[2] === "EF" ? `${m[1]}º ano do Ensino Fundamental` : `${m[1]}ª série do Ensino Médio`;
}

function manifestos() {
  const saida = new Map();
  for (const pasta of readdirSync(EXPERIENCIAS).sort()) {
    if (pasta.startsWith("_") || pasta.startsWith("backup-")) continue;
    const arquivo = join(EXPERIENCIAS, pasta, "public/experiencia.json");
    if (!existsSync(arquivo)) continue;
    const m = JSON.parse(readFileSync(arquivo, "utf8"));
    saida.set(m.id, m);
  }
  return saida;
}

function catalogoParaTexto(mapa) {
  const linhas = [...mapa.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((m) => {
      const series = m.series?.length ? m.series.map(serie).join(", ") : "qualquer ano";
      const unidade = m.unidade ? `, unidade ${m.unidade}` : "";
      const publico = m.publico === "professor" ? "ferramenta do professor" : "missão da turma";
      return `- ${m.nome}: ${publico}; ${series}${unidade}.`;
    });
  return `# O catálogo: as missões e as ferramentas\n\n${linhas.join("\n")}`;
}

// ------------------------------------------------------------------ montagem

export async function gerar() {
  const partes = [];
  for (const cap of CAPITULOS) {
    const tex = semComentarios(readFileSync(join(MAPA, `${cap}.tex`), "utf8"));
    partes.push(paraTexto(soOQueExiste(tex)));
  }
  const mapa = manifestos();
  partes.push(catalogoParaTexto(mapa));
  const guias = await guiasNaOrdemDoRegistro();
  partes.push(
    "# Os guias da aula das missões\n\n" + guias.map((g) => guiaParaTexto(g, mapa.get(g.expId)?.nome ?? g.expId)).join("\n\n"),
  );
  const texto = partes.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";

  const vazados = TERMOS_SENSIVEIS.filter((re) => re.test(texto)).map(String);
  if (vazados.length > 0) {
    throw new Error(`a base da Ajuda contém vocabulário técnico: ${vazados.join(", ")} — corrija na documentação de produto`);
  }

  return [
    "// ARQUIVO GERADO — não edite à mão.",
    "// Fonte: o mapa de produto (PU-PRD-001), os guias da aula e os manifestos das missões.",
    "// Regenerar: node scripts/gerar-base-da-ajuda.mjs (o teste ajuda-base.spec.ts confere).",
    "",
    "/** A base de conhecimento do atendente da Ajuda (ADR-132), em texto corrido. */",
    `export const BASE_DA_AJUDA: string = ${JSON.stringify(texto)};`,
    "",
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const conteudo = await gerar();
  if (process.argv.includes("--verificar")) {
    const atual = existsSync(SAIDA) ? readFileSync(SAIDA, "utf8") : "";
    if (atual !== conteudo) {
      console.error("✗ a base da Ajuda está velha. Rode: node scripts/gerar-base-da-ajuda.mjs");
      process.exit(1);
    }
    console.log("✓ a base da Ajuda está em dia");
  } else {
    writeFileSync(SAIDA, conteudo);
    console.log(`✓ ${SAIDA.replace(RAIZ + "/", "")} (${(conteudo.length / 1024).toFixed(0)} KB, ~${Math.round(conteudo.length / 4)} tokens)`);
  }
}
