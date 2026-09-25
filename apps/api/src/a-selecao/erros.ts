import { HttpException } from "@nestjs/common";

/**
 * Erros de JOGO da exp07ef1b — não de programa. O CÓDIGO é o contrato: é por
 * ele que a experiência e o hub escolhem a frase que a pessoa lê, e a frase que
 * vai aqui é só a de reserva (na voz seca do clone, para a tela que ainda não
 * conhece o código).
 *
 * Molde: `apps/api/src/quem-mandou-isso/erros.ts`. Como lá, boa parte dos 409
 * vem do GATE DA TURMA — o Mural ainda não abriu, a explicação ainda não foi
 * liberada. Nesses casos a frase diz para esperar: um "acesso negado" faria a
 * criança achar que perdeu a missão.
 *
 * Os cinco 422 são do SANITIZADOR da legenda (`sanitizador.ts`): o texto não
 * está errado, está num lugar em que outra criança vai lê-lo. A frase pede
 * para reescrever, e o código diz o quê.
 */
export type CodigoErro =
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "sem-turma"
  | "passo-invalido"
  | "selecao-invalida"
  | "latch-ja-confirmado"
  | "rodada-mudou"
  | "stories-nao-publicados"
  | "mural-nao-liberado"
  | "reflexao-nao-liberada"
  | "reflexao-ja-enviada"
  | "reflexao-pendente"
  | "transicao-de-etapa-invalida"
  | "lote-invalido"
  | "sem-saldo-de-ia"
  | "legenda-com-link"
  | "legenda-com-telefone"
  | "legenda-com-email"
  | "legenda-com-mencao"
  | "legenda-com-palavrao";

export const STATUS: Record<CodigoErro, number> = {
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "sem-turma": 409,
  "passo-invalido": 409,
  "selecao-invalida": 400,
  "latch-ja-confirmado": 409,
  "rodada-mudou": 409,
  "stories-nao-publicados": 409,
  "mural-nao-liberado": 409,
  "reflexao-nao-liberada": 409,
  "reflexao-ja-enviada": 409,
  "reflexao-pendente": 409,
  "transicao-de-etapa-invalida": 409,
  "lote-invalido": 400,
  "sem-saldo-de-ia": 429,
  "legenda-com-link": 422,
  "legenda-com-telefone": 422,
  "legenda-com-email": 422,
  "legenda-com-mencao": 422,
  "legenda-com-palavrao": 422,
};

export const MENSAGENS: Record<CodigoErro, string> = {
  "payload-invalido": "Não entendi o que veio da tela.",
  "turma-nao-encontrada": "Turma não encontrada nesta escola.",
  // Sem turma não há relógio da aula nem Mural — e a tela do hub é quem
  // explica que falta enturmar; aqui dentro do app a frase fica na ficção.
  "sem-turma": "Sua conta do grêmio ainda não está ligada a nenhuma turma.",
  "passo-invalido": "Essa tela não está disponível agora.",
  // Um id que não é desta cobertura é uma tela velha falando com um feed novo.
  "selecao-invalida": "Selecione exatamente 3 posts salvos para habilitar a publicação.",
  // O LATCH. Quem já publicou não pode achar que perdeu o próprio envio.
  "latch-ja-confirmado": "Seus Stories já foram publicados.",
  // A professora zerou a turma ou trocou o tema no meio da requisição.
  "rodada-mudou": "O feed foi atualizado. Recarregue para ver a cobertura nova.",
  "stories-nao-publicados": "Publique seus Stories para continuar.",
  // O gate da turma. A criança não fez nada errado.
  "mural-nao-liberado": "Publicado! Aguardando o professor liberar o mural da turma.",
  "reflexao-nao-liberada": "Aguardando o professor liberar a próxima etapa...",
  "reflexao-ja-enviada": "Sua reflexão já foi enviada.",
  "reflexao-pendente": "Envie sua reflexão para concluir a missão.",
  "transicao-de-etapa-invalida": "A turma só avança uma etapa por vez, e nunca volta.",
  "lote-invalido": "O lote precisa de 12 posts, 4 de cada veículo, sem termos que antecipem a revelação.",
  "sem-saldo-de-ia":
    "A assistente de curadoria do grêmio está temporariamente sem saldo. Os posts seguem com a descrição da imagem.",
  "legenda-com-link": "Tire o link da legenda para publicar nos Stories do grêmio.",
  "legenda-com-telefone": "Tire o número de telefone da legenda para publicar.",
  "legenda-com-email": "Tire o e-mail da legenda para publicar.",
  "legenda-com-mencao": "Tire a marcação de @ da legenda para publicar.",
  "legenda-com-palavrao": "Reescreva a legenda sem palavrão: ela vai aparecer para a turma.",
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
 * RETORNA a exceção, não lança — como na exp05ef1b. Use `throw erroDeJogo(...)`.
 * As regras puras devolvem `{ ok: false, codigo }` e quem lança é o service.
 */
export function erroDeJogo(codigo: CodigoErro, extra?: Record<string, unknown>): ErroDeJogo {
  return new ErroDeJogo(codigo, extra);
}
