import { instalarCapturaDoHub } from "./lib/erros-do-hub";

/**
 * Roda cedo no NAVEGADOR (arquivo do Next, estável desde o 15.3): instala a
 * captura de `error`/`unhandledrejection` do hub antes de qualquer tela
 * hidratar. Os Web Vitals do hub ficam em `components/vitals-hub.tsx` (precisam
 * do `pathname`). O OpenTelemetry Web NÃO entra no hub nesta onda: pesa no
 * first load da landing, e o alvo do trace de navegador são as experiências.
 */
instalarCapturaDoHub();
