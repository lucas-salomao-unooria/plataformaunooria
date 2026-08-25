import {
  COLEGAS,
  INSCRITOS_POR_CONFIAVEL,
  INSCRITOS_POR_FAKE,
  LIMITE_SALVOS,
  ehFactual,
} from "./catalogo";
import type { CodigoErro } from "./erros";

/**
 * Regras da missão — funções PURAS, sem Prisma nem HTTP. O service aplica uma
 * regra sobre o estado lido com lock e persiste o resultado; os testes
 * unitários batem direto aqui.
 *
 * A mecânica (herdada do UnooTube original):
 *  - o aluno salva até 3 vídeos; fake vale 1000 inscritos, confiável vale 50
 *    e conta 1 "fonte confiável";
 *  - ao 3º salvo o ranking desbloqueia (latch — remover depois não tranca);
 *  - "adicionar credibilidade" é a conclusão pedagógica: reordena o ranking
 *    por fontes e CONGELA os salvos (a pontuação já foi reportada como score
 *    da experiência — nota e estado não podem divergir, regra 3). Curtir
 *    segue livre; reiniciar descongela.
 */

export interface EstadoSessao {
  salvos: string[];
  curtidos: string[];
  rankingDesbloqueado: boolean;
  credibilidadeAdicionada: boolean;
  concluidoEm: Date | null;
}

export interface Derivados {
  inscritos: number;
  fontesConfiaveis: number;
  salvos: number;
  vagas: number;
}

export const ESTADO_INICIAL: EstadoSessao = {
  salvos: [],
  curtidos: [],
  rankingDesbloqueado: false,
  credibilidadeAdicionada: false,
  concluidoEm: null,
};

export type ResultadoRegra =
  | { ok: true; estado: EstadoSessao; mudou: boolean }
  | { ok: false; codigo: CodigoErro };

const semMudanca = (estado: EstadoSessao): ResultadoRegra => ({ ok: true, estado, mudou: false });
const mudou = (estado: EstadoSessao): ResultadoRegra => ({ ok: true, estado, mudou: true });
const falha = (codigo: CodigoErro): ResultadoRegra => ({ ok: false, codigo });

export function derivados(salvos: readonly string[]): Derivados {
  const fontesConfiaveis = salvos.filter((id) => ehFactual(id)).length;
  const fakes = salvos.length - fontesConfiaveis;
  return {
    inscritos: fakes * INSCRITOS_POR_FAKE + fontesConfiaveis * INSCRITOS_POR_CONFIAVEL,
    fontesConfiaveis,
    salvos: salvos.length,
    vagas: Math.max(0, LIMITE_SALVOS - salvos.length),
  };
}

export function aplicarSalvar(estado: EstadoSessao, videoId: string): ResultadoRegra {
  if (estado.salvos.includes(videoId)) return semMudanca(estado);
  if (estado.credibilidadeAdicionada) return falha("MISSAO_CONCLUIDA");
  if (estado.salvos.length >= LIMITE_SALVOS) return falha("LIMITE_SALVOS");
  const salvos = [...estado.salvos, videoId];
  return mudou({
    ...estado,
    salvos,
    rankingDesbloqueado: estado.rankingDesbloqueado || salvos.length === LIMITE_SALVOS,
  });
}

export function aplicarRemover(estado: EstadoSessao, videoId: string): ResultadoRegra {
  if (!estado.salvos.includes(videoId)) return semMudanca(estado);
  if (estado.credibilidadeAdicionada) return falha("MISSAO_CONCLUIDA");
  return mudou({ ...estado, salvos: estado.salvos.filter((id) => id !== videoId) });
}

export function alternarCurtida(estado: EstadoSessao, videoId: string): ResultadoRegra {
  const curtidos = estado.curtidos.includes(videoId)
    ? estado.curtidos.filter((id) => id !== videoId)
    : [...estado.curtidos, videoId];
  return mudou({ ...estado, curtidos });
}

export function aplicarCredibilidade(estado: EstadoSessao, agora: Date): ResultadoRegra {
  if (!estado.rankingDesbloqueado) return falha("RANKING_BLOQUEADO");
  if (estado.credibilidadeAdicionada) return semMudanca(estado);
  return mudou({ ...estado, credibilidadeAdicionada: true, concluidoEm: agora });
}

