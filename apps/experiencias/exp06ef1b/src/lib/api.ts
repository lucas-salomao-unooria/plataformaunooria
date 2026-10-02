import type { ExperienciaHandle } from "@edu/sdk";
import { esperaDaTentativa } from "./regras";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Toda chamada passa por aqui — nunca `fetch` solto: é o SDK que põe o
 * token, renova, aplica o timeout e reenvia GET. Molde:
 * `apps/experiencias/exp07ef1b/src/lib/api.ts`.
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
 * `POST` de uma rota que responde **204 sem corpo** (`galeria/acoes`).
 *
 * O SDK faz `res.json()` em toda resposta `ok`, e o corpo vazio do 204 vira
 * `SyntaxError` — sem status na mensagem, que a `tipoDaFalha` leria como queda
 * de REDE e a `comRepeticao` repetiria para sempre. Aqui o `SyntaxError` depois
 * de uma resposta `ok` é o sucesso que ele é.
 */
export async function postSemResposta(path: string, body: unknown): Promise<void> {
  try {
    await exigir().api.post<unknown>(path, body);
  } catch (erro) {
    if (erro instanceof SyntaxError) return;
    throw erro;
  }
}

/** O id opaco do estudante, que vai na chave do `sessionStorage` (`memoria.ts`). */
export function idDoEstudante(): string {
  return handle?.estudante.id ?? "anonimo";
}

/**
 * Fecha a missão no hub. **Sem `score`**: a missão não pontua criança, e o
 * nível das habilidades é do servidor (a ficha da E14). O que vai é progresso,
 * só números e booleanos.
 */
export function concluir(dados: Record<string, number | boolean>) {
  exigir().concluir({ dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  exigir().enviarEstado(estado);
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
 * status: os dois 403 de porta fechada (`missao-nao-liberada` da sala e
 * `atividade-nao-preparada` da missão) chegam iguais, e os vários 409 do
 * relógio da turma também.
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}

/**
 * O que a tela faz com cada falha — e é aqui que a regra mora, uma vez:
 *
 * - `rede`: sem status (o `fetch` caiu, o timeout do SDK estourou), 5xx ou 429.
 *   TRANSITÓRIA: a chamada se repete sozinha, com o aviso na voz da comissão.
 * - `sessao`: 401. O SDK pede token novo ao hub a cada 10 min; enquanto ele não
 *   chega, a tela mostra o aviso de credencial e repete.
 * - `bloqueada`: 403 — a missão não está aberta nesta turma
 *   (`missao-nao-liberada`, `atividade-nao-preparada`, `recurso-indisponivel`)
 *   ou a galeria ainda não foi liberada (`galeria-nao-liberada`). A tela da
 *   escola, ou a releitura da sessão — quem decide é quem chamou.
 * - `conflito`: 409. O voto já estava lacrado, a revisão já estava na ata, a
 *   rodada mudou. Tentar de novo daria o mesmo 409: quem resolve é reler.
 * - `invalida`: 400 e 404. Tela velha falando com uma atividade nova; relê.
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

export interface OpcoesDaRepeticao {
  /** A chamada caiu por um motivo transitório: acenda o aviso. */
  aoCair: (tipo: "rede" | "sessao") => void;
  /** A chamada voltou (ou falhou por motivo que não se repete): apague o aviso. */
  aoVoltar: () => void;
  /** A espera entre tentativas. Injetável: o "Tentar novamente" a encurta. */
  esperar: (ms: number) => Promise<void>;
  /** A tela ainda existe? Sem isso, um laço de uma tela desmontada repetiria para sempre. */
  vivo: () => boolean;
}

/**
 * Repete uma chamada enquanto a falha for de REDE ou de SESSÃO — e só essas.
 *
 * É seguro repetir todas as mutações desta missão, e isso não é por acaso:
 * `POST passo` pede um destino; `feed/eventos` manda curtida como ESTADO
 * (curtiu: true/false) e permanência como fato que o servidor deduplica, e
 * `proximo` só serve o post seguinte ao último que ESTE servidor já serviu;
 * `galeria/acoes` deduplica os abertos; `voto` e `revisao` respondem 409 na
 * segunda vez; `pacotes` e `cadeia` contam uma tentativa a mais no pior caso;
 * `cartoes` regrava a mesma escolha; `concluir` é idempotente. Quando a
 * primeira tentativa chegou ao servidor mas a resposta se perdeu, a repetição
 * volta com 409 e a tela relê a sessão — **o latch nunca se perde e nunca
 * duplica, porque ele só vale quando a api o confirma**.
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
