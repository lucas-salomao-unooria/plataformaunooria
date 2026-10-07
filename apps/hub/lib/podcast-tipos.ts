/**
 * O podcast de recapitulação de toda missão (ADR-150) — espelho de
 * `apps/api/src/podcast/contrato-de-rotas.ts`. As rotas são únicas
 * (`/podcast/:expId/turmas/:turmaId`), e a missão entra pelo código.
 */

/** Uma fala do roteiro: quem fala, como o roteiro o chama, e o texto. */
export interface FalaDoPodcast {
  falante: string;
  texto: string;
}

/** `GET /podcast/:expId/turmas/:turmaId` — o roteiro (a transcrição) e o estado do áudio. */
export interface PodcastDaAtividade {
  atividadeId: string;
  tema: string;
  /** "Jornal da Escola — o podcast de recapitulação". */
  titulo: string;
  /** "Lucas e Clara · cerca de 3 min 30 s". */
  descricao: string;
  roteiro: Array<{ bloco: string; titulo: string; falas: FalaDoPodcast[] }>;
  trechos: { total: number; prontos: number };
  /** O episódio inteiro, quando todos os trechos já foram sintetizados e emendados. */
  url: string | null;
}

/** `POST …/gerar` — o progresso de UMA chamada (um trecho, e a emenda no fim). */
export interface ProgressoDoPodcast extends PodcastDaAtividade {
  gerado: string | null;
  falhou: string | null;
  completo: boolean;
}

/** Uma fala que muda com o tema, como a tela de customização a mostra. */
export interface VagaDoPodcast {
  id: string;
  falante: string;
  /** Completa "Lucas, sobre …". */
  sobre: string;
  texto: string;
}

/**
 * `POST …/falas-do-tema` — RASCUNHO, não persiste. `usouIa: false` = as do
 * banco padrão (o conteúdo é ele, ou a IA não respondeu: aí vem o `motivo`).
 */
export interface FalasEscritas {
  vagas: VagaDoPodcast[];
  usouIa: boolean;
  motivo: "sem-saldo-de-ia" | "ia-indisponivel" | null;
}

/** O que a homologação da missão recebe no campo `podcast`: `{ vaga: fala }`. */
export function falasParaHomologar(vagas: readonly VagaDoPodcast[]): Record<string, string> {
  return Object.fromEntries(vagas.map((v) => [v.id, v.texto.trim()]));
}

/**
 * O laço do "Gerar o áudio": a api sintetiza UM trecho por chamada (o episódio
 * não cabe no teto do BFF). Para quando o episódio existe, ou quando uma
 * chamada não andou — repetir aí é pedir de novo o trecho que o provedor acabou
 * de recusar, e cobrar da quota a cada volta.
 */
export function continuarGerandoPodcast(p: Pick<ProgressoDoPodcast, "completo" | "gerado">): boolean {
  return !p.completo && p.gerado !== null;
}

/** A linha de estado sob o player. */
export function textoDoProgressoDoPodcast(p: Pick<PodcastDaAtividade, "trechos" | "url">): string {
  if (p.url) return "O áudio está pronto.";
  if (p.trechos.prontos === 0) return "O áudio ainda não foi gerado.";
  return `${p.trechos.prontos} de ${p.trechos.total} trechos do áudio prontos.`;
}

// ─────────────────────────────────────────── a régua das falas do tema

/** Espelho de `apps/api/src/podcast/roteiro.ts`. */
export const PALAVRAS_DA_FALA = { min: 12, max: 60 } as const;
export const BYTES_DA_FALA = 400;

function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * O que impede UMA fala de ir para o áudio, na frase do campo — ou `null`. A
 * api confere de novo na aprovação (e é a palavra final); aqui é para o
 * professor ver o problema enquanto digita, no campo certo.
 */
export function problemaDaFala(texto: string): string | null {
  const n = palavras(texto);
  if (n === 0) return "A fala não pode ficar vazia.";
  if (/https?:\/\/|www\.|\.com\b|\.br\b/i.test(texto)) return "Tire o link: ele não se lê em voz alta.";
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(texto)) return "Tire o e-mail: ele não se lê em voz alta.";
  if (/(^|\s)@\w/.test(texto)) return "Escreva o nome por extenso, sem @.";
  if (/<<<|>>>/.test(texto)) return "Tire os sinais <<< e >>>.";
  if (new TextEncoder().encode(texto.trim()).length > BYTES_DA_FALA) return "Está longa demais para o áudio; encurte um pouco.";
  if (n < PALAVRAS_DA_FALA.min) return `Tem ${n} palavras; o mínimo é ${PALAVRAS_DA_FALA.min}.`;
  if (n > PALAVRAS_DA_FALA.max) return `Tem ${n} palavras; o máximo é ${PALAVRAS_DA_FALA.max}.`;
  return null;
}

/** A frase do aviso quando as falas voltaram do banco padrão num tema próprio. */
export function avisoDasFalas(f: Pick<FalasEscritas, "motivo">): string | null {
  if (f.motivo === "sem-saldo-de-ia") {
    return "O seu saldo de IA de hoje acabou, então as falas abaixo são as do banco da Unooria. Reescreva-as para contar o que a turma vai ver nesta atividade.";
  }
  if (f.motivo === "ia-indisponivel") {
    return "A geração automática não respondeu, então as falas abaixo são as do banco da Unooria. Reescreva-as para contar o que a turma vai ver nesta atividade, ou tente de novo.";
  }
  return null;
}
