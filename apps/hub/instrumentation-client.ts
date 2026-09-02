import { iniciarTracesWeb } from "@edu/sdk";
import { HUB_VERSAO, instalarCapturaDoHub } from "./lib/erros-do-hub";

/**
 * Roda cedo no NAVEGADOR (arquivo do Next, estável desde o 15.3):
 *  - instala a captura de `error`/`unhandledrejection` do hub antes de
 *    qualquer tela hidratar;
 *  - liga o OpenTelemetry Web do hub (o MESMO `iniciarTracesWeb` que as
 *    experiências usam), exportando pelo BFF (`/api/plataforma/observabilidade/
 *    v1/traces`, que assina o token da sessão — o client do hub não tem bearer).
 *
 * O ratio vem do `<meta name="unooria-obs-ratio">` que o layout raiz escreve a
 * partir de `OBS_TRACE_RATIO_CLIENTE` (env de RUNTIME, lida no servidor): não
 * é `NEXT_PUBLIC_*`, então mudar a amostragem não exige rebuild — a mesma razão
 * do `config.obs` do hub:init. Como os pacotes entram por `import()` dinâmico,
 * com ratio 0 nada é baixado, e a landing pública não paga o peso.
 *
 * Espera o DOM estar lido: o `<meta>` precisa existir, e o `document-load` lida
 * com registro tardio (lê o `readyState` e emite na hora). Sem sessão (landing,
 * login) o BFF responde 401 e o lote é descartado pelo exportador — aceito.
 * Os Web Vitals ficam em `components/vitals-hub.tsx` (precisam do `pathname`).
 */
instalarCapturaDoHub();

function ratioDoMeta(): number {
  const bruto = document.querySelector('meta[name="unooria-obs-ratio"]')?.getAttribute("content") ?? "0";
  const n = Number(bruto);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

function ligarTraces(): void {
  void iniciarTracesWeb({
    traceRatio: ratioDoMeta(),
    apiUrl: "/api/plataforma",
    expId: "hub",
    versao: HUB_VERSAO,
    // O BFF ignora o `authorization` do cliente e assina o próprio token.
    getToken: () => "",
  }).catch(() => null);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ligarTraces, { once: true });
} else {
  ligarTraces();
}
