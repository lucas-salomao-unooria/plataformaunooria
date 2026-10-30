import { CADERNOS, DOCUMENTOS_INDEXADOS, PROJETOS, type ConteudoDoPacote, type ProjetoId } from "../conteudo";

/**
 * A CONTA DA VIRADA (one-pager v5 §1.3) e a RÉGUA do pacote.
 *
 * A conta: dois critérios de peso 0,5 — documentos indexados e vagas
 * comprovadas —, cada um normalizado pelo maior valor da rodada. Antes da
 * digitalização, o projeto em papel tem 1 documento e 0 vagas comprovadas (o
 * sistema não lê o papel); depois, 180 registros e as vagas dele. Com OS
 * MESMOS critérios, o vencedor muda — é a virada.
 *
 * A régua do pacote (homologação e saída da IA): o pacote gerado precisa
 * MANTER a virada — o da nuvem vence antes, o de papel vence depois. Sem
 * isso, o tema novo desmontaria o aha.
 */

export interface Pontuacao {
  projeto: ProjetoId;
  documentos: number;
  vagasComprovadas: number;
  indice: number;
}

/** Os índices (0 a 1) dos três projetos, antes ou depois dos cadernos, do maior para o menor. */
export function pontuar(c: ConteudoDoPacote, comCadernos: boolean): Pontuacao[] {
  const linhas = PROJETOS.map((projeto) => {
    const emPapel = projeto === "papel";
    const documentos = emPapel ? (comCadernos ? CADERNOS.registros : DOCUMENTOS_INDEXADOS.papel) : DOCUMENTOS_INDEXADOS[projeto];
    const vagasComprovadas = emPapel && !comCadernos ? 0 : c.projetos[projeto].vagas;
    return { projeto, documentos, vagasComprovadas };
  });
  const maxDocs = Math.max(...linhas.map((l) => l.documentos));
  const maxVagas = Math.max(...linhas.map((l) => l.vagasComprovadas));
  return linhas
    .map((l) => ({ ...l, indice: Math.round(((l.documentos / maxDocs) * 0.5 + (maxVagas > 0 ? l.vagasComprovadas / maxVagas : 0) * 0.5) * 1000) / 1000 }))
    .sort((a, b) => b.indice - a.indice);
}

export function vencedor(c: ConteudoDoPacote, comCadernos: boolean): ProjetoId {
  return (pontuar(c, comCadernos)[0] as Pontuacao).projeto;
}

/** Devolve as frases para o professor (vazio = dentro da régua). A FORMA é do Zod. */
export function problemasDoConteudo(c: ConteudoDoPacote): string[] {
  const problemas: string[] = [];
  for (const id of PROJETOS) {
    const p = c.projetos[id];
    if (p.documentos.length !== DOCUMENTOS_INDEXADOS[id]) {
      problemas.push(`O projeto "${p.nome}" precisa de exatamente ${DOCUMENTOS_INDEXADOS[id]} documento(s) indexado(s).`);
    }
  }
  const nomes = PROJETOS.map((id) => c.projetos[id].nome.trim().toLowerCase());
  if (new Set(nomes).size !== nomes.length) problemas.push("Os três projetos precisam de nomes diferentes.");
  if (c.cadernos.amostras.length !== CADERNOS.quantidade) problemas.push(`Os cadernos precisam de exatamente ${CADERNOS.quantidade} amostras (uma por caderno).`);
  if (vencedor(c, false) !== "nuvem") problemas.push("Antes da digitalização, o projeto com acervo em nuvem precisa ficar em primeiro (a recomendação da IA).");
  if (vencedor(c, true) !== "papel") problemas.push("Depois da digitalização, o projeto em papel precisa ficar em primeiro: dê a ele mais vagas que os outros.");
  return problemas;
}
