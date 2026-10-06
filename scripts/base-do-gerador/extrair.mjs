#!/usr/bin/env node
/**
 * Extrai a BASE DA PLATAFORMA que o gerador de missões (repo `gerador-missoes`)
 * lê — a doutrina, os contratos e as listas fechadas da plataforma, por cópia e
 * por parse, nunca por resumo escrito à mão (ADR-149).
 *
 *   node scripts/base-do-gerador/extrair.mjs --saida <dir>
 *       grava <dir>/plataforma/<commit>/ e <dir>/plataforma/atual.json
 *   node scripts/base-do-gerador/extrair.mjs --enviar gs://<bucket>/base-plataforma
 *       gera num diretório temporário, sobe a pasta do commit e SÓ DEPOIS o
 *       `atual.json` (Cache-Control: no-store) — quem lê nunca pega base pela metade
 *
 * O layout:
 *
 *   plataforma/
 *     atual.json                  ponteiro (gravado POR ÚLTIMO)
 *     <commit>/
 *       manifesto.json            a lista do que está nesta pasta, com sha256
 *       contrato-plataforma.json  as listas fechadas, extraídas POR PARSE do código
 *       openapi-rotas.json        {commit, data_commit, origem, rotas:[{metodo, caminho, tag}]}
 *       arquivos/<destino>.md     cópias: Markdown como está, código dentro de cerca
 *
 * Quem roda: `.github/workflows/base-do-gerador.yml`, no push para `dev-local`
 * que toca uma das fontes. Sem dependência nenhuma (o CI não roda `pnpm
 * install`): só `node:` e o `gcloud` do runner.
 *
 * REGRA: fonte ausente, ou campo que o parser não extraiu, FALHA (exit 1) com o
 * arquivo e o que quebrou. Nunca pula em silêncio nem grava lista vazia: base
 * velha avisada é melhor que base errada aceita — foi a cópia que envelheceu em
 * silêncio no gerador que fez a missão do 9º ano sair com a seção `chatgpt`.
 *
 * As chaves `{x}` NÃO são neutralizadas aqui: quem consome (o ADK do gerador)
 * interpolaria `{turmaId}` como variável de estado, e é ele que as troca ao
 * carregar.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const VERSAO_FORMATO = 1;

/** Erro de extração: diz QUAL arquivo e O QUE quebrou. */
export class ErroDeExtracao extends Error {
  constructor(arquivo, oque) {
    super(`${arquivo}: ${oque}`);
    this.name = "ErroDeExtracao";
  }
}

/**
 * As cópias: [origem relativa à raiz, destino em `arquivos/`]. A linguagem da
 * cerca sai da extensão (`.md` entra como está). O DESTINO é o nome que os
 * prompts do gerador incluem — renomear um é quebrar o gerador.
 */
