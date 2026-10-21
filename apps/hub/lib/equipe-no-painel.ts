/**
 * O PAINEL POR COMPUTADOR (E13, ADR-111), do lado do hub.
 *
 * Quando a turma monta equipes para a missão, quem divide um computador entra
 * com o login de UM membro — e a api devolve UMA linha por computador: a do
 * representante (quem entrou), com `equipe` dizendo quem senta com ele. O
 * resumo passa a contar essas linhas, e `porComputador` avisa. Sem equipes,
 * `equipe` vem `null` e tudo é como antes.
 *
 * Vale para o UnooTube (`GET /unootube/turmas/:id/resultados`) e para a Missão
 * Tempestade (`GET /unoogpt/professor/turmas/:id`); o contrato é o Zod dos dois
 * módulos da api. PURO: a tabela do UnooTube é client component e importa daqui.
 */

export interface MembroNoPainel {
  id: string;
  nome: string;
}

/** A equipe de um computador, como a linha do painel a traz. `membros` inclui quem entrou. */
export interface EquipeNoPainel {
  id: string;
  nome: string;
  membros: MembroNoPainel[];
}

/**
 * A chave ESTÁVEL da linha. Com equipe, é a equipe — o representante muda
 * quando um segundo membro entra, e a chave pelo estudante faria o React
 * trocar a linha inteira no meio da aula. Sem equipe, é o estudante.
 */
export function chaveDaLinha(l: { estudanteId: string; equipe?: EquipeNoPainel | null }): string {
  return l.equipe ? `equipe:${l.equipe.id}` : `estudante:${l.estudanteId}`;
}

const lista = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

/** "Ana Souza, Bia Lima e Caio Reis" — na ordem em que a api entrega. */
export function nomesDosMembros(equipe: EquipeNoPainel): string {
  return lista.format(equipe.membros.map((m) => m.nome));
}

/** A frase que acompanha os números quando o painel conta computadores. */
export const AVISO_POR_COMPUTADOR =
  "Contado por computador: cada equipe desta turma é uma linha, com os dados de quem entrou na missão.";
