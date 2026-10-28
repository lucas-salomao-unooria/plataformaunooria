import type { ExperienciaHandle } from "@edu/sdk";
import type { AcaoDeSeguranca, Estado, Gate, Manchete, MotivoDoAviso, Sessao } from "./tipos";

/**
 * O handle da experiência, num singleton depois do handshake. Toda chamada à
 * api passa por aqui — nunca `fetch` solto: é o SDK que põe o token, renova,
 * aplica timeout e reenvia GET.
 *
 * Sem IA na aula (ADR-191): o chat responde pela árvore de intenções do
 * servidor, então toda rota cabe no timeout PADRÃO do SDK. O teto de 45 s da
 * 2.0.x morreu com a conversa híbrida — devolvê-lo deixaria uma api travada
 * pendurar a tela meio minuto.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

function exigir(): ExperienciaHandle {
  if (!handle) throw new Error("experiência usada antes do handshake com o hub");
  return handle;
}

const BASE = "/efeito-amplificador";
const post = (rota: string, corpo?: unknown) => exigir().api.post<Estado>(`${BASE}/${rota}`, corpo);

export const api = {
  sessao: () => exigir().api.get<Sessao>(`${BASE}/sessao`),
  gate: () => exigir().api.get<Gate>(`${BASE}/gate`),
  entrar: () => post("entrar"),
  mensagem: (texto: string) => post("chat/mensagem", { texto }),
  previa: (acao: "aprovar" | "revisar") => post("previa", { acao }),
  publicar: (manchete: Manchete) => post("publicar", { manchete }),
  avisoDeCuidado: (motivo: MotivoDoAviso) => post("aviso-cuidado", { motivo }),
  seguranca: (acao: AcaoDeSeguranca) => post("seguranca", acao),
  explicar: () => post("explicar"),
  evidencia: (elemento: string) => post("evidencia", { elemento }),
  concluir: () => post("concluir"),
};

/** Fecha a missão na plataforma. Sem `score`: a experiência não pontua (regra 3). */
export function concluirNaPlataforma() {
  exigir().concluir({ dados: {} });
}

/**
 * O "chrome" opcional do hub (`exp:estado`). Aqui ele carrega o TC-10: o hub o
 * desenha FORA do aparelho nas telas da Etapa 4, e um `{}` o retira.
 */
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
