import { HttpException } from "@nestjs/common";

/**
 * Erros de MISSÃO da exp01ef1b — não de programa. O leitor tem 6 anos e está
 * dentro de um app disfarçado: mensagem de erro aqui é a voz de Nina, nunca
 * stack trace, "sessão" ou "requisição". A tela decide a ilustração pelo
 * `codigo`; o texto é curto porque toda instrução do 1º EF é lida em voz alta.
 *
 * Os três slugs pedidos pela banca (TEC-03) estão aqui com os status dela:
 * `latch-ja-liberado` (409), `run-nao-encontrada` (404) e
 * `pacote-nao-aprovado` (400).
 */
export type CodigoErro =
  | "latch-ja-liberado"
  | "run-nao-encontrada"
  | "pacote-nao-aprovado"
  | "etapa-fora-de-ordem"
  | "roda-em-andamento"
  | "publicacao-ja-feita"
  | "escolha-incompleta"
  | "escolha-fora-do-pacote"
  | "missao-concluida"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "sem-turma"
  | "tema-sem-fotos";

export const STATUS: Record<CodigoErro, number> = {
  "latch-ja-liberado": 409,
  "run-nao-encontrada": 404,
  "pacote-nao-aprovado": 400,
  "etapa-fora-de-ordem": 409,
  "roda-em-andamento": 409,
  "publicacao-ja-feita": 409,
  "escolha-incompleta": 400,
  "escolha-fora-do-pacote": 400,
  "missao-concluida": 409,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "sem-turma": 409,
  "tema-sem-fotos": 400,
};

const MENSAGENS: Record<CodigoErro, string> = {
  // Professor clicou duas vezes, ou dois professores da mesma turma: a
  // segunda chamada não é falha da aula — a turma JÁ está liberada.
  "latch-ja-liberado": "A turma já foi liberada para a reflexão final.",
  "run-nao-encontrada": "Não encontramos a sua missão. Toque para começar de novo.",
  "pacote-nao-aprovado": "O pacote da turma ainda não foi aprovado.",
  "etapa-fora-de-ordem": "Calma! Termine esta parte antes de ir para a próxima.",
  // Voz de Nina, igual à tela do latch: esperar não é castigo.
  "roda-em-andamento": "HORA DA RODA DE CONVERSA! OLHE PARA O SEU PROFESSOR.",
  "publicacao-ja-feita": "A SUA FOTO JÁ ESTÁ NO MURAL!",
  "escolha-incompleta": "ESCOLHA UMA FOTO E UMA LEGENDA PARA COMPARTILHAR.",
  "escolha-fora-do-pacote": "Essa escolha não é desta aula. Tente de novo.",
  "missao-concluida": "A SUA MISSÃO JÁ TERMINOU! VEJA O MURAL DA TURMA.",
  "payload-invalido": "Não entendemos o pedido. Tente de novo.",
  "turma-nao-encontrada": "Turma não encontrada nesta escola.",
  // A missão é síncrona por turma: sem matrícula não há aula para entrar. A
  // frase de resolução ("peça para a coordenação te matricular") é do HUB,
  // fora do disfarce — dentro do aparelho ela quebraria a ficção.
  "sem-turma": "Você ainda não está numa turma.",
  "tema-sem-fotos": "Este tema ainda não tem fotos produzidas.",
};

export class ErroDaMissao extends HttpException {
  constructor(readonly codigo: CodigoErro) {
    super({ codigo, mensagem: MENSAGENS[codigo] }, STATUS[codigo]);
  }
}

/** RETORNA a exceção, não lança — use `throw erroDaMissao(...)` (molde do
 *  o-eco-no-grupo). */
export function erroDaMissao(codigo: CodigoErro): ErroDaMissao {
  return new ErroDaMissao(codigo);
}
