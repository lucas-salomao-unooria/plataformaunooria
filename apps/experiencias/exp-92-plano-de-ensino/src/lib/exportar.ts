import type { Aula, Configuracao, PlanoDePeriodo } from "./tipos";
import { DIAS, dataLonga } from "./tipos";

/**
 * Exportação do plano — `.doc` e impressão.
 *
 * O `.doc` é um HTML com os namespaces do MS Office: o Word, o Google Docs e o
 * LibreOffice abrem como documento, e o professor edita. Não é DOCX (zip), e a
 * escolha é a mesma da exp-90 — zero dependência no bundle, download imediato.
 *
 * A IMPRESSÃO é o segundo caminho, e não é um detalhe: o plano de aula da
 * semana vai impresso para a pasta do professor e para a mesa da coordenação.
 * Uma folha de impressão ruim é o motivo pelo qual professor recopia à mão o
 * que o sistema já tinha.
 *
 * Cores como literais porque o Word não resolve CSS variable — todos valores de
 * token do @unooria/design-system:
 *   #22272A neutral-950 · #383E41 neutral-900 · #3D4448 neutral-800
 *   #475157 neutral-700 · #536167 neutral-600 · #CBD4D6 neutral-200
 *   #E4E8E9 neutral-150 · #F5F5F5 neutral-100 · #BDD0EF brandnavy-300
 */

const FOLHA = `
  @page Section1 { size: 21cm 29.7cm; margin: 2cm; mso-page-orientation: portrait; }
  div.Section1 { page: Section1; }
  body { font-family: 'Segoe UI', 'Open Sans', 'Calibri', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #475157; margin: 0; }
  h1 { font-size: 18pt; font-weight: bold; color: #22272A; margin: 0 0 6pt; }
  h2 { font-size: 15pt; font-weight: 600; color: #383E41; margin: 18pt 0 6pt; }
  h3 { font-size: 13pt; font-weight: 600; color: #3D4448; margin: 12pt 0 6pt; }
  p { font-size: 12pt; color: #475157; margin-bottom: 9pt; }
  ul, ol { margin-bottom: 9pt; padding-left: 18pt; }
  li { font-size: 12pt; color: #475157; margin-bottom: 3pt; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 12pt; }
  th, td { border: 1pt solid #CBD4D6; padding: 6pt 9pt; text-align: left; font-size: 10.5pt; vertical-align: top; }
  th { background-color: #F5F5F5; font-weight: 600; color: #383E41; }
  blockquote { border-left: 3pt solid #BDD0EF; padding-left: 12pt; color: #536167; font-style: italic; margin: 12pt 0; }
  hr { border: none; border-top: 1pt solid #E4E8E9; margin: 18pt 0; }
  strong { font-weight: 600; }
  .cabecalho { border-bottom: 2pt solid #CBD4D6; padding-bottom: 9pt; margin-bottom: 18pt; }
  .cabecalho p { margin: 2pt 0; font-size: 10.5pt; color: #536167; }
  .aula { border: 1pt solid #CBD4D6; padding: 9pt 12pt; margin-bottom: 12pt; page-break-inside: avoid; }
  .aula h3 { margin-top: 0; }
  .rotulo { font-size: 9.5pt; font-weight: 600; color: #536167; text-transform: uppercase; letter-spacing: 0.4pt; margin: 9pt 0 2pt; }
  .codigo { font-family: 'Consolas', monospace; font-size: 10pt; color: #383E41; }
  .cumprida { color: #536167; font-size: 10pt; font-style: italic; }
`;

