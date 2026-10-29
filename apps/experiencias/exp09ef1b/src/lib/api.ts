import type { ExperienciaHandle } from "@edu/sdk";
import type { AncoraId, BlocoId, Criterio, PilulaId, ProjetoId, Sessao } from "./tipos";

/**
 * O handle da experiência, num singleton depois do handshake. Toda chamada à
 * api passa por aqui — nunca `fetch` solto: é o SDK que põe o token, renova,
 * aplica timeout e reenvia GET.
 *
 * Toda rota cabe no timeout PADRÃO do SDK (10 s). O classificador de IA do
 * chat corre no servidor contra um teto de 5 s e, perdendo, a árvore responde:
 * a tela nunca espera a IA mais do que o SDK espera a api. Toda rota devolve
 * a sessão inteira.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

function exigir(): ExperienciaHandle {
  if (!handle) throw new Error("experiência usada antes do handshake com o hub");
  return handle;
}

const BASE = "/dossie-invisivel/sessao";
const post = (rota: string, corpo?: unknown) => exigir().api.post<Sessao>(`${BASE}/${rota}`, corpo);

export const api = {
  sessao: () => exigir().api.get<Sessao>(BASE),
  entrar: () => post("entrar"),
  mensagem: (texto: string) => post("mensagem", { texto }),
  verProjetos: () => post("ver-projetos"),
  digitalizar: () => post("digitalizar"),
  decidir: (projeto: ProjetoId, ranking: Criterio[]) => post("decisao", { projeto, ranking }),
  pilula: (pilula: PilulaId) => post("pilula", { pilula }),
  revotar: (projeto: ProjetoId, ranking: Criterio[]) => post("revoto", { projeto, ranking }),
  ancoras: (ancoras: AncoraId[]) => post("ancoras", { ancoras }),
  protocolo: (slots: (BlocoId | null)[], descarte: BlocoId[]) => post("protocolo", { slots, descarte }),
};

/** Fecha a missão na plataforma. Sem `score`: a experiência não pontua (regra 3). */
export function concluirNaPlataforma() {
  exigir().concluir({ dados: {} });
}

export function reportarErro(erro: unknown) {
  handle?.reportarErro(erro);
}

/** O status da falha da api. O SDK joga `Error` com "API POST /x → 409" — sem o corpo; `null` é rede. */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}
