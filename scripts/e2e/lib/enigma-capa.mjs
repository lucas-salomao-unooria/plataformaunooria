import { BFF } from "./roteiro.mjs";

/**
 * Os gestos e as leituras que as duas suítes do Enigma da Capa da Rádio
 * (`estudante/14-enigma-capa`, o caminho feliz com a IA real, e
 * `estudante/15-enigma-capa-caminhos`, os caminhos de borda) dividem. Nada
 * aqui conhece a missão: são o arraste, o toque pela caixa e a espera pelo
 * DADO da api — o que a 14 escreveu primeiro e a 15 reaproveita.
 */

/**
 * GET pelo BFF com a sessão da página. Uma nova tentativa no `ECONNRESET`: o
 * `next dev` fecha o socket ocioso (keep-alive de 5 s) e o contexto de
 * requisição do Playwright às vezes o reusa nesse instante — a leitura morre
 * sem chegar ao hub (nada no log dele), e não diz nada do produto.
 */
export async function lerApi(p, caminho) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const resposta = await p.request.get(`${BFF}${caminho}`);
      return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
    } catch (erro) {
      if (tentativa >= 3 || !/ECONNRESET|socket hang up/.test(String(erro))) throw erro;
      await p.waitForTimeout(300);
    }
  }
}

export async function postarNaApi(p, caminho, dados) {
  const resposta = await p.request.post(`${BFF}${caminho}`, { data: dados });
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

/** Polling curto até a api mostrar `pronto(corpo)` — a espera é pelo dado, nunca pelo relógio. */
export async function esperarNaApi(p, caminho, pronto, { timeout = 30_000, oQue = caminho } = {}) {
  const fim = Date.now() + timeout;
  let ultimo = null;
  while (Date.now() < fim) {
    ultimo = await lerApi(p, caminho);
    if (ultimo.status === 200 && pronto(ultimo.corpo)) return ultimo.corpo;
    await p.waitForTimeout(800);
  }
  throw new Error(`${oQue}: a api não chegou ao estado esperado em ${timeout / 1000}s (último HTTP ${ultimo?.status})`);
}

/** PORTÃO DE HIDRATAÇÃO: em dev o SSR chega antes do bundle, e um clique nesse intervalo não chama handler nenhum. */
export async function hidratado(p, locator) {
  const alvo = locator.first();
  await alvo.waitFor({ timeout: 30_000 });
  await p.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__react")), await alvo.elementHandle(), {
    timeout: 20_000,
  });
}

/** A UNIÃO de desfechos legítimos: devolve o NOME do que apareceu primeiro. */
export async function primeiroQueAparecer(desfechos, { timeout, oQue }) {
  const nomes = Object.keys(desfechos);
  try {
    return await Promise.any(nomes.map((nome) => desfechos[nome].first().waitFor({ timeout }).then(() => nome)));
  } catch {
    throw new Error(`${oQue}: nenhum desfecho em ${timeout / 1000}s (${nomes.join(", ")})`);
  }
}

/**
 * O ponto da PÁGINA que corresponde à fração (fx, fy) da caixa de um elemento.
 * Pela caixa na página, e não por `position`: o aparelho do hub ESCALA o
 * iframe, e a caixa já vem escalada.
 */
export async function pontoEm(locator, fx, fy) {
  const caixa = await locator.boundingBox();
  if (!caixa) throw new Error("o elemento não tem caixa na tela");
  return { x: caixa.x + fx * caixa.width, y: caixa.y + fy * caixa.height, caixa };
}

/** Arrasta com o mouse de `de` até `ate`, em passos (o gesto de verdade, não um salto). */
export async function arrastar(p, de, ate, passos = 12) {
  await p.mouse.move(de.x, de.y);
  await p.mouse.down();
  await p.mouse.move(ate.x, ate.y, { steps: passos });
  await p.mouse.up();
}

/**
 * Dispara `acao` e devolve o JSON da resposta da rota — os dois juntos
 * (`Promise.all`), para a espera nunca ficar órfã se a ação quebrar antes.
 */
export async function comResposta(p, rota, acao, filtro = () => true) {
  const [resposta] = await Promise.all([
    p.waitForResponse((x) => rota.test(new URL(x.url()).pathname) && x.request().method() === "POST" && filtro(x.request()), { timeout: 30_000 }),
    acao(),
  ]);
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

/** Toque de verdade no meio do botão, pela caixa — o AVANÇAR esmaecido tem `aria-disabled`, e o `click` do Playwright esperaria ele "habilitar". */
export async function tocarNoMeio(p, locator) {
  const ponto = await pontoEm(locator, 0.5, 0.5);
  await p.mouse.click(ponto.x, ponto.y);
}

export async function idDaTurma(p, nome) {
  const { status, corpo } = await lerApi(p, "/turmas/minhas");
  return status === 200 && Array.isArray(corpo) ? (corpo.find((t) => t.nome === nome)?.id ?? null) : null;
}
