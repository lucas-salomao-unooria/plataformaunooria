/**
 * O contrato da exp06ef1b como o CLIENTE o vê — o espelho DECLARADO de
 * `apps/api/src/juri-estadual/contrato-de-rotas.ts`, `vocabulario.ts`,
 * `regras/passos.ts` e `conteudo.ts`.
 *
 * A experiência não importa a api (o bundle é público e a api é outro pacote),
 * então as listas fechadas moram aqui uma segunda vez — e `espelho.test.ts` LÊ
 * os arquivos da api como texto e reprova a divergência. Sem ele, um passo novo
 * no servidor cairia numa tela que não existe, e o typecheck não veria.
 *
 * O que NÃO está aqui, de propósito (regra 3): a ordem certa dos blocos da
 * cadeia, o cartão certo do caso Mariana, os pesos do motor do feed, a área
 * líder, o nível das alternativas das enquetes. A tela recebe os itens
 * embaralhados, com ids opacos, e quem confere é o servidor.
 */

export const EXP_ID = "exp06ef1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O CI lê a do manifesto, e a divergência já causou
 * bug — o `versao.test.ts` compara os três (ADR-84).
 */
export const EXP_VERSION = "0.2.0";

/** O prefixo das rotas da missão na api. */
export const ROTA = "/juri-estadual";

// ───────────────────────────────────────────── o vocabulário (espelho)

