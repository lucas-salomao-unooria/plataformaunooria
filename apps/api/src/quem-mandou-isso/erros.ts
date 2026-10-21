import { HttpException } from "@nestjs/common";

/**
 * Os erros de DOMÍNIO da exp05ef1b — com `codigo` estável, que é por onde a
 * tela decide o que mostrar. Molde: `rastro-boato/erros.ts`.
 *
 * As frases das rotas de ESTUDANTE são lidas DENTRO do clone (um app de
 * mensagens): sem "atividade", sem "gabarito", sem "acesso negado". Boa parte
 * dos 409 é o relógio da turma — o professor ainda não liberou —, e a frase
 * diz que está tudo bem e é para esperar. Duas vêm literais da copy
 * (`e2.erro.toast_menor_3`, `e2.erro.toast_limite_3`).
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
  | "alerta-nao-liberado"
  | "alerta-fechado"
  | "alerta-fora-de-ordem"
  | "limite-execucoes"
  | "execute-antes"
  | "alerta-ja-enviado"
  | "robo-invalido"
  | "robo-ja-enviado"
  | "ligacoes-esgotadas"
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
  "alerta-nao-liberado": 409,
  "alerta-fechado": 409,
  "alerta-fora-de-ordem": 409,
  "limite-execucoes": 409,
  "execute-antes": 400,
  "alerta-ja-enviado": 409,
  "robo-invalido": 400,
  "robo-ja-enviado": 409,
  "ligacoes-esgotadas": 409,
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
  "alerta-nao-liberado": "O alerta do grupo aparece depois dos crachás. Aguarde o professor liberar a revelação.",
  "alerta-fechado": "Os alertas do grupo já fecharam.",
  "alerta-fora-de-ordem": "Monte um alerta de cada vez, na ordem.",
  "limite-execucoes": "Você já viu o resultado 3 vezes neste alerta. Envie o alerta ao grupo.",
  // A copy do Figma (E4-ALU-01 B).
  "execute-antes": "Toque em Ver resultado antes de enviar o alerta.",
  "alerta-ja-enviado": "Este alerta já foi enviado ao grupo.",
  "robo-invalido": "Escolha uma condição e uma ou duas ações diferentes.",
  "robo-ja-enviado": "Seu robô já foi enviado.",
  "ligacoes-esgotadas": "Você já ligou o robô 5 vezes. Envie o seu robô.",
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
