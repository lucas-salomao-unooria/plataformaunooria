import { HttpException } from "@nestjs/common";

/**
 * Os erros de DOMÍNIO da exp02em1b, com `codigo` estável — é por ele que a tela
 * decide o que mostrar. Molde: `quem-mandou-isso/erros.ts`.
 *
 * As frases das rotas de ESTUDANTE são lidas DENTRO dos clones (o UnooriaAI e o
 * Unoovista): sem "atividade", sem "gabarito", sem "acesso negado". A espera do
 * professor é dita na voz da ficção (D0-2).
 */
export type CodigoErro =
  | "campanha-em-preparo"
  | "sessao-nao-aberta"
  | "telas-pausadas"
  | "rascunho-nao-gerado"
  | "limite-do-chat"
  | "ja-publicado"
  | "nao-publicado"
  | "paragrafo-desconhecido"
  | "comentario-desconhecido"
  | "veja-as-metricas"
  | "explicar-nao-liberado"
  | "evidencias-incompletas"
  | "pacote-nao-aprovado"
  | "pacote-invalido"
  | "preparo-invalido"
  | "rodada-desatualizada"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "atividade-nao-encontrada";

export const STATUS: Readonly<Record<CodigoErro, number>> = {
  "campanha-em-preparo": 409,
  "sessao-nao-aberta": 409,
  "telas-pausadas": 409,
  "rascunho-nao-gerado": 409,
  "limite-do-chat": 409,
  "ja-publicado": 409,
  "nao-publicado": 409,
  "paragrafo-desconhecido": 400,
  "comentario-desconhecido": 400,
  "veja-as-metricas": 409,
  "explicar-nao-liberado": 409,
  "evidencias-incompletas": 409,
  "pacote-nao-aprovado": 409,
  "pacote-invalido": 400,
  "preparo-invalido": 400,
  "rodada-desatualizada": 409,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "atividade-nao-encontrada": 404,
};

export const MENSAGENS: Readonly<Record<CodigoErro, string>> = {
  // O professor ainda não pôs um pacote no ar. Espera, não bloqueio.
  "campanha-em-preparo": "Aguardando a liberação do orientador do grêmio para começar...",
  "sessao-nao-aberta": "Toque em Iniciar Campanha primeiro.",
  // D0-2, literal.
  "telas-pausadas": "Aguardando a liberação do orientador do grêmio para avançar...",
  "rascunho-nao-gerado": "Peça ao UnooriaAI para montar o rascunho primeiro.",
  "limite-do-chat": "Atingimos o limite de interações planejadas para esta etapa de redação.",
  "ja-publicado": "Sua publicação já está no Unoovista.",
  "nao-publicado": "Publique no Unoovista primeiro.",
  "paragrafo-desconhecido": "Esse trecho não está na prévia.",
  "comentario-desconhecido": "Esse comentário não está mais na publicação.",
  "veja-as-metricas": "Veja as métricas da publicação antes de arquivá-la.",
  "explicar-nao-liberado": "Aguardando a liberação do orientador do grêmio para avançar...",
  "evidencias-incompletas": "Selecione os dois indicadores que comprovam o que a rede priorizou.",
  // As de PROFESSOR, lidas no hub.
  "pacote-nao-aprovado": "Homologue e coloque um pacote no ar para esta turma antes.",
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