/** `regras/passos.ts#PASSOS` — na ordem em que a criança os percorre. */
export const PASSOS = [
  "credencial",
  "feed",
  "lacrada",
  "galeria",
  "cadeia",
  "mariana",
  "enquetes",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/** `regras/passos.ts#ETAPAS` — o relógio da turma. */
export const ETAPAS = ["exploracao", "galeria"] as const;
export type Etapa = (typeof ETAPAS)[number];

/** `regras/passos.ts#PASSOS_PEDIDOS` — o único passo que a criança pede. */
export const PASSOS_PEDIDOS = ["feed"] as const;

/** `vocabulario.ts#AREAS` — o slug é fixo; o nome de cada área vem do pacote do professor. */
export const AREAS = ["area_a", "area_b", "area_c", "area_d"] as const;
export type Area = (typeof AREAS)[number];

/** `vocabulario.ts#TIPOS_DE_POST`. */
export const TIPOS_DE_POST = ["apresentacao", "bastidor"] as const;
export type TipoDePost = (typeof TIPOS_DE_POST)[number];

/** `vocabulario.ts#CONVICCOES` — as duas afirmam certeza, de propósito. */
export const CONVICCOES = ["examinei_bem", "vi_tudo"] as const;
export type Conviccao = (typeof CONVICCOES)[number];

/** `vocabulario.ts#ACOES_DA_REVISAO`. */
export const ACOES_DA_REVISAO = ["manter", "trocar"] as const;
export type AcaoDaRevisao = (typeof ACOES_DA_REVISAO)[number];

/** `vocabulario.ts#TIPOS_DE_BUSCA` — da busca, só o TIPO; o texto nunca sai do aparelho. */
export const TIPOS_DE_BUSCA = ["hashtag", "texto"] as const;
export type TipoDeBusca = (typeof TIPOS_DE_BUSCA)[number];

/** `vocabulario.ts#POSTS_NO_FEED` — a cédula abre quando o décimo chega à tela. */
export const POSTS_NO_FEED = 10;

/** `vocabulario.ts#TOTAL_DE_PROJETOS` — os dezesseis estandes da mostra. */
export const TOTAL_DE_PROJETOS = 16;

/** `conteudo.ts#TOTAL_DE_BLOCOS`. */
export const TOTAL_DE_BLOCOS = 4;

/**
 * As três perguntas da ficha (`evidencias/fichas/exp06ef1b.ts`), uma por
 * segmento do Story, nesta ordem: EF06CO10 (o foco primário, a frase do
 * jurado), EF06CO01 e EF06CO03. Descem pelas rotas GENÉRICAS de
 * `/evidencias`, embaralhadas a cada leitura.
 */
export const ENQUETES = ["p1", "p2", "p3"] as const;
export type IdDaEnquete = (typeof ENQUETES)[number];

// ──────────────────────────────────────────── o que a api devolve

export interface Categoria {
  area: Area;
  nome: string;
  hashtag: string;
}

export interface ImagemPublica {
  /** `null` enquanto o professor não gerou: a tela desenha a arte procedural. */
  url: string | null;
  alt: string;
}

/** `PostPublicoSchema` — a allowlist de um post do feed. */
export interface PostPublico {
  id: string;
  projetoId: string;
  tipo: TipoDePost;
  area: Area;
  titulo: string;
  escola: string;
  perfil: string;
  /** A legenda da apresentação, ou o texto do bastidor. */
  texto: string;
  hashtags: string[];
  imagem: ImagemPublica;
}

/** `FeedSchema`. */
export interface Feed {
  posts: PostPublico[];
  curtidos: string[];
  /** Os dez chegaram: a cédula pode abrir. */
  completo: boolean;
}

export interface BlocoDaCadeia {
  /** Opaco por sessão (`bl-xxx`). */
  id: string;
  rotulo: string;
}

export interface Cartao {
  id: string;
  texto: string;
}

export interface Voto {
  projetoId: string;
  conviccao: Conviccao;
}

/** `SessaoSchema` — o boot e o F5. */
export interface Sessao {
  pacoteId: string;
  rodada: number;
  /** Já reconciliado com a etapa da turma (`passoEfetivo`). É ESTE que manda na tela. */
  passo: Passo;
  /** O gravado. A tela não lê. */
  passoDoEstudante: Passo;
  etapa: Etapa;
  aguardandoOProfessor: boolean;
  tema: string;
  categorias: Categoria[];
  feed: Feed;
  voto: Voto | null;
  revisao: { acao: AcaoDaRevisao; projetoId: string | null } | null;
  /** Do passo `cadeia` em diante. */
  cadeia: { blocos: BlocoDaCadeia[]; tentativas: number; montada: boolean } | null;
  /** Do passo `mariana` em diante. */
  mariana: {
    caso: string;
    mecanismos: Cartao[];
    atitudes: Cartao[];
    escolha: { mecanismo: string; atitude: string } | null;
  } | null;
  concluida: boolean;
}

/** `GatePublicoSchema` — o polling da espera. */
export interface Gate {
  pacoteId: string;
  rodada: number;
  etapa: Etapa;
}

/** `EstadoSchema` — voto, revisão, cartões e concluir. */
export interface Estado {
  passo: Passo;
  etapa: Etapa;
}

/** `TentativaSchema` — a cadeia: certa ou não, nunca qual vaga errou. */
export interface Tentativa {
  correta: boolean;
  tentativas: number;
  passo: Passo;
}

/** `ProjetoDaGaleriaSchema`. */
export interface ProjetoDaGaleria {
  id: string;
  area: Area;
  titulo: string;
  escola: string;
  perfil: string;
  legenda: string;
  hashtags: string[];
  imagem: ImagemPublica;
  exibidoNoSeuFeed: boolean;
}

/** `GaleriaSchema`. */
export interface Galeria {
  invisibilidade: { vistos: number; ocultos: number; total: number; percentual: number };
  /** Os dezesseis, os que NÃO chegaram primeiro. */
  projetos: ProjetoDaGaleria[];
}

/** `AcaoDaGaleriaSchema` — o texto digitado NUNCA viaja (texto livre de menor). */
export type AcaoDaGaleria =
  | { tipo: "abrir"; projetoId: string }
  | { tipo: "buscar"; busca: TipoDeBusca; area: Area | null };

/** A pergunta de evidência, como as rotas genéricas de `/evidencias` a devolvem. */
export interface PerguntaDaEnquete {
  enunciado: string;
  /** Embaralhadas a cada chamada: guarde o `id`, nunca a posição. */
  alternativas: { id: string; texto: string }[];
}
