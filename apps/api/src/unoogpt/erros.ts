import { HttpException } from "@nestjs/common";

/**
 * Erros de JOGO do unoogpt — não de programa. Cada um vira uma frase que o
 * estudante lê DENTRO da ficção (o Cientista, a sala de operações), nunca um
 * stack trace nem um "erro 500".
 *
 * Molde: `apps/api/src/unootube/erros.ts`. A diferença é que aqui há um
 * código que fala de custo (`teto-da-sessao`), e a mensagem dele não pode
 * dizer "quota de IA": o estudante não sabe o que é isso, e a frase precisa
 * encerrar a missão sem sugerir que ele fez algo errado.
 */
export type CodigoErro =
  | "sessao-encerrada"
  | "relogio-nao-comecou"
  | "relogio-encerrado"
  | "sem-perguntas"
  | "falta-justificar"
  | "sem-destino"
  | "registro-pendente"
  | "fechamento-fechado"
  | "fechamento-aberto"
  | "bairro-desconhecido"
  | "ja-simulou"
  | "passo-invalido"
  | "teto-da-sessao"
  | "cientista-indisponivel"
  | "payload-invalido";

export const STATUS: Record<CodigoErro, number> = {
  "sessao-encerrada": 409,
  "relogio-nao-comecou": 409,
  "relogio-encerrado": 409,
  "sem-perguntas": 409,
  "falta-justificar": 409,
  "sem-destino": 409,
  "registro-pendente": 409,
  "fechamento-fechado": 409,
  "fechamento-aberto": 409,
  "bairro-desconhecido": 400,
  "ja-simulou": 409,
  "passo-invalido": 400,
  "teto-da-sessao": 429,
  "cientista-indisponivel": 503,
  "payload-invalido": 400,
};

export const MENSAGENS: Record<CodigoErro, string> = {
  "sessao-encerrada": "Esta rodada já terminou. Recomece para tentar de novo.",
  "relogio-nao-comecou": "A operação ainda não começou. Espere a largada.",
  "relogio-encerrado": "O tempo desta operação terminou.",
  // O campo NÃO fecha quando as perguntas acabam: o estudante ainda precisa mandar
  // as equipes, e fechar aqui o deixaria com uma decisão e nenhuma forma de
  // tomá-la. Esta mensagem só aparece se ele insistir em investigar.
  "sem-perguntas": "Suas 3 perguntas acabaram. Você ainda pode mandar as equipes.",
  "falta-justificar": "Falta dizer por que cada equipe vai para lá.",
  // Mandar com UMA equipe na base é permitido (a tela e o Cientista dizem
  // isso); o que não dá é mandar sem destino nenhum. Antes este caso caía em
  // `falta-justificar`, e a frase acusava um porquê que não faltava.
  "sem-destino": "Escolha o destino de pelo menos uma equipe antes de mandar.",
  // O desfecho fica retido até o registro da operação (ADR-172).
  "registro-pendente": "As equipes já saíram. Registre a operação para ver o resultado.",
  "fechamento-fechado": "O fechamento ainda não foi aberto pelo professor.",
  // "Tentar de novo" some quando o professor abre o fechamento.
  "fechamento-aberto": "O professor já abriu o fechamento: não dá para recomeçar agora.",
  "bairro-desconhecido": "Não reconheci esse bairro.",
  "ja-simulou": "Esta tempestade já foi enfrentada.",
  "passo-invalido": "Não é possível ir para essa etapa agora.",
  // Sem vocabulário de infraestrutura: o estudante não sabe o que é token nem
  // quota, e a frase não pode soar como castigo por ter conversado muito.
  "teto-da-sessao": "A sala de operações fechou por hoje. Sua decisão foi registrada.",
  "cientista-indisponivel": "O Cientista não conseguiu responder agora. Tente falar de novo.",
  "payload-invalido": "Não entendi o que veio da tela.",
};

export class ErroDeJogo extends HttpException {
  constructor(readonly codigo: CodigoErro) {
    super({ codigo, mensagem: MENSAGENS[codigo] }, STATUS[codigo]);
  }
}

export function erroDeJogo(codigo: CodigoErro): ErroDeJogo {
  return new ErroDeJogo(codigo);
}
