import { HttpException } from "@nestjs/common";

/**
 * Erros de JOGO da exp-05 — não de programa. Cada código vira uma frase que o
 * estudante lê DENTRO da ficção do mensageiro, nunca um stack trace.
 *
 * Molde: `apps/api/src/rastro-boato/erros.ts`. Como lá, boa parte dos 409 vem
 * do GATE DA TURMA — a professora ainda não revelou, ou ainda não liberou a
 * reflexão. Nesses casos a frase diz que está tudo bem e que é para esperar:
 * um "acesso negado" faria a criança achar que perdeu a missão.
 *
 * As duas frases de espera dizem "professor" de propósito: são a tarja de
 * SISTEMA do PRD (`e3.feedback.aguardando_sync`, `e5.feedback.espera_debate`),
 * lidas depois de o latch já ter fechado a curadoria. A régua de
 * `invariantes.ts` vale para o conteúdo do grupo, não para o rodapé da espera.
 */
export type CodigoErro =
  | "conteudo-nao-publicado"
  | "mensagem-desconhecida"
  | "piso-nao-atingido"
  | "leitura-incompleta"
  | "curadoria-confirmada"
  | "curadoria-nao-confirmada"
  | "revelacao-iniciada"
  | "revelacao-nao-liberada"
  | "reflexao-nao-liberada"
  | "reflexao-ja-enviada"
  | "missao-concluida"
  | "lote-paridade-invalida"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "escola-obrigatoria";

export const STATUS: Record<CodigoErro, number> = {
  "conteudo-nao-publicado": 409,
  "mensagem-desconhecida": 400,
  "piso-nao-atingido": 409,
  "leitura-incompleta": 409,
  "curadoria-confirmada": 409,
  "curadoria-nao-confirmada": 409,
  "revelacao-iniciada": 409,
  "revelacao-nao-liberada": 409,
  "reflexao-nao-liberada": 409,
  "reflexao-ja-enviada": 409,
  "missao-concluida": 409,
  "lote-paridade-invalida": 400,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "escola-obrigatoria": 400,
};

export const MENSAGENS: Record<CodigoErro, string> = {
  // A professora ainda não publicou o grupo. Espera, não bloqueio.
  "conteudo-nao-publicado": "O grupo ainda está sendo organizado. Volte daqui a pouco.",
  "mensagem-desconhecida": "Essa mensagem não está mais neste grupo.",
  // A porta que a missão mede: fechar o Mural com menos de 3 mensagens.
  "piso-nao-atingido": "Selecione pelo menos 3 mensagens para abrir o Mural da Turma.",
  "leitura-incompleta":
    "Dê uma olhada no resto do grupo antes de decidir — ainda há mensagens mais recentes abaixo!",
  "curadoria-confirmada": "Seu envio para o Mural já foi confirmado.",
  // O inverso da de cima, e a única recusa desta missão que a criança NÃO
  // resolve sozinha: ela chegou à reflexão sem ter fechado o Mural (o telão
  // acendeu antes de ela confirmar). Quem reabre a janela é a professora, com
  // `voltar-exploracao` no painel — por isso a frase manda chamar, em vez de
  // dizer "não pode".
  "curadoria-nao-confirmada":
    "Seu envio para o Mural não chegou a ser confirmado. Chame o professor para reabrir a seleção.",
  // O telão já acendeu: a janela da curadoria fechou para a turma inteira.
  "revelacao-iniciada": "O Mural da Turma já foi fechado para todo mundo.",
  // O gate da turma. A criança não fez nada errado.
  "revelacao-nao-liberada": "Aguardando o professor liberar a revelação coletiva...",
  "reflexao-nao-liberada":
    "Aguardando o professor liberar a próxima etapa no painel da turma...",
  "reflexao-ja-enviada": "Sua resposta já foi enviada.",
  "missao-concluida": "Esta conversa já foi encerrada.",
  "lote-paridade-invalida":
    "O lote precisa ter exatamente 3 mensagens verdadeiras, 3 falsas e 2 ambíguas.",
  "payload-invalido": "Não entendi o que veio da tela.",
  "turma-nao-encontrada": "Turma não encontrada nesta escola.",
  "escola-obrigatoria": "gestor_contrato: informe ?escolaId=",
};

export class ErroDeJogo extends HttpException {
  constructor(readonly codigo: CodigoErro) {
    super({ codigo, mensagem: MENSAGENS[codigo] }, STATUS[codigo]);
  }
}

/**
 * RETORNA a exceção, não lança — como na exp-06. Use `throw erroDeJogo(...)`.
 * As regras puras devolvem `{ ok: false, codigo }` e quem lança é o service,
 * num único ponto.
 */
export function erroDeJogo(codigo: CodigoErro): ErroDeJogo {
  return new ErroDeJogo(codigo);
}
