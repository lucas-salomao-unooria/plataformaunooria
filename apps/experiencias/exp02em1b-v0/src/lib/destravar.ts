/**
 * Quando o estudante trava, ele volta com uma pergunta na mão. PURO.
 *
 * Do board (2b): "após 2 perguntas sem resposta útil, o agente oferece escolher
 * entre 3 perguntas prontas". No playtest o estudante escreveu "num intindi",
 * "manda la" e "no melio" em sequência — três turnos em que ele não recebeu
 * nada da cidade porque não sabia o que pedir. O relógio correu do mesmo jeito.
 *
 * Isto NÃO é o painel de fontes recusado no ADR-0009, por três motivos:
 *
 * 1. São PERGUNTAS, não fontes. Quem escolhe o que consultar continua sendo o
 *    Cientista — a competência que a Missão treina é formular o que se quer
 *    saber, e é exatamente ela que estas três frases exercitam.
 * 2. Elas só aparecem depois de o estudante estar demonstravelmente travado. Quem
 *    está investigando bem nunca as vê.
 * 3. São de TIPOS diferentes — quem, onde, quanto tempo —, não três versões da
 *    mesma pergunta. Ver os três tipos lado a lado é a aula: existe mais de uma
 *    coisa que dá para querer saber.
 */

export interface PerguntaPronta {
  /** O tipo, para o estudante ver que são três coisas diferentes. */
  tipo: 'quem' | 'onde' | 'quanto tempo';
  texto: string;
}

/** Texto autorado e conferido por teste (regra de ouro 2). */
export const PERGUNTAS_PRONTAS: readonly PerguntaPronta[] = [
  { tipo: 'quem', texto: 'Onde mora mais gente?' },
  { tipo: 'onde', texto: 'Onde a chuva vai bater mais forte?' },
  { tipo: 'quanto tempo', texto: 'Qual bairro a equipe alcança mais rápido?' },
] as const;

export const CHAMADA_DESTRAVAR = 'Não sabe o que perguntar? Comece por uma destas:';

/** Quantos turnos sem nada da cidade antes de oferecer ajuda. */
export const TURNOS_ATE_DESTRAVAR = 2;

/**
 * O estudante está travado?
 *
 * Travado = os últimos turnos do Cientista não trouxeram leitura nenhuma. É o
 * mesmo sinal que decide se a Pergunta gastou orçamento, e por um bom motivo:
 * turno sem consulta é turno em que o estudante não recebeu nada.
 *
 * Alocação e desfecho não contam como leitura, mas também não são estar
 * travado — quem alocou está decidindo. Por isso a conta para no primeiro
 * turno que não é de conversa pura.
 */
export function estaTravado(
  falas: readonly { papel: string; anexo?: { tipo?: string } | null }[],
): boolean {
  let semLeitura = 0;
  for (let i = falas.length - 1; i >= 0; i -= 1) {
    const f = falas[i];
    if (!f) continue;
    if (f.papel === 'estudante' || f.papel === 'estudante') continue;
    const tipo = f.anexo?.tipo;
    if (tipo === 'tendencia' || tipo === 'opcoes') return false;
    if (tipo === 'alocacao' || tipo === 'desfecho') return false;
    semLeitura += 1;
    if (semLeitura >= TURNOS_ATE_DESTRAVAR) return true;
  }
  return false;
}
