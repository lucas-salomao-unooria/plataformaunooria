/**
 * As ABAS das telas de condução (ADR-182): o guia da aula em quatro tempos
 * (`tab-guia-*`), a "Conhecer a missão" da ficha (`tab-ficha-*`) e a página da
 * atividade (`tab-atividade-*`).
 *
 * Nas três, a aba fechada fica MONTADA com `hidden` (`components/abas-da-pagina.tsx`
 * e `components/guia/tempos-do-guia.tsx` no hub): o elemento está no DOM, mas o
 * Playwright o considera invisível — `click()` espera até o timeout e reporta o
 * seletor, nunca "está noutra aba". E `innerText` não lê painel escondido: a
 * suíte que conferia o texto da página inteira passaria a reprovar dizendo que
 * a seção SUMIU, quando ela só mudou de aba. Por isso estas três peças.
 */

/** Abre a aba cujo nome casa com `rotulo` (o nome inclui o glifo do ícone, então é regex). */
export async function abrirAba(pagina, rotulo) {
  const aba = pagina.getByRole("tab", { name: rotulo instanceof RegExp ? rotulo : new RegExp(rotulo) }).first();
  await aba.click();
  await pagina.waitForTimeout(150);
}

/**
 * Deixa `alvo` visível: se ele mora numa aba fechada, abre essa aba (e a de
 * fora, se for aba dentro de aba). Chame ANTES de clicar ou esperar por algo
 * da página da atividade que não seja da aba que abre sozinha.
 *
 * `alvo` precisa ser localizador por CSS (`locator("[data-…]")`), nunca por
 * papel: `getByRole` ignora o que está escondido, e numa aba fechada ele não
 * acha nada para revelar — espera até o timeout.
 */
export async function revelar(pagina, alvo, { timeout = 30_000 } = {}) {
  for (let i = 0; i < 3; i++) {
    const painel = await alvo
      .first()
      .evaluate((el) => el.closest('[role="tabpanel"][hidden]')?.id ?? null, null, { timeout });
    if (!painel) return;
    /* O painel é `tabpanel-<valor>` e a aba, `tab-<valor>`. Pelo `id`, e não por
       `aria-controls`: o `Tab` do DS, montado por `items`, não o emite. */
    await pagina.locator(`#tab-${painel.replace(/^tabpanel-/, "")}`).first().click();
    await pagina.waitForTimeout(150);
  }
}

/**
 * O texto de TODAS as abas de um conjunto, uma por vez — o que a suíte lia
 * antes com um `innerText` da página inteira. `prefixo` é o do id da aba:
 * `guia`, `ficha` ou `atividade`. Volta à aba que estava aberta.
 */
export async function textoDeTodasAsAbas(pagina, prefixo, raiz = "main") {
  const abas = pagina.locator(`[role="tab"][id^="tab-${prefixo}-"]`);
  const total = await abas.count();
  if (total === 0) return pagina.locator(raiz).innerText();
  const aberta = await pagina
    .locator(`[role="tab"][id^="tab-${prefixo}-"][aria-selected="true"]`)
    .first()
    .getAttribute("id");
  let texto = "";
  for (let i = 0; i < total; i++) {
    await abas.nth(i).click();
    await pagina.waitForTimeout(150);
    texto += `\n${await pagina.locator(raiz).innerText()}`;
  }
  if (aberta) await pagina.locator(`#${aberta}`).click();
  return texto;
}
