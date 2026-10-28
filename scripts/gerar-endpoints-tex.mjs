#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Gera o Apêndice C (catálogo de endpoints) a partir do `docs/openapi.json`.
 *
 * O apêndice era prosa escrita à mão para 146 rotas, e nada obrigava essa prosa
 * a concordar com o código. Agora ela É o código: o `resumo`, a `descricao` e as
 * `notas` do `@Contrato` de cada rota, e a autorização vinda das extensões
 * `x-papeis`/`x-acesso` — legíveis por máquina justamente para este gerador não
 * precisar ler a própria prosa procurando "**Papéis:**". Um gerador que faz
 * parsing de texto quebra na primeira reescrita da frase, e quebra em silêncio.
 *
 *   node scripts/gerar-endpoints-tex.mjs [destino.tex]
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");
const ORIGEM = resolve(RAIZ, "docs/openapi.json");
const DESTINO_PADRAO = resolve(RAIZ, "documentacao-latex/apendices/c-endpoints.tex");

/**
 * Escapa para LaTeX. A ordem importa: a contrabarra primeiro, senão ela escapa
 * as barras que as próprias substituições acabaram de inserir.
 *
 * Os três caracteres do fim são os que a codificação T1 ENGOLE em silêncio (sem
 * erro de compilação, sem aviso): o travessão vira `---`, e o resto some da
 * página se passar literal.
 */
function escapar(texto) {
  return texto
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/—/g, "---")
    .replace(/–/g, "--")
    .replace(/·/g, "\\textbullet{}")
    .replace(/§/g, "\\S{}")
    .replace(/→/g, "\\seta{}")
    .replace(/⇒/g, "\\implica{}")
    .replace(/⇔/g, "\\ensuremath{\\Leftrightarrow}")
    .replace(/▶/g, "\\ensuremath{\\blacktriangleright}")
    .replace(/…/g, "\\ldots{}");
}

/**
 * Markdown restrito para LaTeX: negrito, `código` e aspas.
 *
 * Fatia o texto nos trechos marcados ANTES de escapar, porque o escape
 * transformaria os próprios delimitadores. O que sobra entre os trechos é texto
 * comum e passa pelo `escapar`.
 */
