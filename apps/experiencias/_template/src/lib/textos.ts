/**
 * Só o que a TELA escreve. Em português do Brasil, sempre (ADR-91): o único
 * inglês permitido é o nome que o app clonado usa na versão brasileira dele.
 *
 * Numa missão real, o conteúdo parametrizável por turma (réplicas, cartões,
 * roteiro) vem da api pelo `catalogo.ts` do módulo — corrigir uma palavra não
 * pode exigir republicar um caminho imutável no bucket. Aqui ficam só os
 * rótulos e as mensagens da moldura.
 */
export const TEXTOS = {
  saudacao: (nome: string) => `Olá, ${nome}`,
  passos: (n: number) => (n === 0 ? "Nenhum passo registrado ainda." : `${n} passo(s) registrado(s).`),
  registrarPasso: "Registrar um passo",
  concluir: "Concluir a missão",
  /** Na voz da FICÇÃO da missão, nunca jargão ("erro 500", "falha na API"). */
  erroDeAbertura: "Não deu para abrir agora. Tente de novo em instantes.",
} as const;