export const FONTES = [
  // doutrina
  ["AGENTS.md", "agents-raiz.md"],
  ["CONTEXT.md", "contexto.md"],
  ["apps/api/AGENTS.md", "agents-api.md"],
  ["apps/experiencias/AGENTS.md", "agents-experiencias.md"],
  ["apps/hub/AGENTS.md", "agents-hub.md"],
  ["packages/sdk/AGENTS.md", "agents-sdk.md"],
  ["packages/ui/AGENTS.md", "agents-ui.md"],
  ["apps/api/src/telemetry/AGENTS.md", "agents-api-telemetry.md"],
  ["apps/api/src/salas/AGENTS.md", "agents-api-salas.md"],
  ["apps/api/src/ai/AGENTS.md", "agents-api-ai.md"],
  ["apps/api/src/experiencias/AGENTS.md", "agents-api-experiencias.md"],
  ["apps/api/src/recursos/AGENTS.md", "agents-api-recursos.md"],
  ["apps/api/src/evidencias/AGENTS.md", "agents-api-evidencias.md"],
  ["apps/api/src/equipes/AGENTS.md", "agents-api-equipes.md"],
  ["scripts/e2e/AGENTS.md", "agents-e2e.md"],
  ["docs/agents/domain.md", "glossario-dominio.md"],
  ["docs/DECISOES.md", "decisoes-adr.md"],
  ["docs/ARQUITETURA.md", "arquitetura.md"],
  ["docs/INFRA.md", "infra.md"],
  // contratos e código canônico (dentro de cerca)
  ["apps/api/src/telemetry/contrato-de-rotas.ts", "contrato-telemetria.md"],
  ["apps/api/src/experiencias/contrato-de-rotas.ts", "contrato-manifesto.md"],
  ["apps/api/src/progress/contrato-de-rotas.ts", "contrato-progresso.md"],
  ["apps/api/src/atividades/contrato-de-rotas.ts", "contrato-atividades.md"],
  ["apps/api/src/comum/liberacao.ts", "guarda-liberacao.md"],
  ["apps/api/src/auth/claims.ts", "perfis-claims.md"],
  ["apps/api/src/recursos/catalogo.ts", "produtos-catalogo.md"],
  ["apps/api/src/comum/series.ts", "series.md"],
  ["packages/sdk/src/types.ts", "sdk-types.md"],
  ["packages/ui/package.json", "ui-package.md"],
  ["apps/hub/lib/experiencias-dev.ts", "experiencias-dev-portas.md"],
  ["apps/api/src/evidencias/fichas/tipos.ts", "evidencia-fichas-tipos.md"],
  ["apps/api/src/equipes/regras.ts", "equipes-regras.md"],
  // exemplares de missão nova: o Júri Estadual (exp06ef1b) é a mais recente
  // com atividade (pacote), rodada, equipe e ficha de evidência
  ["apps/api/src/juri-estadual/AGENTS.md", "exemplo-juri-agents.md"],
  ["apps/api/src/juri-estadual/contrato-de-rotas.ts", "exemplo-juri-contrato-rotas.md"],
  ["apps/api/src/juri-estadual/invariantes.ts", "exemplo-juri-invariantes.md"],
  ["apps/experiencias/exp06ef1b/public/experiencia.json", "exemplo-manifesto-exp06ef1b.md"],
  ["apps/experiencias/exp06ef1b/src/lib/telemetria.ts", "exemplo-telemetria-exp06ef1b.md"],
  { glob: ["apps/api/prisma/migrations", /_exp06ef1b_/, "migration.sql"], destino: "exemplo-migration-exp06ef1b.md" },
  // A Seleção: o molde de "zerar = rodada nova"; unooGPT: o chat com IA real
  ["apps/api/src/a-selecao/contrato-de-rotas.ts", "exemplo-a-selecao-contrato-rotas.md"],
  ["apps/api/src/unoogpt/AGENTS.md", "exemplo-unoogpt-agents.md"],
];
/** Cada regra transversal vira `regras-<nome>.md`. */
export const PASTA_REGRAS = "docs/regras";
export const ADR_TEX = "documentacao-latex/secoes/18-adr.tex";
export const SCHEMA_PRISMA = "apps/api/prisma/schema.prisma";
export const OPENAPI = "docs/openapi.json";
/** Os modelos-molde no recorte do schema, pelo `@@map`. Cada prefixo tem de achar ao menos um. */
export const PREFIXOS_DO_RECORTE = ["exp06ef1b_", "exp07ef1b_", "evidencias", "equipes"];

/**
 * Os arquivos que o `contrato-plataforma.json` lê por parse (além das cópias).
 * O workflow os lista em `paths:` — fonte nova aqui é linha nova lá.
 */
export const FONTES_DO_CONTRATO = {
  uiPackage: "packages/ui/package.json",
  designSystem: "docs/regras/design-system.md",
  contratoManifesto: "apps/api/src/experiencias/contrato-de-rotas.ts",
  publicarManifesto: "apps/hub/scripts/publicar-manifesto.mjs",
  experiencias: "apps/experiencias",
  portas: "apps/hub/lib/experiencias-dev.ts",
  adr: ADR_TEX,
  equipes: "apps/api/src/equipes/regras.ts",
  fichas: "apps/api/src/evidencias/fichas/index.ts",
  niveis: "apps/api/src/evidencias/regras.ts",
  vertex: "apps/api/src/ai/vertex.provider.ts",
};

// ─────────────────────────────────────────────────────────── utilitários

function ler(raiz, rel) {
  const p = join(raiz, rel);
  if (!existsSync(p)) throw new ErroDeExtracao(rel, "fonte ausente");
  return readFileSync(p, "utf8");
}

function sha16(texto) {
  return createHash("sha256").update(texto, "utf8").digest("hex").slice(0, 16);
}

function git(raiz, ...args) {
  return execFileSync("git", args, { cwd: raiz, encoding: "utf8" }).trim();
}

/** Exige o casamento: regex que não casa é erro, nunca `undefined` em silêncio. */
function casar(texto, regex, arquivo, oque) {
  const m = texto.match(regex);
  if (!m) throw new ErroDeExtracao(arquivo, `não achei ${oque} (regex ${regex})`);
  return m;
}

