/**
 * O contrato desta experiência como o CLIENTE o vê — espelho declarado de
 * `apps/api/src/nina-noticia/contrato-de-rotas.ts` e `vocabulario.ts`. A
 * experiência não importa a api (o bundle é público), então as listas e os
 * campos que a tela lê moram aqui também, e `lib/espelho.test.ts` LÊ os
 * arquivos da api e reprova a divergência.
 *
 * O que NÃO está aqui, de propósito (regra 3): o gabarito dos carimbos
 * (K1–K6), a sequência certa da rotina e a regra do reparo. Os blocos e as
 * etiquetas descem com ids OPACOS e a bandeja da rotina vem embaralhada pelo
 * servidor — este arquivo só conhece o TIPO de cada um, nunca a ordem certa.
 */

export const EXP_ID = "exp03ef1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json`. O `versao.test.ts` compara os três (ADR-84).
 */
export const EXP_VERSION = "0.1.1";

/** O prefixo das rotas do módulo da api (`apps/api/src/nina-noticia`). */
export const ROTA = "/nina-noticia";

// ───────────────────────────────────────────────────────── o vocabulário

/**
 * Os passos, na ordem. `aposta` é nome INTERNO: na tela é "escolha" (ajuste do
 * PO de 27/10, spec §7.1) — nenhuma palavra visível diz "aposta".
 */
