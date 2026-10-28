/**
 * O contrato de `/jornal-escola/*` como o CLIENTE o vê. Desde a 3.0.0 (Canal A
 * puro, ADR-168) a missão não tem pergunta de múltipla escolha: as rotas
 * `/evidencias/exp04ef1b/perguntas/*` não existem mais para ela.
 *
 * Espelho DECLARADO de `apps/api/src/jornal-escola/contrato-de-rotas.ts`,
 * `vocabulario.ts` e `regras/passos.ts` — a experiência não importa a api (o
 * bundle é público e a api é outro pacote). `espelho.test.ts` LÊ aqueles
 * arquivos e reprova a divergência nas listas: uma segunda lista de valores é a
 * que ninguém atualiza junto.
 *
 * **O que NÃO tem tipo aqui, de propósito** (regra inviolável 3): o gabarito de
 * cada notícia (`publicavel`, `pilarEmFalta`, `explicacao`), a `consequencia`,
 * QUAIS blocos da Chave são pilares e o LADO CERTO de cada cartão de condição. Acrescentar um campo opcional "por
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
export const EXP_VERSION = "3.0.3";

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

/**
 * O vocabulário do Canal A (3.0.0, ADR-168) — SÓ tipos, pela mesma razão da
 * Chave: uma constante `["aprova", "reprova"]` no bundle seria, letra por
 * letra, o `LADO_CERTO` da api (o 1º cartão de um pilar aprova, o 2º reprova).
 * A exaustividade vem dos `Record` de rótulos em `lib/textos.ts`, e é com eles
 * que o `espelho.test.ts` compara as listas da api.
 */
/** "✓ Confio" / "✗ Não confio" — o julgamento de uma pista aberta. */
export type Veredito = "confio" | "nao_confio";
/** O lado de um cartão de condição: a pista PASSA ou FALHA. */
export type LadoDaCondicao = "aprova" | "reprova";
/** "Se esta pista falhar": "Não publico" ou "Olho a próxima pista". */
export type SeFalhar = "parar" | "seguir";
/** "Usar estes passos em TODAS as notícias" ou "Só na primeira notícia". */
export type Repeticao = "todas" | "so_a_primeira";
/** As duas matérias da simulação — fora da mesa, ids próprios. */
export type IdDeSimulacao = "s1" | "s2";
export type DecisaoDaSimulacao = "publicar" | "nao_publicar";
export type DecisaoDaTransferencia = "repassar" | "nao_repassar";

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
  "simulacao",
  "transferencia",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/** As etapas da turma — o botão único do professor anda uma por vez. */
export const ETAPAS = ["exploracao", "resultado", "revisao"] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Os passos que a própria criança pede por `POST /jornal-escola/passo`. */
export const PASSOS_PEDIDOS = ["mesa", "simulacao"] as const;
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

/**
 * Um cartão de condição. `indice` é a posição CANÔNICA dele no bloco (o
 * `lados[indice]` do envio); a ordem da lista é a embaralhada desta sessão.
 * NÃO diz o lado certo.
 */
export interface Cartao {
  indice: 0 | 1;
  texto: string;
  exemplo: string;
}

/** O bloco com os dois cartões — o que o Montador recebe em `sessao.blocos`. */
export interface BlocoDaChave extends Bloco {
  cartoes: Cartao[];
}

/** Um "confio / não confio" gravado. Vale o PRIMEIRO de cada par. */
export interface JulgamentoGravado {
  noticiaId: IdDeNoticia;
  tipo: TipoDePista;
  veredito: Veredito;
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
  edicao2: EdicaoDoEstudante | null;
  pistasAbertas: PistaAberta[];
  /** Os "confio / não confio" já marcados na mesa — o F5 reabre a pista com o veredito. */
  julgamentos: JulgamentoGravado[];
  /** A simulação da Chave já foi enviada. */
  simulada: boolean;
  /** A decisão diante do boato já foi registrada. */
  transferida: boolean;
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
  /** Os seis blocos na ordem da bandeja DESTA sessão, com os cartões; `null` antes de a revisão abrir. */
  blocos: BlocoDaChave[] | null;
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

/** `POST julgamento`: o veredito que VALE (o primeiro do par); `novo: false` = já havia um. */
export interface Julgamento extends JulgamentoGravado {
  novo: boolean;
}

/** Uma vaga da Chave MONTADA: o bloco, o lado de cada cartão NA ORDEM CANÔNICA, e o "se falhar". */
export interface VagaMontada {
  bloco: IdDeBloco;
  lados: [LadoDaCondicao, LadoDaCondicao];
  seFalhar: SeFalhar;
}

/** O corpo do `POST chave`: um envio, sem correção. */
export interface CorpoDaChave {
  vagas: VagaMontada[];
  repeticao: Repeticao;
}

/** A resposta do `POST chave`: só o estado — ela NÃO diz se a Chave está certa. */
export interface ChaveMontada {
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

// ──────────────────────────────────── a simulação e a transferência (3.0.0)

/** As pistas de uma matéria da simulação ou do boato — o texto vem inteiro no GET. */
export interface PistasDoTexto {
  fonte: string;
  data: string;
  autoria: string;
}

/** Uma matéria da simulação como a criança a recebe: sem imagem e sem o gabarito. */
export interface MateriaDaSimulacao {
  id: IdDeSimulacao;
  meio: Meio;
  veiculo: string;
  falante: string | null;
  manchete: string;
  resumo: string;
  pistas: PistasDoTexto;
}

/** Uma vaga da Chave DELA, como roteiro da simulação. `pulo` só na vaga com isca. */
export interface VagaDoRoteiro {
  bloco: IdDeBloco;
  rotulo: string;
  seFalhar: SeFalhar;
  pulo: string | null;
}

/** `GET simulacao`: as duas matérias e a Chave da criança. */
export interface SimulacaoDaTela {
  materias: MateriaDaSimulacao[];
  chave: { vagas: VagaDoRoteiro[]; repeticao: Repeticao };
}

/** Uma pista aberta na simulação, com a marcação (obrigatória ali). */
export interface PassoDaSimulacao {
  tipo: TipoDePista;
  veredito: Veredito;
}

/** O corpo do `POST simulacao`: por matéria, as pistas NA ORDEM em que ela abriu, e a decisão. */
export interface CorpoDaSimulacao {
  materias: { id: IdDeSimulacao; passos: PassoDaSimulacao[]; decisao: DecisaoDaSimulacao }[];
}

/** A resposta: o estado e a regra de REFERÊNCIA, igual para todos. */
export interface SimulacaoEnviada {
  estado: Estado;
  referencia: string;
}

/** `GET transferencia`: o boato e as três pistas dele. */
export interface TransferenciaDaTela {
  remetente: string;
  mensagem: string;
  pistas: PistasDoTexto;
}

/** O corpo do `POST transferencia`: as pistas abertas ANTES da decisão, na ordem, e a decisão. */
export interface CorpoDaTransferencia {
  pistas: TipoDePista[];
  decisao: DecisaoDaTransferencia;
}

export interface TransferenciaEnviada {
  estado: Estado;
}

/**
 * O que a peça da matéria ORIGINAL precisa para se desenhar — a notícia da mesa
 * e a matéria da simulação (com o `resumo` no lugar do `corpo`) cabem nela.
 */
export type MateriaNaTela = Pick<NoticiaPublica, "meio" | "veiculo" | "falante" | "manchete" | "corpo" | "legenda" | "imagem">;
