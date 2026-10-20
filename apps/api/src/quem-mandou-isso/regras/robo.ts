import type { Nivel } from "../../evidencias/regras";
import { CONDICOES, type Condicao } from "../catalogo";

export { CONDICOES, type Condicao };

/**
 * O ROBÔ DO GRUPO da EF05CO04: criar e simular um algoritmo com repetição,
 * seleção condicional e sequência (instrumento 2.5.0, substitui a regra do tio
 * com previsão da 2.4.0).
 *
 * A criança encaixa blocos: o laço "para cada mensagem nova" (opcional, não
 * vem montado), SE a mensagem for [condição], ENTÃO o robô [ação] E DEPOIS
 * [ação, opcional]. Liga o robô e vê quatro mensagens chegando, com o robô
 * agindo em cada uma. Sem o laço, ele só olha a primeira — a tela não explica,
 * a criança vê.
 *
 * SEM previsão (o Figma de 20/10 a tirou): a simulação passa a ser a do
 * próprio robô, executado pelo servidor e animado pelo cliente, e a régua lê a
 * PRIMEIRA ligação, como lia o primeiro teste.
 *
 * Os ATRIBUTOS das quatro mensagens são abertos ao aluno (aparecem sob cada
 * uma): não há gabarito escondido na condição. O que fica no servidor, e
 * nunca desce, é o TIPO de cada ação (checagem, espera, condicional,
 * repasse) — quem executa o robô é o servidor.
 */

// ─────────────────────────────────────────────────────────────── os blocos

/** O bloco de repetição. */
export const LACO = { icone: "🔁", rotulo: "para cada mensagem nova" } as const;

/** O rótulo curto de cada condição no bloco (o `SE a mensagem for…` vem antes). */
export const ROTULO_DA_CONDICAO: Readonly<Record<Condicao, string>> = {
  urgente_alarmante: "urgente e alarmante",
  parente_proximo: "de parente próximo",
  link_nao_checado: "tem link que ninguém checou",
  promessa_incrivel: "promete algo incrível",
};

/** Ícones provisórios do Figma (emojis): decorativos — o nome do bloco é o rótulo. */
export const ICONE_DA_CONDICAO: Readonly<Record<Condicao, string>> = {
  urgente_alarmante: "🚨",
  parente_proximo: "👪",
  link_nao_checado: "🔗",
  promessa_incrivel: "🎁",
};

/** A condição dentro da frase ("se a mensagem tiver link que ninguém checou"). */
const CONDICAO_NA_FRASE: Readonly<Record<Condicao, string>> = {
  urgente_alarmante: "for urgente e alarmante",
  parente_proximo: "for de parente próximo",
  link_nao_checado: "tiver link que ninguém checou",
  promessa_incrivel: "prometer algo incrível",
};

export const ACOES = [
  "comparar_fonte",
  "perguntar_adulto",
  "buscar_outro_site",
  "conferir_origem",
  "encaminhar_se_confirmar",
  "esperar",
  "encaminhar_logo",
  "encaminhar_pedir",
] as const;
export type Acao = (typeof ACOES)[number];

/** O rótulo do bloco, na voz da criança (é ela que monta o robô). */
export const ROTULO_DA_ACAO: Readonly<Record<Acao, string>> = {
  comparar_fonte: "comparo com fonte confiável",
  perguntar_adulto: "pergunto a um adulto de confiança",
  buscar_outro_site: "procuro em outro site",
  conferir_origem: "confiro quem mandou e quando",
  encaminhar_se_confirmar: "encaminho só se confirmar",
  esperar: "espero antes de encaminhar",
  encaminhar_logo: "encaminho logo",
  encaminhar_pedir: "encaminho e peço que todos repassem",
};

export const ICONE_DA_ACAO: Readonly<Record<Acao, string>> = {
  comparar_fonte: "🔍",
  perguntar_adulto: "🧑",
  buscar_outro_site: "🌐",
  conferir_origem: "🕒",
  encaminhar_se_confirmar: "✅",
  esperar: "✋",
  encaminhar_logo: "➡️",
  encaminhar_pedir: "📣",
};

/** A ação dentro da frase, na voz do robô ("o robô compara com fonte confiável"). */
const ACAO_NA_FRASE: Readonly<Record<Acao, string>> = {
  comparar_fonte: "compara com fonte confiável",
  perguntar_adulto: "pergunta a um adulto de confiança",
  buscar_outro_site: "procura em outro site",
  conferir_origem: "confere quem mandou e quando",
  encaminhar_se_confirmar: "encaminha só se confirmar",
  esperar: "espera antes de encaminhar",
  encaminhar_logo: "encaminha logo",
  encaminhar_pedir: "encaminha e pede que todos repassem",
};

