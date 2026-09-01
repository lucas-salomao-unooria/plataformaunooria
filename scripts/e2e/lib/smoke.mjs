/**
 * Peças compartilhadas pelos walkthroughs.
 *
 * Existe por um defeito medido: ao gerar um plano de aula, a api falhou em
 * 306 ms e o roteiro ficou 180 s esperando uma `<table>` que nunca viria —
 * 588x o tempo que a resposta levou. O erro estava em vermelho na tela desde o
 * primeiro segundo, e o que saiu no console foi "Timeout waiting for
 * locator('table')": um sintoma que não aponta para a causa, que é justamente
 * o que o apêndice F existe para evitar.
 *
 * Pior que os 3 minutos: nenhum walkthrough olhava estado de erro. Uma falha
 * que ainda deixasse uma `<table>` na tela (plano cortado por MAX_TOKENS caindo
 * num fallback) passaria VERDE.
 */

/**
 * O alerta de erro da seção `unooria` do design system.
 *
 * É a CLASSE, não `[role="alert"]`: o `role` é o mesmo para info, warning e
 * success, então esperar por ele faria um aviso benigno derrubar o roteiro.
 * O modificador `--error` é a única parte estrutural que separa os quatro
 * (`FeedbackAlert.mjs` monta `unooria-feedback-alert--${alertType}`).
 *
 * Vale para o que fala pela PLATAFORMA — exp-90 e exp-91. As experiências
 * disfarçadas (exp-01, exp-03) renderizam erro em `<p>` avulso, com classe
 * diferente em cada tela, e por isso ainda não têm gancho estável: nelas o
 * sinal é `vigiarFalhasDaApi`.
 *
 * São DOIS componentes, não um: `FeedbackAlert` é a faixa inline das telas de
 * experiência, e `AlertBox` é o que as 25 telas do hub usam — inclusive toda a
 * área administrativa. Com só o primeiro na lista, uma espera em `/admin/*`
 * pagava o timeout inteiro e reportava "o seletor não apareceu" enquanto a
 * causa estava escrita na tela, em vermelho, desde o segundo 1.
 */
export const ALERTA_DE_ERRO =
  ".unooria-feedback-alert--error, .unooria-alertbox--error, .unooria-alertbox--danger";

/**
 * Ruído de dev do PRÓPRIO Next, que não é defeito nosso.
 *
 * `performance.measure(routeChangeToRender, ...)` em `next/dist/client/index.js`
 * pode receber um timestamp negativo numa navegação cliente e lança
 * `Failed to execute 'measure' on 'Performance'`. Aparece em 11 dos 12
 * roteiros, e como o da exp-02 e o da exp-03 reprovam por QUALQUER erro de
 * console, os dois viviam vermelhos por isso — o que treina a pessoa a ignorar
 * o vermelho, que é o único jeito de um smoke deixar de servir.
 *
 * A lista é EXPLÍCITA e curta de propósito: silenciar por padrão devolveria o
 * problema em outra forma. Quem filtra também CONTA e diz quantos ignorou.
 */
const RUIDO_DE_DEV = [/Failed to execute 'measure' on 'Performance'/];

/** @param {string} texto */
export function ehRuidoDeDev(texto) {
  return RUIDO_DE_DEV.some((padrao) => padrao.test(texto));
}

/**
 * Defeitos REAIS do produto que já estão nomeados e que, se reprovassem cada
 * suíte, deixariam todas vermelhas por um motivo que ninguém vai olhar duas
 * vezes — o começo do fim de um smoke, como diz o bloco de cima.
 *
 * Diferente do ruído: isto NÃO é silenciado. Cada suíte lista as pendências que
 * encontrou, no terminal e no relatório, e elas viram um slide próprio no deck.
 * Sair daqui é consertar, não apagar a linha.
 *
 * - `favicon.ico`: o hub não declara ícone nenhum (`app/layout.tsx` só tem
 *   `title`). Toda navegação de todo papel gera um 404 no console.
 */
const PENDENCIAS_CONHECIDAS = [
  {
    padrao: /favicon\.ico/,
    oQue: "o hub não declara favicon — todo carregamento de página gera um 404 no console",
  },
];

/**
 * @param {string} texto
 * @returns {string | null} a descrição da pendência, ou null se não for uma
 */
export function pendenciaConhecida(texto) {
  return PENDENCIAS_CONHECIDAS.find((p) => p.padrao.test(texto))?.oQue ?? null;
}

