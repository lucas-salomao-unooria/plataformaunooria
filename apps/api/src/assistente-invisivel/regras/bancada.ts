import {
  BLOCOS,
  CARTOES,
  COLUNA_DO_CARTAO,
  CRITERIOS_EQUITATIVOS,
  OPCAO_CERTA_DO_BLOCO,
  PASSOS_DISPENSAVEIS,
  type Bloco,
  type Cartao,
  type Coluna,
  type Criterios,
  type PassoDoAlgoritmo,
} from "../conteudo";

/**
 * A correção da bancada (E5 e E6) — o gabarito aplicado, no servidor. Puro.
 * Nada aqui BLOQUEIA o avanço (o "princípio de fluxo contínuo" do PO): o que
 * sai é o fato, que vai à régua e ao painel; a tela recebe só o que a
 * mecânica mostra (a tabela causal, o resultado do reteste, o aviso dos blocos).
 */

// ──────────────────────────────────────────── os cartões (E5-ALU-01)

export type Classificacao = Partial<Record<Cartao, Coluna>>;

export interface CorrecaoDosCartoes {
  /** Os 6 alocados (a tela avisa "ainda não foi concluída" quando falta algum). */
  completa: boolean;
  acertos: number;
  /** Horário e sinal de rede em "observados": a tabela causal aparece. */
  cadeiaCausal: boolean;
}

export function corrigirCartoes(c: Classificacao): CorrecaoDosCartoes {
  const alocados = CARTOES.filter((k) => c[k] !== undefined);
  const acertos = alocados.filter((k) => c[k] === COLUNA_DO_CARTAO[k]).length;
  return {
    completa: alocados.length === CARTOES.length,
    acertos,
    cadeiaCausal: c.horario === "observados" && c["sinal-de-rede"] === "observados",
  };
}

// ──────────────────────────────────────────── o algoritmo (E5-ALU-02, opcional)

/** Marcou exatamente os passos de inferência (2, 3 e 4) — e nenhum essencial. */
export function marcouOsDispensaveis(marcados: readonly PassoDoAlgoritmo[]): boolean {
  const m = new Set(marcados);
  return m.size === PASSOS_DISPENSAVEIS.length && PASSOS_DISPENSAVEIS.every((p) => m.has(p));
}

// ──────────────────────────────────────────── o reteste (E5-ALU-04)

export type Equidade = "total" | "parcial" | "nenhuma";

/**
 * O resultado do reteste. "total" = as funções 1 e 2 sem critério de dado
 * observado → "Homologação Aprovada"; senão o alerta de viés mantido. A
 * função 3 não pesa (o §12a do PO só mede 1 e 2).
 */
export function equidadeDoReteste(c: Criterios): Equidade {
  const exercicios = CRITERIOS_EQUITATIVOS.exercicios.includes(c.exercicios);
  const duvidas = CRITERIOS_EQUITATIVOS.duvidas.includes(c.duvidas);
  if (exercicios && duvidas) return "total";
  return exercicios || duvidas ? "parcial" : "nenhuma";
}

/** O que o reteste mostra no chat: a Beatriz no avançado? O Thiago sem bloqueio? */
export function efeitoDoReteste(c: Criterios): { beatrizAvancada: boolean; thiagoLivre: boolean } {
  return {
    beatrizAvancada: CRITERIOS_EQUITATIVOS.exercicios.includes(c.exercicios),
    thiagoLivre: CRITERIOS_EQUITATIVOS.duvidas.includes(c.duvidas),
  };
}

// ──────────────────────────────────────────── o comunicado (E6-ALU-01)

export type Comunicado = Partial<Record<Bloco, string>>;

export type Alinhamento = "pleno" | "incompleto" | "descaracterizado";

export interface CorrecaoDoComunicado {
  alinhamento: Alinhamento;
  /** Quantos blocos têm a opção certa (o PQ-05 conta os quatro). */
  corretos: number;
  /** Algum bloco em branco: a tela mostra o aviso do PO — e publica mesmo assim. */
  incompleto: boolean;
}

/**
 * - pleno: os quatro com a opção certa;
 * - descaracterizado: a opção errada em 2, 3 ou 4 — inferência, regra
 *   corrigida ou revisão humana, os elos que o §12a diz que "descaracterizam a
 *   relação causal" (decisão de computabilidade, registrada no card);
 * - incompleto: o resto (bloco em branco, ou só o bloco 1 trocado).
 */
export function corrigirComunicado(c: Comunicado): CorrecaoDoComunicado {
  const preenchidos = BLOCOS.filter((b) => c[b] !== undefined);
  const corretos = preenchidos.filter((b) => c[b] === OPCAO_CERTA_DO_BLOCO[b]).length;
  const errouUmElo = (["inferencia", "regra", "salvaguarda"] as const).some((b) => c[b] !== undefined && c[b] !== OPCAO_CERTA_DO_BLOCO[b]);
  const alinhamento: Alinhamento = corretos === BLOCOS.length ? "pleno" : errouUmElo ? "descaracterizado" : "incompleto";
  return { alinhamento, corretos, incompleto: preenchidos.length < BLOCOS.length };
}
