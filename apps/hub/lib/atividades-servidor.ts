import "server-only";
import type { CoberturasDaTurma } from "./a-selecao-tipos";
import { apiDoServidor } from "./api-servidor";
import {
  atividadesDaSelecao,
  atividadesDoInstanooria,
  atividadesDoJornal,
  atividadesDoQuemMandou,
  ordenarAtividades,
  type AtividadeDoInstanooria,
  type AtividadeNaLista,
  type MissaoComAtividade,
} from "./entre-redes/atividades";
import type { PacotesDaTurma } from "./jornal-escola-tipos";
import type { PacoteDaTurma, PacotesDaTurmaQuemMandou } from "./quem-mandou-tipos";

/**
 * AS ATIVIDADES DA MISSÃO NUMA TURMA, lidas da api da missão (ADR-130) e já na
 * forma única da lista. `null` é a api fora do ar (ou a turma que não é do
 * professor): a ficha diz que não conseguiu ler, em vez de mostrar uma lista
 * vazia que mentiria "nenhuma atividade".
 */
export async function atividadesDaMissao(
  expId: MissaoComAtividade,
  turmaId: string,
): Promise<AtividadeNaLista[] | null> {
  const t = encodeURIComponent(turmaId);
  switch (expId) {
    case "exp08ef1b": {
      const r = await apiDoServidor<{ atividades: AtividadeDoInstanooria[] }>(`/atividades?turmaId=${t}`);
      return r ? ordenarAtividades(atividadesDoInstanooria(r.atividades)) : null;
    }
    case "exp07ef1b": {
      const r = await apiDoServidor<CoberturasDaTurma>(`/a-selecao/turmas/${t}/coberturas`);
      return r ? ordenarAtividades(atividadesDaSelecao(r)) : null;
    }
    case "exp04ef1b": {
      const r = await apiDoServidor<PacotesDaTurma>(`/jornal-escola/turmas/${t}/pacotes`);
      return r ? ordenarAtividades(atividadesDoJornal(r)) : null;
    }
    case "exp05ef1b": {
      /* A lista não traz o rótulo da disciplina; a rota do preparo traz o
         vocabulário inteiro, e é dela que o rótulo sai. */
      const [r, preparo] = await Promise.all([
        apiDoServidor<PacotesDaTurmaQuemMandou>(`/quem-mandou-isso/turmas/${t}/pacotes`),
        apiDoServidor<PacoteDaTurma>(`/quem-mandou-isso/turmas/${t}/pacote`),
      ]);
      if (!r) return null;
      const rotulo = new Map((preparo?.disciplinas ?? []).map((d) => [d.slug, d.rotulo]));
      return ordenarAtividades(atividadesDoQuemMandou(r, (slug) => rotulo.get(slug) ?? slug));
    }
  }
}
