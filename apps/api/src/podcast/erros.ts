import { HttpException } from "@nestjs/common";

/**
 * Os erros do módulo `podcast`. Os da ATIVIDADE (turma alheia, atividade de
 * outra turma, sem atividade em andamento) não estão aqui: quem os lança é o
 * carregador da missão (`FonteDoPodcast.atividade`), com o código e a frase
 * dela.
 */
export type CodigoDoPodcast =
  | "payload-invalido"
  | "experiencia-sem-podcast"
  | "roteiro-indisponivel"
  | "sem-saldo-de-ia"
  | "ia-indisponivel"
  | "muitas-tentativas";

const STATUS: Record<CodigoDoPodcast, number> = {
  "payload-invalido": 400,
  "experiencia-sem-podcast": 404,
  "roteiro-indisponivel": 409,
  "sem-saldo-de-ia": 429,
  "ia-indisponivel": 503,
  "muitas-tentativas": 429,
};

const MENSAGENS: Record<CodigoDoPodcast, string> = {
  "payload-invalido": "Não entendi o que veio da tela.",
  "experiencia-sem-podcast": "Esta missão não tem podcast de recapitulação.",
  "roteiro-indisponivel":
    "Esta atividade foi criada antes do podcast de recapitulação. Crie a atividade de novo para revisar as falas e ter o podcast.",
  "sem-saldo-de-ia": "O seu saldo de IA de hoje acabou. A transcrição do podcast continua na tela.",
  "ia-indisponivel": "O serviço de geração automática oscilou. Tente novamente ou escreva as falas você mesmo.",
  "muitas-tentativas": "Muitas tentativas em pouco tempo. Espere um minuto.",
};

export class ErroDoPodcast extends HttpException {
  constructor(
    readonly codigo: CodigoDoPodcast,
    extra?: Record<string, unknown>,
  ) {
    super({ codigo, mensagem: MENSAGENS[codigo], ...extra }, STATUS[codigo]);
  }
}

/** RETORNA a exceção, não lança — o padrão das missões. Use `throw erroDoPodcast(...)`. */
export function erroDoPodcast(codigo: CodigoDoPodcast, extra?: Record<string, unknown>): ErroDoPodcast {
  return new ErroDoPodcast(codigo, extra);
}
