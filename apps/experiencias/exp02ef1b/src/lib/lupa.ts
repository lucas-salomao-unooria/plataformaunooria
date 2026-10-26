import type { FotoId, RelatoDaLupa } from "./tipos";

/**
 * O CRONÔMETRO da lupa (E2) — puro, testado em `lupa.test.ts`.
 *
 * Quem cronometra é a tela (o servidor não vê o dedo): a cada amostra, o tempo
 * desde a anterior vai para a foto que está sob o CENTRO da lente, e o fundo
 * de uma foto fica "visto" quando o centro passa pelo `cena.fundo` dela. O
 * servidor guarda o máximo, limita ao tempo desde a entrada e decide o piso;
 * o piso LOCAL aqui só acende o botão (o one-pager §7 quer o botão esmaecido
 * até lá) e diz para onde a mãozinha aponta.
 */

/** Uma amostra nunca vale mais que isto: a aba que dormiu não ganha minutos de lupa de uma vez. */
export const AMOSTRA_MAXIMA_MS = 500;

export const LUPA_VAZIA: RelatoDaLupa = { foto1Ms: 0, foto2Ms: 0, fundo1: false, fundo2: false };

export function registrarAmostra(atual: RelatoDaLupa, sobre: FotoId | null, noFundo: boolean, dtMs: number): RelatoDaLupa {
  if (!sobre) return atual;
  const dt = Math.max(0, Math.min(AMOSTRA_MAXIMA_MS, Math.round(dtMs)));
  if (sobre === "foto-1") return { ...atual, foto1Ms: atual.foto1Ms + dt, fundo1: atual.fundo1 || noFundo };
  return { ...atual, foto2Ms: atual.foto2Ms + dt, fundo2: atual.fundo2 || noFundo };
}

/** O que o servidor já tem não volta atrás: o relato parte do máximo dos dois. */
export function juntarRelatos(a: RelatoDaLupa, b: RelatoDaLupa): RelatoDaLupa {
  return {
    foto1Ms: Math.max(a.foto1Ms, b.foto1Ms),
    foto2Ms: Math.max(a.foto2Ms, b.foto2Ms),
    fundo1: a.fundo1 || b.fundo1,
    fundo2: a.fundo2 || b.fundo2,
  };
}

export function pisoLocal(l: RelatoDaLupa, pisoMs: number): boolean {
  return l.foto1Ms >= pisoMs && l.foto2Ms >= pisoMs && l.fundo1 && l.fundo2;
}

/** A foto para onde a mãozinha do "OLHE O FUNDO" aponta: a primeira que ainda falta. */
export function fotoQueFalta(l: RelatoDaLupa, pisoMs: number): FotoId {
  if (!l.fundo1 || l.foto1Ms < pisoMs) return "foto-1";
  return "foto-2";
}

/** Vale mandar um relato periódico? Só se mudou algo que o servidor ainda não sabe. */
export function relatoMudou(enviado: RelatoDaLupa, atual: RelatoDaLupa, folgaMs = 250): boolean {
  return (
    atual.foto1Ms - enviado.foto1Ms >= folgaMs ||
    atual.foto2Ms - enviado.foto2Ms >= folgaMs ||
    (atual.fundo1 && !enviado.fundo1) ||
    (atual.fundo2 && !enviado.fundo2)
  );
}
