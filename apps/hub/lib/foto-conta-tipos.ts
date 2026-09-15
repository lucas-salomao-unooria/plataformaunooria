/**
 * O que o hub lê da exp-04 — espelho do contrato do PROFESSOR em
 * `apps/api/src/foto-conta/contrato-de-rotas.ts`. Só o lado docente: o lado do
 * estudante vive no bundle da experiência.
 */

export type TemaDaFoto = "recreio" | "nossa_horta" | "sala_de_aula" | "parquinho";
export type ComplexidadeDaFoto = "nivel_1" | "nivel_2";

export const ROTULO_DO_TEMA: Record<TemaDaFoto, string> = {
  recreio: "Pátio do Recreio (Padrão)",
  nossa_horta: "Horta Escolar",
  sala_de_aula: "Sala de Aula",
  parquinho: "Parquinho",
};

export const ROTULO_DA_COMPLEXIDADE: Record<ComplexidadeDaFoto, string> = {
  nivel_1: "Palavras curtas em CAIXA ALTA (1º ano início)",
  nivel_2: "Frases simples (1º ano consolidado)",
};

export interface LegendaDoParDoHub {
  id: "legenda_1" | "legenda_2";
  texto: string;
  icone: "bloco" | "vassoura";
}

export interface ComentariosDoParDoHub {
  fotoId: string;
  legendaId: string;
  leo: string;
  sofia: string;
}

/** O pacote COMPLETO (o preview do professor traz a matriz — é o material da
 *  mediação dele; do estudante ela continua escondida até a publicação). */
export interface PacoteDaTurmaDoHub {
  tema: TemaDaFoto;
  feed: Array<{ id: string; fotoId: string; legenda: string }>;
  par: { fotoAId: string; fotoBId: string };
  legendas: [LegendaDoParDoHub, LegendaDoParDoHub];
  comentarios: ComentariosDoParDoHub[];
}

export interface TurmaDaFoto {
  id: string;
  nome: string;
  serie: string;
  estudantes: number;
}

export interface PainelDaFoto {
  turma: { id: string; nome: string; serie: string };
  tema: TemaDaFoto;
  complexidade: ComplexidadeDaFoto;
  statusPacote: "pendente" | "pronto";
  pacoteDaIa: boolean;
  latchLiberado: boolean;
  tentativa: number;
  resumo: {
    conectados: number;
    publicaram: number;
    noLatch: number;
    concluiram: number;
    porFoto: Record<string, number>;
    porLegenda: Record<string, number>;
  };
  hesitando: Array<{ id: string; nome: string }>;
}

export interface ProjecaoDaFoto {
  fotoAId: string;
  fotoBId: string;
  legendas: [LegendaDoParDoHub, LegendaDoParDoHub];
  rotulos: { meio: string; fora: string };
  perguntas: string[];
  tema: TemaDaFoto;
  latchLiberado: boolean;
  conectados: number;
  noLatch: number;
}
