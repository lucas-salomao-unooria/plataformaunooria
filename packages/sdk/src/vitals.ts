/**
 * Web Vitals da experiência (LCP, INP, CLS, TTFB) → `POST /observabilidade/vitals`.
 * Amostrado por SESSÃO (10%): a decisão é uma só, na instalação, para uma
 * sessão amostrada mandar todos os seus vitais e a maioria não mandar nenhum.
 * `web-vitals` (~2 KB) entra por `import()` dinâmico: sessão fora da amostra
 * nem baixa o pacote, e o hub — que transpila esta SDK — não o avalia no
 * servidor.
 *
 * Nenhum identificador de pessoa no corpo: `rota` é o `expId`, o perfil vem do
 * token na api.
 */
import { lerDispositivo, type DispositivoDoNavegador } from "./dispositivo";

export const AMOSTRA_DE_VITAIS = 0.1;

export interface Vital {
  nome: "LCP" | "INP" | "CLS" | "TTFB";
  valor: number;
  rota: string;
  superficie: "hub" | "exp";
  dispositivo?: DispositivoDoNavegador;
}

export interface OpcoesDosVitais {
  rota: string;
  superficie: "hub" | "exp";
  enviar: (vital: Vital) => Promise<unknown>;
  amostra?: number;
  /** Para os testes: decide a amostragem sem `Math.random`. */
  sorteio?: () => number;
}

export async function instalarVitais(o: OpcoesDosVitais): Promise<boolean> {
  const amostra = o.amostra ?? AMOSTRA_DE_VITAIS;
  if ((o.sorteio ?? Math.random)() >= amostra || typeof window === "undefined") return false;
  const { onCLS, onINP, onLCP, onTTFB } = await import("web-vitals");
  // Lido UMA vez, na instalação: `innerWidth` durante um LCP forçaria layout,
  // e o aparelho não muda no meio da sessão (girar a tela, sim — e o que se
  // mede aqui é a população de aparelhos, não a orientação).
  const dispositivo = lerDispositivo();
  const mandar = (nome: Vital["nome"]) => (m: { value: number }) => {
    void o
      .enviar({ nome, valor: Math.round(m.value * 1000) / 1000, rota: o.rota, superficie: o.superficie, ...(dispositivo ? { dispositivo } : {}) })
      .catch(() => undefined);
  };
  onLCP(mandar("LCP"));
  onINP(mandar("INP"));
  onCLS(mandar("CLS"));
  onTTFB(mandar("TTFB"));
  return true;
}
