import { EXP_ID } from './tipos';

/**
 * A memória de F5 — `sessionStorage`, só com IDS, por PARTIDA: estudante, rodada
 * da TURMA e tentativa. A pergunta reaparece em cada "Tentar de novo" (vale a
 * melhor resposta, ADR-154), então a trava vale só para o resultado em que ela
 * foi respondida. Nunca `localStorage` (a máquina da escola é compartilhada) e
 * tudo em `try/catch`.
 *
 * A chave já foi SÓ a tentativa (`exp02em1b:perguntas:1`), e o `sessionStorage`
 * é da ABA, não do estudante: depois do "Zerar a turma" (a tentativa volta a 1)
 * ou com outro estudante entrando na mesma aba, as perguntas chegavam com a
 * resposta de antes marcada — e travadas. `limparOutras` apaga, ao montar,
 * toda chave deste prefixo que não é a desta partida, as do formato velho
 * inclusive.
 */
export const PREFIXO = `${EXP_ID}:perguntas:`;
export const chave = (p: Partida) => `${PREFIXO}${p.estudanteId}:${p.rodadaDaTurma}:${p.tentativa}`;

export interface Partida {
  estudanteId: string;
  rodadaDaTurma: number;
  tentativa: number;
}

export function lerEnviadas(armazem: Storage | null, p: Partida): Record<string, string> {
  try {
    const dado: unknown = JSON.parse(armazem?.getItem(chave(p)) ?? '{}');
    if (!dado || typeof dado !== 'object') return {};
    return Object.fromEntries(
      Object.entries(dado as Record<string, unknown>).filter((par): par is [string, string] => typeof par[1] === 'string'),
    );
  } catch {
    return {};
  }
}

export function gravarEnviadas(armazem: Storage | null, p: Partida, enviadas: Record<string, string>) {
  try {
    armazem?.setItem(chave(p), JSON.stringify(enviadas));
  } catch {
    /* Armazenamento bloqueado: a tela segue, só sem o F5 amigável. */
  }
}

export function limparOutras(armazem: Storage | null, p: Partida) {
  if (!armazem) return;
  try {
    const desta = chave(p);
    const velhas: string[] = [];
    for (let i = 0; i < armazem.length; i++) {
      const k = armazem.key(i);
      if (k && k.startsWith(PREFIXO) && k !== desta) velhas.push(k);
    }
    for (const k of velhas) armazem.removeItem(k);
  } catch {
    /* Armazenamento bloqueado: não há o que limpar. */
  }
}
