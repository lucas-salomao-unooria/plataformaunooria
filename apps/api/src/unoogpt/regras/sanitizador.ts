import type { Passo } from './passos';
import type { EstimativaDoBairro } from '../modelo/estimativa';

/**
 * ALLOWLIST explicita, nunca `delete obj.campo`. O que nao pode vazar aqui e o
 * `achado` das Perguntas ainda NAO feitas: o mapa comeca vazio e so o que uma
 * Pergunta revelou pode chegar ao navegador.
 */
export interface BairroPublico {
  slug: string;
  nome: string;
  left: string;
  top: string;
  w: string;
  h: string;
  /** So com o conjunto de malha viaria carregado. */
  tempos: { alfa: number; bravo: number } | null;
  /**
   * O que o modelo enxerga deste bairro. `null` = nenhum Conjunto carregado o
   * cobre, e o cartao fica em branco. Branco e informacao.
   */
  estimativa: EstimativaDoBairro | null;
}

/**
 * O Relógio da aula, do jeito que o navegador pode ver.
 *
 * Allowlist como todo o resto: `tenantId` e id de turma NÃO entram — o aluno
 * não precisa deles e não pode tê-los (regra de ouro 7). `agora` é o instante
 * do SERVIDOR: é dele que o cronômetro parte, senão o relógio da máquina da
 * escola (que atrasa) decide quanto tempo a turma tem.
 */
export interface RelogioPublico {
  modo: 'cronometrado' | 'livre';
  iniciadoEm: string | null;
  duracaoSeg: number;
  encerradoEm: string | null;
  pivoSeg: number;
  pivoMin: number;
  agora: string;
}

export function sanitizarRelogio(
  bruto: {
    modo: 'cronometrado' | 'livre';
    iniciadoEm: Date | null;
    duracaoSeg: number;
    encerradoEm: Date | null;
    pivoSeg: number;
    pivoMin: number;
  },
  agora: Date,
): RelogioPublico {
  return {
    modo: bruto.modo,
    iniciadoEm: bruto.iniciadoEm ? bruto.iniciadoEm.toISOString() : null,
    duracaoSeg: bruto.duracaoSeg,
    encerradoEm: bruto.encerradoEm ? bruto.encerradoEm.toISOString() : null,
    pivoSeg: bruto.pivoSeg,
    pivoMin: bruto.pivoMin,
    agora: agora.toISOString(),
  };
}

/**
 * A sessão do jeito que o navegador pode ver.
 *
 * Sem `id`: a identidade da sessão é `(escola, aluno)` e vem do TOKEN — foi o
 * que dispensou a guarda `donoDaSessao` do projeto de origem, onde a sessão era
 * um uuid na URL. Sem `evidencias` também: era coluna só-escrita lá, e o que
 * ela guardava (`rodada-N`) já está em `rodadas`.
 */
export interface SessaoPublica {
  passo: Passo;
  minutosGastos: number;
  /** Conjuntos carregados no modelo. Acumulam em camadas. */
  conjuntos: string[];
  rodadas: number;
  /** Perguntas de investigação já gastas (`regras/orcamento.ts`). */
  perguntasGastas: number;
  /** Qual partida do aluno. Recomeçar abre a seguinte. */
  tentativa: number;
  alocacao: { alfa: string | null; bravo: string | null };
  justificativas: { alfa: string | null; bravo: string | null };
}

interface SessaoBruta {
  passo: string;
  minutosGastos: number;
  conjuntos: string[];
  rodadas: number;
  perguntasGastas: number;
  tentativa: number;
  alocacaoAlfa: string | null;
  alocacaoBravo: string | null;
  justificativaAlfa: string | null;
  justificativaBravo: string | null;
  [extra: string]: unknown;
}

export function sanitizarSessao(bruta: SessaoBruta): SessaoPublica {
  return {
    passo: bruta.passo as Passo,
    minutosGastos: bruta.minutosGastos,
    conjuntos: bruta.conjuntos,
    rodadas: bruta.rodadas,
    perguntasGastas: bruta.perguntasGastas,
    tentativa: bruta.tentativa,
    alocacao: { alfa: bruta.alocacaoAlfa, bravo: bruta.alocacaoBravo },
    justificativas: { alfa: bruta.justificativaAlfa, bravo: bruta.justificativaBravo },
  };
}

/**
 * A ficha da missão do jeito que o navegador pode ver.
 *
 * ALLOWLIST, como todo o resto. O que fica FORA é o que mais importa: os
 * números por bairro da ficha canônica (`pop`, `exp`, `vexp`, `alag`, `danos`,
 * `granizo`). Eles são a verdade do mundo, e nenhuma fonte os entrega inteiros
 * — quem os entrega, já distorcidos pelo viés de cada conjunto, é a estimativa
 * do modelo. Mandar a ficha crua daria ao aluno, de graça, a resposta que a
 * missão existe para ele não ter.
 *
 * `totais` entra porque é o enunciado ("26 mil pessoas, duas equipes, quatro
 * bairros"): é o tamanho do problema, não a solução dele.
 */
export interface FichaPublica {
  titulo: string;
  chamada: string;
  contexto: string;
  equipes: { id: string; nome: string; base: string; descricao: string }[];
  totais: { populacao: number; expostos: number; vulneraveis: number; danosMi: number };
}

export function sanitizarFicha(bruta: {
  titulo: string;
  chamada: string;
  contexto: string;
  equipes: readonly { id: string; nome: string; base: string; descricao: string }[];
  totais: { populacao: number; expostos: number; vulneraveis: number; danosMi: number };
}): FichaPublica {
  return {
    titulo: bruta.titulo,
    chamada: bruta.chamada,
    contexto: bruta.contexto,
    equipes: bruta.equipes.map((e) => ({ id: e.id, nome: e.nome, base: e.base, descricao: e.descricao })),
    totais: { ...bruta.totais },
  };
}
