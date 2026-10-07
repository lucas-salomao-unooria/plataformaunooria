"use client";

import { ScrollBar, Table, type TableColumn } from "@edu/ui/ds";
import { chaveDaLinha, type EquipeNoPainel, type MembroNoPainel } from "@/lib/equipe-no-painel";
import { ROTULO_DO_PASSO, ordenarLinhas, type LinhaDoPainel } from "@/lib/juri-estadual-tipos";

import { EquipeNaLinha } from "./equipe-na-linha";

/**
 * A folha da turma da exp06ef1b — UMA LINHA POR COMPUTADOR quando a turma
 * montou equipes (E13), uma por criança quando não.
 *
 * Client component de propósito: `columns[].render` do `Table` do DS é função
 * e não atravessa a fronteira RSC, e o painel ao vivo, acima, repassa a lista
 * nova a cada consulta.
 *
 * O que ela NÃO tem, e cada ausência é regra: o VOTO, a taxa de invisibilidade
 * e o nível (`PROIBIDO_NA_LINHA_DO_PAINEL`, na api) — nome ligado a escolha
 * não vai para a lousa do pico —, e ordenação. A ordem é alfabética pelo que a
 * primeira célula mostra (`ordenarLinhas`) e nenhuma coluna é `sortable`:
 * listagem ordenável por progresso vira ranking.
 */
interface Linha extends Record<string, unknown>, Omit<LinhaDoPainel, "equipe"> {
  equipe: EquipeNoPainel | null;
}

const feito = (sim: boolean, rotulo: string) => (sim ? rotulo : "—");

function primeiraColuna(porComputador: boolean): TableColumn<Linha> {
  return {
    key: "nome",
    title: porComputador ? "Estudante ou equipe" : "Estudante",
    render: (_, l) =>
      l.equipe ? (
        /* `entrou` vem da api (tem sessão nesta rodada). Sem sessão ela traz o
           primeiro membro como representante, e dizer que ele entrou seria falso. */
        <EquipeNaLinha equipe={l.equipe} representante={l.nome} entrou={l.entrou} />
      ) : (
        <span className="flex flex-col">
          <span className="font-semibold text-unooria-neutral-950">{l.nome}</span>
          <span className="text-[11px] text-unooria-neutral-500">{l.usuario}</span>
        </span>
      ),
  };
}

const DEMAIS_COLUNAS: TableColumn<Linha>[] = [
  { key: "passo", title: "Onde está", minWidth: 200, render: (_, l) => (l.entrou ? ROTULO_DO_PASSO[l.passo] : "Não entrou") },
  { key: "votou", title: "Cédula", width: 110, render: (_, l) => feito(l.votou, "lacrou") },
  { key: "abriuAGaleria", title: "Galeria Oculta", width: 140, render: (_, l) => feito(l.abriuAGaleria, "abriu") },
  { key: "buscou", title: "Busca", width: 110, render: (_, l) => feito(l.buscou, "buscou") },
  { key: "revisou", title: "Revisão do voto", width: 140, render: (_, l) => feito(l.revisou, "revisou") },
  { key: "desviou", title: "Rodada de desvio", width: 150, render: (_, l) => feito(l.desviou, "fez") },
  { key: "concluiu", title: "Missão", width: 120, render: (_, l) => feito(l.concluiu, "concluiu") },
];

export function ListaDoJuri({
  linhas,
  porComputador,
  membros,
}: {
  linhas: LinhaDoPainel[];
  porComputador: boolean;
  /** Os membros de cada equipe, por id. A linha desta api traz só o nome da equipe. */
  membros: Readonly<Record<string, MembroNoPainel[]>>;
}) {
  const dados: Linha[] = ordenarLinhas(linhas).map((l) => ({
    ...l,
    equipe: l.equipe ? { ...l.equipe, membros: membros[l.equipe.id] ?? [] } : null,
  }));

  return (
    <ScrollBar orientation="both" autoHide className="tabela-rolavel">
      <Table<Linha>
        columns={[primeiraColuna(porComputador), ...DEMAIS_COLUNAS]}
        data={dados}
        keyExtractor={chaveDaLinha}
        emptyText="Esta turma ainda não tem estudantes."
        size="md"
        theme="light"
      />
    </ScrollBar>
  );
}
