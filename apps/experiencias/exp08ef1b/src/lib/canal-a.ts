import type { FeedPostCliente } from "./tipos";

/**
 * O CANAL A no aparelho (ADR-167): os tipos das rotas `/runs/:id/tarefas`,
 * `raio-x`, `termos`, `envio` e `revelacao/concluida`. O aparelho só MOSTRA e
 * ENVIA: as composições, os gabaritos e as réguas ficam na api (regra 3), e
 * todo envio responde `{ enviada: true }` — o estudante nunca vê o nível.
 */

export type SituacaoDaTarefa = "indisponivel" | "aguardando" | "pendente" | "enviada" | "encerrada";

export interface SituacaoDasTarefas {
  revelacaoConcluida: boolean;
  raioX: SituacaoDaTarefa;
  termos: SituacaoDaTarefa;
  envio: SituacaoDaTarefa;
}

export type OpcaoDoRaioX = "A" | "B" | "neutro";

export interface RaioXDaApi {
  situacao: SituacaoDaTarefa;
  rotulos: { A: string; B: string };
  posts: FeedPostCliente[];
}

export interface DevolutivaDaApi {
  posts: (FeedPostCliente & { origem: OpcaoDoRaioX })[];
}

export interface Opcao {
  id: string;
  texto: string;
}

export interface TermosDaApi {
  situacao: SituacaoDaTarefa;
  clausulas: Opcao[];
}

/** Os termos da ENTRADA (ADR-179): os parágrafos, com as 5 regras do 6b enterradas. */
export interface TermosDaEntradaDaApi {
  paragrafos: string[];
}

export interface EnvioDaApi {
  situacao: SituacaoDaTarefa;
  posts: (FeedPostCliente & { bio: string | null })[];
  mensagens: Opcao[];
}

/** Tarefa que ainda pede o estudante agora. */
export const pede = (s: SituacaoDaTarefa | undefined) => s === "pendente";

/**
 * O DESVIO POR FASE (ADR-167): o que o aparelho mostra antes da tela da fase.
 *
 *   - o Raio-x pendente vem antes da revelação (quem chega atrasado o faz na
 *     entrada da explicabilidade);
 *   - a revelação pendente vem antes das tarefas (quem foi puxado adiante
 *     pela turma vê a revelação primeiro);
 *   - tarefa pendente vem antes da reflexão;
 *   - quem não teve feed com lado não recebe tarefa (`indisponivel`).
 *
 * Puro, para o teste; `null` = a tela da própria fase.
 */
export type Desvio = "raio-x" | "revelacao" | "tarefas" | null;

const FASES_DEPOIS_DA_REVELACAO = ["perdidos", "reflexao", "fim"];

export function desvioDaFase(fase: string, s: SituacaoDasTarefas | null): Desvio {
  if (!s) return null;
  const naRevelacaoOuDepois = ["explicabilidade", "revelacao", "dossie", ...FASES_DEPOIS_DA_REVELACAO].includes(fase);
  if (naRevelacaoOuDepois && pede(s.raioX)) return "raio-x";
  if (FASES_DEPOIS_DA_REVELACAO.includes(fase) && !s.revelacaoConcluida) return "revelacao";
  if ((fase === "reflexao" || fase === "fim") && (pede(s.termos) || pede(s.envio))) return "tarefas";
  return null;
}