/**
 * O tipo de cada ação — o GABARITO do robô, que só o professor vê. "Encaminho
 * só se confirmar" é o jeito certo de TERMINAR — mas só depois de uma
 * checagem: sozinho, não diz como confirmar.
 */
export type TipoDeAcao = "checagem" | "espera" | "condicional" | "repasse";

const TIPO_DA_ACAO: Readonly<Record<Acao, TipoDeAcao>> = {
  comparar_fonte: "checagem",
  perguntar_adulto: "checagem",
  buscar_outro_site: "checagem",
  conferir_origem: "checagem",
  encaminhar_se_confirmar: "condicional",
  esperar: "espera",
  encaminhar_logo: "repasse",
  encaminhar_pedir: "repasse",
};

export function tipoDaAcao(a: Acao): TipoDeAcao {
  return TIPO_DA_ACAO[a];
}

export function ehCondicao(v: unknown): v is Condicao {
  return (CONDICOES as readonly unknown[]).includes(v);
}

export function ehAcao(v: unknown): v is Acao {
  return (ACOES as readonly unknown[]).includes(v);
}

/** O robô montado: o laço (ou não), a condição e uma ou duas ações, em ORDEM. */
export interface Robo {
  laco: boolean;
  condicao: Condicao;
  acoes: readonly [Acao] | readonly [Acao, Acao];
}

/** A forma do robô: condição e 1 ou 2 ações conhecidas, sem repetir a mesma. */
export function conferirRobo(laco: boolean, condicao: unknown, acoes: readonly unknown[]): Robo | null {
  if (!ehCondicao(condicao)) return null;
  if (acoes.length < 1 || acoes.length > 2 || !acoes.every(ehAcao)) return null;
  if (acoes.length === 2 && acoes[0] === acoes[1]) return null;
  return { laco, condicao, acoes: acoes as Robo["acoes"] };
}

export function mesmoRobo(a: Robo, b: Robo): boolean {
  return (
    a.laco === b.laco &&
    a.condicao === b.condicao &&
    a.acoes.length === b.acoes.length &&
    a.acoes.every((x, i) => x === b.acoes[i])
  );
}

/** O robô em palavras, para o card final e para a folha do professor. */
export function roboEmPalavras(robo: Robo): string {
  const [a1, a2] = robo.acoes;
  const depois = a2 ? ` e depois ${ACAO_NA_FRASE[a2]}` : "";
  const se = `se a mensagem ${CONDICAO_NA_FRASE[robo.condicao]}, o robô ${ACAO_NA_FRASE[a1]}${depois}.`;
  return robo.laco ? `Para cada mensagem nova, ${se}` : `${se.charAt(0).toUpperCase()}${se.slice(1)}`;
}

// ───────────────────────────────────────────────── as quatro mensagens

export interface MensagemDoRobo {
  id: string;
  remetente: string;
  texto: string;
  tipo: "audio" | "texto";
  /** Os sinais da mensagem — ABERTOS ao aluno (aparecem sob ela). */
  atributos: readonly Condicao[];
}

/**
 * As quatro mensagens fixas que chegam quando o robô liga (a proposta do PO).
 * A 1ª é o áudio do tio da `FALA_DO_TIO`; a 3ª, da vizinha, é o CONTROLE: não
 * tem sinal nenhum, e o robô não precisa agir.
 */
export const MENSAGENS_DO_ROBO: readonly MensagemDoRobo[] = [
  {
    id: "robo_1",
    remetente: "Tio Paulo",
    tipo: "audio",
    texto: "Gente, cancelaram as aulas por causa do temporal! Repassa pra todo mundo correndo!",
    atributos: ["urgente_alarmante", "parente_proximo"],
  },
  {
    id: "robo_2",
    remetente: "Banco Seguro",
    tipo: "texto",
    texto: "Sua conta será bloqueada hoje. Clique no link para evitar.",
    atributos: ["link_nao_checado"],
  },
  {
    id: "robo_3",
    remetente: "Dona Rita, vizinha",
    tipo: "texto",
    texto: "Churrasco da rua no sábado às 18h, levem cadeira.",
    atributos: [],
  },
  {
    id: "robo_4",
    remetente: "Corrente",
    tipo: "texto",
    texto: "Quem repassar para 10 pessoas ganha um mês de internet. Passa já!",
    atributos: ["promessa_incrivel"],
  },
];

/** A condição pega o áudio do tio (a 1ª mensagem)? É o que a régua cobra. */
export function pegaOTio(c: Condicao): boolean {
  return (MENSAGENS_DO_ROBO[0]?.atributos ?? []).includes(c);
}

// ──────────────────────────────────────────────────────────── a simulação

