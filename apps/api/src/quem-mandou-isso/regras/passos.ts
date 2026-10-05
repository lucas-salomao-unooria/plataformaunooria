/**
 * Os passos da exp05ef1b v2.2 e a regra que reconcilia A TURMA com O ESTUDANTE.
 *
 * Dois relógios, como nas outras missões de clone:
 *
 * - `exp05ef1b_gates_turma.fase` — o relógio da TURMA, que o professor move
 *   com os três botões do painel (revelação, síntese, reflexão);
 * - os CARIMBOS da sessão do estudante (`entrou_em`, `confirmado_em`,
 *   `votou_em`, `concluido_em`) — cada um é um latch. A `reflexao_em` ficou
 *   no banco só para o histórico: a regra Se/Então saiu (ADR-145), e as
 *   perguntas de múltipla escolha são a reflexão.
 *
 * **O passo NÃO é coluna.** Ele é DERIVADO: `passoEfetivo(carimbos, fase)`.
 * Uma coluna `passo` seria uma terceira fonte que os latches já dizem — e que
 * diverge no primeiro UPDATE que esquecer de mexer nela (a v1 pagava isso com
 * CHECKs de equivalência entre `passo` e `concluido_em`).
 */

/** As fases da turma, na ordem em que o professor as abre. Mesmo vocabulário do CHECK. */
export const FASES = ["triagem", "revelacao", "explicar", "reflexao"] as const;
export type Fase = (typeof FASES)[number];

export const FASE_INICIAL: Fase = "triagem";

/** Os três botões do painel e a fase que cada um abre. */
export const FASE_DA_ACAO = {
  liberar_revelacao: "revelacao",
  apresentar_sintese: "explicar",
  liberar_reflexao: "reflexao",
} as const satisfies Record<string, Fase>;

export type AcaoDoGate = keyof typeof FASE_DA_ACAO;
export const ACOES_DO_GATE = Object.keys(FASE_DA_ACAO) as [AcaoDoGate, ...AcaoDoGate[]];

const ORDEM_DA_FASE: Readonly<Record<Fase, number>> = { triagem: 0, revelacao: 1, explicar: 2, reflexao: 3 };

export function ehFase(valor: string): valor is Fase {
  return (FASES as readonly string[]).includes(valor);
}

/** Fase desconhecida (linha escrita por versão futura) volta ao começo — nunca adiante, que abriria o gabarito. */
export function normalizarFase(valor: string | null | undefined): Fase {
  return valor && ehFase(valor) ? valor : FASE_INICIAL;
}

/** A turma já chegou a `alvo`? `null` = sem gate ainda, que é `triagem`. */
export function faseAtingiu(fase: Fase | null, alvo: Fase): boolean {
  return ORDEM_DA_FASE[fase ?? FASE_INICIAL] >= ORDEM_DA_FASE[alvo];
}

/**
 * A fase só ANDA PARA A FRENTE. Apertar "Liberar revelação" depois de ter
 * liberado a reflexão não pode fechar as perguntas de quem está respondendo — o
 * clique repetido (ou fora de ordem) vira no-op. Pular adiante é permitido: o
 * professor pode não projetar a síntese.
 */
export function avancarFase(atual: Fase, alvo: Fase): Fase {
  return ORDEM_DA_FASE[alvo] > ORDEM_DA_FASE[atual] ? alvo : atual;
}

/**
 * Os passos do estudante, na ordem. `grupo` cobre o grupo E o Mural: os dois
 * são vistas sobre a MESMA seleção guardada no servidor, e alternar entre elas
 * é do cliente (quem volta de um F5 com três selecionadas pode abrir no Mural).
 */
export const PASSOS = [
  "abertura",
  "grupo",
  "enquete",
  "espera",
  "revelacao",
  "sintese",
  "perguntas",
  "concluida",
] as const;
export type Passo = (typeof PASSOS)[number];

/** Os latches da sessão, como booleanos. `null` = o estudante nem abriu o grupo. */
export interface MarcosDaSessao {
  entrou: boolean;
  confirmou: boolean;
  votou: boolean;
  concluiu: boolean;
}

/**
 * O PASSO EFETIVO, dado o que o estudante já fez e a fase da turma.
 *
 * 1. Os latches do estudante vêm primeiro: quem concluiu está concluído —
 *    nenhuma fase o puxa de volta.
 * 2. **A triagem NÃO é empurrada pela revelação.** Quem ainda não confirmou o
 *    Mural quando o professor abre a revelação CONTINUA no grupo, confirma,
 *    vota, e vê a própria revelação depois (default aceito). Empurrá-lo
 *    mediria outra coisa, e mostraria o gabarito a quem ainda escolhe.
 * 3. Depois do voto, a FASE decide: espera na triagem, e então revelação,
 *    síntese e as perguntas (a fase `reflexao`: elas SÃO a reflexão, ADR-145)
 *    conforme o professor abre.
 *
 * O aluno que vota DEPOIS de a turma passar da revelação cai direto no passo
 * da turma (`sintese` ou `perguntas`), e a revelação dele vai junto na resposta
 * (`revelacao` não é nula): a experiência mostra os crachás antes do passo
 * corrente. O servidor não guarda "já viu" — um F5 mostraria de novo, sem dano.
 */
export function passoEfetivo(sessao: MarcosDaSessao | null, fase: Fase | null): Passo {
  if (!sessao || !sessao.entrou) return "abertura";
  if (sessao.concluiu) return "concluida";
  if (!sessao.confirmou) return "grupo";
  if (!sessao.votou) return "enquete";
  switch (fase ?? FASE_INICIAL) {
    case "triagem":
      return "espera";
    case "revelacao":
      return "revelacao";
    case "explicar":
      return "sintese";
    case "reflexao":
      return "perguntas";
  }
}

/**
 * O gabarito das TRÊS mensagens do estudante desce? Só depois do voto (o
 * latch 2) E da revelação aberta pela turma. Antes disso a resposta não tem
 * onde carregá-lo (`revelacao: null`).
 */
export function revelacaoAberta(sessao: MarcosDaSessao | null, fase: Fase | null): boolean {
  return Boolean(sessao?.votou) && faseAtingiu(fase, "revelacao");
}
