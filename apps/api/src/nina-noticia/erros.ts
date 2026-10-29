import { HttpException } from "@nestjs/common";

/**
 * Erros de JOGO da exp03ef1b — não de programa. O CÓDIGO é o contrato: é por
 * ele que a experiência e o hub escolhem a frase que a pessoa lê, e a frase que
 * vai aqui é só a de reserva, para a tela que ainda não conhece o código.
 *
 * Toda resposta de erro é `{ codigo, mensagem }` (o molde de
 * `juri-estadual/erros.ts`). As exceções que não nascem aqui têm a mesma
 * forma: o 403 `missao-nao-liberada`/`recurso-indisponivel`, da porta da sala
 * (`comum/liberacao.ts`), e o 400 genérico do Nest para rota inexistente.
 *
 * Duas vozes, porque são duas zonas (ADR-91):
 * - os códigos do ESTUDANTE falam na voz do jornal da escola, para uma
 *   criança de 8 anos — boa parte dos 409/403 vem do relógio da turma, e a
 *   frase diz para esperar a professora;
 * - os da PROFESSORA (`transicao-de-etapa-invalida`, `pacote-invalido`, os das
 *   imagens, os da IA) falam na voz da plataforma.
 *
 * Nenhuma frase diz "aposta" (spec §7.1): na tela é "escolha".
 */
export type CodigoErro =
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "sem-turma"
  | "atividade-nao-preparada"
  | "atividade-nao-encontrada"
  | "muitas-requisicoes"
  | "rodada-mudou"
  | "turma-pausada"
  | "etapa-nao-liberada"
  | "passo-fora-de-ordem"
  | "passo-invalido"
  | "reportagem-desconhecida"
  | "selos-incompletos"
  | "previsao-vazia"
  | "previsao-ja-travada"
  | "valor-de-filtro-invalido"
  | "carimbos-incompletos"
  | "carimbos-ja-enviados"
  | "carimbos-pendentes"
  | "etiqueta-desconhecida"
  | "reparo-incompleto"
  | "reparo-ja-enviado"
  | "bloco-desconhecido"
  | "rotina-incompleta"
  | "transicao-de-etapa-invalida"
  | "pacote-invalido"
  | "imagem-desconhecida"
  | "imagens-nao-aprovadas"
  | "imagens-ja-aprovadas"
  | "sem-saldo-de-ia"
  | "ia-indisponivel";

export const STATUS: Record<CodigoErro, number> = {
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "sem-turma": 409,
  /* 403, e não 409: para a criança, a turma sem atividade em andamento é a
     mesma porta fechada da missão não liberada (ADR-130). */
  "atividade-nao-preparada": 403,
  "atividade-nao-encontrada": 404,
  "muitas-requisicoes": 429,
  "rodada-mudou": 409,
  /* A professora pausou a turma: nada se grava até ela retomar. */
  "turma-pausada": 409,
  /* O relógio da turma: a jogada é de uma etapa que a professora ainda não liberou. */
  "etapa-nao-liberada": 403,
  "passo-fora-de-ordem": 409,
  "passo-invalido": 409,
  "reportagem-desconhecida": 400,
  "selos-incompletos": 409,
  "previsao-vazia": 409,
  /* O LATCH da escolha (E2). */
  "previsao-ja-travada": 409,
  "valor-de-filtro-invalido": 400,
  "carimbos-incompletos": 409,
  "carimbos-ja-enviados": 409,
  /* `concluir` sem os carimbos do caso novo. */
  "carimbos-pendentes": 409,
  "etiqueta-desconhecida": 400,
  /* As três etiquetas, uma por campo (spec §7.6). */
  "reparo-incompleto": 409,
  "reparo-ja-enviado": 409,
  "bloco-desconhecido": 400,
  "rotina-incompleta": 409,
  "transicao-de-etapa-invalida": 409,
  "pacote-invalido": 400,
  "imagem-desconhecida": 400,
  /* A segunda fase da aprovação (ADR-146): o pacote existe, mas ninguém viu as imagens. */
  "imagens-nao-aprovadas": 409,
  "imagens-ja-aprovadas": 409,
  "sem-saldo-de-ia": 429,
  "ia-indisponivel": 503,
};

export const MENSAGENS: Record<CodigoErro, string> = {
  "payload-invalido": "O jornal não entendeu o pedido. Tente de novo.",
  "turma-nao-encontrada": "Turma não encontrada nesta escola.",
  "sem-turma": "Sua conta ainda não está ligada a nenhuma turma.",
  "atividade-nao-preparada": "Esta missão ainda não foi aberta para a sua turma.",
  "atividade-nao-encontrada": "Atividade não encontrada nesta turma.",
  "muitas-requisicoes": "Muitas ações em pouco tempo. Espere um instante e tente de novo.",
  "rodada-mudou": "A professora começou de novo. Recarregue para continuar.",
  "turma-pausada": "Momento de conversar com a turma!",
  "etapa-nao-liberada": "Espere a professora liberar a próxima parte.",
  "passo-fora-de-ordem": "Essa parte do jornal não está aberta agora.",
  "passo-invalido": "Essa parte do jornal não está aberta agora.",
  "reportagem-desconhecida": "Essa notícia não está no seu jornal.",
  "selos-incompletos": "Toque no cartaz das três reportagens antes de avançar.",
  "previsao-vazia": "Coloque ao menos uma notícia na caixa.",
  "previsao-ja-travada": "Sua escolha já está travada.",
  "valor-de-filtro-invalido": "Escolha um valor da pastilha antes de buscar.",
  "carimbos-incompletos": "Carimbe os três cartões antes de avançar.",
  "carimbos-ja-enviados": "Os carimbos destes cartões já foram registrados.",
  "carimbos-pendentes": "Carimbe os cartões do caso novo antes de concluir.",
  "etiqueta-desconhecida": "Essa etiqueta não está na sua bandeja.",
  "reparo-incompleto": "Coloque as três etiquetas na ficha, uma em cada campo.",
  "reparo-ja-enviado": "A ficha do telão já foi concluída.",
  "bloco-desconhecido": "Esse bloco não está na sua bandeja.",
  "rotina-incompleta": "Encaixe os sete blocos na esteira antes de testar.",
  "transicao-de-etapa-invalida": "A turma avança uma etapa por vez, e nunca volta.",
  "pacote-invalido": "As notícias geradas não atendem às regras da missão.",
  "imagem-desconhecida": "Essa imagem não pertence a esta atividade.",
  "imagens-nao-aprovadas":
    "Aprove as imagens das reportagens antes de pôr esta atividade no ar: confira, na do telão, se o pátio aparece.",
  "imagens-ja-aprovadas": "As imagens desta atividade já foram aprovadas e não mudam mais.",
  "sem-saldo-de-ia": "Limite de geração com IA atingido por hoje. Você pode usar o banco padrão.",
  "ia-indisponivel": "O serviço de geração automática oscilou. Tente novamente em instantes ou use o banco padrão.",
};

export class ErroDeJogo extends HttpException {
  constructor(
    readonly codigo: CodigoErro,
    extra?: Record<string, unknown>,
  ) {
    super({ codigo, mensagem: MENSAGENS[codigo], ...extra }, STATUS[codigo]);
  }
}

/**
 * RETORNA a exceção, não lança. Use `throw erroDeJogo(...)`. As regras puras
 * devolvem `{ ok: false, codigo }` e quem lança é o service.
 */
export function erroDeJogo(codigo: CodigoErro, extra?: Record<string, unknown>): ErroDeJogo {
  return new ErroDeJogo(codigo, extra);
}
