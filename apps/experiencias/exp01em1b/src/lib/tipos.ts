/**
 * O contrato desta experiência como o cliente o vê — ESPELHO dos `z.infer` de
 * `apps/api/src/assistente-invisivel/contrato-de-rotas.ts` (`EstadoSchema`,
 * `SessaoSchema`, `GateDoEstudanteSchema`, `RespostaDoRetesteSchema`,
 * `MaterialFixoSchema`) e dos vocabulários de `conteudo.ts` /
 * `regras/passos.ts`. A experiência não importa de `apps/api`: mudou lá, muda
 * aqui (e o typecheck não vê).
 *
 * O gabarito não está aqui porque NÃO desce (regra 3): nem a coluna certa de
 * cada cartão, nem os passos dispensáveis do algoritmo, nem os critérios
 * equitativos, nem a opção certa de cada bloco do comunicado.
 * `src/contrato.test.ts` prende isso.
 */

export const EXP_ID = "exp01em1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json` (`versao.test.ts` compara os três — ADR-84).
 */
export const EXP_VERSION = "1.0.7";

// ─────────────────────────────────────────── vocabulários (espelho de conteudo.ts / passos.ts)

export const FASES = ["aguardando-inicio", "testes", "simulacao", "debate-1", "explicar", "debate-2", "publicar"] as const;
export type Fase = (typeof FASES)[number];

export type Passo =
  | "boas-vindas"
  | "funcoes"
  | "aposta"
  | "simulacao"
  | "confronto"
  | "fichas"
  | "classificacao"
  | "algoritmo"
  | "criterios"
  | "reteste"
  | "publicacao"
  | "concluida";

export type ApostaId = "a" | "b" | "c";
export type Funcao = "exercicios" | "duvidas" | "sugestoes";
export type OpcaoDeCriterio = "a" | "b" | "c";
export type Cartao = "trilha-avancada" | "nome-turma" | "horario" | "sinal-de-rede" | "endereco-ip" | "modelo-aparelho";
export type Coluna = "fornecidos" | "observados";
export type Bloco = "problema" | "inferencia" | "regra" | "salvaguarda";
export type Perfil = "lucas" | "beatriz" | "thiago";
export type PassoDoAlgoritmo = 1 | 2 | 3 | 4 | 5;

export const FUNCOES: readonly Funcao[] = ["exercicios", "duvidas", "sugestoes"];
export const BLOCOS: readonly Bloco[] = ["problema", "inferencia", "regra", "salvaguarda"];
export const COLUNAS: readonly Coluna[] = ["fornecidos", "observados"];

// ─────────────────────────────────────────── peças

export type CriteriosValor = Record<Funcao, OpcaoDeCriterio>;

/** Cada bloco aceita as duas opções dele, ou fica em branco. */
export type ComunicadoValor = Partial<Record<Bloco, string>>;

/** Cada cartão numa coluna, ou ausente (ainda não alocado). */
export type ClassificacaoValor = Partial<Record<Cartao, Coluna>>;

export interface ConteudoDoPacote {
  versao: 1;
  trilhaAvancada: { titulo: string; enunciado: string };
  reforcoBasico: { titulo: string; enunciado: string };
  duvidas: { lucas: string; beatriz: string; thiago1: string; thiago2: string; thiago3: string };
  respostas: { lucas: string; beatriz: string; thiago1: string; thiago2: string; thiago3: string };
  leitura: { titulo: string; resumo: string };
}

/** O medidor da turma (TC-12): percentuais agregados, `null` abaixo de 3 apostas. */
export type Medidor = { a: number; b: number; c: number; total: number } | null;

export interface Atividade {
  pacoteId: string;
  rodada: number;
}

export interface Reteste {
  /** "total" = "Homologação Aprovada"; "parcial"/"nenhuma" = "Alerta de Viés Mantido". */
  equidade: "total" | "parcial" | "nenhuma";
  beatrizAvancada: boolean;
  thiagoLivre: boolean;
}

// ─────────────────────────────────────────── saída (estudante)

/** O estado da missão — a resposta de TODO POST de estudante. Sem gabarito. */
export interface Estado {
  passo: Passo;
  fase: Fase | null;
  preparada: boolean;
  aguardandoProfessor: boolean;
  atividade: Atividade | null;
  equipe: { nome: string } | null;
  funcoesAbertas: Funcao[];
  aposta: ApostaId | null;
  apostadaEm: string | null;
  classificacao: { cartoes: ClassificacaoValor; completa: boolean; cadeiaCausal: boolean } | null;
  /** `enviesados`: dos marcados, os que levam "(Ação enviesada)" — vem do servidor (gabarito). */
  algoritmo: { aberto: boolean; marcados: PassoDoAlgoritmo[]; enviesados: PassoDoAlgoritmo[]; concluido: boolean };
  criterios: CriteriosValor;
  retestes: number;
  ultimoReteste: Reteste | null;
  publicacao: { paginaAtiva: boolean; comunicado: ComunicadoValor; publicadaEm: string } | null;
  concluido: boolean;
}

export interface Ficha {
  perfil: Perfil;
  nome: string;
  idade: number;
  formulario: string;
  horario: string;
  conexao: string;
  inferencia: string | null;
  acao: string;
}

/** O material FIXO da missão: rótulos e textos que não são gabarito. */
export interface MaterialFixo {
  apostas: { id: ApostaId; texto: string }[];
  fichas: Ficha[];
  avisos: { beatriz: string; thiago: string };
  cartoes: { id: Cartao; rotulo: string }[];
  passosDoAlgoritmo: { id: PassoDoAlgoritmo; rotulo: string }[];
  criterios: { funcao: Funcao; opcoes: { id: OpcaoDeCriterio; rotulo: string }[] }[];
  criteriosIniciais: CriteriosValor;
  blocos: { id: Bloco; titulo: string; inicio: string; opcoes: { id: string; texto: string }[] }[];
}

export interface Sessao extends Estado {
  pacote: { disciplina: string; tema: string; conteudo: ConteudoDoPacote; contingencia: boolean } | null;
  material: MaterialFixo;
  medidor: Medidor;
  tempos: { pollingMs: number };
}

/** O polling de 3 s. */
export interface GateDoEstudante {
  preparada: boolean;
  fase: Fase | null;
  rodada: number | null;
  atividade: Atividade | null;
  passo: Passo;
  aguardandoProfessor: boolean;
  medidor: Medidor;
  agora: string;
}

export interface RespostaDoReteste extends Estado {
  reteste: Reteste;
}

/** "A turma já está em `alvo` ou além?" — espelho de `faseAlcancou` (`regras/passos.ts`). */
export function faseAlcancou(atual: Fase | null, alvo: Fase): boolean {
  if (!atual) return false;
  return FASES.indexOf(atual) >= FASES.indexOf(alvo);
}
