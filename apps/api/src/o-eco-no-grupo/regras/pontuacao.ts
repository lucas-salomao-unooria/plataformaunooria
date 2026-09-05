import { opcaoDo, ESTRATEGIAS, JUSTIFICATIVAS, ESTRATEGIAS_EXIGIDAS } from "../catalogo";

/**
 * A pontuação da missão — pura, e a única fonte do `score`.
 *
 * Três valores, e só três (o CHECK do banco cobra): 100, 70 e 0. Eles medem
 * PROFICIÊNCIA, não acerto de prova, e o estudante nunca vê o número — a
 * interface dele não tem nota, estrela nem ranking (PED-05, PED-07). O valor
 * existe para o `exp:concluir` do hub e para o painel da turma.
 *
 * Por que 70 e não 50 para quem se corrigiu: a recuperação formativa é o
 * caminho pedagógico, não a punição. Quem postou no impulso, viu o bairro
 * entrar em pânico, apagou e voltou com a contraprova APRENDEU a lição da
 * missão — só levou o caminho longo.
 */

export const SCORE_DE_PRIMEIRA = 100;
export const SCORE_APOS_RECUPERACAO = 70;
export const SCORE_SEM_CONTRAPROVA = 0;

export interface EntradaDaPontuacao {
  /** Abriu a matéria íntegra antes de responder. */
  inspecionouMateria: boolean;
  /** A opção enviada, ou `null` se nunca respondeu. */
  opcao: string | null;
  /** Quantas vezes usou "Apagar para todos". */
  desfazerUsado: number;
}

export function pontuar(entrada: EntradaDaPontuacao): number {
  if (!entrada.opcao) return SCORE_SEM_CONTRAPROVA;
  if (!opcaoDo(entrada.opcao).correta) return SCORE_SEM_CONTRAPROVA;
  // A inspeção é condição de enviar, então em produção ela é sempre verdadeira
  // aqui. A checagem fica porque uma linha antiga (ou um caminho novo que
  // esqueça o portão) não pode render 100 sem a evidência ter sido aberta.
  if (!entrada.inspecionouMateria) return SCORE_APOS_RECUPERACAO;
  return entrada.desfazerUsado === 0 ? SCORE_DE_PRIMEIRA : SCORE_APOS_RECUPERACAO;
}

/**
 * O acerto do "Meu percurso" — separado do `score` de propósito.
 *
 * Isto NÃO entra na nota da missão: o formulário é registro metacognitivo, e
 * transformá-lo em prova mudaria o que o estudante escreve nele. O número
 * alimenta só a leitura agregada do professor ("quantos identificaram as duas
 * estratégias que a missão ensinou").
 */
export interface AcertoDoPercurso {
  estrategiasPrioritarias: number;
  justificativaCorreta: boolean;
}

export function avaliarPercurso(
  estrategias: readonly string[],
  justificativaId: string,
): AcertoDoPercurso {
  const prioritarias = new Set(ESTRATEGIAS.filter((e) => e.prioritaria).map((e) => e.id));
  const escolhidas = new Set(estrategias);
  const justificativa = JUSTIFICATIVAS.find((j) => j.id === justificativaId);
  return {
    estrategiasPrioritarias: [...escolhidas].filter((id) => prioritarias.has(id)).length,
    justificativaCorreta: justificativa?.correta ?? false,
  };
}

/** Quantas estratégias prioritárias existem — o teto de `estrategiasPrioritarias`. */
export const PRIORITARIAS_NO_CATALOGO = ESTRATEGIAS.filter((e) => e.prioritaria).length;

/** O formulário pede exatamente 2, e há exatamente 2 prioritárias: a escolha é
 *  entre acertar as duas, uma, ou nenhuma. Se o catálogo mudar e isso deixar de
 *  valer, a leitura do professor passa a comparar coisas diferentes. */
export const PERCURSO_COERENTE = PRIORITARIAS_NO_CATALOGO === ESTRATEGIAS_EXIGIDAS;
