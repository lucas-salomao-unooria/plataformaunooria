import {
  ESTRATEGIAS_EXIGIDAS,
  TOTAL_DE_CARDS,
  opcaoDo,
  type Desfecho,
  type IdDeOpcao,
} from "../catalogo";
import type { CodigoErro } from "../erros";
import { pontuar } from "./pontuacao";
import { normalizarEtapa, normalizarPasso, passoEfetivo, type Etapa, type Passo } from "./passos";

/**
 * As transições da missão — funções PURAS, sem Prisma nem HTTP.
 *
 * O service lê a linha com lock, aplica uma destas e persiste o resultado; os
 * testes unitários batem direto aqui. A forma do retorno é a mesma do unootube:
 * `ResultadoRegra` diz se a transição vale, o estado que resulta dela e se
 * houve mudança (para não escrever no banco à toa).
 *
 * O GATE DA TURMA entra em toda regra que depende de momento coletivo. Ele não
 * é um `if` no controller de propósito: se a checagem morasse lá, uma rota nova
 * poderia esquecê-la e deixar um estudante decidir sozinho antes da Aula 2.
 */

export interface EstadoSessao {
  passo: Passo;
  inspecionouMateria: boolean;
  ouviuAudio: boolean;
  ouviuPodcast: boolean;
  cardsLidos: number;
  opcao: IdDeOpcao | null;
  latenciaSeg: number | null;
  desfazerUsado: number;
  score: number | null;
  concluidoEm: Date | null;
}

export const ESTADO_INICIAL: EstadoSessao = {
  passo: "chat_amara",
  inspecionouMateria: false,
  ouviuAudio: false,
  ouviuPodcast: false,
  cardsLidos: 0,
  opcao: null,
  latenciaSeg: null,
  desfazerUsado: 0,
  score: null,
  concluidoEm: null,
};

export type ResultadoRegra =
  | { ok: true; estado: EstadoSessao; mudou: boolean }
  | { ok: false; codigo: CodigoErro };

const semMudanca = (estado: EstadoSessao): ResultadoRegra => ({ ok: true, estado, mudou: false });
const mudou = (estado: EstadoSessao): ResultadoRegra => ({ ok: true, estado, mudou: true });
const falha = (codigo: CodigoErro): ResultadoRegra => ({ ok: false, codigo });

/** As marcas que o cliente registra durante a investigação. */
export const ACOES = [
  "inspecionar-materia",
  "ouvir-audio",
  "ouvir-podcast",
  "entrar-no-grupo",
  "encerrar-investigacao",
  "avancar-card",
  "abrir-reflexao",
] as const;

export type Acao = (typeof ACOES)[number];

/**
 * Aplica uma marca de investigação.
 *
 * Todas são IDEMPOTENTES e só andam para a frente: o estudante abre a matéria
 * três vezes e o dado continua "abriu". O que a missão mede é se ele abriu
 * antes de responder, não quantas vezes.
 */
export function aplicarAcao(estado: EstadoSessao, acao: Acao, etapa: Etapa | null): ResultadoRegra {
  if (estado.concluidoEm) return falha("missao-concluida");

  switch (acao) {
    case "entrar-no-grupo":
      return estado.passo === "chat_amara" ? mudou({ ...estado, passo: "grupo" }) : semMudanca(estado);

    case "inspecionar-materia":
      return estado.inspecionouMateria
        ? semMudanca(estado)
        : mudou({ ...estado, inspecionouMateria: true });

    case "ouvir-audio":
      return estado.ouviuAudio ? semMudanca(estado) : mudou({ ...estado, ouviuAudio: true });

    case "ouvir-podcast":
      // Só conta na Aula 2: marcar o podcast como ouvido durante a investigação
      // destravaria a decisão antes de a professora abrir a aula.
      if (passoEfetivo(estado.passo, etapa) !== "podcast") return falha("passo-invalido");
      return estado.ouviuPodcast
        ? semMudanca(estado)
        : mudou({ ...estado, ouviuPodcast: true, passo: "intervencao" });

    case "encerrar-investigacao":
      // O fim da Aula 1. O teto da etapa `investigacao` segura o estudante no
      // breakpoint; quando a professora abre a Aula 2, o piso o solta.
      if (estado.passo !== "grupo") return semMudanca(estado);
      return mudou({ ...estado, passo: "breakpoint" });

    case "avancar-card": {
      if (passoEfetivo(estado.passo, etapa) !== "sintese") return falha("passo-invalido");
      if (estado.cardsLidos >= TOTAL_DE_CARDS) return semMudanca(estado);
      return mudou({ ...estado, cardsLidos: estado.cardsLidos + 1 });
    }

    case "abrir-reflexao": {
      // Só a professora abre a reflexão (o piso da etapa). O estudante que
      // terminou os cards espera no debate — e é isso que a tela congelada diz.
      const efetivo = passoEfetivo(estado.passo, etapa);
      if (efetivo !== "reflexao") return falha("reflexao-nao-liberada");
      if (estado.cardsLidos < TOTAL_DE_CARDS) return mudou({ ...estado, passo: "reflexao", cardsLidos: TOTAL_DE_CARDS });
      return estado.passo === "reflexao" ? semMudanca(estado) : mudou({ ...estado, passo: "reflexao" });
    }
  }
}

