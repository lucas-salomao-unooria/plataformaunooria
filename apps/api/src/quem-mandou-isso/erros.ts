import { HttpException } from "@nestjs/common";
import { ENTAO_MAX_CARACTERES, ENTAO_MIN_CARACTERES } from "./catalogo";

/**
 * Os erros de DOMÍNIO da exp05ef1b — com `codigo` estável, que é por onde a
 * tela decide o que mostrar. Molde: `rastro-boato/erros.ts`.
 *
 * As frases das rotas de ESTUDANTE são lidas DENTRO do clone (um app de
 * mensagens): sem "atividade", sem "gabarito", sem "acesso negado". Boa parte
 * dos 409 é o relógio da turma — o professor ainda não liberou —, e a frase
 * diz que está tudo bem e é para esperar. Duas vêm literais da copy
 * (`e2.erro.toast_menor_3`, `e2.erro.toast_limite_3`, `e6.erro.entropia_baixa`).
 */
export type CodigoErro =
  | "grupo-em-preparo"
  | "grupo-nao-aberto"
  | "mensagem-desconhecida"
  | "selecao-repetida"
  | "selecao-acima-do-limite"
  | "selecao-incompleta"
  | "mural-ja-enviado"
  | "mural-nao-enviado"
  | "enquete-ja-votada"
  | "enquete-nao-votada"
  | "reflexao-nao-liberada"
  | "reflexao-ja-enviada"
  | "reflexao-nao-enviada"
  | "entao-curto"
  | "entao-longo"
  | "entao-sem-sentido"
  | "pacote-nao-aprovado"
  | "pacote-invalido"
  | "preparo-invalido"
  | "rodada-desatualizada"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "atividade-nao-encontrada";

export const STATUS: Readonly<Record<CodigoErro, number>> = {
  "grupo-em-preparo": 409,
  "grupo-nao-aberto": 409,
  "mensagem-desconhecida": 400,
  "selecao-repetida": 400,
  "selecao-acima-do-limite": 400,
  "selecao-incompleta": 400,
  "mural-ja-enviado": 409,
  "mural-nao-enviado": 409,
  "enquete-ja-votada": 409,
  "enquete-nao-votada": 409,
  "reflexao-nao-liberada": 409,
  "reflexao-ja-enviada": 409,
  "reflexao-nao-enviada": 409,
  "entao-curto": 400,
  "entao-longo": 400,
  "entao-sem-sentido": 400,
  "pacote-nao-aprovado": 409,
  "pacote-invalido": 400,
  "preparo-invalido": 400,
  "rodada-desatualizada": 409,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "atividade-nao-encontrada": 404,
};

export const MENSAGENS: Readonly<Record<CodigoErro, string>> = {
  // O professor ainda não aprovou o pacote desta turma. Espera, não bloqueio.
  "grupo-em-preparo": "O grupo ainda está sendo organizado. Volte daqui a pouco.",
  "grupo-nao-aberto": "Entre no grupo da turma primeiro.",
  "mensagem-desconhecida": "Essa mensagem não está mais neste grupo.",
  "selecao-repetida": "Cada mensagem vai uma vez só para o Mural.",
  "selecao-acima-do-limite": "Limite de 3 mensagens atingido. Desmarque uma mensagem para escolher outra.",
  "selecao-incompleta": "Você precisa selecionar exatamente 3 mensagens antes de continuar.",
  "mural-ja-enviado": "Suas mensagens já foram enviadas para o Mural da Turma.",
  "mural-nao-enviado": "Confirme o envio para o Mural da Turma primeiro.",
  "enquete-ja-votada": "Seu voto já foi registrado.",
  "enquete-nao-votada": "Vote na enquete do Mural primeiro.",
  // O relógio da turma. A criança não fez nada errado.
  "reflexao-nao-liberada": "Aguarde o professor liberar a próxima etapa.",
  "reflexao-ja-enviada": "Sua regra já foi enviada.",
  "reflexao-nao-enviada": "Monte a sua regra antes de terminar.",
  "entao-curto": `Escreva pelo menos ${ENTAO_MIN_CARACTERES} caracteres.`,
  "entao-longo": `Use no máximo ${ENTAO_MAX_CARACTERES} caracteres.`,
  "entao-sem-sentido": "Explique sua regra de checagem com mais detalhes para que Nina consiga entender o que fazer.",
  // As de PROFESSOR, lidas no hub.
  "pacote-nao-aprovado": "Aprove um pacote de mensagens para esta turma antes.",
  "pacote-invalido": "O pacote não pôde ser aprovado.",
  "preparo-invalido": "O recorte da aula não pôde ser usado.",
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

/**
 * RETORNA a exceção, não lança — `throw erroDeJogo(...)`. `erros` é a lista de
 * frases para o professor (o pacote e o recorte devolvem TODOS os problemas de
 * uma vez, como `ajuste-invalido` na evidência).
 */
export function erroDeJogo(codigo: CodigoErro, erros?: readonly string[]): ErroDeJogo {
  return new ErroDeJogo(codigo, erros);
}
