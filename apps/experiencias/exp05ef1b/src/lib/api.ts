import type { ExperienciaHandle } from "@edu/sdk";
import type { CodigoErro } from "./tipos";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Toda chamada passa por aqui — nunca `fetch` solto: é o SDK que põe o
 * token, renova, aplica timeout e reenvia GET.
 * Molde: `apps/experiencias/exp06ef2b/src/lib/api.ts`.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

function exigir(): ExperienciaHandle {
  if (!handle) throw new Error("experiência usada antes do handshake com o hub");
  return handle;
}

export const api = {
  get: <T,>(path: string) => exigir().api.get<T>(path),
  post: <T,>(path: string, body?: unknown) => exigir().api.post<T>(path, body),
  /**
   * O `del` existe por UMA rota: `DELETE /quem-mandou-isso/encaminhar/:id`, o
   * "Apagar para todos" do Mural. O verbo é o da api de propósito — apagar o
   * que já não está lá é 200, não erro, e um retry de rede não precisa de corpo
   * para ser seguro. **Sem reenvio automático**: o SDK só reenvia GET.
   */
  del: <T,>(path: string) => exigir().api.delete<T>(path),
};

export function estudanteAtual() {
  return exigir().estudante;
}

/**
 * Fecha a missão. **Sem `score` nenhum**, e a ausência é o desenho desta missão
 * (PED-11): ela não pontua criança. O que vai ao hub é progresso — quantas
 * mensagens foram ao Mural, se leu o grupo inteiro, se confirmou —, e nenhum
 * desses números aparece em tela para o estudante.
 */
export function concluir(dados: Record<string, unknown>) {
  exigir().concluir({ dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  exigir().enviarEstado(estado);
}

/**
 * Manda a falha ao servidor pelo SDK.
 *
 * Usa o handle direto, e não `exigir()`, porque quem reporta um erro não pode
 * ganhar outro por causa disso: se a falha aconteceu ANTES do handshake, não há
 * token nem para onde mandar, e o sinal ali é a ausência do `exp:ready`, que o
 * hub observa. Depois do handshake há token, e é assim que a falha deixa rastro
 * em vez de morrer no console de um Chromebook (ADR-84).
 */
export function reportarErro(erro: unknown) {
  handle?.reportarErro(erro);
}

/**
 * O status da falha da api, quando houver. O SDK joga `Error` com
 * "API POST /x → 409" — SEM o corpo; por isso a classificação é pelo status.
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}

/**
 * Traduz a falha no código de jogo que a TELA distingue.
 *
 * O 403 é o único que merece frase própria no boot: é a guarda de liberação
 * (ADR-69) dizendo que a professora ainda não abriu a missão nesta turma, e
 * confundi-lo com "sem conexão" mandaria a criança recarregar a página para
 * sempre. O 409 fica genérico de propósito — ver a nota de `CodigoErro`.
 */
export function codigoDoErro(erro: unknown): CodigoErro {
  switch (statusDoErro(erro)) {
    case 409:
      return "conflito-de-etapa";
    case 403:
      return "missao-nao-liberada";
    case 400:
      return "payload-invalido";
    default:
      return "rede";
  }
}