/** As strings de um literal de array: `["a", "b"]` ou `[\n "a",\n]`. */
function stringsDoArray(corpo, arquivo, oque) {
  const itens = [...corpo.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (itens.length === 0) throw new ErroDeExtracao(arquivo, `${oque} veio vazio`);
  return itens;
}

function arrayConst(texto, nome, arquivo) {
  const m = casar(texto, new RegExp(`export const ${nome}\\s*=\\s*\\[([^\\]]*)\\]`), arquivo, `\`${nome}\``);
  return stringsDoArray(m[1], arquivo, nome);
}

const LINGUAGEM = { ".ts": "ts", ".tsx": "tsx", ".mjs": "js", ".js": "js", ".json": "json", ".sql": "sql", ".prisma": "prisma" };

/** Cerca mais longa que qualquer sequência de crases do texto: código com Markdown no comentário não a fecha. */
function cercar(texto, linguagem) {
  const maior = Math.max(2, ...[...texto.matchAll(/`{3,}/g)].map((m) => m[0].length));
  const cerca = "`".repeat(maior + 1);
  return `${cerca}${linguagem}\n${texto.replace(/\s+$/, "")}\n${cerca}\n`;
}

function cabecalho(origem, ctx) {
  return `<!-- CÓPIA de plataforma-unooria@${ctx.commit} (${ctx.data}) · origem: ${origem} · não edite -->\n\n`;
}

/** Texto de célula/título LaTeX → texto corrido (só as macros que o índice das ADRs usa). */
export function latexParaTexto(s) {
  let t = s;
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/\\(?:cd|arq|rota|texttt)\{([^{}]*)\}/g, "`$1`")
      .replace(/\\(?:emph|textbf|textit|adrr|enquote)\{([^{}]*)\}/g, "$1");
  }
  return t
    .replace(/\$\\times\$|\\times/g, "×")
    .replace(/\\,/g, " ")
    .replace(/\\([_&%#$])/g, "$1")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────── cópias

function resolverGlob(raiz, [pasta, re, arquivo]) {
  const abs = join(raiz, pasta);
  if (!existsSync(abs)) throw new ErroDeExtracao(pasta, "pasta ausente");
  const achados = readdirSync(abs).filter((n) => re.test(n));
  if (achados.length !== 1) {
    throw new ErroDeExtracao(pasta, `esperava UMA pasta casando ${re}, achei ${achados.length} (${achados.join(", ")})`);
  }
  return `${pasta}/${achados[0]}/${arquivo}`;
}

export function listarFontes(raiz) {
  const lista = FONTES.map((f) => (Array.isArray(f) ? { origem: f[0], destino: f[1] } : { origem: resolverGlob(raiz, f.glob), destino: f.destino }));
  const regras = join(raiz, PASTA_REGRAS);
  if (!existsSync(regras)) throw new ErroDeExtracao(PASTA_REGRAS, "pasta ausente");
  for (const nome of readdirSync(regras).filter((n) => n.endsWith(".md")).sort()) {
    lista.push({ origem: `${PASTA_REGRAS}/${nome}`, destino: `regras-${basename(nome, ".md")}.md` });
  }
  const vistos = new Set();
  for (const { destino } of lista) {
    if (vistos.has(destino)) throw new ErroDeExtracao("FONTES", `destino repetido: ${destino}`);
    vistos.add(destino);
  }
  return lista;
}

function copia(raiz, origem, ctx) {
  const texto = ler(raiz, origem);
  const ext = extname(origem);
  const corpo = ext === ".md" ? texto : `# \`${origem}\`\n\n${cercar(texto, LINGUAGEM[ext] ?? "")}`;
  return cabecalho(origem, ctx) + corpo;
}

// ─────────────────────────────────────────────────────────── gerados

/** O índice das ADRs: número, título, data e estado — o `.tex` inteiro tem centenas de KB. */
export function lerAdrs(raiz) {
  const texto = ler(raiz, ADR_TEX);
  const linhas = [...texto.matchAll(/^(?:\\zebra\s+)?\\adrr\{ADR-(\d+)\}\s*&(.*)\\\\\s*$/gm)];
  if (linhas.length === 0) throw new ErroDeExtracao(ADR_TEX, "o índice (`\\adrr{ADR-NN} & título & data & estado\\\\`) não casou nenhuma linha");
  const adrs = linhas.map((m) => {
    const celulas = m[2].split(/(?<!\\)&/).map((c) => latexParaTexto(c));
    if (celulas.length !== 3) throw new ErroDeExtracao(ADR_TEX, `a linha da ADR-${m[1]} no índice não tem 4 colunas`);
    return { numero: Number(m[1]), titulo: celulas[0], data: celulas[1], estado: celulas[2] };
  });
  const secoes = new Set([...texto.matchAll(/\\section\{ADR-(\d+)\b/g)].map((m) => Number(m[1])));
  const noIndice = new Set(adrs.map((a) => a.numero));
  const soNaSecao = [...secoes].filter((n) => !noIndice.has(n));
  const soNoIndice = [...noIndice].filter((n) => !secoes.has(n));
  if (soNaSecao.length || soNoIndice.length) {
    throw new ErroDeExtracao(ADR_TEX, `índice e seções divergem (só na seção: ${soNaSecao.join(", ") || "—"}; só no índice: ${soNoIndice.join(", ") || "—"})`);
  }
  return adrs.sort((a, b) => a.numero - b.numero);
}

const rotuloAdr = (n) => `ADR-${String(n).padStart(2, "0")}`;

function adrLog(adrs, ctx) {
  const linhas = [
    `# \`${ADR_TEX}\` — o registro das ADRs (número, título, data, estado)`,
    "",
    `${adrs.length} ADRs; a última é a ${rotuloAdr(adrs.at(-1).numero)}. O texto completo de cada uma (contexto, alternativas, consequências) está no \`.tex\`; aqui só o índice.`,
    "",
    "| ADR | Decisão | Data | Estado |",
    "|---|---|---|---|",
    ...adrs.map((a) => `| ${rotuloAdr(a.numero)} | ${a.titulo.replace(/\|/g, "\\|")} | ${a.data} | ${a.estado.replace(/\|/g, "\\|")} |`),
  ];
  return cabecalho(ADR_TEX, ctx) + linhas.join("\n") + "\n";
}

function recorteDoSchema(raiz, ctx) {
  const texto = ler(raiz, SCHEMA_PRISMA);
  const blocos = texto.match(/(?:^[ \t]*\/\/\/[^\n]*\n)*^model\s+\w+\s*\{[\s\S]*?\n\}/gm) ?? [];
  const escolhidos = [];
  for (const prefixo of PREFIXOS_DO_RECORTE) {
    const deste = blocos.filter((b) => new RegExp(`@@map\\("${prefixo}`).test(b));
    if (deste.length === 0) throw new ErroDeExtracao(SCHEMA_PRISMA, `nenhum model com @@map("${prefixo}…")`);
    escolhidos.push(...deste.filter((b) => !escolhidos.includes(b)));
  }
  const corpo =
    `# \`${SCHEMA_PRISMA}\` — só os modelos das missões-molde e das tabelas de plataforma que elas usam\n\n` +
    `${escolhidos.length} modelos: \`exp06ef1b_*\` (O Júri Estadual), \`exp07ef1b_*\` (A Seleção), \`evidencias*\` e \`equipes*\`.\n\n` +
    "Padrões a imitar numa missão nova:\n\n" +
    "- **Prefixo é o CÓDIGO da experiência** (`@@map(\"exp06ef1b_…\")`, ADR-110); tabela que serve a todas (`evidencias`, `equipes`, `liberacoes`) fica sem prefixo.\n" +
    "- **`escola_id` em toda tabela, sob RLS** (`ENABLE` + `FORCE ROW LEVEL SECURITY` e a policy `escola_id = current_setting('app.escola_id', true)`), escrita no bloco MANUAL da migration — o Prisma não gera CHECK, índice parcial, RLS nem GRANT. `turma_id` vai denormalizado.\n" +
    "- **A atividade é do professor, por turma** (ADR-130): o pacote (`exp06ef1b_pacotes`) ou a cobertura (`exp07ef1b_coberturas`) que ele homologa, com `ativo`, `criado_por` sem FK e o conteúdo em `Json` validado pelo Zod do `contrato-de-rotas.ts` (o CHECK cobra só a forma).\n" +
    "- **O gate da turma** (`<código>_gates_turma`, PK `turma_id`) diz qual atividade e qual RODADA estão em andamento. \"Zerar a turma\" soma 1 na rodada — nunca apaga sessão.\n" +
    "- **Sessão por (atividade, rodada, estudante)**, com `@@unique` nomeado à mão (`map:`; o nome gerado passa de 63 caracteres e o Postgres o corta em silêncio). A rodada anterior fica imutável: é ela que o painel de habilidades lê (vale a melhor rodada).\n" +
    "- **Estado como `String` com CHECK na migration, nunca `enum`**: passo, etapa e vocabulários; cada latch (carimbo + valores) é amarrado por CHECK ao passo gravado.\n" +
    "- Contadores de `tentativas`, `versao_instrumento` para reprocessamento, e **texto livre de menor em tabela própria** (`exp07ef1b_reflexoes`, com `chars` = `char_length(texto)` no CHECK), lida só por quem leciona.\n" +
    "- A missão não grava nível em tabela própria: chama `EvidenciasService.marcar` com a ficha registrada (`evidencias_marcas`), e a equipe é da atividade (`equipes_*`).\n\n" +
    cercar(escolhidos.join("\n\n"), "prisma");
  return { conteudo: cabecalho(SCHEMA_PRISMA, ctx) + corpo, modelos: escolhidos.length };
}

const METODOS = ["get", "post", "put", "patch", "delete"];

export function rotasDoOpenapi(doc) {
  const rotas = [];
  for (const caminho of Object.keys(doc.paths).sort()) {
    for (const [metodo, op] of Object.entries(doc.paths[caminho])) {
      if (METODOS.includes(metodo.toLowerCase())) rotas.push({ metodo: metodo.toUpperCase(), caminho, tag: (op.tags ?? []).join(", ") });
    }
  }
  return rotas;
}

function openapi(raiz, ctx) {
  let doc;
  try {
    doc = JSON.parse(ler(raiz, OPENAPI));
  } catch (e) {
    if (e instanceof ErroDeExtracao) throw e;
    throw new ErroDeExtracao(OPENAPI, `JSON inválido (${e.message})`);
  }
  if (!doc.paths || Object.keys(doc.paths).length === 0) throw new ErroDeExtracao(OPENAPI, "sem `paths`");
  const linhas = [
    `# \`${OPENAPI}\` — índice de rotas (método · caminho · resumo · tags)`,
    "",
    `${Object.keys(doc.paths).length} caminhos. O contrato completo (Zod → OpenAPI) está no repositório; aqui só o mapa.`,
    "",
    "| Método | Caminho | Resumo | Tags |",
    "|---|---|---|---|",
  ];
  for (const caminho of Object.keys(doc.paths).sort()) {
    for (const [metodo, op] of Object.entries(doc.paths[caminho])) {
      if (!METODOS.includes(metodo.toLowerCase())) continue;
      const resumo = (op.summary ?? "").replace(/\|/g, "\\|").trim();
      linhas.push(`| ${metodo.toUpperCase()} | \`${caminho}\` | ${resumo} | ${(op.tags ?? []).join(", ")} |`);
    }
  }
  const indice = cabecalho(OPENAPI, ctx) + linhas.join("\n") + "\n";
  const rotas = JSON.stringify({ commit: ctx.commit, data_commit: ctx.data, origem: OPENAPI, rotas: rotasDoOpenapi(doc) }, null, 1) + "\n";
  return { indice, rotas, caminhos: Object.keys(doc.paths).length };
}

// ─────────────────────────────────────────────────────────── contrato-plataforma.json

function designSystem(raiz) {
  const arqPkg = FONTES_DO_CONTRATO.uiPackage;
  let pkg;
  try {
    pkg = JSON.parse(ler(raiz, arqPkg));
  } catch (e) {
    if (e instanceof ErroDeExtracao) throw e;
    throw new ErroDeExtracao(arqPkg, `JSON inválido (${e.message})`);
  }
  const dependencia = pkg.dependencies?.["@unooria/design-system"];
  if (!dependencia) throw new ErroDeExtracao(arqPkg, "sem `dependencies[\"@unooria/design-system\"]`");
  if (!pkg.name) throw new ErroDeExtracao(arqPkg, "sem `name`");
  const pontes = Object.keys(pkg.exports ?? {})
    .filter((e) => /^\.\/ds(-[\w-]+)?$/.test(e))
    .map((e) => ({ ponte: `${pkg.name}/${e.slice(2)}`, export: e }));
  if (pontes.length === 0) throw new ErroDeExtracao(arqPkg, "nenhum export `./ds` ou `./ds-*`");

  const arqDs = FONTES_DO_CONTRATO.designSystem;
  const linhas = ler(raiz, arqDs).split("\n");
  const ini = linhas.findIndex((l) => /^\|\s*Seção\s*\|\s*Ponte\s*\|/.test(l));
  if (ini < 0) throw new ErroDeExtracao(arqDs, "não achei a tabela `| Seção | Ponte | Onde vale |`");
  const secoes = [];
  for (const linha of linhas.slice(ini + 2)) {
    if (!linha.startsWith("|")) break;
    const celulas = linha.split("|").slice(1, -1).map((c) => c.trim());
    const secao = casar(celulas[0] ?? "", /^`([\w-]+)`$/, arqDs, `o nome da seção na linha «${linha.slice(0, 60)}»`)[1];
    const cruPonte = (celulas[1] ?? "").replace(/`/g, "").trim();
    const ponte = /^[—–-]$/.test(cruPonte) || cruPonte === "" ? null : cruPonte;
    if (ponte && !pontes.some((p) => p.ponte === ponte)) {
      throw new ErroDeExtracao(arqDs, `a seção \`${secao}\` aponta para \`${ponte}\`, que não é export de ${arqPkg}`);
    }
    secoes.push({ secao, ponte, linha });
  }
  if (secoes.length === 0) throw new ErroDeExtracao(arqDs, "a tabela de seções veio vazia");
  return { dependencia, pontes, secoes };
}

function manifesto(raiz, experiencias) {
  const arq = FONTES_DO_CONTRATO.contratoManifesto;
  const texto = ler(raiz, arq);
  const capabilities = arrayConst(texto, "CAPABILITIES", arq);
  const permissoesIframe = arrayConst(texto, "PERMISSOES_DE_IFRAME", arq);
  const upsert = casar(texto, /export const UpsertSchema = z\.object\(\{([\s\S]*?)\n\}\);/, arq, "`UpsertSchema`")[1];
  const camposUpsert = [...upsert.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
  if (camposUpsert.length === 0) throw new ErroDeExtracao(arq, "`UpsertSchema` sem campos");
  const publico = stringsDoArray(casar(upsert, /publico:\s*z\s*\.enum\(\[([^\]]*)\]\)/, arq, "`publico: z.enum([...])` no UpsertSchema")[1], arq, "publico");

  // O manifesto (`experiencia.json`) não usa os nomes do UpsertSchema: quem
  // traduz é o publicar-manifesto (`versao` → `versaoAtiva`, `id` → URL).
  const arqPub = FONTES_DO_CONTRATO.publicarManifesto;
  const pub = ler(raiz, arqPub);
  const chaveDaVersao = casar(pub, /const versao = [^;\n]*manifesto\.(\w+)/, arqPub, "`const versao = … manifesto.<chave>`")[1];
  const doManifesto = {};
  for (const m of pub.matchAll(/^\s+(\w+):\s*(?:manifesto\.(\w+)|(versao)\b)/gm)) doManifesto[m[1]] = m[2] ?? chaveDaVersao;
  const semTraducao = camposUpsert.filter((c) => !doManifesto[c]);
  if (semTraducao.length) throw new ErroDeExtracao(arqPub, `não achei de que chave do manifesto sai ${semTraducao.map((c) => `\`${c}\``).join(", ")}`);
  casar(pub, /manifesto\.id\b/, arqPub, "`manifesto.id`");
  const chaves = ["id", ...camposUpsert.map((c) => doManifesto[c])];
  // Chave que os manifestos usam e o PUT não leva (`verbos`, lido pela telemetria).
  for (const e of experiencias) for (const k of e._chaves) if (!chaves.includes(k)) chaves.push(k);
  return { chaves, capabilities, permissoes_iframe: permissoesIframe, publico };
}

/**
 * As experiências ATIVAS: toda pasta de `apps/experiencias/` com
 * `public/experiencia.json`, MENOS `_template` (o molde do `pnpm new:exp`) e
 * `backup-*` (arquivada, ADR-116 — não entra no catálogo nem no deploy).
 */
function experiencias(raiz, portas) {
  const pasta = FONTES_DO_CONTRATO.experiencias;
  const abs = join(raiz, pasta);
  if (!existsSync(abs)) throw new ErroDeExtracao(pasta, "pasta ausente");
  const lista = [];
  for (const nome of readdirSync(abs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    if (nome.startsWith("_") || nome.startsWith("backup-")) continue;
    const rel = `${pasta}/${nome}/public/experiencia.json`;
    if (!existsSync(join(raiz, rel))) continue;
    let m;
    try {
      m = JSON.parse(readFileSync(join(raiz, rel), "utf8"));
    } catch (e) {
      throw new ErroDeExtracao(rel, `JSON inválido (${e.message})`);
    }
    if (m.id !== nome) throw new ErroDeExtracao(rel, `id \`${m.id}\` diferente do nome da pasta \`${nome}\``);
    for (const campo of ["nome", "versao", "produto"]) if (!m[campo]) throw new ErroDeExtracao(rel, `sem \`${campo}\``);
    lista.push({
      id: m.id,
      nome: m.nome,
      pasta: `${pasta}/${nome}`,
      series: m.series ?? [],
      unidade: m.unidade ?? null,
      produto: m.produto,
      publico: m.publico ?? "estudante",
      versao: m.versao,
      porta: portas.ocupadas[m.id] ?? null,
      _chaves: Object.keys(m),
    });
  }
  if (lista.length === 0) throw new ErroDeExtracao(pasta, "nenhuma experiência ativa com public/experiencia.json");
  return lista;
}

function portas(raiz) {
  const arq = FONTES_DO_CONTRATO.portas;
  const texto = ler(raiz, arq);
  const ocupadas = {};
  for (const m of texto.matchAll(/^\s*"([\w-]+)":\s*"http:\/\/localhost:(\d+)"/gm)) ocupadas[m[1]] = Number(m[2]);
  const valores = Object.values(ocupadas);
  if (valores.length === 0) throw new ErroDeExtracao(arq, "nenhuma entrada `\"<expId>\": \"http://localhost:<porta>\"`");
  let proxima = Math.max(...valores) + 1;
  while (valores.includes(proxima)) proxima++;
  return { ocupadas, proxima_livre: proxima };
}

function equipes(raiz) {
  const arq = FONTES_DO_CONTRATO.equipes;
  const texto = ler(raiz, arq);
  return { com_equipe: arrayConst(texto, "EXPERIENCIAS_COM_EQUIPE", arq), com_atividade: arrayConst(texto, "EXPERIENCIAS_COM_ATIVIDADE", arq) };
}

function evidencia(raiz) {
  const arq = FONTES_DO_CONTRATO.fichas;
  const texto = ler(raiz, arq);
  const nomes = casar(texto, /export const FICHAS[^=]*=\s*\[([^\]]*)\]/, arq, "`FICHAS`")[1].match(/\w+/g) ?? [];
  if (nomes.length === 0) throw new ErroDeExtracao(arq, "`FICHAS` veio vazio");
  const fichas = nomes.map((nome) => {
    const de = casar(texto, new RegExp(`import \\{[^}]*\\b${nome}\\b[^}]*\\} from "\\./([\\w-]+)"`), arq, `o import de \`${nome}\``)[1];
    const arqFicha = `${dirname(arq)}/${de}.ts`;
    return casar(ler(raiz, arqFicha), /expId:\s*"([\w-]+)"/, arqFicha, "`expId`")[1];
  });
  const arqNiveis = FONTES_DO_CONTRATO.niveis;
  return { fichas, niveis: arrayConst(ler(raiz, arqNiveis), "STATUS_DE_MARCA", arqNiveis) };
}

function ia(raiz) {
  const arq = FONTES_DO_CONTRATO.vertex;
  const texto = ler(raiz, arq);
  return {
    modelo_padrao: casar(texto, /const MODELO_PADRAO = "([^"]+)"/, arq, "`MODELO_PADRAO`")[1],
    modelo_imagem_padrao: casar(texto, /const MODELO_IMAGEM_PADRAO = "([^"]+)"/, arq, "`MODELO_IMAGEM_PADRAO`")[1],
  };
}

