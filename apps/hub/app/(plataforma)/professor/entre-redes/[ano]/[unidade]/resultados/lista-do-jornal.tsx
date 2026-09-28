"use client";

import { ScrollBar, Table, type TableColumn } from "@edu/ui/ds";
import { chaveDaLinha, type EquipeNoPainel, type MembroNoPainel } from "@/lib/equipe-no-painel";
import { ROTULO_DO_PASSO, ordenarLinhas, type LinhaDoPainel } from "@/lib/jornal-escola-tipos";

import { EquipeNaLinha } from "./equipe-na-linha";

/**
 * A folha da turma da exp04ef1b — UMA LINHA POR COMPUTADOR quando a turma
 * montou equipes (E13), uma por criança quando não.
 *
 * Client component de propósito: `columns[].render` do `Table` do DS é função
 * e não atravessa a fronteira RSC, e o painel ao vivo, acima, repassa a lista
 * nova a cada consulta.
 *
 * O que ela NÃO tem, e cada ausência é regra: quantas notícias verificadas
 * cada um publicou, nível, nota ou "acerto" (`PROIBIDO_NA_LINHA_DO_PAINEL`, na
 * api — a contagem mora SÓ no histograma anônimo), e ordenação. A ordem é
 * alfabética pelo que a primeira célula mostra (`ordenarLinhas`) e nenhuma
 * coluna é `sortable`: listagem ordenável por pistas ou por velocidade vira
 * ranking — e o PDF §7 é explícito: nada de ranking nem exposição de quem errou.
 *
 * "Pistas abertas" é PROGRESSO, não prova: abrir um campo não comprova
 * compreensão (PDF §11). O cabeçalho da folha diz isso ao professor.
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
  { key: "passo", title: "Onde está", minWidth: 190, render: (_, l) => ROTULO_DO_PASSO[l.passo] },
  { key: "pistasAbertas", title: "Pistas abertas", width: 120, render: (_, l) => (l.pistasAbertas > 0 ? l.pistasAbertas : "—") },
  { key: "publicouAPrimeira", title: "1ª edição", width: 110, render: (_, l) => feito(l.publicouAPrimeira, "publicou") },
  { key: "chaveFormada", title: "Chave do Editor", width: 140, render: (_, l) => feito(l.chaveFormada, "formada") },
  { key: "publicouASegunda", title: "2ª edição", width: 110, render: (_, l) => feito(l.publicouASegunda, "publicou") },
  { key: "concluiu", title: "Desafio final", width: 130, render: (_, l) => feito(l.concluiu, "concluiu") },
];

export function ListaDoJornal({
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
