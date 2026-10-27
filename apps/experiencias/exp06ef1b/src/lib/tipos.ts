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
 * O que NÃO está aqui, de propósito (regra 3): o acerto da separação nas
 * pastas, a peça certa da regra (antes do envio), os pesos do motor do feed, a
 * área líder. A tela recebe as peças embaralhadas, com ids opacos, e quem
 * corrige é o servidor.
 */

export const EXP_ID = "exp06ef1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O CI lê a do manifesto, e a divergência já causou
 * bug — o `versao.test.ts` compara os três (ADR-84).
 */
export const EXP_VERSION = "0.8.2";

/** O prefixo das rotas da missão na api. */
export const ROTA = "/juri-estadual";

// ───────────────────────────────────────────── o vocabulário (espelho)

/**
 * `regras/passos.ts#PASSOS` — na ordem em que a criança os percorre. `cadeia`
 * é a tela da regra, que conclui desde a 0.7.0 (ADR-176). `classificacao`
 * (a tela da separação da 0.6.0), `mariana` (o caso da 0.6.0) e `enquetes`
 * só existem para as sessões antigas, que a tela tira de lá sozinha.
 */
export const PASSOS = [
  "credencial",
  "feed",
  "classificacao",
  "lacrada",
  "galeria",
  "revisada",
  "cadeia",
  "mariana",
  "enquetes",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/** `regras/passos.ts#ETAPAS` — o relógio da turma. */
export const ETAPAS = ["exploracao", "galeria"] as const;
export type Etapa = (typeof ETAPAS)[number];

/**
 * `regras/passos.ts#PASSOS_PEDIDOS` — os passos que a criança pede: o `feed`
 * ("Acessar Feed da Mostra"), a `cadeia` (o avanço depois da revisão do voto)
 * e a `lacrada` (só a sessão antiga parada na separação da 0.6.0).
 */
export const PASSOS_PEDIDOS = ["feed", "cadeia", "lacrada"] as const;

/** `vocabulario.ts#AREAS` — o slug é fixo; o nome de cada área vem do pacote do professor. */
export const AREAS = ["area_a", "area_b", "area_c", "area_d"] as const;
export type Area = (typeof AREAS)[number];

/**
 * `vocabulario.ts#TIPOS_DE_POST` — o formato que o motor SERVE desde a 0.5.0
 * (instrumento 3.0.0): só a apresentação, e nenhum post se repete.
 */
export const TIPOS_DE_POST = ["apresentacao"] as const;
/**
 * `vocabulario.ts#TIPOS_DE_POST_LEGADOS` — os formatos da saturação da 0.4.x.
 * Só chegam no feed GRAVADO de uma sessão 2.0.0, e a tela continua sabendo
 * desenhá-los (o texto do formato vem em `texto`).
 */
export const TIPOS_DE_POST_LEGADOS = ["bastidor", "prototipo", "depoimento"] as const;
/** `vocabulario.ts#TIPOS_DE_POST_LIDOS` — todo formato que a leitura aceita. */
export const TIPOS_DE_POST_LIDOS = [...TIPOS_DE_POST, ...TIPOS_DE_POST_LEGADOS] as const;
export type TipoDePost = (typeof TIPOS_DE_POST_LIDOS)[number];

/** `vocabulario.ts#CONVICCOES` — as duas afirmam certeza, de propósito. */
export const CONVICCOES = ["examinei_bem", "vi_tudo"] as const;
export type Conviccao = (typeof CONVICCOES)[number];

/**
 * `vocabulario.ts#ACOES_DA_REVISAO` — os dois botões da revisão (PRD v2):
 * "Manter meu voto inicial" e "Confirmar Voto Revisado".
 */
export const ACOES_DA_REVISAO = ["manter", "trocar"] as const;
export type AcaoDaRevisao = (typeof ACOES_DA_REVISAO)[number];

/** `vocabulario.ts#MINUTOS_NO_FEED` — o teto do feed, contado no SERVIDOR desde a 1ª rolagem. */
export const MINUTOS_NO_FEED = 8;

/** `vocabulario.ts#TIPOS_DE_BUSCA` — da busca, só o TIPO; o texto nunca sai do aparelho. */
export const TIPOS_DE_BUSCA = ["hashtag", "texto"] as const;
export type TipoDeBusca = (typeof TIPOS_DE_BUSCA)[number];

/** `vocabulario.ts#POSTS_NO_FEED` — a cédula abre quando o décimo chega à tela. */
export const POSTS_NO_FEED = 10;

/**
 * `vocabulario.ts#TOTAL_DE_PROJETOS` — os quarenta estandes da mostra (dez por
 * área). O pacote de dezesseis da 0.4.x continua legível na api: a tela nunca
 * crava o total, ela lê `GaleriaSchema.invisibilidade.total`.
 */
export const TOTAL_DE_PROJETOS = 40;

/** `conteudo.ts#PECAS_DO_SE` e `PECAS_DO_ENTAO` — três peças de cada lado da regra. */
export const PECAS_POR_LADO = 3;

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

/**
 * As fotos 2 e 3 do carrossel e a dos bastidores (0.8.0, ADR-178). `null` é a
 * lâmina sem imagem: a arte procedural (e, nos bastidores, só o texto).
 */
export interface LaminasPublicas {
  detalhe: string | null;
  equipe: string | null;
  bastidor: string | null;
}

/** `PostPublicoSchema` — a allowlist de um post do feed. */
export interface PostPublico {
  id: string;
  projetoId: string;
  /** O formato: a apresentação (ou, numa sessão 2.0.0, um formato legado). */
  tipo: TipoDePost;
  area: Area;
  titulo: string;
  escola: string;
  perfil: string;
  /** O texto do FORMATO. */
  texto: string;
  /** A legenda do ESTANDE, em qualquer formato. */
  legenda: string;
  /** O resumo técnico do estande (o bastidor): a ÚLTIMA lâmina do carrossel do post. */
  bastidor: string;
  hashtags: string[];
  imagem: ImagemPublica;
  laminas: LaminasPublicas;
}

/** `FeedSchema`. */
export interface Feed {
  posts: PostPublico[];
  curtidos: string[];
  salvos: string[];
  /** A pasta (área) de cada post salvo — a separação da EF06CO01 (ADR-176). */
  pastas: Partial<Record<string, Area>>;
  /** Quantos estandes vistos ainda não estão numa pasta: a cédula só lacra com zero. */
  semPasta: number;
  /** Os dez chegaram. */
  completo: boolean;
  /** Os 8 minutos do servidor acabaram: o feed não serve mais. */
  tempoEsgotado: boolean;
  /** Quando o feed encerra por tempo (ISO), ou `null` antes da 1ª rolagem. */
  encerraEm: string | null;
  /** A cédula pode abrir: `completo` OU `tempoEsgotado`. Quem decide é o servidor. */
  cedulaLiberada: boolean;
}

/** `PecaPublicaSchema` — uma peça da regra, sem dizer se é a certa. */
export interface PecaDaRegra {
  /** Opaco por sessão (`rg-xxx`). */
  id: string;
  texto: string;
}

/** `RevelacaoDaRegraSchema` — só depois do envio. */
export interface RevelacaoDaRegra {
  escolha: { se: string; entao: string };
  certa: { se: string; entao: string };
  motivo: "curtidas" | "permanencia" | "variado";
  area: Area | null;
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
  /** `complementar` só nas sessões da 0.3.0. `projetoId`: o estande da troca; `null` ao manter. */
  revisao: { acao: AcaoDaRevisao | "complementar"; projetoId: string | null } | null;
  /**
   * A REGRA (o passo guarda o nome `cadeia`), do passo dela em diante.
   * `enviada` sem `revelacao` = a cadeia antiga da 0.5.0, já montada.
   */
  cadeia: { se: PecaDaRegra[]; entao: PecaDaRegra[]; enviada: boolean; revelacao: RevelacaoDaRegra | null } | null;
  concluida: boolean;
}

/** `GatePublicoSchema` — o polling da espera. */
export interface Gate {
  pacoteId: string;
  rodada: number;
  etapa: Etapa;
}

/** `EstadoSchema` — voto, revisão e concluir. */
export interface Estado {
  passo: Passo;
  etapa: Etapa;
}

/** `RespostaDaRegraSchema` — o estado e a revelação da regra. */
export interface RespostaDaRegra extends Estado {
  revelacao: RevelacaoDaRegra | null;
}

/** `ProjetoDaGaleriaSchema`. */
export interface ProjetoDaGaleria {
  id: string;
  area: Area;
  titulo: string;
  escola: string;
  perfil: string;
  legenda: string;
  /** O resumo técnico da ficha de inspeção (E4-ALU-02). */
  resumo: string;
  hashtags: string[];
  imagem: ImagemPublica;
  laminas: LaminasPublicas;
  exibidoNoSeuFeed: boolean;
}

/** `VistosPorAreaSchema` — projetos DISTINTOS de uma área que chegaram ao feed, sobre os da área. */
export interface VistosPorArea {
  area: Area;
  vistos: number;
  total: number;
}

/**
 * `AreaSemCurtidasSchema` — uma área do CONTRAFACTUAL: os projetos que o feed
 * teria mostrado dela sem nenhuma curtida e nenhuma permanência. Calculado no
 * SERVIDOR (o motor não desce para o bundle); a tela só conta.
 */
export interface AreaSemCurtidas {
  area: Area;
  posts: string[];
}

/** `GaleriaSchema`. */
export interface Galeria {
  /** "{ocultos} de {total}": o total vem do pacote (40, ou 16 no legado). Sem percentual. */
  invisibilidade: { ocultos: number; total: number };
  /** As quatro áreas, na ordem delas. */
  porArea: VistosPorArea[];
  /** O contrafactual, nas quatro áreas. */
  semCurtidas: AreaSemCurtidas[];
  /** Os quarenta (ou dezesseis no pacote legado), os que NÃO chegaram primeiro. */
  projetos: ProjetoDaGaleria[];
  /** Quantos estandes ocultos a criança já abriu. */
  ocultosAbertos: number;
  /** "Manter meu voto inicial" está liberado (abriu ao menos um oculto). */
  podeManter: boolean;
}

/** `AcaoDaGaleriaSchema` — o texto digitado NUNCA viaja (texto livre de menor). */
export type AcaoDaGaleria =
  | { tipo: "abrir"; projetoId: string }
  | { tipo: "buscar"; busca: TipoDeBusca; area: Area | null };
