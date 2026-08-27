/**
 * Os sete Passos da Missao. Quem transiciona e o CLIQUE do aluno; o Cientista
 * so sugere. Estado em linguagem natural nao e testavel.
 */
/**
 * Quatro Passos. Decisão, Confirmação e Simulação existiam como telas; viraram
 * conversa (ADR-0007), e passo sem tela é passo que mente na trilha.
 */
export const PASSOS = ['abertura', 'orientacao', 'investigacao', 'resultado'] as const;
export type Passo = (typeof PASSOS)[number];

export const ROTULO_PASSO: Record<Passo, string> = {
  abertura: 'Briefing',
  orientacao: 'Orientação',
  investigacao: 'Investigação',
  resultado: 'Resultado',
};

/**
 * Voltar e permitido: reler a Orientacao no meio da Investigacao e legitimo. O
 * que voltar nao faz e devolver Relogio.
 */
export function podeIr(de: Passo, para: Passo): boolean {
  const i = PASSOS.indexOf(de);
  const j = PASSOS.indexOf(para);
  if (i < 0 || j < 0) return false;
  if (j < i) return true;
  return j === i + 1;
}

export function ehPasso(valor: unknown): valor is Passo {
  return typeof valor === 'string' && (PASSOS as readonly string[]).includes(valor);
}
