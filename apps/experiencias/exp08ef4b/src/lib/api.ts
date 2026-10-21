import type { ExperienciaHandle } from "@edu/sdk";
import type { CodigoErro } from "./tipos";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Molde: `apps/experiencias/exp06ef2b/src/lib/api.ts`.
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
};

export function estudanteAtual() {
  return exigir().estudante;
}

/**
 * Fecha a missão. **Sem `score`**, e a ausência é a regra 3 aplicada a uma
 * missão sem nota: as quatro cláusulas valem igual, e um número aqui deixaria a
 * tela pontuar uma escolha que a missão não pontua. O progresso da plataforma
 * lê o `concluido_em` que a api grava.
 */
export function concluir(dados: Record<string, unknown>) {
  exigir().concluir({ dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  exigir().enviarEstado(estado);
}

export function reportarErro(erro: unknown) {
  handle?.reportarErro(erro);
}

/**
 * O status da falha da api, quando houver.
 *
 * O SDK joga `Error` com "API POST /x → 409" — **sem o corpo**. Por isso a
 * classificação é pelo STATUS.
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}

export function codigoDoErro(erro: unknown): CodigoErro {
  switch (statusDoErro(erro)) {
    // O único código que a tela reconhece com certeza: é o filtro de dado
    // pessoal da Etapa 5, e a mensagem dele é corretiva, não um aviso de falha.
    case 422:
      return "dado-pessoal-no-texto";
    case 409:
      return "conflito";
    case 400:
      return "payload-invalido";
    default:
      return "rede";
  }
}
