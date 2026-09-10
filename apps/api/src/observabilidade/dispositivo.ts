/**
 * O user-agent vira RÓTULO FECHADO (ADR-84).
 *
 * A pergunta que isto responde é a que o log sozinho não responde: "a exp-70
 * trava no Chromebook?", "a plataforma está lenta no celular?". Para virar
 * rótulo de métrica, a resposta precisa ser um conjunto pequeno e fechado — a
 * regra de cardinalidade do `metricas.ts` continua valendo, e o user-agent CRU
 * é o oposto disso (cada versão de cada navegador seria uma série).
 *
 * Por que uma tabela à mão e não uma biblioteca (`ua-parser-js` e afins): elas
 * carregam centenas de expressões para distinguir dispositivos que não existem
 * numa escola pública brasileira, e a saída delas é aberta — voltaríamos ao
 * problema da cardinalidade. Aqui o conjunto é o que se pretende medir, e
 * qualquer coisa fora dele é `outro`: um valor novo nunca cria série nova.
 *
 * A ORDEM das checagens importa e é o único detalhe frágil deste arquivo: todo
 * navegador de Chromium diz "Chrome" no user-agent, e o Edge diz "Chrome" E
 * "Edg". Quem casa primeiro ganha, então o mais específico vem antes.
 */
export const NAVEGADORES = ["chrome", "edge", "safari", "firefox", "samsung", "outro"] as const;
export const SISTEMAS = ["android", "ios", "chromeos", "windows", "macos", "linux", "outro"] as const;
export const TIPOS = ["mobile", "tablet", "desktop"] as const;

export type Navegador = (typeof NAVEGADORES)[number];
export type Sistema = (typeof SISTEMAS)[number];
export type TipoDeDispositivo = (typeof TIPOS)[number];

export interface Dispositivo {
  navegador: Navegador;
  so: Sistema;
  tipo: TipoDeDispositivo;
}

/** Sem user-agent não se adivinha: `outro/outro/desktop` é o rótulo explícito de "não sei". */
export const DISPOSITIVO_DESCONHECIDO: Dispositivo = { navegador: "outro", so: "outro", tipo: "desktop" };

function navegadorDe(ua: string): Navegador {
  // Edge e Samsung Internet dizem "Chrome" também: vêm antes.
  if (/\bEdgA?\//.test(ua)) return "edge";
  if (/\bSamsungBrowser\//.test(ua)) return "samsung";
  if (/\bFirefox\/|\bFxiOS\//.test(ua)) return "firefox";
  if (/\bChrome\/|\bCriOS\//.test(ua)) return "chrome";
  // Safari por último: todo navegador em iOS carrega "Safari" no fim da string.
  if (/\bSafari\//.test(ua)) return "safari";
  return "outro";
}

function sistemaDe(ua: string): Sistema {
  // ChromeOS antes de Linux: "CrOS x86_64" também casaria com X11/Linux.
  if (/\bCrOS\b/.test(ua)) return "chromeos";
  if (/\bAndroid\b/.test(ua)) return "android";
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return "ios";
  if (/\bWindows\b/.test(ua)) return "windows";
  if (/\bMac OS X\b/.test(ua)) return "macos";
  if (/\bLinux\b|\bX11\b/.test(ua)) return "linux";
  return "outro";
}

function tipoDe(ua: string, so: Sistema): TipoDeDispositivo {
  if (/\biPad\b/.test(ua)) return "tablet";
  // Android SEM "Mobile" é tablet — a convenção é do próprio Android.
  if (so === "android") return /\bMobile\b/.test(ua) ? "mobile" : "tablet";
  if (so === "ios") return "mobile";
  if (/\bMobile\b/.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Três rótulos fechados a partir do user-agent. Nunca lança, e nunca devolve
 * valor fora das listas acima — é isso que a torna segura como rótulo.
 */
export function classificarDispositivo(userAgent: string | undefined): Dispositivo {
  if (!userAgent) return DISPOSITIVO_DESCONHECIDO;
  const ua = userAgent.slice(0, 256);
  const so = sistemaDe(ua);
  return { navegador: navegadorDe(ua), so, tipo: tipoDe(ua, so) };
}