function envelope(titulo: string, corpo: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapar(titulo)}</title><style>${FOLHA}</style></head>
<body><div class="Section1">${corpo}</div></body></html>`;
}

/** Nome de arquivo seguro: só letras (com acento), dígitos, `_` e `-`. */
export function nomeDoArquivo(titulo: string, extensao = "doc"): string {
  const limpo = titulo
    .replace(/[^a-zA-Z0-9À-ÿºª\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `${limpo || "Plano_de_Ensino"}.${extensao}`;
}

/**
 * Dispara o download no navegador.
 *
 * As três linhas que parecem cerimônia são as que fazem o download acontecer
 * dentro do iframe do hub, e cada uma custou um sintoma sem mensagem:
 *
 *  - **o `<a>` entra no DOM** antes do `click()`. Elemento desanexado funciona
 *    no Chrome e é ignorado no Firefox e no Safari, em silêncio;
 *  - **a revogação espera.** `revokeObjectURL` na linha seguinte ao `click()`
 *    corre contra o início da transferência: o navegador ainda não leu o blob e
 *    a URL já não existe;
 *  - e o iframe precisa de `allow-downloads` no sandbox, que vem da permissão
 *    `downloads` do `experiencia.json` (ver o `ExpFrame` do hub). Sem ela nada
 *    disto importa: o bloqueio é do navegador e é MUDO — sem erro na tela, sem
 *    linha no console, com o `click()` voltando como se tivesse funcionado.
 *    Foi assim que este botão existiu por uma versão inteira sem nunca ter
 *    baixado um arquivo.
 */
export function baixarDoc(corpoHtml: string, titulo: string): void {
  const blob = new Blob([envelope(titulo, corpoHtml)], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeDoArquivo(titulo);
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Abre a janela de impressão com a folha própria.
 *
 * Escreve num iframe e não numa `window.open`: a experiência roda dentro do
 * iframe do hub, e um pop-up daqui é bloqueado pelo navegador na maioria das
 * configurações — o professor clicaria em "Imprimir" e nada aconteceria.
 */
export function imprimir(corpoHtml: string, titulo: string): void {
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(quadro);

  const doc = quadro.contentDocument;
  if (!doc) {
    document.body.removeChild(quadro);
    return;
  }
  doc.open();
  doc.write(envelope(titulo, corpoHtml));
  doc.close();

  const disparar = () => {
    quadro.contentWindow?.focus();
    quadro.contentWindow?.print();
    // A remoção espera o diálogo: retirar o iframe antes cancela a impressão em
    // alguns navegadores, e o professor vê a caixa fechar sozinha.
    window.setTimeout(() => quadro.remove(), 1000);
  };
  if (doc.readyState === "complete") disparar();
  else quadro.onload = disparar;
}

// ------------------------------------------------------- o plano da semana

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const nl = (s: string) => escapar(s).replace(/\n/g, "<br>");

/**
 * Monta o documento de UMA semana a partir das AULAS estruturadas.
 *
 * O documento nasce do dado, não de prosa que a IA formatou — é o que garante
 * que a aula que o professor editou na tela é a aula que sai no papel. Uma aula
 * marcada como cumprida sai marcada: o plano impresso vira registro de classe.
 */
export function documentoDaSemana(
  semana: PlanoDePeriodo,
  config: Configuracao,
  nomeDoProfessor: string,
): string {
  const partes: string[] = [
    `<div class="cabecalho">`,
    `<h1>Plano de aulas — ${escapar(config.componenteRotulo)}</h1>`,
    `<p><strong>${escapar(config.serieRotulo)}</strong>${config.turmaNome ? ` · Turma ${escapar(config.turmaNome)}` : ""} · Ano letivo ${config.anoLetivo}</p>`,
    `<p>Professor(a): ${escapar(nomeDoProfessor)}</p>`,
    `<p>${escapar(semana.rotulo)} · ${dataLonga(semana.inicio)} a ${dataLonga(semana.fim)} · ${semana.periodoDeAvaliacao}º período de avaliação</p>`,
    `<p>${semana.aulas.length} aula(s) de ${config.minutosPorAula} minutos</p>`,
    `</div>`,
  ];

  for (const aula of semana.aulas) {
    partes.push(bloco(aula, config));
  }

  partes.push(`<hr>`, `<p class="cumprida">${RODAPE}</p>`);
  return partes.join("\n");
}

/** UMA fonte para a procedência do documento: ela sai em toda exportação. */
const RODAPE =
  "Documento gerado pela Plataforma Unooria a partir do plano anual. As habilidades citadas são da Base Nacional Comum Curricular (Brasil, MEC, 2018).";

function bloco(aula: Aula, config: Configuracao): string {
  const dia = DIAS.find((d) => d.valor === aula.diaDaSemana)?.longo ?? "";
  const m = aula.momentos;
  const linhas: string[] = [
    `<div class="aula">`,
    `<h3>Aula ${aula.numero} — ${escapar(aula.tema || "Sem tema definido")}</h3>`,
    `<p class="cumprida">${dia}, ${dataLonga(aula.data)}, às ${escapar(aula.horario)} · ${config.minutosPorAula} min${aula.cumprida ? " · AULA CUMPRIDA" : ""}</p>`,
  ];

  if (aula.objetivo) linhas.push(`<p class="rotulo">Objetivo</p><p>${nl(aula.objetivo)}</p>`);
  if (aula.habilidades.length) {
    linhas.push(
      `<p class="rotulo">Habilidades da BNCC</p><p class="codigo">${aula.habilidades.map(escapar).join(" · ")}</p>`,
    );
  }
  if (aula.conteudo) linhas.push(`<p class="rotulo">Conteúdo</p><p>${nl(aula.conteudo)}</p>`);

  const momentos: [string, typeof m.retomada][] = [
    ["Retomada", m.retomada],
    ["Desenvolvimento", m.desenvolvimento],
    ["Sistematização", m.sistematizacao],
    ["Fechamento", m.fechamento],
  ];
  const comTexto = momentos.filter(([, v]) => v.o_que);
  if (comTexto.length) {
    linhas.push(
      `<p class="rotulo">Sequência da aula</p>`,
      `<table><tr><th style="width:22%">Momento</th><th style="width:11%">Tempo</th><th>O que acontece</th></tr>`,
      ...comTexto.map(
        ([nome, v]) =>
          `<tr><td><strong>${nome}</strong></td><td>${v.minutos} min</td><td>${nl(v.o_que)}</td></tr>`,
      ),
      `</table>`,
    );
  }

  if (aula.recursos.length) {
    linhas.push(`<p class="rotulo">Recursos</p><p>${aula.recursos.map(escapar).join(" · ")}</p>`);
  }
  if (aula.avaliacao) linhas.push(`<p class="rotulo">O que observar</p><p>${nl(aula.avaliacao)}</p>`);
  if (aula.tarefaDeCasa) linhas.push(`<p class="rotulo">Tarefa de casa</p><p>${nl(aula.tarefaDeCasa)}</p>`);
  if (aula.adaptacoes) linhas.push(`<p class="rotulo">Adaptações</p><p>${nl(aula.adaptacoes)}</p>`);
  if (aula.observacaoDoProfessor) {
    linhas.push(
      `<p class="rotulo">Registro do professor</p><blockquote>${nl(aula.observacaoDoProfessor)}</blockquote>`,
    );
  }

  linhas.push(`</div>`);
  return linhas.join("\n");
}

/**
 * O documento de VÁRIAS semanas — a entrega de quinze em quinze dias, ou a do
 * período de avaliação inteiro.
 *
 * O planejamento é sempre semanal (ADR-76) e o recorte da entrega é aqui: a
 * escola que recolhe planejamento quinzenalmente recebe duas semanas no mesmo
 * arquivo, e a que pede o bimestre recebe as dez. Não há "plano quinzenal" como
 * objeto no produto — o que existe é este agrupamento na hora de exportar, e é
 * por isso que trocar de escola não obriga o professor a replanejar nada.
 *
 * Cada semana abre em PÁGINA NOVA (`page-break-before`), menos a primeira: o
 * documento vai impresso para a pasta, e semana que começa no meio da folha é
 * exatamente o que faz o professor recopiar à mão. A primeira é exceção porque
 * uma quebra antes dela deixaria uma página em branco na frente.
 */
export function documentoDeSemanas(
  semanas: readonly PlanoDePeriodo[],
  config: Configuracao,
  nomeDoProfessor: string,
  subtitulo: string,
): string {
  const primeira = semanas[0];
  const ultima = semanas[semanas.length - 1];
  const totalDeAulas = semanas.reduce((t, s) => t + s.aulas.length, 0);

  const partes: string[] = [
    `<div class="cabecalho">`,
    `<h1>Plano de aulas — ${escapar(config.componenteRotulo)}</h1>`,
    `<p><strong>${escapar(config.serieRotulo)}</strong>${config.turmaNome ? ` · Turma ${escapar(config.turmaNome)}` : ""} · Ano letivo ${config.anoLetivo}</p>`,
    `<p>Professor(a): ${escapar(nomeDoProfessor)}</p>`,
    `<p>${escapar(subtitulo)}${primeira && ultima ? ` · ${dataLonga(primeira.inicio)} a ${dataLonga(ultima.fim)}` : ""}</p>`,
    `<p>${semanas.length} semana(s) · ${totalDeAulas} aula(s) de ${config.minutosPorAula} minutos</p>`,
    `</div>`,
  ];

  semanas.forEach((semana, i) => {
    partes.push(
      `<h2${i > 0 ? ' style="page-break-before: always"' : ""}>${escapar(semana.rotulo)} · ${dataLonga(semana.inicio)} a ${dataLonga(semana.fim)}</h2>`,
    );
    for (const aula of semana.aulas) partes.push(bloco(aula, config));
  });

  partes.push(`<hr>`, `<p class="cumprida">${RODAPE}</p>`);
  return partes.join("\n");
}

/** O plano anual já vem como HTML da api; só ganha o cabeçalho da escola. */
export function documentoAnual(
  html: string,
  config: Configuracao,
  nomeDoProfessor: string,
): string {
  return [
    `<div class="cabecalho">`,
    `<h1>Plano Anual — ${escapar(config.componenteRotulo)}</h1>`,
    `<p><strong>${escapar(config.serieRotulo)}</strong>${config.turmaNome ? ` · Turma ${escapar(config.turmaNome)}` : ""} · Ano letivo ${config.anoLetivo}</p>`,
    `<p>Professor(a): ${escapar(nomeDoProfessor)}</p>`,
    `<p>${config.aulasSemanais} aula(s) semanais de ${config.minutosPorAula} min · ${config.dimensionamento.aulasNoAno} aulas no ano · ${config.dimensionamento.horasRelogio} horas-relógio</p>`,
    `</div>`,
    html,
  ].join("\n");
}