export const PASSOS = [
  "galeria",
  "aposta",
  "filtro",
  "omissao",
  "ficha",
  "carimbos",
  "reparo",
  "desfecho",
  "ponte",
  "rotina",
  "caso",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

export const ETAPAS = ["aposta", "filtro", "inspecao"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const SUPORTES = ["mural", "portal", "telao"] as const;
export type Suporte = (typeof SUPORTES)[number];

export const CAMPOS = ["quem", "onde", "quando"] as const;
export type Campo = (typeof CAMPOS)[number];

export const LUGARES = ["patio", "biblioteca", "quadra"] as const;
export type Lugar = (typeof LUGARES)[number];

export const PESSOAS = ["estudantes", "professores", "familias", "visitantes"] as const;
export type Pessoa = (typeof PESSOAS)[number];

export const DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
export type Dia = (typeof DIAS)[number];

/** Os valores de cada pastilha do filtro (E3). Quem/Quando NÃO são os da feira: a busca é honesta. */
export const VALORES_DO_FILTRO = {
  quem: ["professores", "familias", "visitantes"],
  onde: LUGARES,
  quando: ["segunda", "terca", "quarta"],
} as const satisfies Readonly<Record<Campo, readonly string[]>>;
export type ValorDoFiltro = (typeof VALORES_DO_FILTRO)[Campo][number];

export const CARIMBOS = ["v", "x", "duvida"] as const;
export type Carimbo = (typeof CARIMBOS)[number];

export const CARTOES_DA_INSPECAO = ["k1", "k2", "k3"] as const;
export const CARTOES_DO_CASO = ["k4", "k5", "k6"] as const;
export type CartaoDaInspecao = (typeof CARTOES_DA_INSPECAO)[number];
export type CartaoDoCaso = (typeof CARTOES_DO_CASO)[number];
export type Cartao = CartaoDaInspecao | CartaoDoCaso;

export const ETIQUETAS = ["patio", "estudantes", "sexta"] as const;
export type Etiqueta = (typeof ETIQUETAS)[number];

/** Os blocos da rotina — SÓ o tipo. A ordem desta lista não é a da esteira certa: é a do vocabulário. */
export type Bloco = "enquanto" | "pegar" | "se" | "ok" | "senao" | "revisar" | "fim";
/** Quantos blocos a esteira tem (sete vagas). */
export const VAGAS_DA_ESTEIRA = 7;

export const DESFECHOS = ["sucesso", "erro"] as const;
export type Desfecho = (typeof DESFECHOS)[number];

export type MarcaDaRotina = "ok" | "revisar";

export const FERRAMENTAS_DO_CASO = ["filtrar", "fotos", "fontes"] as const;
export type FerramentaDoCaso = (typeof FERRAMENTAS_DO_CASO)[number];

/** Os passos que a própria criança pede (`POST passo`). */
export const PASSOS_PEDIDOS = ["ficha", "ponte", "rotina"] as const;
export type PassoPedido = (typeof PASSOS_PEDIDOS)[number];

// ─────────────────────────────────────────────────────────────── os tempos

/** E1: com a foto aberta, 20 s sem tocar o cartaz → o cartaz pulsa. */
export const PULSO_DA_GALERIA_MS = 20_000;
/** E4-01: 15 s sem abrir a ficha → "Inspecionar Ficha" pulsa (e `dica`). */
export const PULSO_DA_INSPECAO_MS = 15_000;
/** O polling do portão da turma. */
export const POLLING_DO_GATE_MS = 3_000;
/** A simulação da rotina válida (contador 3 → 0). */
export const SIMULACAO_DA_ROTINA_MS = 1_800;

// ─────────────────────────────────────────────────────────── as respostas

export type Ficha = { quem: Pessoa | null; onde: Lugar | null; quando: Dia | null };

/** `url: null` = a imagem não existe (ou falhou): a tela desenha a ilustração SVG local. */
export type ImagemPublica = { url: string | null; alt: string };

export interface ReportagemPublica {
  id: string;
  suporte: Suporte;
  kicker: string;
  manchete: string;
  legenda: string;
  lugar: string;
  imagem: ImagemPublica;
}

export interface Estado {
  passo: Passo;
  etapa: Etapa;
  pausada: boolean;
  aguardandoOProfessor: boolean;
}

export interface Gate extends Estado {
  pacoteId: string;
  rodada: number;
}

export interface BlocoPublico {
  id: string;
  bloco: Bloco;
  rotulo: string;
}

export interface EtiquetaPublica {
  id: string;
  etiqueta: Etiqueta;
  rotulo: string;
}

export interface PassoDaSimulacao {
  manchete: string;
  marca: MarcaDaRotina;
  pendentes: number;
}

export interface MateriaDoCaso {
  id: "a" | "b";
  titulo: string;
  ficha: Ficha;
  imagem: ImagemPublica;
}

export interface FerramentaPublica {
  id: FerramentaDoCaso;
  rotulo: string;
  retorno: string;
  aviso: string | null;
}

export interface FichaExtra {
  manchete: string;
  ficha: Ficha;
  imagem: ImagemPublica;
}

export interface ResumoDaInvestigacao {
  suportes: { escolhidas: number };
  omissao: { encontradas: number; deFora: Suporte };
  reparo: { desfecho: Desfecho };
  automacao: { testes: number };
}

export interface Sessao extends Estado {
  pacoteId: string;
  rodada: number;
  passoDoEstudante: Passo;
  jornal: {
    tema: string;
    cartaz: { texto: string; imagem: ImagemPublica };
    reportagens: ReportagemPublica[];
  };
  selos: string[];
  previsao: { itens: string[]; travada: boolean };
  filtro: { encontradas: string[] } | null;
  ficha: { reportagemId: string; ficha: Ficha; aberta: boolean } | null;
  carimbos: {
    e4: Partial<Record<Cartao, Carimbo>> | null;
    e6: Partial<Record<Cartao, Carimbo>> | null;
  };
  reparo: {
    etiquetas: EtiquetaPublica[];
    enviada: Partial<Record<Campo, string>> | null;
    desfecho: Desfecho | null;
  } | null;
  rotina: {
    blocos: BlocoPublico[];
    valida: boolean;
    simulacao: PassoDaSimulacao[] | null;
  } | null;
  caso: {
    tema: string;
    materias: MateriaDoCaso[];
    ferramentas: FerramentaPublica[];
  } | null;
  fim: {
    resumo: ResumoDaInvestigacao;
    desafioExtra: FichaExtra[];
  } | null;
  concluida: boolean;
}

export interface RespostaDosSelos extends Estado {
  selos: string[];
}

export interface RespostaDoFiltro extends Estado {
  encontradas: string[];
  total: number;
}

export interface RespostaDaFicha extends Estado {
  ficha: { reportagemId: string; ficha: Ficha };
}

export interface RespostaDoReparo extends Estado {
  desfecho: Desfecho;
}

export interface RespostaDaRotina extends Estado {
  valida: boolean;
  simulacao: PassoDaSimulacao[] | null;
}

export interface RespostaDoConcluir extends Estado {
  resumo: ResumoDaInvestigacao;
}

// ─────────────────────────────────────────────────────────── as entradas

export type PedidoDoFiltro =
  | { campo: "quem"; valor: (typeof VALORES_DO_FILTRO)["quem"][number] }
  | { campo: "onde"; valor: (typeof VALORES_DO_FILTRO)["onde"][number] }
  | { campo: "quando"; valor: (typeof VALORES_DO_FILTRO)["quando"][number] };

export type PedidoDosCarimbos =
  | { etapa: "e4"; carimbos: Record<CartaoDaInspecao, Carimbo> }
  | { etapa: "e6"; carimbos: Record<CartaoDoCaso, Carimbo> };

/** A ficha do telão MONTADA: o id da etiqueta em cada campo. */
export type FichaMontada = Record<Campo, string>;
