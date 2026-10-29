import type { ExperienciaHandle } from "@edu/sdk";
import type { Marco, Parecer, Publicar, Sessao } from "./tipos";

/**
 * O handle da experiência, num singleton depois do handshake. Toda chamada à
 * api passa por aqui — nunca `fetch` solto: é o SDK que põe o token, renova,
 * aplica timeout e reenvia GET.
 *
 * Não há IA na aula (o Assistente de Dados é determinístico; a IA é do
 * preparo do professor), então toda rota cabe no timeout PADRÃO do SDK (10 s)
 * — e `contrato.test.ts` reprova teto de timeout próprio aqui.
 *
 * Toda rota do estudante devolve a `Sessao` inteira (o mesmo `SessaoSchema`):
 * a tela troca o estado pelo que voltou, sem remendar.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

function exigir(): ExperienciaHandle {
  if (!handle) throw new Error("experiência usada antes do handshake com o hub");
  return handle;
}

const BASE = "/porta-voz-dos-dados";
const post = (rota: string, corpo?: unknown) => exigir().api.post<Sessao>(`${BASE}/${rota}`, corpo);

export const api = {
  /** Read-only; é também o polling da pausa (3 s). */
  sessao: () => exigir().api.get<Sessao>(`${BASE}/sessao`),
  marco: (marco: Marco) => post("sessao/marco", { marco }),
  publicar: (corpo: Publicar) => post("decisao/publicar", corpo),
  publicarErrata: (corpo: Publicar) => post("errata/publicar", corpo),
  pularErrata: () => post("errata/pular"),
  parecer: (corpo: Parecer) => post("pericia/parecer", corpo),
  pularPericia: () => post("pericia/pular"),
};

/** Fecha a missão na plataforma. Sem `score`: a experiência não pontua (regra 3). */
export function concluirNaPlataforma() {
  handle?.concluir({ dados: {} });
}

/** O "chrome" opcional do hub (`exp:estado`): a instrução ao lado do aparelho; `{}` a retira. */
export function enviarEstado(estado: Record<string, unknown>) {
  handle?.enviarEstado(estado);
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
