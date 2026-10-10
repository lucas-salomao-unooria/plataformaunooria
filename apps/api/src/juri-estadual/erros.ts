import { HttpException } from "@nestjs/common";

/**
 * Erros de JOGO da exp06ef1b — não de programa. O CÓDIGO é o contrato: é por
 * ele que a experiência e o hub escolhem a frase que a pessoa lê, e a frase que
 * vai aqui é só a de reserva, para a tela que ainda não conhece o código.
 *
 * Toda resposta de erro é `{ codigo, mensagem }` (o molde de `jornal-escola/erros.ts`).
 * As duas exceções que não nascem aqui têm a mesma forma: o 403
 * `missao-nao-liberada`/`recurso-indisponivel`, que é da porta da sala
 * (`comum/liberacao.ts`), e o 400 genérico do Nest para rota inexistente.
 *
 * Duas vozes, porque são duas zonas (ADR-91):
 * - os códigos do ESTUDANTE falam na voz da comissão da mostra — boa parte dos
 *   409 vem do relógio da turma, e a frase diz para esperar;
 * - os do PROFESSOR (`transicao-de-etapa-invalida`, `pacote-invalido`, os das
 *   imagens, os da IA) falam na voz da plataforma.
 */
export type CodigoErro =
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "sem-turma"
  | "atividade-nao-preparada"
  | "atividade-nao-encontrada"
  | "muitas-requisicoes"
  | "passo-invalido"
  | "rodada-mudou"
  | "post-desconhecido"
  | "feed-incompleto"
  | "projeto-fora-do-feed"
  | "voto-ja-lacrado"
  | "galeria-nao-liberada"
  | "voto-ja-revisado"
  | "galeria-sem-inspecao"
  | "ordem-incorreta"
  | "transicao-de-etapa-invalida"
  | "pacote-invalido"
  | "imagens-nao-aprovadas"
  | "imagens-ja-aprovadas"
  | "sem-saldo-de-ia"
  | "ia-indisponivel";

export const STATUS: Record<CodigoErro, number> = {
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "sem-turma": 409,
  /* 403, e não 409: é o "a missão ainda não foi aberta" que a experiência JÁ
     sabe dizer — a turma sem atividade em andamento é, para a criança, a mesma
     porta fechada (ADR-130). */
  "atividade-nao-preparada": 403,
  "atividade-nao-encontrada": 404,
  "muitas-requisicoes": 429,
  "passo-invalido": 409,
  "rodada-mudou": 409,
  "post-desconhecido": 400,
  "feed-incompleto": 409,
  "projeto-fora-do-feed": 409,
  "voto-ja-lacrado": 409,
  "galeria-nao-liberada": 403,
  "voto-ja-revisado": 409,
  /* "Manter meu voto inicial" só depois de abrir ao menos um estande oculto
     (melhoria 6): o botão fica apagado na tela, e a rota cobra o mesmo. */
  "galeria-sem-inspecao": 409,
  /* A cadeia montada fora da ordem (PRD §12.1). 422, e a TENTATIVA CONTA para a
     EF06CO03: o service grava a contagem e só depois responde o erro. */
  "ordem-incorreta": 422,
  "transicao-de-etapa-invalida": 409,
  "pacote-invalido": 400,
  /* A segunda fase da aprovação (como na exp07ef1b, ADR-146): o pacote existe,
     mas ninguém viu as imagens. 409 — é o estado da atividade, não o pedido,
     que está errado. */
  "imagens-nao-aprovadas": 409,
  "imagens-ja-aprovadas": 409,
  "sem-saldo-de-ia": 429,
  "ia-indisponivel": 503,
};

export const MENSAGENS: Record<CodigoErro, string> = {
  "payload-invalido": "A comissão não entendeu o pedido. Tente de novo.",
  "turma-nao-encontrada": "Turma não encontrada nesta escola.",
  "sem-turma": "Sua conta ainda não está ligada a nenhuma turma.",
  "atividade-nao-preparada": "Esta missão ainda não foi aberta para a sua turma.",
  "atividade-nao-encontrada": "Atividade não encontrada nesta turma.",
  "muitas-requisicoes": "Muitas ações em pouco tempo. Espere um instante e tente de novo.",
  "passo-invalido": "Essa parte da mostra não está aberta agora.",
  "rodada-mudou": "A mostra foi atualizada. Recarregue para continuar.",
  "post-desconhecido": "Essa publicação não está no seu feed.",
  "feed-incompleto": "Continue avaliando os estandes do feed: a cédula abre na 10ª publicação ou aos 8 minutos.",
  "projeto-fora-do-feed": "A cédula só aceita estandes que apareceram no seu feed.",
  // O LATCH 1. Quem já votou não pode achar que perdeu o voto.
  "voto-ja-lacrado": "Seu voto já foi registrado e lacrado na urna.",
  // O relógio da turma. A criança não fez nada errado: espera o professor.
  "galeria-nao-liberada": "A comissão está reunida em plenária. Aguarde o sinal do professor.",
  // O LATCH 2.
  "voto-ja-revisado": "A revisão do seu voto já foi registrada na ata.",
  "galeria-sem-inspecao": "Inspecione ao menos um projeto que não apareceu no seu feed antes de manter o voto.",
  // O texto literal do feedback de erro da Etapa 5 (copy revisada, e5.feedback.cadeia_erro).
  "ordem-incorreta":
    "A ordem das regras precisa de ajuste. Lembre-se: primeiro vêm suas ações, depois os dados registrados pela máquina.",
  "transicao-de-etapa-invalida": "A turma avança uma etapa por vez, e nunca volta.",
  "pacote-invalido": "Os estandes gerados não atendem às regras da missão.",
  "imagens-nao-aprovadas":
    "Aprove as imagens dos estandes antes de pôr esta atividade no ar: elas aparecem na página da atividade, estande por estande.",
  "imagens-ja-aprovadas": "As imagens desta atividade já foram aprovadas e não mudam mais.",
  "sem-saldo-de-ia": "Limite de geração com IA atingido por hoje. Tente novamente amanhã.",
  "ia-indisponivel": "O serviço de geração automática oscilou. Tente novamente em instantes.",
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
 * RETORNA a exceção, não lança — como na exp04ef1b. Use `throw erroDeJogo(...)`.
 * As regras puras devolvem `{ ok: false, codigo }` e quem lança é o service.
 */
export function erroDeJogo(codigo: CodigoErro, extra?: Record<string, unknown>): ErroDeJogo {
  return new ErroDeJogo(codigo, extra);
}
