/**
 * O contrato de `/jornal-escola/*` e das perguntas finais
 * (`/evidencias/exp04ef1b/perguntas/*`) como o CLIENTE o vê.
 *
 * Espelho DECLARADO de `apps/api/src/jornal-escola/contrato-de-rotas.ts`,
 * `vocabulario.ts` e `regras/passos.ts` — a experiência não importa a api (o
 * bundle é público e a api é outro pacote). `espelho.test.ts` LÊ aqueles
 * arquivos e reprova a divergência nas listas: uma segunda lista de valores é a
 * que ninguém atualiza junto.
 *
 * **O que NÃO tem tipo aqui, de propósito** (regra inviolável 3): o gabarito de
 * cada notícia (`publicavel`, `pilarEmFalta`, `explicacao`), a `consequencia`,
 * e QUAIS blocos da Chave são pilares. Acrescentar um campo opcional "por
 * garantia" seria escrever a suspeita de que eles podem descer — e a próxima
 * pessoa leria isso como permissão. O gabarito cruza a fronteira em três
 * momentos, cada um com o seu portão e o seu tipo: as REAÇÕES no `GET resultado`,
 * o pilar de cada vaga no `GET revisao` (depois da Chave) e no comparativo.
 */

export const EXP_ID = "exp04ef1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O CI lê a do manifesto para montar o caminho
 * IMUTÁVEL no bucket — e o `exp04ef1b/` pode ter o UnooTube 1.2.8 lá (ADR-116),
 * por isso a série do Jornal começa na 2.0.0. `versao.test.ts` compara os três.
 */
export const EXP_VERSION = "2.0.0";

// ──────────────────────────────────────────────── vocabulário (espelho)

/** A primeira página sempre tem três vagas; a Chave, também três. */
export const TAMANHO_DA_EDICAO = 3;

/** Os ids são a POSIÇÃO no pacote e não dizem nada do gabarito. */
export const IDS_DE_NOTICIA = ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"] as const;
export type IdDeNoticia = (typeof IDS_DE_NOTICIA)[number];

/** Os oito meios. Na tela, cada um vira o `NewsMedium` do DS (`lib/meios.ts`). */
export const MEIOS = ["jornal", "radio", "tv", "blog", "portal", "rede_social", "mensagem", "mural"] as const;
export type Meio = (typeof MEIOS)[number];

/** As três pistas de checagem, na ordem da gaveta. */
export const TIPOS_DE_PISTA = ["fonte", "data", "autoria"] as const;
export type TipoDePista = (typeof TIPOS_DE_PISTA)[number];