/**
 * O que o robô faz com cada mensagem. Nenhuma diz "certo" ou "errado": dizem
 * o que ele fez, em texto e ícone neutros (sem verde nem vermelho na tela).
 */
export const SITUACOES = ["nao_olhou", "passou", "checa", "checa_e_repassa", "sem_conferir", "repassa_antes"] as const;
export type Situacao = (typeof SITUACOES)[number];

export const TEXTO_DA_SITUACAO: Readonly<Record<Situacao, string>> = {
  nao_olhou: "O robô não olhou esta mensagem",
  passou: "Passou direto: a regra não pegou",
  checa: "Checou antes de encaminhar",
  checa_e_repassa: "Checou, mas encaminhou de qualquer jeito",
  sem_conferir: "Esperou, sem conferir",
  repassa_antes: "Encaminhou sem checar",
};

function primeira(acoes: readonly Acao[], tipo: TipoDeAcao): number {
  const i = acoes.findIndex((a) => TIPO_DA_ACAO[a] === tipo);
  return i < 0 ? Number.POSITIVE_INFINITY : i;
}

/**
 * As ações encaminham antes de qualquer checagem? Vale para QUALQUER
 * condição: "SE tem link ENTÃO encaminho logo" repassa sem checar, mesmo
 * deixando o tio passar. É o "não atingiu".
 */
export function repassaSemChecar(acoes: readonly Acao[]): boolean {
  const repasse = primeira(acoes, "repasse");
  return repasse !== Number.POSITIVE_INFINITY && repasse < primeira(acoes, "checagem");
}

/** O que as ações fazem com uma mensagem que a condição pegou. */
export function situacaoDasAcoes(acoes: readonly Acao[]): Exclude<Situacao, "nao_olhou" | "passou"> {
  if (repassaSemChecar(acoes)) return "repassa_antes";
  if (primeira(acoes, "checagem") === Number.POSITIVE_INFINITY) return "sem_conferir";
  return primeira(acoes, "repasse") === Number.POSITIVE_INFINITY ? "checa" : "checa_e_repassa";
}

export interface ResultadoDaMensagem {
  mensagemId: string;
  situacao: Situacao;
  texto: string;
}

export interface Ligacao {
  resultados: ResultadoDaMensagem[];
  resumo: string;
}

/**
 * O robô LIGADO: as quatro mensagens, uma a uma. Sem o laço, ele só olha a
 * primeira; com o laço, olha todas. Em cada mensagem que olha: a condição fora
 * dos sinais dela = passou direto; senão, o que as ações fazem.
 */
export function ligar(robo: Robo): Ligacao {
  const resultados = MENSAGENS_DO_ROBO.map((m, i): ResultadoDaMensagem => {
    const situacao: Situacao =
      !robo.laco && i > 0 ? "nao_olhou" : m.atributos.includes(robo.condicao) ? situacaoDasAcoes(robo.acoes) : "passou";
    return { mensagemId: m.id, situacao, texto: TEXTO_DA_SITUACAO[situacao] };
  });
  const total = MENSAGENS_DO_ROBO.length;
  const resumo = robo.laco ? `O robô tratou as ${total} mensagens.` : `O robô tratou 1 das ${total} mensagens.`;
  return { resultados, resumo };
}

/** Quantas vezes o robô liga numa sessão, no máximo — limite técnico, não pedagógico. */
export const MAX_LIGACOES = 5;

/** O robô do jeito que a habilidade pede: repete, pega o tio e checa antes de encaminhar. */
function roboCompleto(r: Robo): boolean {
  return r.laco && pegaOTio(r.condicao) && situacaoDasAcoes(r.acoes) === "checa";
}

/**
 * A RÉGUA da EF05CO04, sobre o robô ENVIADO e as ligações:
 *
 *   não atingiu — as ações do enviado encaminham antes de checar;
 *   atingiu     — o enviado repete (laço), a condição pega o tio, as ações
 *                 checam antes de encaminhar (sem encaminhar de qualquer
 *                 jeito) e a PRIMEIRA ligação já era assim;
 *   em processo — todo o resto: chegou lá só depois de ver o robô ligado,
 *                 sem laço, condição que não pega o tio, só espera, checa e
 *                 encaminha de qualquer jeito, ou enviou sem ligar.
 *
 * Robô não enviado não chega aqui: é "Não avaliado".
 */
export function nivelCO04(enviado: Robo, ligacoes: readonly Robo[]): Nivel {
  if (repassaSemChecar(enviado.acoes)) return "nao_atingiu";
  const primeiraLigacao = ligacoes[0];
  if (roboCompleto(enviado) && primeiraLigacao && roboCompleto(primeiraLigacao)) return "atingiu";
  return "em_processo";
}
