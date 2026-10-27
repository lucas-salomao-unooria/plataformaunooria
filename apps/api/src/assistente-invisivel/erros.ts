import { HttpException } from "@nestjs/common";

/**
 * Os erros de DOMÍNIO da exp01em1b, com `codigo` estável — é por ele que a
 * tela decide o que mostrar. Molde: `enigma-capa/erros.ts`.
 *
 * As frases das rotas de ESTUDANTE são lidas dentro do módulo escolar
 * ("Unooria · Comissão"): curtas, sem "gabarito" nem "acesso negado". A tela
 * costuma mostrar o próprio texto da etapa (a camada de espera); estas são a
 * rede de segurança.
 */
export type CodigoErro =
  | "missao-em-preparo"
  | "sessao-nao-aberta"
  | "passo-invalido"
  | "aguardando-professor"
  | "ja-apostou"
  | "ja-publicado"
  | "rodada-mudou"
  | "apostas-pendentes"
  | "transicao-de-etapa-invalida"
  | "pacote-nao-aprovado"
  | "pacote-invalido"
  | "preparo-invalido"
  | "rascunho-nao-encontrado"
  | "rascunho-desatualizado"
  | "rodada-desatualizada"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "atividade-nao-encontrada"
  | "sem-saldo-de-ia"
  | "ia-indisponivel";

export const STATUS: Readonly<Record<CodigoErro, number>> = {
  "missao-em-preparo": 409,
  "sessao-nao-aberta": 409,
  "passo-invalido": 409,
  "aguardando-professor": 409,
  "ja-apostou": 409,
  "ja-publicado": 409,
  "rodada-mudou": 409,
  "apostas-pendentes": 409,
  "transicao-de-etapa-invalida": 409,
  "pacote-nao-aprovado": 409,
  "pacote-invalido": 400,
  "preparo-invalido": 400,
  "rascunho-nao-encontrado": 404,
  "rascunho-desatualizado": 409,
  "rodada-desatualizada": 409,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "atividade-nao-encontrada": 404,
  "sem-saldo-de-ia": 429,
  "ia-indisponivel": 503,
};

export const MENSAGENS: Readonly<Record<CodigoErro, string>> = {
  // O professor ainda não pôs uma atividade no ar. Espera, não bloqueio.
  "missao-em-preparo": "O módulo de homologação está sendo preparado. Aguarde a liberação da mediação docente.",
  "sessao-nao-aberta": "Abra o módulo de teste primeiro.",
  "passo-invalido": "Uma etapa de cada vez.",
  "aguardando-professor": "Aguardando autorização da mediação docente…",
  "ja-apostou": "Sua previsão já foi arquivada.",
  "ja-publicado": "A transparência já foi publicada.",
  "rodada-mudou": "A turma recomeçou a atividade. Recarregue a página.",
  // As de PROFESSOR, lidas no hub.
  "apostas-pendentes": "Ainda há estudantes sem previsão registrada. Veja quem falta no painel.",
  "transicao-de-etapa-invalida": "Essa etapa não pode ser liberada agora. Recarregue o painel.",
  "pacote-nao-aprovado": "Aprove e coloque um pacote no ar para esta turma antes.",
  "pacote-invalido": "O pacote não pôde ser aprovado.",
  "preparo-invalido": "O recorte da aula não pôde ser usado.",
  "rascunho-nao-encontrado": "Não há rascunho para esta turma. Gere o pacote de novo.",
  "rascunho-desatualizado": "O pacote foi gerado de novo em outra janela. Recarregue a página.",
  "rodada-desatualizada": "A turma já está em outra rodada. Recarregue o painel.",
  "payload-invalido": "Não entendi o que veio da tela.",
  "turma-nao-encontrada": "Turma não encontrada.",
  "atividade-nao-encontrada": "Atividade não encontrada nesta turma.",
  "sem-saldo-de-ia": "Limite de geração com IA atingido por hoje. Tente novamente amanhã.",
  "ia-indisponivel": "O serviço de geração automática oscilou. Tente novamente em instantes.",
};

export class ErroDeJogo extends HttpException {
  constructor(
    readonly codigo: CodigoErro,
    readonly erros?: readonly string[],
  ) {
    super({ codigo, mensagem: MENSAGENS[codigo], ...(erros ? { erros: [...erros] } : {}) }, STATUS[codigo]);
  }
}

/** RETORNA a exceção, não lança — `throw erroDeJogo(...)`. */
export function erroDeJogo(codigo: CodigoErro, erros?: readonly string[]): ErroDeJogo {
  return new ErroDeJogo(codigo, erros);
}
