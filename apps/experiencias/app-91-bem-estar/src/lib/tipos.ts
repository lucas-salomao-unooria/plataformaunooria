/** Espelho do que a api devolve em `/bemestar/*` (apps/api/src/bemestar). */

export type Faixa = "normal" | "leve" | "moderado" | "severo" | "extremamente-severo";

export interface ItemDoDia {
  numero: number;
  texto: string;
}

export interface OpcaoDaEscala {
  valor: 0 | 1 | 2 | 3;
  rotulo: string;
  curto: string;
}

export interface Checkin {
  id: string;
  numero: number;
  total: number;
  dia: string;
  status: "pendente" | "respondido";
  itens: ItemDoDia[];
  abertura: string;
  pergunta: string;
  respostas: Array<{ item: number; valor: number }> | null;
  textoLivre: string | null;
  acolhimento: string | null;
  sinalDeApoio: boolean;
  respondidoEm: string | null;
}

export interface Ciclo {
  id: string;
  status: "aberto" | "concluido" | "expirado";
  respondidos: number;
  total: number;
  iniciadoEm: string;
  expiraEm: string;
}

export interface Dimensao {
  subescala: "depressao" | "ansiedade" | "estresse";
  rotulo: string;
  pontos: number;
  faixa: Faixa;
  faixaRotulo: string;
  leitura: string;
}

export interface Resultado {
  dimensoes: Dimensao[];
  aviso: string;
}

export interface Apoio {
  titulo: string;
  texto: string;
  recursos: ReadonlyArray<{ nome: string; detalhe: string }>;
}

export interface Hoje {
  checkin: Checkin;
  ciclo: Ciclo | null;
  resultado: Resultado | null;
  apoio: Apoio | null;
  escala: OpcaoDaEscala[];
  instrucao: string;
  aviso: string;
}

export interface RespostaResponder {
  checkin: Checkin;
  acolhimento: string;
  sinalDeApoio: boolean;
  apoio: Apoio | null;
  ciclo: Ciclo;
  resultado: Resultado | null;
}

export interface Historico {
  ciclos: Array<{ id: string; iniciadoEm: string; concluidoEm: string | null; resultado: Resultado }>;
  anotacoes: Array<{
    id: string;
    dia: string;
    numero: number;
    cicloId: string;
    textoLivre: string | null;
    acolhimento: string | null;
    sinalDeApoio: boolean;
  }>;
  aviso: string;
}