export function contratoPlataforma(raiz, ctx, adrs) {
  const p = portas(raiz);
  const exps = experiencias(raiz, p);
  const contrato = {
    versao_formato: VERSAO_FORMATO,
    commit: ctx.commit,
    data_commit: ctx.data,
    design_system: designSystem(raiz),
    manifesto: manifesto(raiz, exps),
    experiencias: exps.map(({ _chaves, ...e }) => e),
    portas: p,
    adr: {
      ultima: adrs.at(-1).numero,
      proxima: adrs.at(-1).numero + 1,
      titulos: Object.fromEntries(adrs.map((a) => [rotuloAdr(a.numero), a.titulo])),
    },
    equipes: equipes(raiz),
    evidencia: evidencia(raiz),
    ia: ia(raiz),
  };
  return contrato;
}

// ─────────────────────────────────────────────────────────── montagem

function contexto(raiz) {
  return {
    commit: git(raiz, "rev-parse", "--short=8", "HEAD"),
    data: git(raiz, "log", "-1", "--format=%cs"),
    branch: process.env.GITHUB_REF_NAME || git(raiz, "branch", "--show-current") || "HEAD",
    geradoEm: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
  };
}

/**
 * Gera a base inteira em `<saida>/plataforma/`. Tudo é montado em memória
 * ANTES de escrever: um erro de extração não deixa pasta pela metade.
 */
