import type { ExperienciaHandle } from "@edu/sdk";
import type { Caminho, PilulaId, ProjetoId } from "./tipos";

/**
 * Telemetria analítica da missão — `verbo:objeto`, e nada além disso (o
 * contrato da api: `resultado` e `contexto` são OBJETOS com número, booleano ou
 * vocabulário fechado). Os eventos são os do handoff §3.2 (EVENTO-01 a 10),
 * sem os da Etapa 6, que saiu desta versão.
 *
 * O que NUNCA sai daqui: o texto que a criança escreveu no chat (sai o
 * TAMANHO), nome, e-mail (regra 6). O nível da habilidade também não: é do
 * servidor.
 */
let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

function track(verbo: string, objeto: string, dados?: { resultado?: Record<string, unknown>; contexto?: Record<string, unknown> }) {
  exp?.track(verbo, objeto, dados);
}

export const telemetria = {
  /** EVENTO-01. */
  entrou: () => track("attempted", "missao:iniciar"),
  /** EVENTO-02: a cada passo novo. */
  etapa: (etapa: string) => track("progressed", "etapa:entrar", { contexto: { etapa } }),
  /** Uma consulta ao assistente — só o tamanho. */
  pergunta: (tamanho: number) => track("interacted", "chat:consultar", { resultado: { tamanho } }),
  /** EVENTO-07: a lacuna investigada (os cadernos digitalizados) e em que etapa. */
  digitalizou: (etapa: "E2" | "E4") => track("interacted", "lacuna:investigar", { contexto: { etapa } }),
  /** EVENTO-06: a escolha inicial e o caminho (A1, A2 ou B — correção do PO de 29/10). */
  decidiu: (projeto: ProjetoId, caminho: Caminho | null) => track("scored", "delibera:projeto", { contexto: { projeto, caminho_tomado: caminho ?? "B" } }),
  pilula: (pilula: PilulaId) => track("interacted", "revisao:pilula", { contexto: { pilula } }),
  /** EVENTO-08: a decisão final. */
  revotou: (projeto: ProjetoId, manteve: boolean) => track("scored", "revisao:projeto", { contexto: { projeto }, resultado: { manteve } }),
  /** EVENTO-09: o protocolo — quantos blocos na esteira e quantos no descarte (o nível é do servidor). */
  protocolo: (naEsteira: number, descartados: number) =>
    track("scored", "protocolo:assistente", { resultado: { blocos_adicionados: naEsteira, descartados } }),
  /** EVENTO-03. */
  concluiu: () => track("completed", "exp09ef1b"),
  /** EVENTO-05. */
  erro: (tipo: string) => track("attempted", "erro:exibir", { contexto: { tipo } }),
};
