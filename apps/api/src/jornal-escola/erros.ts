import { HttpException } from "@nestjs/common";

/**
 * Erros de JOGO da exp04ef1b — não de programa. O CÓDIGO é o contrato: é por
 * ele que a experiência e o hub escolhem a frase que a pessoa lê, e a frase que
 * vai aqui é só a de reserva, para a tela que ainda não conhece o código.
 *
 * Toda resposta de erro é `{ codigo, mensagem }` (o molde de `a-selecao/erros.ts`).
 * As duas exceções que não nascem aqui têm a mesma forma: o 403
 * `missao-nao-liberada`/`recurso-indisponivel`, que é da porta da sala
 * (`comum/liberacao.ts`), e o 400 genérico do Nest para rota inexistente.
 *
 * Duas vozes, porque são duas zonas (ADR-91):
 * - os códigos do ESTUDANTE falam na voz da redação — boa parte dos 409 vem do
 *   relógio da turma, e a frase diz para esperar: um "acesso negado" faria a
 *   criança achar que perdeu a edição;
 * - os do PROFESSOR (`transicao-de-etapa-invalida`, `pacote-invalido`, os da
 *   IA) falam na voz da plataforma.
 */
export type CodigoErro =
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "sem-turma"
  | "muitas-requisicoes"
  | "passo-invalido"
  | "rodada-mudou"
  | "edicao-ja-publicada"
  | "edicao-nao-publicada"
  | "motivo-ja-respondido"
  | "motivo-pendente"
  | "resultado-nao-liberado"
  | "revisao-nao-liberada"
  | "chave-nao-formada"
  | "transicao-de-etapa-invalida"
  | "pacote-invalido"
  | "sem-saldo-de-ia"
  | "ia-indisponivel";

export const STATUS: Record<CodigoErro, number> = {
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "sem-turma": 409,
  "muitas-requisicoes": 429,
  "passo-invalido": 409,
  "rodada-mudou": 409,
  "edicao-ja-publicada": 409,
  "edicao-nao-publicada": 409,
  "motivo-ja-respondido": 409,
  "motivo-pendente": 409,
  "resultado-nao-liberado": 409,
  "revisao-nao-liberada": 409,
  "chave-nao-formada": 409,
  "transicao-de-etapa-invalida": 409,
  "pacote-invalido": 400,
  "sem-saldo-de-ia": 429,
  "ia-indisponivel": 503,
};

export const MENSAGENS: Record<CodigoErro, string> = {
  "payload-invalido": "A redação não entendeu o pedido. Tente de novo.",
  "turma-nao-encontrada": "Turma não encontrada nesta escola.",
  // Sem turma não há relógio da aula; quem explica que falta enturmar é o hub.
  "sem-turma": "Sua conta ainda não está ligada a nenhuma turma.",
  "muitas-requisicoes": "Muitas ações em pouco tempo. Espere um instante e tente de novo.",
  "passo-invalido": "Essa parte da redação não está aberta agora.",
  // O professor zerou a turma ou trocou o pacote no meio da requisição.
  "rodada-mudou": "A mesa de notícias foi atualizada. Recarregue para continuar.",
  // O LATCH. Quem já publicou não pode achar que perdeu a própria edição.
  "edicao-ja-publicada": "Esta edição já foi publicada.",
  "edicao-nao-publicada": "Publique a edição para continuar.",
  "motivo-ja-respondido": "A resposta sobre a escolha já foi registrada.",
  "motivo-pendente": "Conte como a escolha foi feita para continuar.",
  // O relógio da turma. A criança não fez nada errado: espera o professor.
  "resultado-nao-liberado": "Edição entregue aos leitores! Aguardando o sinal do professor.",
  "revisao-nao-liberada": "Aguardando o professor liberar a mesa de revisão.",
  "chave-nao-formada": "Monte a Chave do Editor para abrir a mesa de revisão.",
  "transicao-de-etapa-invalida": "A turma avança uma etapa por vez, e nunca volta.",
  "pacote-invalido": "O pacote de notícias não atende às regras da missão.",
  "sem-saldo-de-ia":
    "Limite de geração com IA atingido. O banco curado padrão está disponível para iniciar a aula imediatamente.",
  "ia-indisponivel":
    "O serviço de geração automática oscilou. Tente novamente ou carregue o banco oficial da missão.",
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
 * RETORNA a exceção, não lança — como na exp07ef1b. Use `throw erroDeJogo(...)`.
 * As regras puras devolvem `{ ok: false, codigo }` e quem lança é o service.
 */
export function erroDeJogo(codigo: CodigoErro, extra?: Record<string, unknown>): ErroDeJogo {
  return new ErroDeJogo(codigo, extra);
}
