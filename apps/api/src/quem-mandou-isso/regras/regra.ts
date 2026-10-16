import type { Nivel } from "../../evidencias/regras";
import { CONDICOES, type Condicao } from "../catalogo";

export { CONDICOES, type Condicao };

/**
 * A REGRA DO TIO da EF05CO04: criar e SIMULAR um algoritmo com seleção
 * condicional e sequência.
 *
 * A criança monta, com peças, "SE a mensagem for [condição] ENTÃO eu [ação] E
 * DEPOIS [ação]", e antes de cada teste PREVÊ o que a regra vai fazer com o
 * áudio do tio. Prever é simular: a criança executa o algoritmo de cabeça. Só
 * então a plataforma mostra o que a regra fez.
 *
 * Sem texto livre (o PO tirou o campo dissertativo em 05/10, ADR-145): as
 * peças têm critério fixo, e as erradas existem de propósito, para a criança
 * poder errar.
 *
 * O que fica no SERVIDOR, e nunca desce: quais condições combinam com o áudio
 * e de que tipo é cada ação. O cliente recebe só os ids e os rótulos.
 */

// ─────────────────────────────────────────────────────────────── as peças

/** As condições são as quatro do dropdown da v2.2 (o one-pager), de volta (`catalogo.ts#CONDICOES`). */
export const ROTULO_DA_CONDICAO: Readonly<Record<Condicao, string>> = {
  urgente_alarmante: "urgente e alarmante",
  parente_proximo: "enviada por parente próximo",
  link_nao_checado: "um link que ninguém checou",
  promessa_incrivel: "prometendo algo incrível",
};

/**
 * O áudio do tio é urgente e alarmante E foi mandado por um parente: as duas
 * primeiras condições o pegam, as outras duas o deixam passar.
 */
const COMBINA_COM_O_AUDIO: Readonly<Record<Condicao, boolean>> = {
  urgente_alarmante: true,
  parente_proximo: true,
  link_nao_checado: false,
  promessa_incrivel: false,
};

export const ACOES = [
  "comparar_fonte",
  "perguntar_adulto",
  "buscar_outro_site",
  "conferir_origem",
  "esperar",
  "encaminhar_se_confirmar",
  "encaminhar_logo",
  "encaminhar_pedir",
] as const;
export type Acao = (typeof ACOES)[number];

export const ROTULO_DA_ACAO: Readonly<Record<Acao, string>> = {
  comparar_fonte: "comparo com uma fonte confiável",
  perguntar_adulto: "pergunto a um adulto de confiança",
  buscar_outro_site: "procuro a mesma notícia em outro site",
  conferir_origem: "confiro quem mandou e quando",
  esperar: "espero antes de encaminhar",
  encaminhar_se_confirmar: "encaminho só se a notícia se confirmar",
  encaminhar_logo: "encaminho logo para avisar todo mundo",
  encaminhar_pedir: "encaminho e peço que todos repassem",
};

/**
 * O tipo de cada ação. As de checagem vão além da lâmina da síntese (que só
 * fala em "comparar com uma fonte confiável"), para a regra não ser eco do
 * que a criança acabou de ver. "Encaminho só se a notícia se confirmar" é o
 * jeito certo de TERMINAR a regra — mas só depois de uma checagem.
 */
export type TipoDeAcao = "checagem" | "espera" | "condicional" | "repasse";

const TIPO_DA_ACAO: Readonly<Record<Acao, TipoDeAcao>> = {
  comparar_fonte: "checagem",
  perguntar_adulto: "checagem",
  buscar_outro_site: "checagem",
  conferir_origem: "checagem",
  esperar: "espera",
  encaminhar_se_confirmar: "condicional",
  encaminhar_logo: "repasse",
  encaminhar_pedir: "repasse",
};

/** O tipo da ação e se a condição pega o áudio — SÓ para o guia do professor (é o gabarito da regra). */
export function tipoDaAcao(a: Acao): TipoDeAcao {
  return TIPO_DA_ACAO[a];
}

export function pegaOAudio(c: Condicao): boolean {
  return COMBINA_COM_O_AUDIO[c];
}

/** Uma ou duas ações, em ORDEM (a ordem é a sequência que a habilidade pede). */
export interface Regra {
  condicao: Condicao;
  acoes: readonly [Acao] | readonly [Acao, Acao];
}

export function ehCondicao(v: string): v is Condicao {
  return (CONDICOES as readonly string[]).includes(v);
}

export function ehAcao(v: string): v is Acao {
  return (ACOES as readonly string[]).includes(v);
}

/** A forma da regra: condição e 1 ou 2 ações conhecidas, sem repetir a mesma ação. */
export function conferirRegra(condicao: string, acoes: readonly string[]): Regra | null {
  if (!ehCondicao(condicao)) return null;
  if (acoes.length < 1 || acoes.length > 2 || !acoes.every(ehAcao)) return null;
  if (acoes.length === 2 && acoes[0] === acoes[1]) return null;
  return { condicao, acoes: acoes as Regra["acoes"] };
}

export function mesmaRegra(a: Regra, b: Regra): boolean {
  return a.condicao === b.condicao && a.acoes.length === b.acoes.length && a.acoes.every((x, i) => x === b.acoes[i]);
}