export function extrair(raiz, saida) {
  const ctx = contexto(raiz);
  const arquivos = []; // { origem, destino, conteudo }
  for (const { origem, destino } of listarFontes(raiz)) arquivos.push({ origem, destino: `arquivos/${destino}`, conteudo: copia(raiz, origem, ctx) });
  const adrs = lerAdrs(raiz);
  arquivos.push({ origem: ADR_TEX, destino: "arquivos/adr-log.md", conteudo: adrLog(adrs, ctx) });
  const schema = recorteDoSchema(raiz, ctx);
  arquivos.push({ origem: SCHEMA_PRISMA, destino: "arquivos/exemplo-schema-exp.md", conteudo: schema.conteudo });
  const api = openapi(raiz, ctx);
  arquivos.push({ origem: OPENAPI, destino: "arquivos/openapi-indice.md", conteudo: api.indice });
  arquivos.push({ origem: OPENAPI, destino: "openapi-rotas.json", conteudo: api.rotas });
  const contrato = contratoPlataforma(raiz, ctx, adrs);
  arquivos.push({ origem: "(parse; veja FONTES_DO_CONTRATO em scripts/base-do-gerador/extrair.mjs)", destino: "contrato-plataforma.json", conteudo: JSON.stringify(contrato, null, 1) + "\n" });

  const pastaRel = `plataforma/${ctx.commit}/`;
  const pasta = join(saida, "plataforma", ctx.commit);
  rmSync(pasta, { recursive: true, force: true });
  mkdirSync(join(pasta, "arquivos"), { recursive: true });
  const lista = [];
  for (const a of arquivos) {
    writeFileSync(join(pasta, a.destino), a.conteudo, "utf8");
    lista.push({ origem: a.origem, destino: a.destino, sha256: sha16(a.conteudo), bytes: Buffer.byteLength(a.conteudo, "utf8") });
  }
  const comum = { versao_formato: VERSAO_FORMATO, commit: ctx.commit, branch: ctx.branch, data_commit: ctx.data, gerado_em: ctx.geradoEm };
  writeFileSync(join(pasta, "manifesto.json"), JSON.stringify({ ...comum, arquivos: lista }, null, 1) + "\n", "utf8");
  const atual = { ...comum, pasta: pastaRel, arquivos: lista.length };
  writeFileSync(join(saida, "plataforma", "atual.json"), JSON.stringify(atual, null, 1) + "\n", "utf8");
  return { ctx, pasta, atual, contrato, arquivos: lista, modelos: schema.modelos, caminhos: api.caminhos };
}

