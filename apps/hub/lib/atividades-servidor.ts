import "server-only";
import type { CoberturasDaTurma } from "./a-selecao-tipos";
import { apiDoServidor } from "./api-servidor";
import {
  atividadesDaSelecao,
  atividadesDoInstanooria,
  atividadesDoJornal,
  atividadesDoEfeito,
  atividadesDoEnigma,
  atividadesDaNina,
  atividadesDoAssistente,
  atividadesDoJuri,
  atividadesDoQuemMandou,
  ordenarAtividades,
  type AtividadeDoInstanooria,
  type AtividadeNaLista,
  type MissaoComAtividade,
} from "./entre-redes/atividades";
import { caminhoDaTurma as caminhoDoEfeito, rotuloDaDisciplina as rotuloDoEfeito, type PacotesDaTurmaEfeito } from "./efeito-amplificador-tipos";
import { ROTAS_DA_CURADORIA as ROTAS_DO_ASSISTENTE, caminhoDaTurma as caminhoDoAssistente, rotuloDaDisciplina as rotuloDoAssistente, type PacotesDaTurmaAssistente } from "./assistente-invisivel-tipos";
import { caminhoDaTurma as caminhoDoEnigma, rotuloDaDisciplina as rotuloDoEnigma, type PacotesDaTurmaEnigma } from "./enigma-capa-tipos";
import type { PacotesDaTurma } from "./jornal-escola-tipos";
import { caminhoDaTurma as caminhoDaNina, rotuloDaDisciplina as rotuloDaNina, type PacotesDaTurmaNina } from "./nina-noticia-tipos";
import { caminhoDaTurma, rotuloDaDisciplina, type PacotesDoJuri } from "./juri-estadual-tipos";
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
    case "exp06ef1b": {
      /* A disciplina vem em slug, do vocabulário fechado da missão; o rótulo
         sai do espelho do hub (`juri-estadual-tipos.ts`), com teste. */
      const r = await apiDoServidor<PacotesDoJuri>(`${caminhoDaTurma(turmaId)}/pacotes`);
      return r ? ordenarAtividades(atividadesDoJuri(r, rotuloDaDisciplina)) : null;
    }
    case "exp02em1b": {
      const r = await apiDoServidor<PacotesDaTurmaEfeito>(`${caminhoDoEfeito(turmaId)}/pacotes`);
      return r ? ordenarAtividades(atividadesDoEfeito(r, rotuloDoEfeito)) : null;
    }
    case "exp02ef1b": {
      const r = await apiDoServidor<PacotesDaTurmaEnigma>(`${caminhoDoEnigma(turmaId)}/pacotes`);
      return r ? ordenarAtividades(atividadesDoEnigma(r, rotuloDoEnigma)) : null;
    }
    case "exp01em1b": {
      const r = await apiDoServidor<PacotesDaTurmaAssistente>(`${caminhoDoAssistente(turmaId)}${ROTAS_DO_ASSISTENTE.historico}`);
      return r ? ordenarAtividades(atividadesDoAssistente(r, rotuloDoAssistente)) : null;
    }
    case "exp03ef1b": {
      const r = await apiDoServidor<PacotesDaTurmaNina>(`${caminhoDaNina(turmaId)}/pacotes`);
      return r ? ordenarAtividades(atividadesDaNina(r, rotuloDaNina)) : null;
    }
  }
}
