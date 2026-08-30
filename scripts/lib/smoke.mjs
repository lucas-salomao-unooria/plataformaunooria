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
 */
export const ALERTA_DE_ERRO = ".unooria-feedback-alert--error";

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
  pagina.on("response", (r) => {
    if (r.status() < 400) return;
    const caminho = new URL(r.url()).pathname;
    if (!/\/(api|planos|bemestar|unoogpt|vila|runs|telemetry|ai)\//.test(caminho)) return;
    falhas.push(`${prefixo}${r.status()} ${r.request().method()} ${caminho}`);
  });
}