// ─────────────────────────────────────────────────── o teste no áudio do tio

/**
 * O que a regra FAZ com o áudio do tio — as cinco respostas do teste, e as
 * cinco opções da previsão. Nenhuma diz "certo" ou "errado": dizem o que a
 * regra fez.
 */
export const SITUACOES = ["deixa_passar", "checa", "checa_e_repassa", "sem_conferir", "repassa_antes"] as const;
export type Situacao = (typeof SITUACOES)[number];

export function ehSituacao(v: string): v is Situacao {
  return (SITUACOES as readonly string[]).includes(v);
}

/** A previsão, como a criança a escolhe ("O que sua regra vai fazer com o áudio?"). */
export const ROTULO_DA_PREVISAO: Readonly<Record<Situacao, string>> = {
  deixa_passar: "Deixar o áudio passar",
  checa: "Mandar checar antes de encaminhar",
  checa_e_repassa: "Mandar checar, mas encaminhar de qualquer jeito",
  sem_conferir: "Mandar esperar, sem dizer como conferir",
  repassa_antes: "Mandar encaminhar antes de checar",
};

/** O resultado do teste, depois da previsão. */
export const RESULTADO_DO_TESTE: Readonly<Record<Situacao, string>> = {
  deixa_passar: "Sua regra deixou o áudio passar: a condição não combina com ele.",
  checa: "Sua regra pegou o áudio e mandou você checar antes de encaminhar.",
  checa_e_repassa: "Sua regra pegou o áudio e mandou checar, mas encaminha mesmo se a notícia for falsa.",
  sem_conferir: "Sua regra pegou o áudio, mas não diz como conferir.",
  repassa_antes: "Sua regra pegou o áudio, mas mandou encaminhar antes de checar.",
};

/** O primeiro índice de uma ação do tipo, ou `Infinity`. */
function primeira(regra: Regra, tipo: TipoDeAcao): number {
  const i = regra.acoes.findIndex((a) => TIPO_DA_ACAO[a] === tipo);
  return i < 0 ? Number.POSITIVE_INFINITY : i;
}

/**
 * A regra encaminha antes de qualquer checagem? Vale para QUALQUER mensagem,
 * não só o áudio: "SE for um link que ninguém checou ENTÃO encaminho logo" é
 * repassar sem checar, mesmo deixando o áudio passar. É o "não atingiu".
 */
export function repassaSemChecar(regra: Regra): boolean {
  const repasse = primeira(regra, "repasse");
  return repasse !== Number.POSITIVE_INFINITY && repasse < primeira(regra, "checagem");
}

/** O que a regra faz com o áudio do tio. */
export function simular(regra: Regra): Situacao {
  if (!COMBINA_COM_O_AUDIO[regra.condicao]) return "deixa_passar";
  if (repassaSemChecar(regra)) return "repassa_antes";
  if (primeira(regra, "checagem") === Number.POSITIVE_INFINITY) return "sem_conferir";
  // Há checagem, e o repasse (se houver) vem depois dela.
  return primeira(regra, "repasse") === Number.POSITIVE_INFINITY ? "checa" : "checa_e_repassa";
}

/** Quantos testes uma sessão faz, no máximo — limite técnico, não pedagógico. */
export const MAX_TESTES = 5;

export interface TesteDaRegra {
  regra: Regra;
  previsao: Situacao;
  situacao: Situacao;
}

/**
 * A RÉGUA da EF05CO04, sobre a regra ENVIADA e o histórico de testes:
 *
 *   não atingiu — a regra enviada encaminha antes de checar;
 *   atingiu     — a PRIMEIRA regra testada já pega o áudio e manda checar
 *                 (sem encaminhar de qualquer jeito), a PRIMEIRA previsão
 *                 acertou o que ela faria, e a enviada continua assim;
 *   em processo — todo o resto: chegou lá só depois do retorno do teste,
 *                 errou a previsão, só esperou, a condição não pegou o áudio,
 *                 checa e encaminha de qualquer jeito, ou enviou sem testar.
 *
 * Testar e corrigir continua sendo aprendizado, mas não leva ao "atingiu"
 * sozinho: o teste mostra o resultado, e a correção depois dele não é
 * evidência de que a criança simulou. Regra não enviada não chega aqui: é
 * "Não avaliado".
 */
export function nivelCO04(enviada: Regra, testes: readonly TesteDaRegra[]): Nivel {
  if (repassaSemChecar(enviada)) return "nao_atingiu";
  const primeiro = testes[0];
  if (primeiro && primeiro.situacao === "checa" && primeiro.previsao === "checa" && simular(enviada) === "checa") {
    return "atingiu";
  }
  return "em_processo";
}

/** A regra em palavras, para o card final e para a folha do professor. */
export function regraEmPalavras(regra: Regra): string {
  const [a1, a2] = regra.acoes;
  const depois = a2 ? ` e depois ${ROTULO_DA_ACAO[a2]}` : "";
  return `Se a mensagem for ${ROTULO_DA_CONDICAO[regra.condicao]}, então eu ${ROTULO_DA_ACAO[a1]}${depois}.`;
}