function gcloud(...args) {
  console.log(`$ gcloud ${args.join(" ")}`);
  execFileSync("gcloud", args, { stdio: "inherit" });
}

/** Escrita atômica para quem lê: a pasta do commit primeiro, o ponteiro por último. */
function enviar(destino, resultado, saida) {
  const base = destino.replace(/\/+$/, "");
  gcloud("storage", "cp", "-r", resultado.pasta, `${base}/plataforma/`);
  gcloud("storage", "cp", "--cache-control=no-store", "--content-type=application/json", join(saida, "plataforma", "atual.json"), `${base}/plataforma/atual.json`);
}

function resumo(r) {
  const c = r.contrato;
  const kb = r.arquivos.reduce((s, a) => s + a.bytes, 0) / 1024;
  return [
    `ok → ${r.arquivos.length} arquivos (${kb.toFixed(0)} KB) em ${r.pasta}`,
    `   plataforma-unooria@${r.ctx.commit} (${r.ctx.branch}, ${r.ctx.data})`,
    `   DS ${c.design_system.dependencia} · seções: ${c.design_system.secoes.map((s) => s.secao).join(", ")}`,
    `   ADR: última ${c.adr.ultima}, próxima ${c.adr.proxima} · porta livre: ${c.portas.proxima_livre}`,
    `   experiências: ${c.experiencias.map((e) => e.id).join(", ")}`,
    `   schema: ${r.modelos} modelos no recorte · OpenAPI: ${r.caminhos} caminhos · modelo de IA: ${c.ia.modelo_padrao}`,
  ].join("\n");
}