function markdown(texto) {
  const pedacos = [];
  const re = /\*\*(.+?)\*\*|`([^`]+?)`|"([^"]+?)"/gs;
  let ultimo = 0;
  let m;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) pedacos.push(escapar(texto.slice(ultimo, m.index)));
    if (m[1] !== undefined) pedacos.push(`\\textbf{${escapar(m[1])}}`);
    else if (m[2] !== undefined) pedacos.push(`\\cd{${codigoQuebravel(m[2])}}`);
    else pedacos.push(`\\enquote{${escapar(m[3])}}`);
    ultimo = re.lastIndex;
  }
  pedacos.push(escapar(texto.slice(ultimo)));
  return (
    pedacos
      .join("")
      // Referência a ADR ganha a macro da casa, como no resto do documento.
      .replace(/\(?(ADR-\d+)\)?/g, "\\adrr{$1}")
      // Item de lista vira marcador em parágrafo próprio. Sem isto as notas
      // saíam emendadas na mesma linha ("- uma - outra - outra"), ilegíveis.
      .replace(/\n[-*] +/g, "\\par \\hspace*{1em}\\textbullet{} ")
      // Parágrafo do markdown vira quebra na CÉLULA: `\par` dentro de tabularx
      // funciona; uma linha em branco encerraria a célula.
      .replace(/\n\n+/g, "\\par ")
      .replace(/\n/g, " ")
      .trim()
  );
}

/**
 * Trecho de código com pontos de quebra.
 *
 * Mesmo motivo do caminho: `\texttt` não hifeniza, e um token longo — o
 * cabeçalho da planilha (`matricula,nome,usuario,...`, 52 caracteres) é o pior —
 * vaza para fora da coluna em vez de quebrar. As barras, vírgulas e sublinhados
 * são os lugares onde a quebra não atrapalha a leitura.
 */
function codigoQuebravel(texto) {
  return escapar(texto).replace(/([,/]|\\_)/g, "$1\\allowbreak{}");
}

/**
 * O caminho com pontos de quebra depois de cada barra.
 *
 * Sem isto, `POST /unoogpt/professor/turmas/{turmaId}/relogio` não cabe na
 * coluna e vaza para fora da tabela: `\texttt` não hifeniza, então o TeX
 * prefere estourar a linha a quebrar a palavra. `\allowbreak` dá a ele um lugar
 * legítimo para quebrar, e sem inserir hífen — hífen num caminho de URL seria
 * pior que o estouro, porque o leitor copiaria o hífen junto.
 */
function caminhoQuebravel(texto) {
  return escapar(texto).replace(/\//g, "/\\allowbreak{}");
}

/** A coluna de autorização, a partir das extensões — nunca da prosa. */
function autorizacao(op) {
  const acesso = op["x-acesso"] ?? "token";
  if (acesso === "publica") return "\\textbf{público}";
  if (acesso === "servico") return "\\textbf{serviço}";
  if (acesso === "push") return "\\textbf{push}";
  if (acesso === "token-no-corpo") return "\\textbf{token no corpo}";
  const papeis = op["x-papeis"] ?? [];
  return papeis.length > 0 ? papeis.map((p) => `\\cd{${escapar(p)}}`).join(", ") : "\\emph{(qualquer)}";
}

/** A semântica: o resumo, a prosa e as restrições, nessa ordem. */
function semantica(op) {
  const partes = [markdown(op.summary ?? "")];
  if (op.description) {
    // A linha de "Acesso:"/"Papéis:" sai: ela já é a COLUNA ao lado, e repetir
    // dobraria a informação que mais custa estar errada.
    const prosa = op.description
      .split(/\n\n+/)
      .filter((p) => !/^\*\*(Acesso|Papéis):\*\*/.test(p.trim()))
      .join("\n\n");
    if (prosa.trim()) partes.push(markdown(prosa));
  }
  return partes.filter(Boolean).join("\\par ");
}

const ORDEM_DOS_VERBOS = ["get", "post", "put", "patch", "delete"];

function main() {
  const doc = JSON.parse(readFileSync(ORIGEM, "utf8"));
  const destino = process.argv[2] ? resolve(process.argv[2]) : DESTINO_PADRAO;

  /** Agrupa por tag — que é o primeiro segmento do caminho. */
  const porTag = new Map();
  for (const [caminho, item] of Object.entries(doc.paths)) {
    for (const verbo of ORDEM_DOS_VERBOS) {
      const op = item[verbo];
      if (!op) continue;
      const tag = op.tags?.[0] ?? "raiz";
      if (!porTag.has(tag)) porTag.set(tag, []);
      porTag.get(tag).push({ verbo: verbo.toUpperCase(), caminho, op });
    }
  }

  const linhas = [];
  linhas.push("% ===========================================================================");
  linhas.push("%  Apendice C - Catalogo de endpoints");
  linhas.push("%");
  linhas.push("%  ARQUIVO GERADO. Nao edite a mao: o conteudo vem do @Contrato de cada");
  linhas.push("%  rota, via docs/openapi.json.");
  linhas.push("%");
  linhas.push("%    npx ts-node --transpile-only apps/api/scripts/gerar-openapi.ts");
  linhas.push("%    node scripts/gerar-endpoints-tex.mjs");
  linhas.push("% ===========================================================================");
  linhas.push("\\chapter{Catálogo de \\emph{endpoints}}");
  linhas.push("\\label{ap:endpoints}");
  linhas.push("");
  linhas.push(
    "Todas as rotas da API, com o papel autorizado. \\textbf{Este apêndice é gerado} " +
      "a partir do \\cd{@Contrato} de cada rota (\\adrr{ADR-36}): a coluna de autorização " +
      "vem do \\cd{@Roles} real, e a semântica, do resumo e das notas declarados no " +
      "\\emph{controller}. Convenções transversais e justificativas estão no " +
      "Capítulo~\\ref{cap:api}.",
  );
  linhas.push("");
  linhas.push("\\begin{tabularx}{\\linewidth}{@{}L{28mm}X@{}}");
  linhas.push("\\toprule");
  linhas.push("\\headrow \\thd{Marca} & \\thd{Significado}\\\\");
  linhas.push("\\midrule");
  linhas.push("\\cd{papel} & \\cd{@Roles(...)} restringe aos papéis listados.\\\\");
  linhas.push("\\zebra \\emph{(qualquer)} & \\cd{OidcGuard} apenas: qualquer papel autenticado.\\\\");
  linhas.push("\\textbf{público} & Sem \\emph{guard}, deliberadamente.\\\\");
  linhas.push(
    "\\zebra \\textbf{serviço} & Chave em cabeçalho; \\textbf{503} se a variável estiver ausente.\\\\",
  );
  linhas.push("\\textbf{push} & \\cd{PubSubPushGuard}; \\textbf{401} se as variáveis estiverem ausentes.\\\\");
  linhas.push(
    "\\zebra \\textbf{token no corpo} & O \\emph{token} vai no corpo, não no cabeçalho --- " +
      "\\cd{sendBeacon} não manda cabeçalho.\\\\",
  );
  linhas.push("\\bottomrule");
  linhas.push("\\end{tabularx}");
  linhas.push("");

  let total = 0;
  for (const tag of [...porTag.keys()].sort()) {
    const rotas = porTag.get(tag).sort((a, b) => a.caminho.localeCompare(b.caminho));
    linhas.push(`\\section{${escapar(tag)}}`);
    linhas.push("");
    linhas.push("\\begin{tabularx}{\\linewidth}{@{}L{40mm}L{24mm}X@{}}");
    linhas.push("\\toprule");
    linhas.push("\\headrow \\thd{Rota} & \\thd{Autorização} & \\thd{Semântica}\\\\");
    linhas.push("\\midrule");
    // `ltablex` faz a tabularx quebrar entre páginas; o `\endhead` repete o
    // cabeçalho na continuação. Sem ele, a segunda página de uma seção longa
    // vira três colunas sem rótulo.
    linhas.push("\\endhead");
    rotas.forEach(({ verbo, caminho, op }, i) => {
      const zebra = i % 2 === 1 ? "\\zebra " : "";
      linhas.push(
        `${zebra}\\rota{${escapar(verbo)} ${caminhoQuebravel(caminho)}} & ${autorizacao(op)} & ${semantica(op)}\\\\`,
      );
      total += 1;
    });
    linhas.push("\\bottomrule");
    linhas.push("\\end{tabularx}");
    linhas.push("");
  }

  writeFileSync(destino, linhas.join("\n") + "\n", "utf8");
  console.log(`${destino}: ${porTag.size} seções, ${total} rotas`);
}

main();
