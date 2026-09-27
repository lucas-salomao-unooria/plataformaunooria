/**
 * A memória DA ABA — o que a api não guarda e um F5 não pode apagar.
 *
 * A api guarda tudo o que VALE (as edições publicadas, as pistas abertas, o
 * motivo, a Chave). O que ela não guarda é a página EM MONTAGEM: as vagas antes
 * do latch. Sem isto, um F5 no meio da escolha devolveria a página vazia — e a
 * copy promete o contrário ("Suas matérias continuam salvas na mesa
 * editorial!"). Guarda também as alternativas já respondidas de P1/P2, para a
 * pergunta reabrir travada.
 *
 * **Só ids e números, nunca texto** (a missão não tem texto de criança), e
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
  /** As alternativas já enviadas de P1 e P2 (o id, opaco). */
  respostas?: Record<string, string>;
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
