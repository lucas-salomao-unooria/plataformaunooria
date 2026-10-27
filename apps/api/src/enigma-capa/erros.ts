import { HttpException } from "@nestjs/common";

/**
 * Os erros de DOMÍNIO da exp02ef1b, com `codigo` estável — é por ele que a tela
 * decide o que mostrar. Molde: `efeito-amplificador/erros.ts`.
 *
 * As frases das rotas de ESTUDANTE são lidas por uma criança de 7 anos (e em
 * voz alta pelo professor): curtas, na voz da Rádio Escola, sem "atividade",
 * "gabarito" nem "acesso negado". A tela costuma mostrar o próprio texto da
 * etapa (`TEXTOS`); estas são a rede de segurança.
 */
export type CodigoErro =
  | "radio-em-preparo"
  | "sessao-nao-aberta"
  | "passo-invalido"
  | "virada-nao-liberada"
  | "ja-publicado"
  | "toque-fora-da-foto"
  | "carta-desconhecida"
  | "pacote-nao-aprovado"
  | "pacote-invalido"
  | "preparo-invalido"
  | "rascunho-nao-encontrado"
  | "rascunho-desatualizado"
  | "imagem-so-da-ia"
  | "rodada-desatualizada"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "atividade-nao-encontrada";

export const STATUS: Readonly<Record<CodigoErro, number>> = {
  "radio-em-preparo": 409,
  "sessao-nao-aberta": 409,
  "passo-invalido": 409,
  "virada-nao-liberada": 409,
  "ja-publicado": 409,
  "toque-fora-da-foto": 400,
  "carta-desconhecida": 400,
  "pacote-nao-aprovado": 409,
  "pacote-invalido": 400,
  "preparo-invalido": 400,
  "rascunho-nao-encontrado": 404,
  "rascunho-desatualizado": 409,
  "imagem-so-da-ia": 409,
  "rodada-desatualizada": 409,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "atividade-nao-encontrada": 404,
};

export const MENSAGENS: Readonly<Record<CodigoErro, string>> = {
  // O professor ainda não pôs uma atividade no ar. Espera, não bloqueio.
  "radio-em-preparo": "A Rádio Escola está preparando as fotos. Aguarde o professor.",
  "sessao-nao-aberta": "Toque em ABRIR BANCADA primeiro.",
  "passo-invalido": "Vamos uma coisa de cada vez.",
  "virada-nao-liberada": "AGUARDE O PROFESSOR",
  "ja-publicado": "Sua capa já foi publicada.",
  "toque-fora-da-foto": "Toque dentro da foto.",
  "carta-desconhecida": "Essa foto não está na mesa.",
  // As de PROFESSOR, lidas no hub.
  "pacote-nao-aprovado": "Aprove e coloque uma atividade no ar para esta turma antes.",
  "pacote-invalido": "A atividade não pôde ser aprovada.",
  "preparo-invalido": "O recorte da aula não pôde ser usado.",
  "rascunho-nao-encontrado": "Não há rascunho para esta turma. Gere as fotos de novo.",
  "rascunho-desatualizado": "As fotos foram geradas de novo em outra janela. Recarregue a página.",
  "imagem-so-da-ia": "Só a cena gerada com IA pode ganhar outra imagem. Gere com IA primeiro.",
  "rodada-desatualizada": "A turma já está em outra rodada. Recarregue o painel.",
  "payload-invalido": "Não entendi o que veio da tela.",
  "turma-nao-encontrada": "Turma não encontrada.",
  "atividade-nao-encontrada": "Atividade não encontrada nesta turma.",
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
