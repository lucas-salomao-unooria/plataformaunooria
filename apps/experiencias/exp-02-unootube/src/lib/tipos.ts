/**
 * Espelho dos tipos de resposta de `apps/api/src/unootube` — o que atravessa a
 * rede. Note a ausência de `factual`: o gabarito não existe deste lado.
 */
export const EXP_ID = "exp-02-unootube";
export const EXP_VERSION = "1.0.0";

export interface VideoPublico {
  id: string;
  arquivo: string;
  titulo: string;
  descricao: string;
  handle: string;
  inscritosRotulo: string;
  avatar: string;
  accent: string;
}

export interface EstadoMissao {
  salvos: string[];
  curtidos: string[];
  rankingDesbloqueado: boolean;
  credibilidadeAdicionada: boolean;
  concluidoEm: string | null;
}

export interface Derivados {
  inscritos: number;
  fontesConfiaveis: number;
  salvos: number;
  vagas: number;
}

export interface RespostaEstado {
  estado: EstadoMissao;
  derivados: Derivados;
  limiteSalvos: number;
}

export interface RankingLinha {
  id: string;
  nome: string;
  avatar: string;
  accent: string;
  fontesConfiaveis: number;
  inscritos: number;
  voce: boolean;
}

export interface RespostaRanking {
  linhas: RankingLinha[];
  posicao: { porInscritos: number; porFontes: number };
}

export interface RespostaSessao extends RespostaEstado {
  catalogo: { videos: VideoPublico[] };
  aluno: { nome: string; avatar: string };
  ranking: RespostaRanking | null;
}

export type Tela = "feed" | "playlists" | "ranking" | "perfil";
export type AbaPlaylists = "salvos" | "curtidos";
export type ModoRanking = "confiaveis" | "inscritos";
