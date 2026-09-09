import { HttpException } from "@nestjs/common";

/**
 * Erros de JOGO da exp-07 — não de programa. Cada código vira uma frase que o
 * estudante lê DENTRO da ficção do mensageiro, nunca um stack trace nem um
 * "erro 500".
 *
 * Molde: `apps/api/src/unoogpt/erros.ts`. A diferença desta missão é que boa
 * parte dos 409 vem do GATE DA TURMA — a professora ainda não abriu a Aula 2,
 * ou congelou as telas para o debate. Nesses casos a frase precisa dizer que
 * está tudo bem e que é para esperar: um "acesso negado" ali faria a criança
 * achar que perdeu a missão.
 *
 * Vocabulário proibido nas mensagens: "atividade", "professor", "gabarito",
 * "experimento" — ver `invariantes.ts`. A tela é um app de conversa, e quem
 * fala nela é o app.
 */
export type CodigoErro =
  | "aula2-nao-liberada"
  | "debate-congelado"
  | "reflexao-nao-liberada"
  | "sem-inspecao"
  | "podcast-incompleto"
  | "resposta-ja-enviada"
  | "sem-resposta-para-desfazer"
  | "reflexao-ja-enviada"
  | "missao-concluida"
  | "amara-em-silencio"
  | "sem-turno"
  | "passo-invalido"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "escola-obrigatoria"
  | "teto-da-sessao"
  | "amara-indisponivel"
  | "midia-indisponivel";

export const STATUS: Record<CodigoErro, number> = {
  "aula2-nao-liberada": 409,
  "debate-congelado": 409,
  "reflexao-nao-liberada": 409,
  "sem-inspecao": 409,
  "podcast-incompleto": 409,
  "resposta-ja-enviada": 409,
  "sem-resposta-para-desfazer": 409,
  "reflexao-ja-enviada": 409,
  "missao-concluida": 409,
  "amara-em-silencio": 409,
  "sem-turno": 409,
  "passo-invalido": 400,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "escola-obrigatoria": 400,
  "teto-da-sessao": 429,
  "amara-indisponivel": 503,
  "midia-indisponivel": 503,
};

export const MENSAGENS: Record<CodigoErro, string> = {
  // Os três gates da turma. Espera, não bloqueio: a criança não fez nada errado.
  "aula2-nao-liberada": "A conversa continua na próxima aula. Sua investigação está salva.",
  "debate-congelado": "Agora é hora de conversar com a turma. A tela volta em seguida.",
  "reflexao-nao-liberada": "Ainda falta um pouco. Aguarde para registrar seu percurso.",
  // A porta que a missão mede: responder sem ter aberto a matéria íntegra.
  "sem-inspecao": "Abra a matéria completa antes de responder — veja o que cortaram no final.",
  "podcast-incompleto": "Ouça o episódio até o fim para responder no grupo.",
  "resposta-ja-enviada": "Sua resposta já está no grupo.",
  "sem-resposta-para-desfazer": "Não há nada para apagar aqui.",
  "reflexao-ja-enviada": "Seu percurso já foi salvo.",
  "missao-concluida": "Esta conversa já foi encerrada.",
  // Amara cala na investigação de propósito — é o não-negociável de ofício.
  "amara-em-silencio": "Amara está offline agora.",
  "sem-turno": "Amara precisa sair. Vocês já conversaram bastante!",
  "passo-invalido": "Não é possível ir para essa etapa agora.",
  "payload-invalido": "Não entendi o que veio da tela.",
  "turma-nao-encontrada": "Turma não encontrada nesta escola.",
  "escola-obrigatoria": "gestor_contrato: informe ?escolaId=",
  // Sem vocabulário de infraestrutura: a criança não sabe o que é token nem
  // quota, e a frase não pode soar como castigo por ter conversado muito.
  "teto-da-sessao": "Amara ficou sem sinal por hoje. Seu percurso está registrado.",
  "amara-indisponivel": "Amara não conseguiu responder agora. Tente falar de novo.",
  "midia-indisponivel": "Não foi possível carregar a mídia. Toque para tentar baixar novamente.",
};

export class ErroDeJogo extends HttpException {
  constructor(readonly codigo: CodigoErro) {
    super({ codigo, mensagem: MENSAGENS[codigo] }, STATUS[codigo]);
  }
}

/**
 * RETORNA a exceção, não lança — como no unoogpt. Use `throw erroDeJogo(...)`.
 *
 * A diferença com o `erroDeJogo(): never` do unootube é proposital e vale
 * saber: aqui as regras puras devolvem `{ ok: false, codigo }` e quem lança é
 * o service, num único ponto.
 */
export function erroDeJogo(codigo: CodigoErro): ErroDeJogo {
  return new ErroDeJogo(codigo);
}
