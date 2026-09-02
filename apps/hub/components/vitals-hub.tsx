"use client";
import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";
import { useRef } from "react";

/**
 * Web Vitals do hub → `POST /observabilidade/vitals` pelo BFF (cap. 17).
 * Amostra de 10% decidida UMA vez por aba (sessionStorage); `rota` é o
 * `pathname`, que a api normaliza para um conjunto fechado. Nenhum
 * identificador de pessoa: o perfil vem do token que o BFF assina.
 * Sem sessão (landing, login) o BFF responde 401 e nada acontece.
 */
const AMOSTRA = 0.1;
const NOMES = new Set(["LCP", "INP", "CLS", "TTFB"]);

function amostrado(): boolean {
  try {
    const chave = "unooria.vitais";
    const atual = sessionStorage.getItem(chave);
    if (atual !== null) return atual === "1";
    const sim = Math.random() < AMOSTRA;
    sessionStorage.setItem(chave, sim ? "1" : "0");
    return sim;
  } catch {
    return false;
  }
}

export function VitalsHub() {
  const pathname = usePathname();
  const decisao = useRef<boolean | null>(null);
  useReportWebVitals((metrica) => {
    if (decisao.current === null) decisao.current = amostrado();
    if (!decisao.current || !NOMES.has(metrica.name)) return;
    void fetch("/api/plataforma/observabilidade/vitals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome: metrica.name, valor: Math.round(metrica.value * 1000) / 1000, rota: pathname ?? "/", superficie: "hub" }),
      keepalive: true,
    }).catch(() => undefined);
  });
  return null;
}
