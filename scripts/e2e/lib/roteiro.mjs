import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { ehRuidoDeDev, pendenciaConhecida, vigiarFalhasDaApi } from "./smoke.mjs";

/**
 * A casca compartilhada de TODAS as suítes de ponta a ponta.
 *
 * Antes, cada roteiro carregava sua própria cópia de `registrar`, de `entrar`,
 * do vigia de console e do relatório final — doze cópias que divergiram entre
 * si (uma tirava `fullPage`, outra não; três reprovavam por erro de console e
 * nove não). Divergência em código de teste é pior que em código de produção:
 * quem lê o resultado não sabe qual regra valeu.
 *
 * O que esta casca acrescenta ao que os roteiros já faziam:
 *
 *  1. Um MANIFESTO por suíte (`passos.json`), com uma entrada por print e a
 *     descrição do passo escrita por quem escreveu o passo. É dele que o deck e
 *     o vídeo nascem — antes o roteiro do PPTX era um segundo arquivo de 66 KB
 *     mantido à mão, e ele já descrevia telas que o script não tirava mais.
 *  2. Um `relatorio.md` legível ao lado dos prints.
 *  3. Saída de processo honesta: qualquer `exigir` reprovado, erro de console
 *     não-ruído ou exceção termina com código 1.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export const HUB = process.env.HUB_URL ?? "http://localhost:3000";
export const SENHA_DEMO = process.env.SENHA_DEMO ?? "unooria123";

/** O BFF do hub — é por ele que o navegador logado alcança a api. */
export const BFF = `${HUB}/api/plataforma`;

/**
 * Onde as evidências de uma suíte moram: `testes/<papel>/<suite>/`.
 *
 * A pasta é APAGADA no início de cada execução. Sem isso, o print 7 de uma
 * execução curta convivia com o print 12 da anterior, e o deck montava uma
 * história que nunca aconteceu numa corrida só.
 */
function pastaDaSuite(slug) {
  return join(RAIZ, "testes", slug);
}

export class Roteiro {
  /**
   * @param {object} ficha
   * @param {string} ficha.slug       caminho da evidência: "professor/04-plano-de-aula"
   * @param {string} ficha.papel      estudante | professor | gestor | admin-contrato | publico
   * @param {string} ficha.titulo     título da seção no deck
   * @param {string} ficha.subtitulo  uma linha abaixo do título
   * @param {string} ficha.contexto   o parágrafo de abertura da seção
   * @param {string[]} ficha.prova    o que a suíte inteira comprova
   * @param {string} ficha.comando    como reexecutar
   */
  static async iniciar(ficha) {
    const roteiro = new Roteiro(ficha);
    await roteiro.#abrirNavegador();
    return roteiro;
  }

  constructor(ficha) {
    this.ficha = ficha;
    this.saida = pastaDaSuite(ficha.slug);
    this.passos = [];
    this.verificacoes = [];
    this.erros = [];
    this.falhasDaApi = [];
    this.recursosQueFaltaram = [];
    this.pendencias = new Set();
    this.errosProvocados = [];
    this.ruidoIgnorado = 0;
    this.comecouEm = Date.now();
    this.paginas = new Map();

    rmSync(this.saida, { recursive: true, force: true });
    mkdirSync(this.saida, { recursive: true });
    console.log(`\n▶ ${ficha.titulo}\n  ${ficha.subtitulo ?? ""}\n  evidências em testes/${ficha.slug}/\n`);
  }