export function aplicarReinicio(): ResultadoRegra {
  return mudou({ ...ESTADO_INICIAL, salvos: [], curtidos: [] });
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface RankingLinha {
  id: string;
  nome: string;
  avatar: string;
  accent: string;
  fontesConfiaveis: number;
  inscritos: number;
  voce: boolean;
}

/** Colegas fictícios sempre têm 3 salvos: o que não é fonte confiável é fake. */
export function inscritosDoColega(fontesConfiaveis: number): number {
  return (
    fontesConfiaveis * INSCRITOS_POR_CONFIAVEL +
    (LIMITE_SALVOS - fontesConfiaveis) * INSCRITOS_POR_FAKE
  );
}

export function montarRanking(
  aluno: { nome: string; avatar?: string | null },
  salvos: readonly string[],
): RankingLinha[] {
  const d = derivados(salvos);
  const voce: RankingLinha = {
    id: "voce",
    nome: aluno.nome,
    avatar: (aluno.avatar ?? aluno.nome.trim().charAt(0) ?? "?").toUpperCase(),
    accent: "blue",
    fontesConfiaveis: d.fontesConfiaveis,
    inscritos: d.inscritos,
    voce: true,
  };
  return [
    ...COLEGAS.map((c) => ({
      id: c.id,
      nome: c.nome,
      avatar: c.avatar,
      accent: c.accent,
      fontesConfiaveis: c.fontesConfiaveis,
      inscritos: inscritosDoColega(c.fontesConfiaveis),
      voce: false,
    })),
    voce,
  ];
}

const porNome = (a: RankingLinha, b: RankingLinha) =>
  a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });

/** Desempates determinísticos: o client reproduz a mesma ordem na animação. */
export function ordenarPorInscritos(linhas: readonly RankingLinha[]): RankingLinha[] {
  return [...linhas].sort((a, b) => b.inscritos - a.inscritos || porNome(a, b));
}

export function ordenarPorFontes(linhas: readonly RankingLinha[]): RankingLinha[] {
  return [...linhas].sort(
    (a, b) => b.fontesConfiaveis - a.fontesConfiaveis || a.inscritos - b.inscritos || porNome(a, b),
  );
}

/** Posições 1-based do aluno nas duas ordenações. */
export function posicaoDoAluno(linhas: readonly RankingLinha[]): {
  porInscritos: number;
  porFontes: number;
} {
  return {
    porInscritos: ordenarPorInscritos(linhas).findIndex((l) => l.voce) + 1,
    porFontes: ordenarPorFontes(linhas).findIndex((l) => l.voce) + 1,
  };
}

// ---------------------------------------------------------------------------
// Visão do professor
// ---------------------------------------------------------------------------

export interface LinhaTurma {
  alunoId: string;
  nome: string;
  usuario: string;
  iniciou: boolean;
  salvos: number;
  fontesConfiaveis: number;
  inscritos: number;
  rankingDesbloqueado: boolean;
  credibilidadeAdicionada: boolean;
  concluidoEm: string | null;
}

export interface ResumoTurma {
  total: number;
  iniciaram: number;
  desbloquearamRanking: number;
  concluiram: number;
  /** Só entre os que concluíram: quantos fecharam com 0, 1, 2 ou 3 fontes. */
  distribuicaoFontes: Record<"0" | "1" | "2" | "3", number>;
  mediaFontesConcluidos: number | null;
}

export function resumirTurma(linhas: readonly LinhaTurma[]): ResumoTurma {
  const concluidos = linhas.filter((l) => l.credibilidadeAdicionada);
  const distribuicaoFontes: ResumoTurma["distribuicaoFontes"] = { "0": 0, "1": 0, "2": 0, "3": 0 };
  for (const l of concluidos) {
    const chave = String(Math.min(3, Math.max(0, l.fontesConfiaveis))) as keyof typeof distribuicaoFontes;
    distribuicaoFontes[chave] += 1;
  }
  const soma = concluidos.reduce((acc, l) => acc + l.fontesConfiaveis, 0);
  return {
    total: linhas.length,
    iniciaram: linhas.filter((l) => l.iniciou).length,
    desbloquearamRanking: linhas.filter((l) => l.rankingDesbloqueado).length,
    concluiram: concluidos.length,
    distribuicaoFontes,
    mediaFontesConcluidos: concluidos.length ? Math.round((soma / concluidos.length) * 100) / 100 : null,
  };
}