export interface ResultadoDaIntervencao {
  desfecho: Desfecho;
  correta: boolean;
}

/**
 * A intervenção no grupo — o pico da missão.
 *
 * Dois portões, e os dois são pedagógicos:
 *
 * - a Aula 2 precisa estar aberta (`aula2-nao-liberada`), senão a turma se
 *   dispersa e quem chegou primeiro decide sozinho;
 * - a matéria íntegra precisa ter sido aberta (`sem-inspecao`). Este é o
 *   portão que a missão inteira existe para instalar: responder sem checar é
 *   exatamente o comportamento que ela está tentando desfazer.
 *
 * O desfecho sai do catálogo, nunca do cliente. `latenciaSeg` é o tempo de
 * DECISÃO do estudante, cronometrado por ele — não a latência da requisição.
 */
export function aplicarIntervencao(
  estado: EstadoSessao,
  opcaoId: IdDeOpcao,
  latenciaSeg: number,
  etapa: Etapa | null,
): ResultadoRegra {
  if (estado.concluidoEm) return falha("missao-concluida");
  if (passoEfetivo(estado.passo, etapa) === "breakpoint") return falha("aula2-nao-liberada");
  if (estado.passo === "desfecho") return falha("resposta-ja-enviada");
  if (estado.passo !== "intervencao") return falha("passo-invalido");
  if (!estado.ouviuPodcast) return falha("podcast-incompleto");
  if (!estado.inspecionouMateria) return falha("sem-inspecao");

  return mudou({ ...estado, passo: "desfecho", opcao: opcaoId, latenciaSeg });
}

/** O que o bairro faz com a resposta — leitura do gabarito, sem efeito. */
export function desfechoDe(opcaoId: IdDeOpcao): ResultadoDaIntervencao {
  const opcao = opcaoDo(opcaoId);
  return { desfecho: opcao.desfecho, correta: opcao.correta };
}

/**
 * "Apagar para todos e tentar outra resposta" — a recuperação formativa.
 *
 * Só existe para quem postou no impulso: depois da contraprova, a mensagem
 * está fixada pelo Admin e o chat não regride (latch). Desfazer a resposta
 * certa desmontaria a única cena em que a criança vê a checagem funcionar.
 */
export function aplicarDesfazer(estado: EstadoSessao): ResultadoRegra {
  if (estado.concluidoEm) return falha("missao-concluida");
  if (estado.passo !== "desfecho" || !estado.opcao) return falha("sem-resposta-para-desfazer");
  if (opcaoDo(estado.opcao).correta) return falha("resposta-ja-enviada");

  return mudou({
    ...estado,
    passo: "intervencao",
    opcao: null,
    latenciaSeg: null,
    desfazerUsado: estado.desfazerUsado + 1,
  });
}

/** Depois da cascata e do alfinete: a validação de Amara abre a sistematização. */
export function aplicarVerSintese(estado: EstadoSessao, etapa: Etapa | null): ResultadoRegra {
  if (estado.concluidoEm) return falha("missao-concluida");
  if (estado.passo !== "desfecho") return falha("passo-invalido");
  if (!estado.opcao || !opcaoDo(estado.opcao).correta) return falha("passo-invalido");
  if (passoEfetivo("sintese", etapa) !== "sintese") return falha("passo-invalido");
  return mudou({ ...estado, passo: "sintese" });
}

/**
 * O "Meu percurso" — o latch final.
 *
 * Aqui o `score` é calculado e gravado. Ele vem de `pontuar`, sobre o que
 * aconteceu no grupo: o formulário reflexivo NÃO entra na nota (transformá-lo
 * em prova mudaria o que a criança marca nele).
 */
export function aplicarReflexao(
  estado: EstadoSessao,
  estrategias: readonly string[],
  etapa: Etapa | null,
  agora: Date,
): ResultadoRegra {
  if (estado.concluidoEm) return falha("reflexao-ja-enviada");
  if (passoEfetivo(estado.passo, etapa) !== "reflexao") return falha("reflexao-nao-liberada");
  if (estrategias.length !== ESTRATEGIAS_EXIGIDAS) return falha("payload-invalido");
  if (new Set(estrategias).size !== estrategias.length) return falha("payload-invalido");

  return mudou({
    ...estado,
    passo: "fim",
    cardsLidos: TOTAL_DE_CARDS,
    score: pontuar(estado),
    concluidoEm: agora,
  });
}

/** Reidrata o estado vindo do banco, normalizando o que pode ter envelhecido. */
export function comPassoNormalizado(estado: EstadoSessao & { passo: string }): EstadoSessao {
  return { ...estado, passo: normalizarPasso(estado.passo) };
}

export { normalizarEtapa, normalizarPasso, passoEfetivo };
export type { Etapa, Passo };
