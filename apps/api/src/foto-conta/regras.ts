/**
 * Regras PURAS da exp01ef1b — sem banco, sem IA, sem relógio próprio.
 *
 * Tudo aqui é chamado pelo service e provado em `tests/foto-conta-regras.spec.ts`
 * sem Postgres. A máquina de etapas anda numa direção só: esta missão não tem
 * "voltar" (o público tem 6 anos e o roteiro é uma aula única) — corrigir uma
 * turma é o reset do professor, nunca um retrocesso por estudante.
 */
import {
  ETAPAS,
  GABARITO_REFLEXAO,
  HESITACAO_MS,
  type ComentariosDoPar,
  type Etapa,
  type OpcaoReflexao,
  type PacoteDaTurma,
} from "./catalogo";

/** Posição da etapa na ordem canônica (-1 para valor desconhecido). */
export function indiceDaEtapa(etapa: string): number {
  return (ETAPAS as readonly string[]).indexOf(etapa);
}

/**
 * A run só anda UM passo por vez e sempre para a frente. O servidor recusa
 * pulo (`feed` → `aha`) e retrocesso: a ordem da missão é instrumento, não
 * conveniência de navegação.
 */
export function podeAvancar(de: Etapa, para: Etapa): boolean {
  const i = indiceDaEtapa(de);
  const j = indiceDaEtapa(para);
  return i >= 0 && j === i + 1;
}

/** As etapas em que a criança está DENTRO do clone (fora delas quem fala é a
 *  casca Unooria). Útil ao cliente e ao painel; a fronteira vem do mapa
 *  "quem está falando" do handoff. */
export const ETAPAS_NO_CLONE: readonly Etapa[] = ["feed", "decidir", "aha"];

/**
 * A linha da matriz causal para o par escolhido.
 *
 * É determinística de propósito (não-negociável 1 do handoff): o mesmo par
 * devolve sempre os mesmos comentários — um F5 não pode mostrar o colega
 * reagindo de outro jeito à mesma foto.
 */
export function comentariosDe(
  pacote: PacoteDaTurma,
  fotoId: string,
  legendaId: string,
): ComentariosDoPar | null {
  return (
    pacote.comentarios.find((c) => c.fotoId === fotoId && c.legendaId === legendaId) ?? null
  );
}

/** A escolha é válida dentro DESTE pacote? (foto do par + legenda do par —
 *  ids fora do pacote são payload forjado, não clique.) */
export function escolhaValida(pacote: PacoteDaTurma, fotoId: string, legendaId: string): boolean {
  const foto = fotoId === pacote.par.fotoAId || fotoId === pacote.par.fotoBId;
  const legenda = pacote.legendas.some((l) => l.id === legendaId);
  return foto && legenda;
}

/** A reflexão conclui? `lupa` conclui; `globo` é retry formativo (sem nota,
 *  sem punição — o contador existe para o professor ver quem precisou do
 *  segundo olhar). */
export function reflexaoConclui(escolha: OpcaoReflexao): boolean {
  return escolha === GABARITO_REFLEXAO;
}

/* ------------------------------ painel ao vivo ---------------------------- */

/** O que o painel precisa de cada run para montar o resumo — nunca o nome:
 *  a hidratação é da rota do professor (DAD-07). */
export interface RunParaPainel {
  estudanteId: string;
  etapa: Etapa;
  fotoEscolhidaId: string | null;
  legendaEscolhidaId: string | null;
  atualizadoEm: Date;
}

export interface ResumoDaTurma {
  conectados: number;
  publicaram: number;
  noLatch: number;
  concluiram: number;
  /** Contagem por foto do par (chave = fotoId). */
  porFoto: Record<string, number>;
  /** Contagem por legenda (chave = legendaId). */
  porLegenda: Record<string, number>;
  /** Ids (opacos) de quem está parado há mais de 60s na tela de decisão. */
  hesitando: string[];
}

/**
 * O resumo do dashboard docente, computado de uma lista de runs da tentativa
 * corrente. "Hesitação" é run parada na etapa `decidir` há mais de
 * `HESITACAO_MS` — o dado que vira a lista de mediação de leitura.
 */
export function resumoDaTurma(runs: RunParaPainel[], agora: Date): ResumoDaTurma {
  const porFoto: Record<string, number> = {};
  const porLegenda: Record<string, number> = {};
  const hesitando: string[] = [];
  let publicaram = 0;
  let noLatch = 0;
  let concluiram = 0;

  for (const r of runs) {
    if (r.fotoEscolhidaId) {
      porFoto[r.fotoEscolhidaId] = (porFoto[r.fotoEscolhidaId] ?? 0) + 1;
      publicaram += 1;
    }
    if (r.legendaEscolhidaId) {
      porLegenda[r.legendaEscolhidaId] = (porLegenda[r.legendaEscolhidaId] ?? 0) + 1;
    }
    if (r.etapa === "roda") noLatch += 1;
    if (r.etapa === "concluida") concluiram += 1;
    if (r.etapa === "decidir" && agora.getTime() - r.atualizadoEm.getTime() > HESITACAO_MS) {
      hesitando.push(r.estudanteId);
    }
  }

  return {
    conectados: runs.length,
    publicaram,
    noLatch,
    concluiram,
    porFoto,
    porLegenda,
    hesitando,
  };
}