  async #abrirNavegador() {
    /**
     * `--use-angle=swiftshader` sempre: a Vila do Lume precisa de WebGL, e sem
     * o rasterizador de software o canvas volta com dimensão zero em máquina
     * sem GPU acessível ao headless. Ligar para todas as suítes custa
     * milissegundos e evita um roteiro passar na sua máquina e falhar na do CI.
     */
    const args = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
    if (this.ficha.chromeDoSistema) {
      /* Pointer lock só é concedido pelo Chrome de verdade — a tabela medida
         está em `estudante/05-vila-do-lume.mjs`. Sem ele, seguimos no Chromium
         e o roteiro AVISA que a checagem não valeu. */
      this.browser = await chromium.launch({ channel: "chrome", args }).catch(() => {
        this.semChromeReal = true;
        return chromium.launch({ args });
      });
    } else {
      this.browser = await chromium.launch({ args });
    }
  }

  /**
   * Abre um contexto novo (cookies próprios) e devolve a página.
   *
   * Cada PAPEL tem o seu: os roteiros de dois contextos (professor conduz,
   * estudante joga) existem porque metade das travas do produto só se prova com
   * as duas pontas vivas ao mesmo tempo.
   */
  async pagina(rotulo, opcoes = {}) {
    const contexto = await this.browser.newContext({
      viewport: opcoes.viewport ?? { width: 1440, height: 960 },
      deviceScaleFactor: opcoes.deviceScaleFactor ?? 2,
      acceptDownloads: true,
      ...(opcoes.mobile ? { isMobile: true, hasTouch: true } : {}),
    });
    const pagina = await contexto.newPage();

    const anotar = (texto) => {
      if (ehRuidoDeDev(texto)) return (this.ruidoIgnorado += 1);
      /* Defeito real, já nomeado: entra no relatório com nome e sobrenome, mas
         não pinta a suíte de vermelho — ver `PENDENCIAS_CONHECIDAS`. */
      const pendencia = pendenciaConhecida(texto);
      if (pendencia) return this.pendencias.add(pendencia);
      return this.erros.push(`[${rotulo}] ${texto}`);
    };
    /**
     * "Failed to load resource: 404" é o erro de console mais inútil que
     * existe: ele não diz QUAL recurso. Trocamos a mensagem genérica pela URL
     * que realmente faltou — a lista é preenchida pelo listener de resposta,
     * que sempre chega antes do erro de console correspondente.
     */
    /* No CONTEXTO, não na página: uma resposta de dentro de um iframe
       cross-origin não sobe para `page.on('response')` de forma confiável, e
       era justamente ela que faltava — o 404 vinha do bundle da experiência. */
    contexto.on("response", (resp) => {
      if (resp.status() >= 400) this.recursosQueFaltaram.push(`${resp.status()} ${resp.url()}`);
    });
    contexto.on("requestfailed", (req) => {
      this.recursosQueFaltaram.push(`falhou ${req.url()} (${req.failure()?.errorText ?? "?"})`);
    });
    pagina.on("console", (m) => {
      if (m.type() !== "error") return;
      const texto = m.text().slice(0, 240);
      if (/Failed to load resource/.test(texto)) {
        /* Nesta mensagem o `location.url` do console É a URL do recurso que
           faltou — e é a única fonte confiável dela: uma resposta de dentro de
           um iframe cross-origin nem sempre chega aos listeners de rede. */
        const url = m.location()?.url;
        return anotar(url ? `recurso não carregou: ${texto.replace(/^Failed to load resource: /, "")} — ${url}` : texto);
      }
      anotar(texto);
    });
    pagina.on("pageerror", (e) => anotar("PAGEERROR: " + String(e).slice(0, 240)));
    vigiarFalhasDaApi(pagina, this.falhasDaApi, rotulo);

    this.paginas.set(rotulo, { pagina, contexto });
    return pagina;
  }

  /**
   * Login com PORTÃO DE HIDRATAÇÃO.
   *
   * Em dev o HTML do SSR chega antes do bundle, e escrever nesse intervalo põe
   * texto no input sem mover o estado do React — o formulário envia vazio e o
   * erro sai como "credenciais inválidas", que culpa o seed por um problema de
   * tempo. Esperar o botão HABILITAR depois de digitar é o sinal de que o
   * `onChange` chegou ao componente.
   */
  async entrar(pagina, usuario, senha = SENHA_DEMO) {
    await pagina.context().clearCookies();
    await pagina.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
    await pagina.waitForSelector("button[type=submit]");
    await pagina.waitForTimeout(1500);
    await pagina.locator("#username").pressSequentially(usuario, { delay: 20 });
    await pagina.locator("#password").pressSequentially(senha, { delay: 20 });
    await pagina.waitForFunction(
      () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
      null,
      { timeout: 10_000 },
    );
    await pagina.click("button[type=submit]");
    /* A raiz só ROTEIA (`app/page.tsx` redireciona por papel): parar em "/"
       fotografa uma tela em branco e faz a contagem de linhas dar zero. */
    await pagina.waitForURL((url) => !url.pathname.startsWith("/login") && url.pathname !== "/", {
      timeout: 30_000,
    });
    await pagina.waitForTimeout(1200);
    return pagina;
  }

  /**
   * Tira o print e ANOTA o que ele mostra e o que ele prova.
   *
   * `titulo`, `mostra` e `prova` não são enfeite: são o slide e a legenda do
   * vídeo. Um passo sem eles entra no deck como "passo 7" e não ensina nada a
   * quem não escreveu o teste.
   */
  async registrar(pagina, nome, ficha = {}) {
    const numero = this.passos.length + 1;
    const arq = `${numero}-${nome}.png`;
    const caminho = join(this.saida, arq);
    /* `fullPage` numa tela muito alta (o monitor de uma turma inteira passa de
       30 000 px) estoura o `Page.captureScreenshot` do Chrome com "Unable to
       capture screenshot" — e derrubar a suíte por causa do print seria perder
       a corrida inteira por causa da câmera. Cai para a viewport e diz. */
    try {
      await pagina.screenshot({ path: caminho, fullPage: ficha.inteira ?? false });
    } catch (erro) {
      if (!ficha.inteira) throw erro;
      console.log(`      · página alta demais para um print inteiro: ${String(erro).slice(0, 80)}`);
      await pagina.screenshot({ path: caminho });
    }
    /* De QUEM é esta tela. Nos roteiros de dois contextos (o professor conduz o
       relógio, o estudante joga) o deck e o vídeo precisam dizer em qual das
       duas pontas o print foi tirado — senão a sequência parece uma pessoa só
       fazendo coisas impossíveis. */
    const contexto = [...this.paginas].find(([, v]) => v.pagina === pagina)?.[0] ?? "";

    const passo = {
      n: numero,
      arq,
      contexto,
      nome,
      titulo: ficha.titulo ?? nome.replace(/-/g, " "),
      mostra: ficha.mostra ?? "",
      prova: ficha.prova ?? "",
      detalhe: ficha.detalhe ?? "",
      url: pagina.url().replace(HUB, ""),
    };
    this.passos.push(passo);
    console.log(
      `  ${String(numero).padStart(2)}. ${passo.titulo}` +
        `${contexto ? ` [${contexto}]` : ""}${passo.detalhe ? ` — ${passo.detalhe}` : ""}`,
    );
    return passo;
  }

  /** Uma asserção nomeada. Reprovar aqui reprova a suíte inteira. */
  exigir(condicao, texto) {
    const ok = Boolean(condicao);
    this.verificacoes.push({ ok, texto });
    console.log(`      ${ok ? "✓" : "✗"} ${texto}`);
    return ok;
  }

  /**
   * Declara que uma resposta de erro é o COMPORTAMENTO SENDO EXERCITADO.
   *
   * Um roteiro que testa uma trava provoca o erro de propósito: o 422 de
   * "conteúdo de menos", o 400 do perfil adulterado, o 403 do papel errado.
   * Sem isto eles entravam na lista de erros de console e pintavam de vermelho
   * a suíte que estava justamente provando que a trava funciona — e vermelho
   * que não significa nada é o começo do fim de um smoke.
   *
   * O erro não some: ele muda de seção no relatório, com o motivo ao lado.
   */
  provocado(padrao, motivo) {
    this.errosProvocados.push({ padrao, motivo });
    return this;
  }

  /** O que a suíte ainda não alcança, dito em voz alta em vez de omitido. */
  ressalva(texto) {
    this.verificacoes.push({ ok: true, ressalva: true, texto });
    console.log(`      · ${texto}`);
  }

  /**
   * Encerra: grava manifesto + relatório, imprime o resumo e define o código de
   * saída. `falha` é a exceção que interrompeu, quando houve.
   */
  async encerrar(falha = null) {
    const reprovadas = this.verificacoes.filter((v) => !v.ok);
    /* Separa o que a suíte PROVOCOU do que ela descobriu. Os dois vão para o
       relatório; só o segundo reprova. */
    const provocados = [];
    const inesperados = [];
    for (const erro of new Set(this.erros)) {
      const declarado = this.errosProvocados.find((e) => e.padrao.test(erro));
      if (declarado) provocados.push(`${erro} — ${declarado.motivo}`);
      else inesperados.push(erro);
    }
    const status = falha || reprovadas.length || inesperados.length ? "vermelho" : "verde";

    const manifesto = {
      slug: this.ficha.slug,
      papel: this.ficha.papel,
      titulo: this.ficha.titulo,
      subtitulo: this.ficha.subtitulo ?? "",
      contexto: this.ficha.contexto ?? "",
      comando: this.ficha.comando ?? "",
      prova: this.ficha.prova ?? [],
      quando: new Date().toISOString(),
      duracaoMs: Date.now() - this.comecouEm,
      status,
      interrompida: falha ? String(falha).slice(0, 600) : null,
      passos: this.passos,
      verificacoes: this.verificacoes,
      errosDeConsole: inesperados,
      errosProvocados: provocados,
      falhasDaApi: [...new Set(this.falhasDaApi)],
      recursosQueFaltaram: [...new Set(this.recursosQueFaltaram)],
      pendenciasConhecidas: [...this.pendencias],
      ruidoDeDevIgnorado: this.ruidoIgnorado,
    };
    writeFileSync(join(this.saida, "passos.json"), JSON.stringify(manifesto, null, 2), "utf8");
    writeFileSync(join(this.saida, "relatorio.md"), relatorioEmMarkdown(manifesto), "utf8");

    if (falha) {
      /* O print do momento da quebra, de TODAS as páginas vivas: num roteiro de
         dois contextos, a causa costuma estar na tela do outro. */
      for (const [rotulo, { pagina }] of this.paginas) {
        await pagina.screenshot({ path: join(this.saida, `ERRO-${rotulo}.png`) }).catch(() => {});
      }
      console.error(`\n✗ interrompida: ${String(falha).slice(0, 500)}`);
    }
    if (reprovadas.length) {
      console.error(`\n✗ ${reprovadas.length} verificação(ões) reprovadas:`);
      reprovadas.forEach((v) => console.error(`   - ${v.texto}`));
    }
    if (provocados.length) {
      console.log(`\n  erros PROVOCADOS pelo roteiro (a trava funcionando):`);
      provocados.forEach((e) => console.log(`   - ${e}`));
    }
    if (inesperados.length) {
      console.error(`\n✗ erros de console:`);
      inesperados.forEach((e) => console.error(`   - ${e}`));
    } else if (this.ruidoIgnorado) {
      console.log(`\n  (${this.ruidoIgnorado} erro(s) de ruído conhecido do Next ignorados)`);
    }
    if (this.falhasDaApi.length) {
      console.log(`\n  respostas 4xx/5xx da api observadas:`);
      [...new Set(this.falhasDaApi)].forEach((f) => console.log(`   - ${f}`));
    }
    if (this.pendencias.size) {
      console.log(`\n  pendências conhecidas encontradas (não reprovam, mas seguem abertas):`);
      [...this.pendencias].forEach((f) => console.log(`   - ${f}`));
    }
    if (this.recursosQueFaltaram.length) {
      console.log(`\n  recursos que voltaram 4xx/5xx:`);
      [...new Set(this.recursosQueFaltaram)].forEach((f) => console.log(`   - ${f}`));
    }

    await this.browser.close().catch(() => {});
    const segundos = Math.round(manifesto.duracaoMs / 1000);
    console.log(
      `\n${status === "verde" ? "✓" : "✗"} ${this.ficha.titulo} — ${this.passos.length} passos em ${segundos}s ` +
        `(testes/${this.ficha.slug}/)\n`,
    );
    process.exitCode = status === "verde" ? 0 : 1;
    return manifesto;
  }
}

