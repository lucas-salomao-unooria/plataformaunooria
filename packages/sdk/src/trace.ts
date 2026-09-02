/**
 * Um `traceparent` W3C novo, gerado no navegador, para quando o OpenTelemetry
 * Web está DESLIGADO (ratio 0). Serve para a api ter um `traceId` em 100% dos
 * logs de uma requisição vinda da experiência — mesmo sem nenhuma linha do
 * tempo guardada. Com o OTel ligado, quem escreve o cabeçalho é o
 * `FetchInstrumentation`, com o span real como pai.
 *
 * Flags `00` (não amostrado) de propósito: o servidor ignora a flag do pai
 * remoto e redecide pelo `traceId`, mas um cliente que mandasse `01` por
 * hábito não deve nem parecer que pede 100%.
 */
function hex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += b.toString(16).padStart(2, "0");
  return s;
}

export function novoTraceparent(): string {
  let traceId = hex(16);
  let spanId = hex(8);
  // Zero é inválido pela spec; a chance é ínfima, o custo de checar é zero.
  if (/^0+$/.test(traceId)) traceId = "1".padStart(32, "0");
  if (/^0+$/.test(spanId)) spanId = "1".padStart(16, "0");
  return `00-${traceId}-${spanId}-00`;
}

export const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;
