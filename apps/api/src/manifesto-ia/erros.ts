import { HttpException } from "@nestjs/common";

/**
 * Erros de JOGO da exp08ef4b — não de programa. Cada código vira uma frase que o
 * estudante lê DENTRO da ficção do terminal escolar, nunca um stack trace.
 *
 * Molde: `apps/api/src/rastro-boato/erros.ts`. A diferença de tom é que aqui a
 * ficção é uma plataforma corporativa: a voz do erro é a do SISTEMA
 * ("parâmetros", "diretriz", "canal"), fria e burocrática, porque é essa voz
 * que a missão está ensinando a criança a desconfiar.
 *
 * Vocabulário proibido nas mensagens: "atividade", "exercício", "gabarito",
 * "nota" — ver `invariantes.ts`, que tem o teste que cobra esta lista.
 */
export type CodigoErro =
  | "auditoria-insuficiente"
  | "prompt-desconhecido"
  | "prompt-ja-enviado"
  | "clausula-desconhecida"
  | "clausula-ja-submetida"
  | "sem-clausula"
  | "debate-em-andamento"
  | "percurso-ja-registrado"
  | "tags-invalidas"
  | "dado-pessoal-no-texto"
  | "missao-concluida"
  | "conteudo-nao-aprovado"
  | "payload-invalido"
  | "turma-nao-encontrada"
  | "escola-obrigatoria"
  | "ia-indisponivel";

export const STATUS: Record<CodigoErro, number> = {
  "auditoria-insuficiente": 409,
  "prompt-desconhecido": 400,
  "prompt-ja-enviado": 409,
  "clausula-desconhecida": 400,
  "clausula-ja-submetida": 409,
  "sem-clausula": 409,
  "debate-em-andamento": 409,
  "percurso-ja-registrado": 409,
  "tags-invalidas": 400,
  // 422, e não 400: a requisição está bem-formada e a regra é semântica. É a
  // decisão de produto do filtro de PII — recusar sem gravar, com dica.
  "dado-pessoal-no-texto": 422,
  "missao-concluida": 409,
  "conteudo-nao-aprovado": 409,
  "payload-invalido": 400,
  "turma-nao-encontrada": 404,
  "escola-obrigatoria": 400,
  "ia-indisponivel": 503,
};

export const MENSAGENS: Record<CodigoErro, string> = {
  // A porta que a missão mede: fixar a regra do sistema sem tê-lo contraditado.
  "auditoria-insuficiente":
    "Envie ao menos dois questionamentos para auditar os parâmetros antes de fixar uma regra.",
  "prompt-desconhecido": "Esse questionamento não consta nos parâmetros desta conversa.",
  "prompt-ja-enviado": "Esse questionamento já foi processado nesta conversa.",
  "clausula-desconhecida": "Essa salvaguarda não consta na minuta institucional.",
  "clausula-ja-submetida": "A diretriz prioritária já foi fixada no código do sistema.",
  "sem-clausula": "Nenhuma salvaguarda foi fixada ainda.",
  // O Checkpoint A. Espera, não bloqueio: a criança não fez nada errado.
  "debate-em-andamento":
    "Manifesto em análise coletiva. A assinatura individual abre depois da discussão com a turma.",
  "percurso-ja-registrado": "Sua cláusula já está protocolada no Percurso.",
  "tags-invalidas": "Selecione exatamente duas palavras-chave que sustentam sua decisão.",
  "dado-pessoal-no-texto":
    "Reescreva sem dados pessoais como telefone, e-mail ou CPF — nem os seus, nem de outras pessoas.",
  "missao-concluida": "Este protocolo já foi encerrado.",
  // O professor não homologou o pacote da turma. Só a rota do professor
  // devolve isto: a do estudante cai no banco curado default e a aula corre.
  "conteudo-nao-aprovado": "O pacote desta turma ainda não foi homologado.",
  "payload-invalido": "Os parâmetros recebidos não são válidos.",
  "turma-nao-encontrada": "Turma não encontrada nesta escola.",
  "escola-obrigatoria": "gestor_contrato: informe ?escolaId=",
  "ia-indisponivel":
    "O gerador não respondeu. O pacote curado da Unooria continua disponível para aprovar.",
};

export class ErroDeJogo extends HttpException {
  constructor(readonly codigo: CodigoErro) {
    super({ codigo, mensagem: MENSAGENS[codigo] }, STATUS[codigo]);
  }
}

/**
 * RETORNA a exceção, não lança. Use `throw erroDeJogo(...)`. As regras puras
 * devolvem `{ ok: false, codigo }` e quem lança é o service, num único ponto.
 */
export function erroDeJogo(codigo: CodigoErro): ErroDeJogo {
  return new ErroDeJogo(codigo);
}
