import {
  PARIDADE,
  PISO_DE_ENCAMINHAMENTOS,
  TONS_EMOCIONAIS,
  TOTAL_DE_MENSAGENS,
  VERACIDADES,
  resumoDaMensagem,
  type MensagemDoLote,
  type Veracidade,
} from "../catalogo";

/**
 * As regras PURAS da curadoria — sem Prisma, sem HTTP.
 *
 * Três coisas moram aqui e nenhuma pode viver no cliente:
 *
 * 1. **A paridade do lote** (3/3/2). É o que a IA tem de respeitar e o que a
 *    homologação confere — um lote torto é um 400, nunca uma aula torta.
 * 2. **A porta do Mural**: 3 encaminhamentos E a leitura integral. O botão da
 *    tela já fica inerte, mas a regra vale no servidor, porque
 *    `/quem-mandou-isso/confirmar` é endereço alcançável.
 * 3. **A conta da turma**: o histograma anonimizado do telão e a síntese do
 *    card da Etapa 5. Só quem CONFIRMOU entra na conta — o latch é o dado.
 */

// ─────────────────────────────────────────────────────────────── paridade

export type ResultadoDaParidade =
  | { ok: true }
  | { ok: false; codigo: "lote-paridade-invalida"; contagem: Record<Veracidade, number> };

export function validarParidade(
  mensagens: ReadonlyArray<Pick<MensagemDoLote, "veracidade">>,
): ResultadoDaParidade {
  const contagem: Record<Veracidade, number> = { verdadeira: 0, falsa: 0, ambigua: 0 };
  for (const m of mensagens) contagem[m.veracidade] += 1;
  const ok =
    mensagens.length === TOTAL_DE_MENSAGENS &&
    VERACIDADES.every((v) => contagem[v] === PARIDADE[v]);
  return ok ? { ok: true } : { ok: false, codigo: "lote-paridade-invalida", contagem };
}

// ──────────────────────────────────────────────────────── a porta do Mural

export interface EstadoDaCuradoria {
  encaminhadas: string[];
  total: number;
  atingiuPiso: boolean;
  faltam: number;
  leuTudo: boolean;
  /** As duas condições juntas: é o que libera "Ver Mural" e "Confirmar envio". */
  podeConfirmar: boolean;
  /** O caminho degenerado "escolheu tudo": o card do Mural vira atrito, sem trava. */
  encaminhouTudo: boolean;
}

export function estadoDaCuradoria(
  encaminhadas: readonly string[],
  leuTudo: boolean,
): EstadoDaCuradoria {
  const distintas = [...new Set(encaminhadas)];
  const atingiuPiso = distintas.length >= PISO_DE_ENCAMINHAMENTOS;
  return {
    encaminhadas: distintas,
    total: distintas.length,
    atingiuPiso,
    faltam: Math.max(0, PISO_DE_ENCAMINHAMENTOS - distintas.length),
    leuTudo,
    podeConfirmar: atingiuPiso && leuTudo,
    encaminhouTudo: distintas.length >= TOTAL_DE_MENSAGENS,
  };
}

// ───────────────────────────────────────────────────────── a conta da turma

export interface BarraDoHistograma {
  id: string;
  remetente: string;
  tipo: MensagemDoLote["tipo"];
  resumo: string;
  veracidade: Veracidade;
  explicacao: string;
  /** Quantos estudantes CONFIRMADOS encaminharam esta mensagem. */
  total: number;
  /** `total` sobre os confirmados, 0–100 e inteiro. Zero confirmados = 0. */
  percentual: number;
}

/**
 * Para que lado a turma pendeu — o que decide o texto do card da Etapa 5.
 *
 * O PRD pede "adaptação dinâmica caso a turma apresente comportamento atípico
 * de filtragem": se as informativas ganharam, o card não pode afirmar que a
 * urgência venceu. O servidor devolve a polaridade; a tela escolhe a frase.
 */
export type Polaridade = "urgencia-venceu" | "informativas-venceram" | "empate";

export interface SinteseDaSala {
  /** Encaminhamentos de mensagens `alarmista` ou `urgente`, somados. */
  emocionais: number;
  /** Encaminhamentos de mensagens `neutro` ou `ponderado`, somados. */
  informativas: number;
  polaridade: Polaridade;
}

export interface ContaDaTurma {
  totalConfirmados: number;
  histograma: BarraDoHistograma[];
  sintese: SinteseDaSala;
}

/**
 * A conta da turma a partir dos snapshots CONFIRMADOS.
 *
 * `snapshots` é a lista de listas de ids, um por estudante que apertou
 * "Confirmar envio". Quem não confirmou não entra: contar a curadoria em
 * andamento de alguém no histograma mostraria à turma uma escolha que a criança
 * ainda podia desfazer.
 *
 * Nenhum nome chega aqui, e não por disciplina: a assinatura não tem lugar para
 * ele. É a anonimização do telão sendo estrutural (PED-07).
 */
export function contaDaTurma(
  lote: readonly MensagemDoLote[],
  snapshots: ReadonlyArray<readonly string[]>,
): ContaDaTurma {
  const totalConfirmados = snapshots.length;
  const porMensagem = new Map<string, number>(lote.map((m) => [m.id, 0]));
  for (const snapshot of snapshots) {
    for (const id of new Set(snapshot)) {
      if (porMensagem.has(id)) porMensagem.set(id, (porMensagem.get(id) ?? 0) + 1);
    }
  }

  const histograma = lote.map((m) => {
    const total = porMensagem.get(m.id) ?? 0;
    return {
      id: m.id,
      remetente: m.remetente,
      tipo: m.tipo,
      resumo: resumoDaMensagem(m),
      veracidade: m.veracidade,
      explicacao: m.explicacao,
      total,
      percentual: totalConfirmados === 0 ? 0 : Math.round((total / totalConfirmados) * 100),
    };
  });

  let emocionais = 0;
  let informativas = 0;
  for (const m of lote) {
    const total = porMensagem.get(m.id) ?? 0;
    if (TONS_EMOCIONAIS.includes(m.tom)) emocionais += total;
    else informativas += total;
  }
  const polaridade: Polaridade =
    emocionais > informativas
      ? "urgencia-venceu"
      : emocionais < informativas
        ? "informativas-venceram"
        : "empate";

  return { totalConfirmados, histograma, sintese: { emocionais, informativas, polaridade } };
}
