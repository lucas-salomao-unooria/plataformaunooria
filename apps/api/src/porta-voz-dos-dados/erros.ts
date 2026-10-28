import { HttpException } from "@nestjs/common";

/**
 * Os erros de DOMÍNIO da exp03em1b, com `codigo` estável — é por ele que a
 * tela decide o que mostrar. Molde: `efeito-amplificador/erros.ts`.
 *
 * As frases das rotas de ESTUDANTE são lidas DENTRO do clone (o Unoochat), na
 * voz do Programa Municipal (PRD §12.2), sem gênero para quem conduz.
 */
export type CodigoErro =
  | "atividade-nao-preparada"
  | "telas-pausadas"
  | "fora-de-ordem"
  | "ja-publicado"
  | "nao-publicado"
  | "errata-nao-liberada"
  | "errata-ja-decidida"
  | "errata-pendente"
  | "pericia-ja-concluida"
  | "pacote-nao-aprovado"
  | "pacote-nao-homologado"
  | "pacote-ja-homologado"
  | "pacote-invalido"
  | "preparo-invalido"
  | "rodada-desatualizada"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "atividade-nao-encontrada";

export const STATUS: Readonly<Record<CodigoErro, number>> = {
  "atividade-nao-preparada": 409,
  "telas-pausadas": 409,
  "fora-de-ordem": 409,
  "ja-publicado": 409,
  "nao-publicado": 409,
  "errata-nao-liberada": 409,
  "errata-ja-decidida": 409,
  "errata-pendente": 409,
  "pericia-ja-concluida": 409,
  "pacote-nao-aprovado": 409,
  "pacote-nao-homologado": 409,
  "pacote-ja-homologado": 409,
  "pacote-invalido": 400,
  "preparo-invalido": 400,
  "rodada-desatualizada": 409,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "atividade-nao-encontrada": 404,
};

export const MENSAGENS: Readonly<Record<CodigoErro, string>> = {
  // O professor ainda não pôs um pacote no ar: espera, não bloqueio.
  "atividade-nao-preparada": "Aguarde a liberação da atividade da sala.",
  "telas-pausadas": "Sessão pausada pela Coordenação para mediação técnica em sala.",
  "fora-de-ordem": "Conclua a etapa anterior do boletim primeiro.",
  "ja-publicado": "Mensagens oficiais encaminhadas não podem ser editadas ou excluídas.",
  "nao-publicado": "Encaminhe o boletim ao grupo público primeiro.",
  "errata-nao-liberada": "Aguarde a retomada liberada pela Coordenação.",
  "errata-ja-decidida": "Sua decisão sobre a errata técnica já foi registrada.",
  "errata-pendente": "Decida sobre a errata técnica primeiro.",
  "pericia-ja-concluida": "Seu parecer técnico pericial já foi homologado e não pode ser alterado.",
  // As de PROFESSOR, lidas no hub.
  "pacote-nao-aprovado": "Homologue e coloque um pacote no ar para esta turma antes.",
  "pacote-nao-homologado": "Homologue o pacote antes de liberar a atividade para a turma.",
  "pacote-ja-homologado": "Este pacote já foi homologado e não muda mais. Gere ou edite um rascunho novo.",
  "pacote-invalido": "O pacote não pôde ser homologado.",
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

/** RETORNA a exceção, não lança — `throw erroDeJogo(...)`. */
export function erroDeJogo(codigo: CodigoErro, erros?: readonly string[]): ErroDeJogo {
  return new ErroDeJogo(codigo, erros);
}
