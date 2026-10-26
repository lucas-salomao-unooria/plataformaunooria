import { FASES, type Fase } from "../conteudo";

/**
 * O PASSO do estudante — DERIVADO dos carimbos da sessão e da fase da turma,
 * nunca guardado numa coluna (o desenho da exp02em1b e da exp05ef1b).
 *
 *   cracha → lupa → decidir → feed → invariantes → slider → fora → pares →
 *   segunda-foto → transferencia → concluida
 *
 * `feed` é a capa publicada com a resposta da visitante: com a turma na fase
 * `aberta`, é a ESPERA ("AGUARDE O PROFESSOR"); quando o professor toca em
 * LIBERAR VIRADA (geral da turma, decisão do Lucas), o passo vira
 * `invariantes` para todos os que já publicaram — e quem publica depois da
 * virada passa direto da capa à busca (a tela mostra a visitante antes).
 */
export const PASSOS = [
  "cracha",
  "lupa",
  "decidir",
  "feed",
  "invariantes",
  "slider",
  "fora",
  "pares",
  "segunda-foto",
  "transferencia",
  "concluida",
] as const;
export type Passo = (typeof PASSOS)[number];

export const FASE_INICIAL: Fase = "aberta";

/** Os marcos da sessão que decidem o passo (a sessão nasce no crachá). */
export interface MarcosDaSessao {
  lupaLiberada: boolean;
  publicou: boolean;
  invariantesCompletos: boolean;
  panoramicaAberta: boolean;
  marcouFora: boolean;
  formouPar: boolean;
  segundaFoto: boolean;
  concluiu: boolean;
}

export function normalizarFase(bruta: string | null | undefined): Fase {
  return (FASES as readonly string[]).includes(bruta ?? "") ? (bruta as Fase) : FASE_INICIAL;
}

/** A fase só anda para a FRENTE: o clique repetido não volta nada. */
export function avancarFase(atual: Fase, alvo: Fase): Fase {
  return FASES.indexOf(atual) >= FASES.indexOf(alvo) ? atual : alvo;
}

export function passoEfetivo(m: MarcosDaSessao | null, fase: Fase | null): Passo {
  if (!m) return "cracha";
  if (m.concluiu) return "concluida";
  if (!m.lupaLiberada) return "lupa";
  if (!m.publicou) return "decidir";
  if (fase !== "virada") return "feed";
  if (!m.invariantesCompletos) return "invariantes";
  if (!m.panoramicaAberta) return "slider";
  if (!m.marcouFora) return "fora";
  if (!m.formouPar) return "pares";
  if (!m.segundaFoto) return "segunda-foto";
  return "transferencia";
}

/** A posição do passo na trilha — "a jogada é deste passo ou de um já feito?". */
export function indiceDoPasso(p: Passo): number {
  return PASSOS.indexOf(p);
}
