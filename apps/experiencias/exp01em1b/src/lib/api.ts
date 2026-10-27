import type { ExperienciaHandle } from "@edu/sdk";
import type {
  ApostaId,
  ClassificacaoValor,
  ComunicadoValor,
  CriteriosValor,
  Estado,
  Funcao,
  GateDoEstudante,
  PassoDoAlgoritmo,
  RespostaDoReteste,
  Sessao,
} from "./tipos";

/**
 * O handle da experiência, num singleton depois do handshake. Toda chamada à
 * api passa por aqui — nunca `fetch` solto: é o SDK que põe o token, renova,
 * aplica timeout e reenvia GET.
 *
 * Toda resposta de POST de estudante É um `Estado` (o reteste o estende): a
 * tela troca o estado inteiro a cada resposta. As rotas são idempotentes —
 * repetir a jogada já feita devolve o estado atual —, e é isso que torna a
 * fila de reenvio (`fila.ts`) inofensiva. Nenhuma rota daqui chama modelo de
 * IA (as conversas do UnooriaAI são roteirizadas a partir do pacote), então o
 * timeout padrão do SDK basta.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

function exigir(): ExperienciaHandle {
  if (!handle) throw new Error("experiência usada antes do handshake com o hub");
  return handle;
}

const BASE = "/assistente-invisivel";

/**
 * A atividade (pacote + rodada) do GESTO. Vai em TODO POST: a jogada que a fila
 * reenvia depois de o professor zerar leva a rodada VELHA, e a api responde 409
 * `rodada-mudou` em vez de aplicá-la na rodada nova. Por isso ela não é "a
 * atividade atual da tela": `App.tsx#executar` captura a do estado no toque e
 * roda a chamada (e o reenvio da fila) dentro de `naAtividade`.
 */
let atividade: Estado["atividade"] = null;

/**
 * Roda `chamada` com `a` no corpo. O `post` monta o corpo de forma SÍNCRONA,
 * antes do primeiro `await`, então restaurar logo depois é seguro.
 */
export function naAtividade<T>(a: Estado["atividade"], chamada: () => Promise<T>): Promise<T> {
  const antes = atividade;
  atividade = a;
  try {
    return chamada();
  } finally {
    atividade = antes;
  }
}

const post = <T = Estado>(rota: string, corpo?: Record<string, unknown>) =>
  exigir().api.post<T>(`${BASE}${rota}`, atividade ? { ...corpo, atividade } : (corpo ?? {}));

export const api = {
  sessao: () => exigir().api.get<Sessao>(`${BASE}/sessao`),
  gate: () => exigir().api.get<GateDoEstudante>(`${BASE}/gate`),
  iniciar: () => post("/iniciar"),
  navegar: (abertas: Funcao[]) => post("/navegar", { abertas }),
  aposta: (aposta: ApostaId) => post("/aposta", { aposta }),
  concluirSimulacao: () => post("/simulacao/concluir"),
  abrirFichas: () => post("/fichas/abrir"),
  concluirInspecao: () => post("/inspecao/concluir"),
  cartoes: (classificacao: ClassificacaoValor) => post("/cartoes", { classificacao }),
  abrirAlgoritmo: () => post("/algoritmo/abrir"),
  marcarAlgoritmo: (marcados: PassoDoAlgoritmo[]) => post("/algoritmo/marcar", { marcados }),
  concluirAlgoritmo: () => post("/algoritmo/concluir"),
  criterios: (criterios: CriteriosValor) => post<RespostaDoReteste>("/criterios", { criterios }),
  revisarReteste: () => post("/reteste/revisar"),
  avancarReteste: () => post("/reteste/avancar"),
  publicar: (paginaAtiva: boolean, comunicado: ComunicadoValor) => post("/publicar", { paginaAtiva, comunicado }),
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

/**
 * A falha que a fila em memória espera passar: a REDE (sem status) e a SESSÃO
 * (401). O SDK pede token novo ao hub a cada 10 minutos (`exp:token-expirando`)
 * e o token vive 15; um 401 é o hub que não respondeu a tempo, e a mesma
 * jogada passa assim que o `hub:token` chega. As outras saem e são reportadas.
 */
export function ehRetentavel(erro: unknown): boolean {
  const status = statusDoErro(erro);
  return status === null || status === 401;
}
