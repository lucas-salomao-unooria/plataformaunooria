import type { ExperienciaHandle } from "@edu/sdk";
import {
  ROTA,
  type Estado,
  type FichaMontada,
  type Gate,
  type PassoPedido,
  type PedidoDoFiltro,
  type PedidoDosCarimbos,
  type RespostaDaFicha,
  type RespostaDaRotina,
  type RespostaDoConcluir,
  type RespostaDoFiltro,
  type RespostaDoReparo,
  type RespostaDosSelos,
  type Sessao,
} from "./tipos";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Toda chamada passa por aqui — nunca `fetch` solto: é o SDK que põe o
 * token, renova, aplica o timeout e reenvia GET. Molde:
 * `apps/experiencias/exp06ef1b/src/lib/api.ts`.
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

/**
 * O cliente HTTP da missão — uma função por rota de ESTUDANTE do índice
 * `ROTAS` de `apps/api/src/nina-noticia/contrato-de-rotas.ts`, com o corpo
 * exatamente como o Zod de lá o aceita. `lib/api.test.ts` confere método,
 * caminho e corpo de cada uma.
 */
export const nina = {
  sessao: () => api.get<Sessao>(`${ROTA}/sessao`),
  gate: () => api.get<Gate>(`${ROTA}/gate`),
  /** Os cartões com "Mesma feira" (cumulativo): com os três, o passo vai a `aposta`. */
  selos: (reportagens: string[]) => api.post<RespostaDosSelos>(`${ROTA}/selos`, { reportagens }),
  /** O "Travar Escolha" — o LATCH. */
  previsao: (itens: string[]) => api.post<Estado>(`${ROTA}/previsao`, { itens }),
  filtro: (pedido: PedidoDoFiltro) => api.post<RespostaDoFiltro>(`${ROTA}/filtro`, pedido),
  /** A ficha do telão aberta; `dica` = o pulso de 15 s disparou antes. */
  ficha: (dica: boolean) => api.post<RespostaDaFicha>(`${ROTA}/ficha`, { dica }),
  carimbos: (pedido: PedidoDosCarimbos) => api.post<Estado>(`${ROTA}/carimbos`, pedido),
  reparo: (ficha: FichaMontada) => api.post<RespostaDoReparo>(`${ROTA}/reparo`, { ficha }),
  passo: (para: PassoPedido) => api.post<Estado>(`${ROTA}/passo`, { para }),
  rotina: (sequencia: string[]) => api.post<RespostaDaRotina>(`${ROTA}/rotina`, { sequencia }),
  concluir: () => api.post<RespostaDoConcluir>(`${ROTA}/concluir`, {}),
};

/**
 * Fecha a missão no hub. **Sem `score`**: a missão não pontua criança; o
 * nível das habilidades é do servidor (a ficha da E14).
 */
export function concluir(dados: Record<string, number | boolean>) {
  exigir().concluir({ dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  exigir().enviarEstado(estado);
}

/** Usa o handle direto: quem reporta um erro não pode ganhar outro (ADR-84). */
export function reportarErro(erro: unknown) {
  handle?.reportarErro(erro);
}

// ─────────────────────────────────────────────── a falha, como a TELA a lê

/** O SDK joga `Error` com "API POST /x → 409" — SEM o corpo: a classificação é pelo status. */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}

/**
 * - `rede`: sem status, 5xx ou 429 — repete sozinha com o aviso "Sem sinal";
 * - `sessao`: 401 — o token novo do hub ainda não chegou; repete;
 * - `bloqueada`: 403 — missão fechada nesta turma, ou etapa não liberada;
 * - `conflito`: 409 — latch já gravado, turma pausada, passo fora de ordem,
 *   rodada nova: quem resolve é RELER a sessão;
 * - `invalida`: 400 e 404 — tela velha falando com atividade nova; relê.
 */
export type TipoDeFalha = "rede" | "sessao" | "bloqueada" | "conflito" | "invalida";

export function tipoDaFalha(erro: unknown): TipoDeFalha {
  const status = statusDoErro(erro);
  if (status === null) return "rede";
  if (status === 401) return "sessao";
  if (status === 403) return "bloqueada";
  if (status === 409) return "conflito";
  if (status === 429 || status >= 500) return "rede";
  return "invalida";
}

/** Espera entre as tentativas de uma chamada que caiu na rede. */
export function esperaDaTentativa(tentativa: number): number {
  const passos = [2_000, 4_000, 8_000];
  return passos[tentativa] ?? 15_000;
}

export interface OpcoesDaRepeticao {
  aoCair: (tipo: "rede" | "sessao") => void;
  aoVoltar: () => void;
  esperar: (ms: number) => Promise<void>;
  vivo: () => boolean;
}

/**
 * Repete uma chamada enquanto a falha for de REDE ou de SESSÃO — e só essas.
 * Todas as mutações desta missão são seguras de repetir: os latches (escolha,
 * carimbos, reparo) respondem 409 na segunda vez e a tela relê a sessão; o
 * filtro e a rotina contam no máximo uma tentativa a mais; `passo` e
 * `concluir` são idempotentes no servidor.
 */
export async function comRepeticao<T>(chamada: () => Promise<T>, opcoes: OpcoesDaRepeticao): Promise<T> {
  let tentativa = 0;
  for (;;) {
    try {
      const resposta = await chamada();
      if (tentativa > 0) opcoes.aoVoltar();
      return resposta;
    } catch (erro) {
      const tipo = tipoDaFalha(erro);
      if ((tipo !== "rede" && tipo !== "sessao") || !opcoes.vivo()) {
        if (tentativa > 0) opcoes.aoVoltar();
        throw erro;
      }
      opcoes.aoCair(tipo);
      await opcoes.esperar(esperaDaTentativa(tentativa));
      tentativa += 1;
    }
  }
}
