/**
 * O contrato de `GET /recursos/custos-de-ia` e `/recursos/custos-de-ia/precos`
 * (ADR-161), do lado do hub. A fonte é o Zod de
 * `apps/api/src/recursos/contrato-de-rotas.ts` (`PainelDeCustosSchema`,
 * `PrecosDeIaSchema`): mudou lá, muda aqui.
 */

export type Modalidade = "texto" | "imagem" | "audio" | "video";
export type ComponenteDePreco = "entrada" | "saida" | "minuto";

export interface NumerosDoGrupo {
  usd: number;
  brl: number | null;
  tokensEntrada: number;
  tokensSaida: number;
  chamadas: number;
  falhas: number;
  imagens: number;
  segundos: number;
  minutos: number;
  estimado: boolean;
  semPreco: boolean;
  semCotacao: boolean;
}

export interface Cotacao {
  dia: string;
  compra: number;
  venda: number;
  cotadoEm: string;
}

export interface PainelDeCustos {
  periodo: { de: string; ate: string };
  cotacao: { ultima: Cotacao | null; falhou: boolean; fonte: string };
  totais: {
    usd: number;
    brl: number | null;
    tokensEntrada: number;
    tokensSaida: number;
    chamadas: number;
    falhas: number;
    imagens: number;
    segundosDeAudio: number;
    minutosDeVideo: number;
  };
  porDia: Array<NumerosDoGrupo & { dia: string }>;
  porRecurso: Array<NumerosDoGrupo & { recurso: string; nome: string }>;
  porModelo: Array<NumerosDoGrupo & { modelo: string; modalidade: Modalidade }>;
  porModalidade: Array<NumerosDoGrupo & { modalidade: Modalidade }>;
  porEscola: Array<NumerosDoGrupo & { escolaId: string; nome: string }>;
  modelosSemPreco: string[];
}

export interface PrecoDeIa {
  id: string;
  modelo: string;
  componente: ComponenteDePreco;
  usd: number;
  vigenteDesde: string;
  motivo: string | null;
  definidoPorNome: string | null;
  definidoEm: string;
}

export interface PrecosDeIa {
  precos: PrecoDeIa[];
  modelosEmUso: string[];
}
