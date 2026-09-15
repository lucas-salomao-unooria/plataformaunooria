import { buscarGuia } from "./entre-redes/guias";
import {
  MISSOES_DISPONIVEIS,
  rotaDaMissao,
  rotaDaTransversal,
  type Missao,
  type MissaoTransversal,
} from "./entre-redes/catalogo";

/**
 * Onde o PROFESSOR conduz cada missão, a partir do `expId`.
 *
 * A sala (`/professor/turmas/:id`) fala em `expId` — é o que a api devolve na
 * grade. As telas de condução vivem na trilha do Entre Redes, endereçadas por
 * ano/unidade (ou pelo slug, nas transversais). Este arquivo é a tradução entre
 * os dois, e ela precisa existir num lugar só: espalhada, cada tela inventaria
 * a própria e a primeira renomeação de unidade deixaria links mortos.
 *
 * Missão publicada sem `expId` (unidade "em breve") não entra: não há o que
 * conduzir.
 */

export interface RotasDaMissao {
  /** A ficha: o que a missão é, os atos, o preparo. */
  ficha: string;
  /**
   * A tela de resultados da missão, quando ela existe.
   *
   * **A SALA não usa mais este campo** (ADR-100): de lá o professor entra sempre
   * pela ficha, que é quem sabe o que aquela missão oferece. Quem monta o botão
   * "Ver resultados" é o corpo da missão, que existe justamente porque cada uma
   * oferece uma coisa diferente.
   */
  resultados: string | null;
  /**
   * O guia da aula — `null` quando a missão ainda não tem um.
   *
   * Sai daqui, e não de uma concatenação em cada tela, porque quem pergunta
   * "essa missão tem guia?" é a SALA DE AULA, que só conhece `expId`. Montar
   * `${ficha}/guia` na mão produziria link para 404 na primeira missão
   * publicada sem guia — e a sala mostraria o link assim mesmo.
   */
  guia: string | null;
}

function ehTransversal(missao: Missao | MissaoTransversal): missao is MissaoTransversal {
  return !("anoSlug" in missao);
}

const POR_EXP: ReadonlyMap<string, RotasDaMissao> = new Map(
  MISSOES_DISPONIVEIS.filter((missao) => Boolean(missao.expId)).map((missao) => {
    const ficha = ehTransversal(missao) ? rotaDaTransversal(missao) : rotaDaMissao(missao);
    const temGuia = Boolean(buscarGuia(missao.expId!));
    return [
      missao.expId!,
      {
        ficha,
        resultados: `${ficha}/resultados`,
        guia: temGuia ? `${ficha}/guia` : null,
      },
    ] as const;
  }),
);

/**
 * `null` quando o hub não conhece a missão. Acontece de verdade: a api pode
 * liberar uma experiência publicada antes de a ficha do professor existir, e a
 * sala precisa mostrar a linha dela sem link em vez de quebrar.
 */
export function rotasDaMissao(expId: string): RotasDaMissao | null {
  return POR_EXP.get(expId) ?? null;
}

/**
 * **O ÚNICO caminho da sala para a missão** (ADR-100): a ficha, com a turma.
 *
 * A sala tinha três links por missão — "Como funciona", "Guia da aula" e
 * "Conduzir com esta turma" — e o terceiro apontava direto para a tela de
 * resultados. Isso obrigava a SALA a saber o que cada missão oferece, e ela não
 * sabe: o Instanooria não tem tela de resultados (conduz-se pela atividade), o
 * Rastro do Boato não tem guia, e a próxima missão publicada terá outra
 * combinação. O resultado foi um link para 404 na missão do 8º ano.
 *
 * Agora a sala faz UMA pergunta — "onde fica esta missão?" — e quem responde o
 * que ela oferece é a ficha, que já tem o corpo próprio de cada missão. Ela
 * recebe a turma e reponta tudo o que está dentro dela para aquela turma.
 *
 * `null` só quando o hub não conhece a missão.
 */
export function rotaDeConducao(expId: string, turmaId: string): string | null {
  const rotas = rotasDaMissao(expId);
  if (!rotas) return null;
  return `${rotas.ficha}?turmaId=${encodeURIComponent(turmaId)}`;
}

/**
 * Repõe a turma numa rota de dentro da ficha (ADR-100).
 *
 * Existe para que o professor que entrou pela SALA não precise escolher a turma
 * de novo na tela seguinte — ele já escolheu, ao abrir a sala. Sem turma
 * (trilha do Entre Redes), devolve a rota como está, e a tela de destino
 * continua oferecendo o próprio seletor.
 */
export function comTurma(rota: string, turmaId: string | null | undefined): string {
  return turmaId ? `${rota}?turmaId=${encodeURIComponent(turmaId)}` : rota;
}

/** O guia da aula da missão, ou `null` se ela ainda não tem um. */
export function rotaDoGuiaDaMissao(expId: string): string | null {
  return rotasDaMissao(expId)?.guia ?? null;
}
