import type { ExperienciaHandle } from "@edu/sdk";
import type {
  Deslocamento,
  Elemento,
  Estado,
  FotoId,
  Gate,
  Motivo,
  Ponto,
  RelatoDaLupa,
  RespostaDaLupa,
  RespostaDoPublicar,
  RespostaDoToque,
  SeloId,
  Sessao,
} from "./tipos";

/**
 * O handle da experiência, num singleton depois do handshake. Toda chamada à
 * api passa por aqui — nunca `fetch` solto: é o SDK que põe o token, renova,
 * aplica timeout e reenvia GET.
 *
 * Toda resposta de POST de estudante É um `Estado` (as que têm resultado
 * próprio o estendem): a tela troca o estado inteiro a cada resposta. As rotas
 * são idempotentes — repetir a jogada já feita devolve o estado atual —, e é
 * isso que torna a fila de reenvio (`fila.ts`) inofensiva.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

function exigir(): ExperienciaHandle {
  if (!handle) throw new Error("experiência usada antes do handshake com o hub");
  return handle;
}

const BASE = "/enigma-capa";

export const api = {
  sessao: () => exigir().api.get<Sessao>(`${BASE}/sessao`),
  gate: () => exigir().api.get<Gate>(`${BASE}/gate`),
  /** ABRIR BANCADA: a sessão nasce aqui (o passo vai de `inicio` a `lupa`). */
  iniciar: () => exigir().api.post<Estado>(`${BASE}/iniciar`, {}),
  lupa: (relato: RelatoDaLupa, avancar: boolean) =>
    exigir().api.post<RespostaDaLupa>(`${BASE}/lupa`, { tempos: relato, avancar }),
  publicar: (fotoId: FotoId, seloId: SeloId, deslocamento: Deslocamento) =>
    exigir().api.post<RespostaDoPublicar>(`${BASE}/publicar`, { fotoId, seloId, deslocamento }),
  invariante: (fotoId: FotoId, ponto: Ponto) =>
    exigir().api.post<RespostaDoToque>(`${BASE}/invariantes`, { fotoId, x: ponto.x, y: ponto.y }),
  slider: () => exigir().api.post<Estado>(`${BASE}/slider`),
  fora: (toques: Ponto[]) => exigir().api.post<Estado>(`${BASE}/fora`, { toques }),
  pares: (cartas: [string, string], motivo: Motivo) => exigir().api.post<Estado>(`${BASE}/pares`, { cartas, motivo }),
  segundaFoto: (elemento: Elemento, deslocamento: Deslocamento) =>
    exigir().api.post<Estado>(`${BASE}/segunda-foto`, { elemento, deslocamento }),
};

/** Fecha a missão na plataforma. Sem `score`: a experiência não pontua (regra 3) — a régua é da api. */
export function concluirNaPlataforma() {
  exigir().concluir({ dados: {} });
}

export function reportarErro(erro: unknown) {
  handle?.reportarErro(erro);
}

/**
 * O status da falha da api, quando houver. O SDK joga `Error` com
 * "API POST /x → 409" — SEM o corpo; `null` é rede (sem status).
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}
