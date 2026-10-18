/**
 * A memória DA ABA — o que a api não guarda e um F5 não pode apagar.
 *
 * A api guarda tudo o que VALE (as edições publicadas, as pistas abertas e
 * julgadas, o motivo, a Chave montada, a simulação e a decisão do boato). O que
 * ela não guarda é o que ainda está EM CURSO antes de cada envio único: as vagas
 * antes do latch, a Chave antes do "Pronto", a simulação antes da segunda
 * decisão e as pistas do boato antes de decidir. Sem isto, um F5 no meio
 * devolveria tudo vazio — e a copy promete o contrário ("Suas matérias
 * continuam salvas na mesa editorial!").
 *
 * **Só ids e escolhas fechadas, nunca texto** (a missão não tem texto de criança), e
 * **`sessionStorage`, nunca `localStorage`**: a máquina da escola é
 * compartilhada. A chave leva o `sessaoId`: "Zerar a turma" cria outra sessão,
 * e a página montada na rodada anterior não reaparece. Sem `sessionStorage`
 * (modo privado, cota), tudo continua funcionando — só o F5 esquece.
 */

export interface Memoria {
  /** As vagas da 1ª edição em montagem (ids ou `null`). */
  vagas1?: unknown;
  /** As vagas da 2ª edição em montagem. */
  vagas2?: unknown;
  /** A Chave em montagem: o bloco de cada vaga, o lado de cada cartão, o "se falhar", a repetição. */
  chave?: unknown;
  /** A simulação em curso, por matéria (`s1`, `s2`): as pistas marcadas na ordem e a decisão. */
  simulacao?: unknown;
  /** As pistas do boato abertas ANTES da decisão, na ordem. */
  boato?: unknown;
}

function chave(sessaoId: string): string {
  return `exp04ef1b:${sessaoId}`;
}

export function lerMemoria(sessaoId: string): Memoria {
  try {
    const bruto = window.sessionStorage.getItem(chave(sessaoId));
    if (!bruto) return {};
    const valor: unknown = JSON.parse(bruto);
    return valor && typeof valor === "object" ? (valor as Memoria) : {};
  } catch {
    return {};
  }
}

export function gravarMemoria(sessaoId: string, parte: Memoria): void {
  try {
    window.sessionStorage.setItem(chave(sessaoId), JSON.stringify({ ...lerMemoria(sessaoId), ...parte }));
  } catch {
    /* Sem armazenamento, a missão segue: só o F5 esquece a página em montagem. */
  }
}
