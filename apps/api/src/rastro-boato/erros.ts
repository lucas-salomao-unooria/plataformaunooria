import { HttpException } from "@nestjs/common";

/**
 * Erros de JOGO da exp06ef2b — não de programa. Cada código vira uma frase que o
 * estudante lê DENTRO da ficção do mensageiro, nunca um stack trace.
 *
 * Molde: `apps/api/src/o-eco-no-grupo/erros.ts`. Como lá, boa parte dos 409 vem
 * do GATE DA TURMA — a professora ainda não abriu a Aula 2. Nesses casos a
 * frase diz que está tudo bem e que é para esperar: um "acesso negado" faria a
 * criança achar que perdeu a missão.
 *
 * Vocabulário proibido nas mensagens: "atividade", "professor", "gabarito",
 * "nota" — ver `invariantes.ts`, que tem o teste que cobra esta lista.
 */
export type CodigoErro =
  | "aula2-nao-liberada"
  | "auditoria-insuficiente"
  | "mensagem-desconhecida"
  | "decisao-ja-registrada"
  | "sem-decisao"
  | "blocos-incompletos"
  | "modelo-ja-enviado"
  | "reflexao-ja-enviada"
  | "missao-concluida"
  | "passo-invalido"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "escola-obrigatoria";

export const STATUS: Record<CodigoErro, number> = {
  "aula2-nao-liberada": 409,
  "auditoria-insuficiente": 409,
  "mensagem-desconhecida": 400,
  "decisao-ja-registrada": 409,
  "sem-decisao": 409,
  "blocos-incompletos": 400,
  "modelo-ja-enviado": 409,
  "reflexao-ja-enviada": 409,
  "missao-concluida": 409,
  "passo-invalido": 400,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "escola-obrigatoria": 400,
};

export const MENSAGENS: Record<CodigoErro, string> = {
  // O gate da turma. Espera, não bloqueio: a criança não fez nada errado.
  "aula2-nao-liberada": "A conversa continua na próxima aula. Sua investigação está salva.",
  // A porta que a missão mede: decidir sem ter aberto os dados das mensagens.
  "auditoria-insuficiente":
    "Inspecione os dados de pelo menos 3 mensagens para entender a origem do boato.",
  "mensagem-desconhecida": "Essa mensagem não está mais nesta conversa.",
  "decisao-ja-registrada": "Sua ação já foi enviada no grupo.",
  "sem-decisao": "Você ainda não respondeu no grupo.",
  "blocos-incompletos": "Encaixe os quatro blocos na ordem do ciclo para validar o modelo.",
  "modelo-ja-enviado": "Seu modelo do ciclo já foi confirmado.",
  "reflexao-ja-enviada": "Seu percurso já foi salvo.",
  "missao-concluida": "Esta conversa já foi encerrada.",
  "passo-invalido": "Não é possível ir para essa etapa agora.",
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
 * RETORNA a exceção, não lança — como na exp07ef1b. Use `throw erroDeJogo(...)`.
 * As regras puras devolvem `{ ok: false, codigo }` e quem lança é o service,
 * num único ponto.
 */
export function erroDeJogo(codigo: CodigoErro): ErroDeJogo {
  return new ErroDeJogo(codigo);
}
