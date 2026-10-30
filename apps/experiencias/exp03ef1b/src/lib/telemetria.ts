import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria analítica da missão — verbo xAPI + objeto `dominio:acao`. Molde:
 * `apps/experiencias/exp06ef1b/src/lib/telemetria.ts`.
 *
 * `resultado` e `contexto` são OBJETOS com número, booleano ou vocabulário
 * fechado — string solta em `resultado` derruba o lote inteiro.
 *
 * **O que NUNCA sai daqui** (regras 3 e 6): nome, e-mail, e o ACERTO de
 * qualquer tarefa. Dos carimbos sai só que foram enviados; do reparo e da
 * rotina, o desfecho que o SERVIDOR já devolveu à tela (é ele que a criança
 * vê), nunca a posição das etiquetas nem a ordem dos blocos. O estudante é o
 * id opaco que o SDK já põe em todo evento.
 */

let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

type Valor = number | boolean | string;

function track(
  verbo: "attempted" | "interacted" | "progressed" | "completed",
  objeto: string,
  dados?: { resultado?: Record<string, Valor>; contexto?: Record<string, Valor> },
) {
  exp?.track(verbo, objeto, dados);
}

export const telemetria = {
  /** A criança abriu a missão (depois do handshake e da primeira leitura). */
  entrou: (passo: string) => track("progressed", "missao:entrada", { contexto: { passo } }),
  /** O passo mudou (a tela que o servidor pede). */
  passou: (passo: string) => track("progressed", "missao:passo", { contexto: { passo } }),

  // E1
  abriuFoto: (suporte: string) => track("interacted", "galeria:foto", { contexto: { suporte } }),
  confirmouCartaz: (selos: number) => track("interacted", "galeria:selo", { resultado: { selos } }),
  cartazPulsou: () => track("interacted", "galeria:pulso"),
  midiaFalhou: () => track("interacted", "galeria:erro-midia"),

  // E2
  travouEscolha: (itens: number) => track("attempted", "escolha:travar", { resultado: { itens } }),

  // E3
  buscou: (campo: string, encontradas: number) =>
    track("attempted", "filtro:buscar", { resultado: { encontradas }, contexto: { campo } }),
  confrontou: () => track("progressed", "omissao:confrontar"),

  // E4
  abriuFicha: (dica: boolean) => track("interacted", "ficha:abrir", { contexto: { dica } }),
  carimbou: (etapa: "e4" | "e6") => track("attempted", "carimbos:enviar", { contexto: { etapa } }),
  concluiuReparo: (desfecho: string) => track("attempted", "reparo:concluir", { resultado: { desfecho } }),

  // E5
  testouRotina: (valida: boolean) => track("attempted", "rotina:testar", { resultado: { valida } }),

  // E6
  usouFerramenta: (ferramenta: string) => track("interacted", "caso:ferramenta", { contexto: { ferramenta } }),

  concluiu: () => track("completed", "missao:concluida"),

  /** Um aviso global acendeu (rede ou sessão). */
  caiu: (motivo: "rede" | "sessao") => track("interacted", "conexao:aviso", { contexto: { motivo } }),
};
