import { HttpException } from "@nestjs/common";

/**
 * Os erros de DOMÍNIO da exp09ef1b, com `codigo` estável — é por ele que a
 * tela decide o que mostrar. Molde: `porta-voz-dos-dados/erros.ts`.
 *
 * As frases das rotas de ESTUDANTE são lidas DENTRO do clone (o UnooriaAI),
 * na voz da Comissão de Recursos Comunitários.
 */
export type CodigoErro =
  | "atividade-nao-preparada"
  | "nao-entrou"
  | "limite-do-chat"
  | "ja-decidido"
  | "escolha-nao-liberada"
  | "nao-decidido"
  | "revelacao-nao-liberada"
  | "cadernos-pendentes"
  | "pilula-pendente"
  | "revoto-nao-liberado"
  | "ja-revotado"
  | "nao-revotado"
  | "explicar-nao-liberado"
  | "missao-concluida"
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
  "nao-entrou": 409,
  "limite-do-chat": 409,
  "ja-decidido": 409,
  "escolha-nao-liberada": 409,
  "nao-decidido": 409,
  "revelacao-nao-liberada": 409,
  "cadernos-pendentes": 409,
  "pilula-pendente": 409,
  "revoto-nao-liberado": 409,
  "ja-revotado": 409,
  "nao-revotado": 409,
  "explicar-nao-liberado": 409,
  "missao-concluida": 409,
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
  "atividade-nao-preparada": "Aguarde a abertura da sessão deliberativa pela presidência da mesa.",
  "nao-entrou": "Clique em \"Começar Análise\" para abrir a sessão.",
  "limite-do-chat":
    "Você atingiu o número limite de consultas preliminares previsto no regimento da comissão. Avance clicando em 'Ver Projetos' para abrir o painel de deliberação.",
  "ja-decidido": "Sua escolha inicial já foi registrada nos autos e não pode ser alterada.",
  "escolha-nao-liberada": "Consulte o assistente ou clique em \"Ver Projetos\" antes de deliberar.",
  "nao-decidido": "Registre sua decisão sobre os R$ 12.000 primeiro.",
  "revelacao-nao-liberada": "Parecer registrado. Aguardando autorização da presidência da mesa para abrir o próximo ponto de pauta.",
  "cadernos-pendentes": "Digitalize os cadernos de campo antes de seguir.",
  "pilula-pendente": "Examine os dados da tabela antes de revisar a decisão.",
  "revoto-nao-liberado": "A revisão da decisão abre quando a presidência da mesa autorizar.",
  "ja-revotado": "Sua decisão final já foi registrada nos autos e não pode ser alterada.",
  "nao-revotado": "Confirme a decisão final antes de seguir.",
  "explicar-nao-liberado": "Parecer registrado. Aguardando autorização da presidência da mesa para abrir o próximo ponto de pauta.",
  "missao-concluida": "Os autos estão encerrados e protegidos contra novas alterações.",
  "pacote-nao-aprovado": "Aprove e coloque um pacote no ar para esta turma antes.",
  "pacote-nao-homologado": "Aprove o pacote antes de liberar a atividade para a turma.",
  "pacote-ja-homologado": "Este pacote já foi aprovado e não muda mais. Gere ou edite um rascunho novo.",
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

/** RETORNA a exceção, não lança — `throw erroDeJogo(...)`. */
export function erroDeJogo(codigo: CodigoErro, erros?: readonly string[]): ErroDeJogo {
  return new ErroDeJogo(codigo, erros);
}