/** Os layouts fechados da primeira página — os MESMOS do `NEWSPAPER_LAYOUTS` do DS. */
export const LAYOUTS = ["classic", "hero-image", "columns"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const ORIGENS_DO_LAYOUT = ["ia", "modelo"] as const;
export type OrigemDoLayout = (typeof ORIGENS_DO_LAYOUT)[number];

/** As duas respostas da pergunta de motivo, feita DEPOIS da 1ª publicação. */
export const MOTIVOS = ["visual", "checagem"] as const;
export type Motivo = (typeof MOTIVOS)[number];

/**
 * Os seis blocos da Chave — SÓ o tipo, sem lista em tempo de execução. Uma
 * constante com os seis na ordem da api (os três pilares primeiro, as três
 * iscas depois) iria para o bundle e seria o conjunto certo da Chave escrito
 * por extenso. A ordem da bandeja é a que a api devolve em `sessao.blocos`
 * (embaralhada por sessão), e o `Record` de ícones de `lib/meios.ts` é o que o
 * teste compara com o vocabulário da api.
 */
export type IdDeBloco = "fonte" | "data" | "autoria" | "foto" | "urgencia" | "compartilhada";

/** Os passos do estudante, na ordem em que ele os percorre. */
export const PASSOS = [
  "desafio",
  "mesa",
  "motivo",
  "publicada",
  "resultado",
  "chave",
  "revisao",
  "comparativo",
  "transferencia",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/** As etapas da turma — o botão único do professor anda uma por vez. */
export const ETAPAS = ["exploracao", "resultado", "revisao"] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Os passos que a própria criança pede por `POST /jornal-escola/passo`. */
export const PASSOS_PEDIDOS = ["mesa", "transferencia"] as const;
export type PassoPedido = (typeof PASSOS_PEDIDOS)[number];

// ──────────────────────────────────────────────────────────── a mesa

/**
 * Uma notícia como o estudante a recebe: o cartão e a matéria original, e
 * nada do gabarito. `imagem` nula = a notícia não tem imagem; `imagem.url`
 * nula = o professor ainda não a gerou, e o cartão se desenha pelo meio.
 */
export interface NoticiaPublica {
  id: IdDeNoticia;
  meio: Meio;
  veiculo: string;
  falante: string | null;
  manchete: string;
  resumo: string;
  corpo: string;
  legenda: string | null;
  imagem: { url: string | null; alt: string } | null;
}

/** As duas fases em que a criança abre pistas: 1 = a mesa da 1ª edição, 2 = a revisão. */
export type FaseDaPista = 1 | 2;

/**
 * Uma pista já aberta — o F5 devolve todas. O mesmo par pode vir nas DUAS
 * fases: a api registra cada par uma vez por fase, e é a consulta da fase 2 que
 * a EF04CO08 conta.
 */
export interface PistaAberta {
  noticiaId: IdDeNoticia;
  tipo: TipoDePista;
  fase: FaseDaPista;
  texto: string;
}

/** Um bloco da Chave, como a bandeja o mostra. NÃO diz se é pilar ou isca. */
export interface Bloco {
  id: IdDeBloco;
  rotulo: string;
  legenda: string;
}

export interface EdicaoDoEstudante {
  slots: IdDeNoticia[];
  layout: Layout;
  origemDoLayout: OrigemDoLayout;
  publicadaEm: string;
}

/** O estado da sessão, como TODA rota de estudante o devolve. */
export interface Estado {
  sessaoId: string;
  /** A ATIVIDADE (o pacote homologado). Muda quando o professor aprova outro. */
  pacoteId: string;
  /** Sobe quando o professor zera a turma: a sessão passa a ser outra. */
  rodada: number;
  etapa: Etapa;
  /** Já reconciliado com a etapa da turma — USE ESTE, nunca o cru. */
  passo: Passo;
  /** O passo gravado. Divergente do de cima = a turma o está conduzindo. */
  passoDoEstudante: Passo;
  aguardandoOProfessor: boolean;
  edicao1: EdicaoDoEstudante | null;
  motivoRespondido: boolean;
  chaveFormada: boolean;
  /** Quantos envios da Chave a api já contou — o próximo envio leva este + 1. */
  chaveTentativas: number;
  edicao2: EdicaoDoEstudante | null;
  pistasAbertas: PistaAberta[];
  /** Quando a sessão nasceu (ISO, relógio do servidor): a base do tempo total do EVT-U03. */
  iniciadaEm: string;
  concluidaEm: string | null;
}

export interface Sessao extends Estado {
  pacote: {
    tema: string;
    /** As oito notícias na ORDEM DA MESA, sem gabarito. */
    noticias: NoticiaPublica[];
  };
  /** Os seis blocos na ordem da bandeja DESTA sessão; `null` antes de a revisão abrir. */
  blocos: Bloco[] | null;
  limites: { edicao: number; chave: number };
}

/** O polling de 5 s (ADR-93): magro, sem notícias. */
export interface GatePublico {
  etapa: Etapa;
  rodada: number | null;
  pacoteId: string | null;
  passoEfetivo: Passo;
  aguardandoOProfessor: boolean;
  /** O instante do SERVIDOR. */
  agora: string;
}

export interface Diagramacao {
  layout: Layout;
  origem: OrigemDoLayout;
}

export interface PistaRevelada extends PistaAberta {
  /** Quantos pares (notícia, tipo) esta sessão já abriu. */
  abertas: number;
}

// ─────────────────────────────────────────── o resultado e a revisão

/** A reação de um leitor da escola a uma notícia que circulou. */
export interface Reacao {
  noticiaId: IdDeNoticia;
  leitor: string;
  fala: string;
  humor: "happy" | "upset";
}

export interface EdicaoComResultado {
  slots: IdDeNoticia[];
  layout: Layout;
  /** 0 a 3 — descreve a SELEÇÃO, não a criança. */
  verificadas: number;
  /** 0, 33, 67 ou 100. */
  percentual: number;
  /** Uma por vaga, na ordem das vagas. */
  reacoes: Reacao[];
}

export interface Resultado {
  edicao1: EdicaoComResultado;
}

/** Uma tentativa da Chave. `devolvidos` são os blocos que voltam à bandeja. */
export interface TentativaDaChave {
  sucesso: boolean;
  tentativas: number;
  devolvidos: IdDeBloco[];
  estado: Estado;
}

/** `pilarEmFalta` nulo = a notícia daquela vaga está verificada. */
export interface VagaMarcada {
  noticiaId: IdDeNoticia;
  pilarEmFalta: TipoDePista | null;
}

export interface Revisao {
  vagas: VagaMarcada[];
}

export interface Comparativo {
  edicao1: EdicaoComResultado;
  edicao2: EdicaoComResultado;
  vagas: VagaMarcada[];
}

// ──────────────────────────────────────────── as perguntas finais (E14)

/** A pergunta como o estudante a vê: sem o nível de cada alternativa. */
export interface Pergunta {
  /** P1: "boato\n\ndetalhe\n\npergunta"; P2: só a pergunta. */
  enunciado: string;
  /** Na ordem que a api devolve (embaralhada a cada leitura): guarde o `id`, nunca a posição. */
  alternativas: { id: string; texto: string }[];
}

/** O recibo é sempre este: a criança nunca sabe, pela resposta, o nível. */
export interface RespostaEnviada {
  enviada: true;
}

export const PERGUNTAS = ["p1", "p2"] as const;
export type IdDaPergunta = (typeof PERGUNTAS)[number];
