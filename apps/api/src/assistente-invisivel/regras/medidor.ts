import { APOSTAS, MEDIDOR_MINIMO, type Aposta } from "../conteudo";

/**
 * O medidor da turma (E4-ALU-02, TC-12): "Na sua turma: X% apostou que o
 * cadastro seria cumprido integralmente (A), Y% previu triagem parcial (B) e
 * Z% previu básico para todos (C)". É o ÚNICO dado de colegas que desce ao
 * estudante, e desce só agregado: contagens da rodada, nunca quem apostou o
 * quê (a lição de `distribuicaoDaTurma`, `rostering/AGENTS.md`).
 *
 * Abaixo de `MEDIDOR_MINIMO` apostas o medidor SOME (`null`): numa turma de
 * dois, o percentual entregaria a aposta do colega. Decisão de
 * computabilidade, registrada no card.
 */
export type Medidor = Readonly<Record<Aposta, number>> & { total: number };

export function medidorDaTurma(contagens: Partial<Record<Aposta, number>>): Medidor | null {
  const c = { a: contagens.a ?? 0, b: contagens.b ?? 0, c: contagens.c ?? 0 };
  const total = c.a + c.b + c.c;
  if (total < MEDIDOR_MINIMO) return null;
  // Arredondamento que fecha 100: o maior resto leva a sobra.
  const brutos = APOSTAS.map((k) => (c[k] * 100) / total);
  const pisos = brutos.map(Math.floor);
  let sobra = 100 - pisos.reduce((s, x) => s + x, 0);
  const ordem = brutos.map((b, i) => ({ i, resto: b - Math.floor(b) })).sort((x, y) => y.resto - x.resto);
  for (const { i } of ordem) {
    if (sobra <= 0) break;
    pisos[i]! += 1;
    sobra -= 1;
  }
  return { a: pisos[0]!, b: pisos[1]!, c: pisos[2]!, total };
}

/**
 * "Liberar Início da Simulação" (E3-PROF-01) acende com 100% — das sessões
 * ABERTAS na rodada (quem entrou na missão nesta aula), não da lista da turma:
 * quem faltou não segura o botão. Decisão de computabilidade, registrada no card.
 */
export function todosApostaram(sessoesAbertas: number, apostas: number): boolean {
  return sessoesAbertas > 0 && apostas >= sessoesAbertas;
}