/**
 * Roda o corpo da suíte com a casca já montada e o `finally` garantido.
 *
 * Existe porque `try/catch/finally` copiado doze vezes divergiu doze vezes: em
 * três roteiros o `catch` engolia a exceção e o processo saía com 0.
 */
export async function suite(ficha, corpo) {
  const r = await Roteiro.iniciar(ficha);
  let falha = null;
  try {
    await corpo(r);
  } catch (erro) {
    falha = erro;
  }
  return r.encerrar(falha);
}

function relatorioEmMarkdown(m) {
  const linhas = [
    `# ${m.titulo}`,
    "",
    `**${m.subtitulo}**`,
    "",
    m.contexto,
    "",
    `- Papel: \`${m.papel}\``,
    `- Comando: \`${m.comando}\``,
    `- Execução: ${new Date(m.quando).toLocaleString("pt-BR")} · ${Math.round(m.duracaoMs / 1000)}s`,
    `- Resultado: **${m.status === "verde" ? "verde" : "vermelho"}**`,
    "",
    "## O que esta suíte comprova",
    "",
    ...m.prova.map((p) => `- ${p}`),
    "",
    "## Passo a passo",
    "",
  ];
  for (const passo of m.passos) {
    linhas.push(
      `### ${passo.n}. ${passo.titulo}`,
      "",
      `![${passo.titulo}](${passo.arq})`,
      "",
      passo.mostra ? `**Na tela:** ${passo.mostra}` : "",
      passo.prova ? `**Prova:** ${passo.prova}` : "",
      passo.detalhe ? `**Medido:** ${passo.detalhe}` : "",
      passo.url ? `\`${passo.url}\`` : "",
      "",
    );
  }
  linhas.push("## Verificações", "");
  for (const v of m.verificacoes) {
    linhas.push(`- ${v.ressalva ? "·" : v.ok ? "✓" : "✗"} ${v.texto}`);
  }
  if (m.pendenciasConhecidas.length) {
    linhas.push("", "## Pendências conhecidas", "", ...m.pendenciasConhecidas.map((p) => `- ${p}`));
  }
  if (m.errosProvocados.length) {
    linhas.push(
      "",
      "## Erros provocados pelo roteiro",
      "",
      "Estes o teste causou de propósito: são as travas do produto funcionando.",
      "",
      ...m.errosProvocados.map((e) => `- \`${e}\``),
    );
  }
  if (m.errosDeConsole.length) {
    linhas.push("", "## Erros de console", "", ...m.errosDeConsole.map((e) => `- \`${e}\``));
  }
  if (m.falhasDaApi.length) {
    linhas.push("", "## Respostas 4xx/5xx da api", "", ...m.falhasDaApi.map((f) => `- \`${f}\``));
  }
  return linhas.filter((l) => l !== "").join("\n") + "\n";
}

/**
 * Ícone do DS é fonte de LIGADURA: sem a fonte, o `<span>` mostra o NOME do
 * ícone escrito na tela. Nenhum typecheck pega isso, e num print passa
 * despercebido se ninguém for conferir.
 */
export async function estadoDosIcones(alvo) {
  return alvo.evaluate(() => {
    const icone = [...document.querySelectorAll("span")].find((s) =>
      (s.className || "").toString().includes("material-symbols"),
    );
    if (!icone) return "sem ícone na tela";
    const carregou = document.fonts.check('24px "Material Symbols Rounded"');
    return carregou ? "ok" : `FONTE NÃO CARREGOU (${getComputedStyle(icone).fontFamily.split(",")[0]})`;
  });
}
