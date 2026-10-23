/**
 * O podcast de recapitulação na e2e (ADR-150) — os dois passos que toda missão
 * com podcast prova, com a IA real:
 *
 * - `provarFalasNaCriacao`: na criação, as falas do tema chegam da api
 *   (`POST /podcast/:expId/turmas/:t/falas-do-tema`) e aparecem para revisar;
 * - `provarPodcastNaAula`: na página da atividade, a transcrição tem os blocos
 *   e as vozes do roteiro, e o TTS sintetiza o episódio inteiro.
 *
 * A espera é pela UNIÃO dos desfechos — pronto, ou a frase de falha —, nunca
 * pelo relógio; e a falha reprova, porque a IA é a real.
 */

import { revelar } from "./abas.mjs";

/** A promessa da resposta das falas: crie ANTES do clique que traz o conteúdo. */
export function esperarFalasDoTema(pagina, expId) {
  const rota = new RegExp(`/podcast/${expId}/turmas/[^/]+/falas-do-tema$`);
  return pagina.waitForResponse(
    (res) => rota.test(new URL(res.url()).pathname) && res.request().method() === "POST",
    { timeout: 180_000 },
  );
}

/**
 * As falas na criação: a resposta (com ou sem IA, conforme `comIa`) e os
 * campos editáveis. Devolve `false` se a resposta não veio como esperado.
 */
export async function provarFalasNaCriacao(r, pagina, resposta, { comIa, vagas = 3, passo, titulo, mostra, prova }) {
  const corpo = await resposta.json().catch(() => null);
  const ok = r.exigir(
    resposta.status() === 200 && corpo?.usouIa === comIa && corpo?.motivo === null,
    `as falas do podcast chegaram ${comIa ? "escritas pela IA" : "do banco padrão, sem IA"} ` +
      `(falas-do-tema ${resposta.status()}, usouIa=${corpo?.usouIa}, motivo=${corpo?.motivo})`,
  );
  const falas = pagina.locator("[data-falas-do-podcast]");
  await falas.locator("textarea").first().waitFor({ timeout: 20_000 });
  const textos = await falas.locator("textarea").evaluateAll((ts) => ts.map((t) => t.value.trim()));
  r.exigir(
    textos.length === vagas && textos.every((t) => t.length > 0),
    `a criação mostra as ${vagas} falas do podcast, preenchidas, para a professora revisar`,
  );
  await r.registrar(pagina, passo, { titulo, mostra, prova, inteira: true });
  return ok;
}

/**
 * O podcast na página da atividade: a transcrição (os `blocos` e as `vozes`)
 * e o áudio sintetizado de ponta a ponta.
 */
export async function provarPodcastNaAula(r, pagina, { blocos, vozes, trechos, passo, descricao }) {
  const cartao = pagina.locator("[data-podcast-da-aula]");
  /* Na página da atividade o podcast mora na aba Podcast (ADR-182). */
  await revelar(pagina, cartao, { timeout: 20_000 });
  await cartao.waitFor({ timeout: 20_000 });
  await pagina.click('[data-acao="ler-transcricao"]');
  const transcricao = pagina.locator("[data-transcricao-podcast]");
  await transcricao.waitFor({ timeout: 10_000 });
  const roteiro = await transcricao.innerText();
  r.exigir(
    blocos.every((bloco) => roteiro.toUpperCase().includes(bloco.toUpperCase())),
    `a transcrição traz os ${blocos.length} blocos do roteiro aprovado`,
  );
  r.exigir(
    vozes.every((voz) => new RegExp(`${voz}:`).test(roteiro)),
    `com as falas de ${vozes.join(" e de ")}`,
  );
  await r.registrar(pagina, `${passo}-transcricao`, {
    titulo: "O podcast de recapitulação, para a professora",
    mostra: `O player do podcast (${descricao}) e a transcrição inteira, bloco a bloco.`,
    prova:
      "O podcast é da professora, que decide tocar para a turma depois da aula. As falas que contam a " +
      "atividade são as que ela revisou na criação; sem áudio o player diz o porquê, e a transcrição fica.",
    inteira: true,
  });

  if ((await cartao.getAttribute("data-podcast-pronto")) !== "sim") {
    await pagina.click('[data-acao="gerar-podcast"]');
    await pagina
      /* O erro só pode vir do ALERTA ou da linha do trecho que não saiu —
         nunca do cartão inteiro: a transcrição da Tempestade diz "o limite não
         estava na inteligência artificial", e a espera terminava na hora,
         com o áudio ainda sendo gerado. */
      .locator(
        '[data-podcast-pronto="sim"], [data-podcast-da-aula] .unooria-feedback-alert--warning, [data-podcast-da-aula] :text("Um trecho do áudio não saiu")',
      )
      .first()
      .waitFor({ timeout: 300_000 });
  }
  const pronto = (await cartao.getAttribute("data-podcast-pronto")) === "sim";
  r.exigir(pronto, `o TTS sintetizou os ${trechos} trechos e o episódio ficou pronto`);
  if (pronto) r.exigir((await cartao.locator("audio").count()) === 1, "o episódio emendado toca no player do DS");
  await r.registrar(pagina, `${passo}-audio`, {
    titulo: pronto ? "O episódio pronto" : "Sem áudio, com a transcrição",
    mostra: pronto
      ? `Os ${trechos} trechos sintetizados pelo TTS do Gemini e emendados num episódio só, no player.`
      : "A síntese não saiu, e a tela diz isso — a transcrição fica.",
    prova: pronto
      ? "Um trecho por chamada, porque o episódio não cabe numa chamada do BFF; os blocos fixos saem uma vez por contrato."
      : "Falha de voz não esconde o podcast nem cobra a quota: o trecho que não saiu é dito, e a leitura segue.",
    inteira: true,
  });
  return pronto;
}
