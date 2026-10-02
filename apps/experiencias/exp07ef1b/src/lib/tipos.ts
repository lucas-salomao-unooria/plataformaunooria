/**
 * O contrato de `/a-selecao/*` e das enquetes (`/evidencias/exp07ef1b/*`)
 * como o CLIENTE o vê.
 *
 * Espelha `apps/api/src/a-selecao/contrato-de-rotas.ts` — e espelha só o que a
 * TELA precisa ver. **Não existe tipo para o gabarito do post** (enquadramento,
 * fonte ouvida, ângulo) dentro do feed, nem para a matriz: a api monta a
 * resposta por allowlist (`PostPublicoSchema`) e esses campos nunca descem
 * antes de a professora acender as fichas. Acrescentar um campo opcional aqui
 * "por garantia" seria escrever a suspeita de que eles podem vir — e a próxima
 * pessoa leria isso como permissão. O gabarito cruza a fronteira UMA vez,
 * dentro de `FichaDoPost`, no Mural, e só com `fichasReveladas`.
 *
 * Os ids de post são `string`, e não a união `post_a_1 … post_c_4`: o cliente
 * nunca CONSTRÓI um id, ele devolve o que veio da cobertura. (E o bloco do id
 * é o veículo — uma lista deles aqui seria meia ficha técnica no bundle.)
 */

export const EXP_ID = "exp07ef1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O CI lê a do manifesto para montar o caminho
 * IMUTÁVEL no bucket, e a divergência já causou bug — o `versao.test.ts`
 * compara os três (ADR-84).
 */
export const EXP_VERSION = "1.1.0";

// ──────────────────────────────────────────────────────────── vocabulário

/**
 * Os passos do estudante, na ordem em que ele os percorre. Espelho declarado de
 * `PASSOS` em `apps/api/src/a-selecao/regras/passos.ts` — `regras.test.ts` lê
 * aquele arquivo e reprova a divergência.
 */
export const PASSOS = [
  "desafio",
  "feed",
  "salvos",
  "publicado",
  "mural",
  "fichas",
  "explicacao",
  "reflexao",
  "enquetes",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/** As etapas da turma — o botão único da professora anda uma por vez. */
export const ETAPAS = ["exploracao", "mural", "fichas", "explicacao"] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Os passos que a própria criança pede por `POST /a-selecao/passo`. */
export type PassoPedido = "feed" | "salvos" | "reflexao";

// ───────────────────────────────────────────────────────────── o feed

export type TipoDeGrafico = "barras" | "linhas" | "mapa-de-calor";

/** O gráfico de um post de métricas: a TELA o desenha a partir dos números. */
export interface Grafico {
  tipo: TipoDeGrafico;
  titulo: string;
  /** "R$", "min", "%" — ou vazio quando a série é contagem. */
  unidade: string;
  series: { rotulo: string; valor: number }[];
  destaque?: string;
}

/** Um post como o estudante o recebe. Sem gabarito, por construção. */
export interface PostPublico {
  id: string;
  /** O nome da conta, com `@` ("@folhaoficial_"). */
  perfil: string;
  legenda: string;
  curtidas: number;
  comentarios: number;
  comentariosDestaque: string[];
  /** `url: null` enquanto a professora não gerou as imagens: a tela desenha o card. */
  imagem: { url: string | null; alt: string };
  /** Só nos posts de métricas: a tela desenha o SVG. */
  grafico: Grafico | null;
}

// ──────────────────────────────────────────────────────────────── estado

/** O estado da sessão, como TODA rota de estudante o devolve. */
export interface Estado {
  sessaoId: string;
  /** A ATIVIDADE (a cobertura homologada). Muda quando a professora troca o tema. */
  coberturaId: string;
  /** Sobe quando a professora zera a turma: a sessão passa a ser outra. */
  rodada: number;
  etapa: Etapa;
  /** Já reconciliado com a etapa da turma — USE ESTE, nunca o cru. */
  passo: Passo;
  /** O passo gravado. Divergente do de cima = a turma o está conduzindo. */
  passoDoEstudante: Passo;
  aguardandoOProfessor: boolean;
  publicada: boolean;
  publicadaEm: string | null;
  /** A tríade do PRÓPRIO estudante, depois do latch. Nunca a de outro. */
  selecao: string[] | null;
  legenda: string | null;
  reflexaoEnviada: boolean;
  concluidaEm: string | null;
}

export interface Limites {
  selecao: number;
  legendaMin: number;
  legendaMax: number;
  reflexaoMin: number;
  reflexaoMax: number;
}

export interface RespostaSessao extends Estado {
  cobertura: {
    tema: string;
    /** Os 12 posts na ORDEM DO FEED. */
    posts: PostPublico[];
  };
  limites: Limites;
}

/** O polling de 5 s (ADR-93): magro, sem posts. */
export interface RespostaGate {
  etapa: Etapa;
  rodada: number | null;
  coberturaId: string | null;
  passoEfetivo: Passo;
  aguardandoOProfessor: boolean;
  /** O instante do SERVIDOR. */
  agora: string;
}

// ─────────────────────────────────────────────────────────────── o Mural

export type Lente = "institucional" | "comunitario" | "estatistico";

/** A ficha técnica de um post — a revelação. Só existe com `fichasReveladas`. */
export interface FichaDoPost {
  postId: string;
  fonte: string;
  angulo: string;
  enquadramento: Lente;
}

/** O "equilíbrio editorial da seleção": percentuais inteiros que somam 100. */
export type Equilibrio = Record<Lente, number>;

export interface Triade {
  posts: PostPublico[];
  legenda: string;
  fichas: FichaDoPost[] | null;
  equilibrio: Equilibrio | null;
}

export interface RespostaMural {
  etapa: Etapa;
  fichasReveladas: boolean;
  minha: Triade;
  /** `rotulo`: o primeiro nome, o nome da equipe, ou Tomás/Malu. Congelado no pareamento. */
  par: Triade & { rotulo: string; virtual: boolean };
}

// ──────────────────────────────────────────────────────────── as enquetes

/** A pergunta de evidência como o estudante a vê: sem o nível de cada alternativa. */
export interface PerguntaDaEnquete {
  /** "mensagem da Amara\n\npergunta da enquete". */
  enunciado: string;
  /** Embaralhadas a cada chamada: guarde o `id`, nunca a posição. */
  alternativas: { id: string; texto: string }[];
}

/** As duas enquetes da DM, na ordem do PO (P1 = EF07CO11, P2 = EF07CO08). */
export const ENQUETES = ["p1", "p2"] as const;
export type IdDaEnquete = (typeof ENQUETES)[number];
