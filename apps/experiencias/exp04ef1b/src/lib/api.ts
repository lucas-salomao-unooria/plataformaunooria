import type { ExperienciaHandle } from "@edu/sdk";
import { esperaDaTentativa } from "./regras";
import type {
  ChaveMontada,
  Comparativo,
  CorpoDaChave,
  CorpoDaSimulacao,
  CorpoDaTransferencia,
  Diagramacao,
  Estado,
  GatePublico,
  IdDeNoticia,
  Julgamento,
  Layout,
  Motivo,
  OrigemDoLayout,
  PassoPedido,
  PistaRevelada,
  Resultado,
  Revisao,
  Sessao,
  SimulacaoDaTela,
  SimulacaoEnviada,
  TipoDePista,
  TransferenciaDaTela,
  TransferenciaEnviada,
  Veredito,
} from "./tipos";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Toda chamada passa por aqui — nunca `fetch` solto: é o SDK que põe o
 * token, renova, aplica o timeout e reenvia GET. Molde:
 * `apps/experiencias/exp07ef1b/src/lib/api.ts`.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle | null) {
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

/** O corpo das duas publicações: as vagas na ordem e o layout que a tela desenhou. */
export interface CorpoDaPublicacao {
  slots: IdDeNoticia[];
  layout: Layout;
  origemDoLayout: OrigemDoLayout;
}

/**
 * As rotas da missão, uma por linha da tabela do spec — o caminho e o tipo da
 * resposta num lugar só. Quem chama decide se repete (`conexao.executar`) ou
 * não (o polling e a diagramação não repetem). Nenhuma rota de evidências:
 * a 3.0.0 mede tudo por AÇÃO, e as perguntas P1/P2 saíram (ADR-168).
 */
export const rotas = {
  sessao: () => api.get<Sessao>("/jornal-escola/sessao"),
  gate: () => api.get<GatePublico>("/jornal-escola/gate"),
  passo: (para: PassoPedido) => api.post<Estado>("/jornal-escola/passo", { para }),
  pista: (noticiaId: IdDeNoticia, tipo: TipoDePista) =>
    api.post<PistaRevelada>("/jornal-escola/pista", { noticiaId, tipo }),
  diagramar: (slots: IdDeNoticia[]) => api.post<Diagramacao>("/jornal-escola/diagramar", { slots }),
  publicar: (corpo: CorpoDaPublicacao) => api.post<Estado>("/jornal-escola/publicar", corpo),
  motivo: (motivo: Motivo) => api.post<Estado>("/jornal-escola/motivo", { motivo }),
  /** "Confio / não confio" numa pista JÁ aberta, na mesa da 1ª edição. Vale o primeiro. */
  julgamento: (noticiaId: IdDeNoticia, tipo: TipoDePista, veredito: Veredito) =>
    api.post<Julgamento>("/jornal-escola/julgamento", { noticiaId, tipo, veredito }),
  resultado: () => api.get<Resultado>("/jornal-escola/resultado"),
  /** A Chave MONTADA, num envio só. O reenvio idêntico (a repetição da rede) devolve o estado. */
  chave: (corpo: CorpoDaChave) => api.post<ChaveMontada>("/jornal-escola/chave", corpo),
  revisao: () => api.get<Revisao>("/jornal-escola/revisao"),
  republicar: (corpo: CorpoDaPublicacao) => api.post<Estado>("/jornal-escola/republicar", corpo),
  comparativo: () => api.get<Comparativo>("/jornal-escola/comparativo"),
  simulacao: () => api.get<SimulacaoDaTela>("/jornal-escola/simulacao"),
  simular: (corpo: CorpoDaSimulacao) => api.post<SimulacaoEnviada>("/jornal-escola/simulacao", corpo),
  transferencia: () => api.get<TransferenciaDaTela>("/jornal-escola/transferencia"),
  transferir: (corpo: CorpoDaTransferencia) => api.post<TransferenciaEnviada>("/jornal-escola/transferencia", corpo),
  concluir: () => api.post<Estado>("/jornal-escola/concluir"),
};

/**
 * Fecha a missão no hub. **Sem `score`**: a missão não pontua criança (PDF §6
 * e §11), e o nível das habilidades é do servidor (a ficha da E14). O que vai
 * é progresso, só números e booleanos.
 */
export function concluir(dados: Record<string, number | boolean>) {
  exigir().concluir({ dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  handle?.enviarEstado(estado);
}

/**
 * Manda a falha ao servidor pelo SDK. Usa o handle direto, e não `exigir()`:
 * quem reporta um erro não pode ganhar outro por causa disso (ADR-84).
 */
export function reportarErro(erro: unknown) {
  handle?.reportarErro(erro);
}

// ─────────────────────────────────────────────── a falha, como a TELA a lê

/**
 * O status da falha da api, quando houver. O SDK joga `Error` com
 * "API POST /x → 409" — **SEM o corpo**, e por isso a classificação é pelo
 * status: os vários 409 do contrato (`passo-invalido`, `edicao-ja-publicada`,
 * `motivo-ja-respondido`, `resultado-nao-liberado`, `rodada-mudou`…) chegam
 * aqui como um só, e os dois 403 da plataforma (`missao-nao-liberada`,
 * `recurso-indisponivel`) também. O `rodada-mudou` (o professor zerou no meio)
 * se reconhece DEPOIS, pelo efeito: a releitura traz outra sessão
 * (`jornal-app.tsx`).
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}

/**
 * O que a tela faz com cada falha — e é aqui que a regra mora, uma vez:
 *
 * - `rede`: sem status (o `fetch` caiu, o timeout do SDK estourou) ou 5xx.
 *   TRANSITÓRIA: a chamada se repete, com "Conexão com a gráfica oscilou…" na
 *   voz da redação.
 * - `limite`: 429 `muitas-requisicoes` (o rate limit da api). Também se
 *   repete, com a espera crescente, mas com a frase de "muitos pedidos": dizer
 *   que a conexão caiu seria mentir para a criança.
 * - `sessao`: 401. O SDK pede token novo ao hub a cada 10 min; enquanto ele
 *   não chega, a tela mostra "Sua sessão na redação pausou…" e repete.
 * - `bloqueada`: 403 — a guarda de liberação (ADR-69) ou o interruptor da rede
 *   (ADR-87). Não é defeito da criança nem da conexão: é a tela da escola.
 * - `conflito`: 409. O relógio da turma andou, o latch já estava fechado, a
 *   rodada mudou. Tentar de novo daria o mesmo 409 — quem resolve é reler.
 * - `invalida`: 400, 404, 422. Tela velha falando com um pacote novo; relê.
 */
export type TipoDeFalha = "rede" | "limite" | "sessao" | "bloqueada" | "conflito" | "invalida";

/** As falhas TRANSITÓRIAS: as que se repetem sozinhas, com um aviso aceso. */
export type FalhaTransitoria = "rede" | "limite" | "sessao";

export function tipoDaFalha(erro: unknown): TipoDeFalha {
  const status = statusDoErro(erro);
  if (status === null) return "rede";
  if (status === 401) return "sessao";
  if (status === 403) return "bloqueada";
  if (status === 409) return "conflito";
  if (status === 429) return "limite";
  if (status >= 500) return "rede";
  return "invalida";
}

export interface OpcoesDaRepeticao {
  /** A chamada caiu por um motivo transitório: acenda o aviso. */
  aoCair: (tipo: FalhaTransitoria) => void;
  /** A chamada voltou (ou falhou por motivo que não se repete): apague o aviso. */
  aoVoltar: () => void;
  /** A espera entre tentativas. Injetável: o "Tentar novamente" a encurta. */
  esperar: (ms: number) => Promise<void>;
  /** A tela ainda existe? Sem isso, um laço de uma tela desmontada repetiria para sempre. */
  vivo: () => boolean;
}

/**
 * Repete uma chamada enquanto a falha for TRANSITÓRIA (rede, limite, sessão) — e só essas.
 *
 * É seguro repetir todas as mutações desta missão, e isso não é por acaso: a
 * pista é idempotente por par, `POST passo` pede um destino, `concluir` é
 * idempotente em `fim`, o julgamento grava o PRIMEIRO de cada par, e as escritas
 * de latch (`publicar`, `motivo`, `republicar`, `simulacao`, `transferencia`)
 * respondem 409 na segunda vez. A Chave é um envio só, sem tentativa: o reenvio
 * IDÊNTICO devolve o estado, e outro responde 409 (`chave-ja-montada`). Quando a
 * primeira tentativa de um latch chegou mas a resposta se perdeu, a repetição
 * volta com 409 e a tela relê a sessão —
 * **o latch nunca se perde e nunca duplica, porque só vale quando a api o
 * confirma**.
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
      if ((tipo !== "rede" && tipo !== "limite" && tipo !== "sessao") || !opcoes.vivo()) {
        if (tentativa > 0) opcoes.aoVoltar();
        throw erro;
      }
      opcoes.aoCair(tipo);
      await opcoes.esperar(esperaDaTentativa(tentativa));
      tentativa += 1;
    }
  }
}