const USO = `uso:
  node scripts/base-do-gerador/extrair.mjs --saida <dir>
  node scripts/base-do-gerador/extrair.mjs --enviar gs://<bucket>/base-plataforma`;

export function main(argv) {
  const args = [...argv];
  if (args.length !== 2 || !["--saida", "--enviar"].includes(args[0]) || !args[1]) {
    console.error(USO);
    return 2;
  }
  const [modo, alvo] = args;
  if (modo === "--enviar" && !alvo.startsWith("gs://")) {
    console.error(`--enviar espera gs://…, veio ${alvo}\n${USO}`);
    return 2;
  }
  if (git(RAIZ, "status", "--porcelain")) console.warn("⚠ árvore com alteração não commitada: a base leva o conteúdo do disco com o rótulo do HEAD.");
  const saida = modo === "--saida" ? alvo : mkdtempSync(join(tmpdir(), "base-do-gerador-"));
  try {
    const r = extrair(RAIZ, saida);
    console.log(resumo(r));
    if (modo === "--enviar") {
      enviar(alvo, r, saida);
      console.log(`enviado → ${alvo.replace(/\/+$/, "")}/${r.atual.pasta} e atual.json`);
    }
    return 0;
  } catch (e) {
    console.error(`✖ ${e instanceof ErroDeExtracao ? "extração falhou" : "erro"}: ${e.message}`);
    return 1;
  } finally {
    if (modo === "--enviar") rmSync(saida, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
