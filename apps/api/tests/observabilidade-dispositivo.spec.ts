import { classificarDispositivo, DISPOSITIVO_DESCONHECIDO, NAVEGADORES, SISTEMAS, TIPOS } from "../src/observabilidade/dispositivo";

/**
 * O classificador existe para virar RÓTULO de métrica, e é isso que os testes
 * cobram: saída sempre dentro do conjunto fechado, e a ordem das checagens —
 * que é a única parte frágil, porque todo Chromium diz "Chrome" e todo
 * navegador em iOS diz "Safari".
 */
const UA = {
  chromebook: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  androidCelular:
    "Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 12; SM-T500) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/604.1",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  firefox: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  samsung:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
};

describe("classificarDispositivo", () => {
  it("o Chromebook da escola é chromeos/chrome/desktop — e não linux, que o X11 sugeriria", () => {
    expect(classificarDispositivo(UA.chromebook)).toEqual({ navegador: "chrome", so: "chromeos", tipo: "desktop" });
  });

  it("separa celular de tablet no Android pela presença de `Mobile`, que é a convenção do próprio Android", () => {
    expect(classificarDispositivo(UA.androidCelular)).toEqual({ navegador: "chrome", so: "android", tipo: "mobile" });
    expect(classificarDispositivo(UA.androidTablet)).toEqual({ navegador: "chrome", so: "android", tipo: "tablet" });
  });

  it("iPhone é mobile e iPad é tablet, os dois em iOS", () => {
    expect(classificarDispositivo(UA.iphone)).toEqual({ navegador: "safari", so: "ios", tipo: "mobile" });
    expect(classificarDispositivo(UA.ipad)).toEqual({ navegador: "safari", so: "ios", tipo: "tablet" });
  });

  it("Edge e Samsung Internet não viram `chrome`, embora digam Chrome no user-agent", () => {
    expect(classificarDispositivo(UA.edge).navegador).toBe("edge");
    expect(classificarDispositivo(UA.samsung).navegador).toBe("samsung");
  });

  it("Safari de verdade continua safari, e o Firefox não é confundido com ninguém", () => {
    expect(classificarDispositivo(UA.safariMac)).toEqual({ navegador: "safari", so: "macos", tipo: "desktop" });
    expect(classificarDispositivo(UA.firefox)).toEqual({ navegador: "firefox", so: "linux", tipo: "desktop" });
  });

  it("sem user-agent devolve o rótulo explícito de desconhecido, e nunca lança", () => {
    expect(classificarDispositivo(undefined)).toEqual(DISPOSITIVO_DESCONHECIDO);
    expect(classificarDispositivo("")).toEqual(DISPOSITIVO_DESCONHECIDO);
  });

  it("QUALQUER string cai dentro dos conjuntos fechados — é o que impede série nova de métrica", () => {
    const lixo = ["", "a".repeat(5_000), "🙂", "curl/8.7.1", "<script>", "Chrome", "Mozilla/5.0"];
    for (const ua of lixo) {
      const d = classificarDispositivo(ua);
      expect(NAVEGADORES).toContain(d.navegador);
      expect(SISTEMAS).toContain(d.so);
      expect(TIPOS).toContain(d.tipo);
    }
  });
});