/**
 * Espera `sucesso`, mas PERDE A CORRIDA para um erro na tela.
 *
 * O timeout continua alto porque a geração real leva de 30 a 60 s; o que muda
 * é que o caminho de falha não paga esse tempo, e a mensagem que sobe é a que
 * o professor leu, não o nome do seletor que faltou.
 *
 * @param {import('playwright').Locator} sucesso   o que prova que deu certo
 * @param {import('playwright').Locator} erro      o alerta que prova que deu errado
 * @param {{ timeout?: number, oQue?: string }} [opcoes]
 */
export async function esperarOuFalharCedo(sucesso, erro, opcoes = {}) {
  const { timeout = 60_000, oQue = "a tela" } = opcoes;
  await Promise.race([
    sucesso.first().waitFor({ timeout }),
    erro
      .first()
      .waitFor({ timeout })
      .then(async () => {
        const texto = await erro.first().innerText().catch(() => "(sem texto)");
        throw new Error(`${oQue} falhou: ${texto.replace(/\s+/g, " ").trim()}`);
      }),
  ]);
}

/**
 * Espera `sucesso`, mas PERDE A CORRIDA para uma resposta de erro da api.
 *
 * É o irmão de `esperarOuFalharCedo` para as telas que NÃO têm um gancho de
 * erro estável no DOM — as experiências disfarçadas e os painéis que renderizam
 * a falha em `<p>` avulso. Aqui o sinal é a resposta HTTP, que é inequívoca, e
 * o corpo dela vai na mensagem: um `500` sem corpo manda a pessoa procurar no
 * log da api; com o corpo, a causa aparece no terminal.
 *
 * @param {import('playwright').Page} pagina
 * @param {import('playwright').Locator} sucesso   o que prova que deu certo
 * @param {RegExp} rota  qual chamada observar
 * @param {{ timeout?: number, oQue?: string }} [opcoes]
 */
export async function esperarOuFalharPorHttp(pagina, sucesso, rota, opcoes = {}) {
  const { timeout = 120_000, oQue = "a chamada" } = opcoes;
  const erroDaApi = pagina
    .waitForResponse((r) => rota.test(r.url()) && r.status() >= 400, { timeout })
    .then(async (r) => {
      const corpo = await r.text().catch(() => "(sem corpo)");
      throw new Error(
        `${oQue} falhou: HTTP ${r.status()} em ${new URL(r.url()).pathname} — ` +
          corpo.replace(/\s+/g, " ").slice(0, 300),
      );
    });
  await Promise.race([sucesso.first().waitFor({ timeout }), erroDaApi]);
}

/**
 * Anota as respostas 4xx/5xx da api para o relatório final.
 *
 * NÃO derruba o roteiro: é o mecanismo para as experiências sem gancho de erro
 * no DOM, e derrubar por status transformaria um 404 esperado (sondagem de
 * estado que ainda não existe) em falha inventada. O objetivo é que a causa
 * apareça no relatório em vez de ficar invisível.
 *
 * Cobre só a api: erro do dev server do hub é outro assunto, e o `console` já
 * é vigiado pelos roteiros.
 *
 * @param {import('playwright').Page} pagina
 * @param {string[]} falhas  lista compartilhada, impressa no fim do roteiro
 * @param {string} [rotulo]  qual contexto (professor/estudante), nos roteiros de dois
 */
export function vigiarFalhasDaApi(pagina, falhas, rotulo = "") {
  const prefixo = rotulo ? `[${rotulo}] ` : "";
  pagina.on("response", async (r) => {
    if (r.status() < 400) return;
    const caminho = new URL(r.url()).pathname;
    if (!/\/(api|planos|bemestar|unoogpt|vila|runs|telemetry|ai)\//.test(caminho)) return;
    /* O CORPO dos 5xx, e não só o status. "500 POST /destilar" manda a pessoa
       procurar no log da api; "500 … quota diária excedida" resolve na hora.
       Só para 5xx: um 404 de sondagem de estado é esperado e o corpo dele é
       ruído. E entre `catch`: um corpo já consumido por quem chamou faria o
       vigia derrubar o roteiro por causa do próprio diagnóstico. */
    let causa = "";
    /* 422 entra junto com os 5xx: é o status que o produto usa para "dá para
       fazer, mas falta alguma coisa", e a lista de pendências vive no corpo.
       401/403/404 ficam de fora — os dois primeiros são a trava funcionando, e
       o terceiro costuma ser sondagem de estado que ainda não existe. */
    if (r.status() >= 500 || r.status() === 422) {
      causa = await r
        .text()
        .then((corpo) => ` — ${corpo.replace(/\s+/g, " ").slice(0, 240)}`)
        .catch(() => " — (corpo indisponível)");
    }
    falhas.push(`${prefixo}${r.status()} ${r.request().method()} ${caminho}${causa}`);
  });
}
