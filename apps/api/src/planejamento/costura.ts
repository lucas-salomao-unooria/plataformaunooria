import { habilidadePorCodigo } from "../curriculo/consulta";
import type { DataCivil } from "./calendario";
import type { Aula } from "./contrato-de-rotas";

/**
 * A costura entre o que o modelo devolveu e as aulas que existem de verdade.
 *
 * Mora num módulo próprio porque é onde estão as decisões que o produto não pode
 * errar, e nenhuma delas é testável através de uma chamada de IA:
 *
 * 1. O ESQUELETO é do calendário, não do modelo. Número, data, dia e horário
 *    vêm da grade real do professor. Se o modelo devolver 8 aulas para uma
 *    semana de 3, a sobra é descartada; se devolver 1, as outras 2 nascem em
 *    branco para o professor preencher. Assim uma resposta malformada degrada
 *    para "planejar à mão" em vez de para uma semana com aulas em dias que não
 *    existem.
 *
 * 2. Código de habilidade fora do recorte é REMOVIDO, não corrigido. É a
 *    terceira e última barreira contra um `EF67LP42` inventado chegar ao
 *    documento — as outras duas são o prompt e o `PUT .../distribuicao`.
 *    Nenhuma sozinha basta: o prompt é instrução, não garantia; a distribuição
 *    valida o que o professor escolheu, não o que o modelo escreveu depois.
 *
 * 3. Campo ausente vira string VAZIA, nunca `undefined`. Ausente na tela é
 *    indistinguível de "o professor ainda não preencheu"; vazio diz "foi
 *    considerado e não há", que é informação diferente.
 */

export interface HorarioDeAula {
  readonly numero: number;
  readonly data: DataCivil;
  readonly diaDaSemana: number;
  readonly horario: string;
}

export function costurarAulas(
  doModelo: readonly Partial<Aula>[],
  horarios: readonly HorarioDeAula[],
  permitidos: ReadonlySet<string>,
): Aula[] {
  const porNumero = new Map<number, Partial<Aula>>();
  for (const a of doModelo) {
    if (typeof a?.numero === "number" && !porNumero.has(a.numero)) porNumero.set(a.numero, a);
  }

  return horarios.map((h, i) => {
    // Casa por `numero` quando o modelo respeitou a numeração; cai para a ordem
    // quando ele a ignorou (acontece, e a ordem é o que se conserva).
    const m = porNumero.get(h.numero) ?? doModelo[i] ?? {};
    return {
      numero: h.numero,
      data: h.data,
      diaDaSemana: h.diaDaSemana,
      horario: h.horario,
      tema: texto(m.tema, 200),
      objetivo: texto(m.objetivo, 2000),
      habilidades: habilidadesValidas(m.habilidades, permitidos),
      conteudo: texto(m.conteudo, 4000),
      momentos: {
        retomada: momento(m.momentos?.retomada),
        desenvolvimento: momento(m.momentos?.desenvolvimento),
        sistematizacao: momento(m.momentos?.sistematizacao),
        fechamento: momento(m.momentos?.fechamento),
      },
      recursos: Array.isArray(m.recursos)
        ? m.recursos.slice(0, 20).map((r) => texto(r, 200)).filter(Boolean)
        : [],
      avaliacao: texto(m.avaliacao, 2000),
      tarefaDeCasa: texto(m.tarefaDeCasa, 2000),
      adaptacoes: texto(m.adaptacoes, 2000),
      // Nunca vêm do modelo: são o registro do que o professor fez DEPOIS da aula.
      cumprida: false,
      observacaoDoProfessor: "",
    };
  });
}

/**
 * Sobrevive só o código que está no recorte E existe no catálogo. A dupla
 * checagem não é redundante: `permitidos` guarda contra habilidade de OUTRO
 * período, e o catálogo guarda contra código que não existe em lugar nenhum.
 */
function habilidadesValidas(
  codigos: readonly string[] | undefined,
  permitidos: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(codigos)) return [];
  const vistos = new Set<string>();
  const validos: string[] = [];
  for (const bruto of codigos) {
    if (typeof bruto !== "string") continue;
    const c = bruto.trim().toUpperCase();
    if (vistos.has(c)) continue;
    if (!permitidos.has(c) || !habilidadePorCodigo(c)) continue;
    vistos.add(c);
    validos.push(c);
  }
  return validos.slice(0, 20);
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Minutos fora de [0, 120] é erro de unidade (segundos, ou a aula inteira). */
const momento = (m?: { o_que?: string; minutos?: number }) => ({
  o_que: texto(m?.o_que, 4000),
  minutos: Math.max(0, Math.min(120, Math.round(Number(m?.minutos) || 0))),
});
