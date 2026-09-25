"use client";

import { Badge, ScrollBar, Table, Tag, type TableColumn } from "@edu/ui/ds";
import { chaveDaLinha } from "@/lib/equipe-no-painel";
import {
  formatarQuando,
  ordenarEstudantes,
  situacaoDoEstudante,
  type LinhaEstudanteUnootube,
} from "@/lib/unootube-tipos";

import { EquipeNaLinha } from "./equipe-na-linha";

/**
 * Client component de propósito: `columns[].render` do `Table` do DS é função e
 * não atravessa a fronteira RSC. A página (server) só passa os dados.
 */
interface Linha extends Record<string, unknown>, LinhaEstudanteUnootube {}

const numero = new Intl.NumberFormat("pt-BR");

/**
 * Uma linha é UM COMPUTADOR (E13): com equipe, a primeira célula diz a equipe,
 * quem senta nela e quem entrou — e os números ao lado são de quem entrou.
 */
const primeiraColuna = (porComputador: boolean): TableColumn<Linha> => ({
  key: "nome",
  title: porComputador ? "Estudante ou equipe" : "Estudante",
  render: (_, l) =>
    l.equipe ? (
      <EquipeNaLinha equipe={l.equipe} representante={l.nome} entrou={l.iniciou} />
    ) : (
      <span className="flex flex-col">
        <span className="font-semibold text-unooria-neutral-950">{l.nome}</span>
        <span className="text-[11px] text-unooria-neutral-500">{l.usuario}</span>
      </span>
    ),
});

const demaisColunas: TableColumn<Linha>[] = [
  { key: "salvos", title: "Salvos", width: 90, render: (_, l) => (l.iniciou ? `${l.salvos}/3` : "—") },
  {
    key: "fontesConfiaveis",
    title: "Fontes confiáveis",
    width: 150,
    render: (_, l) => {
      if (!l.iniciou || l.salvos === 0) return <span className="text-unooria-neutral-500">—</span>;
      const variante = l.fontesConfiaveis === 3 ? "success" : "disable";
      return (
        <Badge variant={variante}>
          {l.fontesConfiaveis}/3
        </Badge>
      );
    },
  },
  {
    key: "inscritos",
    title: "Inscritos",
    width: 110,
    align: "right",
    render: (_, l) => (l.iniciou ? numero.format(l.inscritos) : "—"),
  },
  {
    key: "situacao",
    title: "Situação",
    width: 200,
    render: (_, l) => {
      const situacao = situacaoDoEstudante(l);
      if (situacao === "concluiu") return <Badge variant="success">Concluiu</Badge>;
      if (situacao === "nao-iniciou") return <Badge variant="disable">Não iniciou</Badge>;
      return (
        <span className="flex flex-wrap items-center gap-1">
          <Tag variant="neutral" size="sm" pill>
            Em andamento
          </Tag>
          {l.rankingDesbloqueado ? (
            <Tag variant="brand" size="sm" pill>
              ranking aberto
            </Tag>
          ) : null}
        </span>
      );
    },
  },
  { key: "concluidoEm", title: "Concluiu em", width: 130, render: (_, l) => formatarQuando(l.concluidoEm) },
];

export function TabelaResultados({
  estudantes,
  porComputador = false,
}: {
  estudantes?: LinhaEstudanteUnootube[];
  /** O resumo conta computadores: a turma tem equipes nesta missão. */
  porComputador?: boolean;
}) {
  const lista = estudantes ?? [];
  const linhas: Linha[] = ordenarEstudantes(lista).map((a) => ({ ...a }));
  return (
    <ScrollBar orientation="both" autoHide className="tabela-rolavel">
      <Table<Linha>
        columns={[primeiraColuna(porComputador), ...demaisColunas]}
        data={linhas}
        keyExtractor={chaveDaLinha}
        emptyText="Ninguém desta turma entrou no UnooTube ainda."
        size="md"
        theme="light"
      />
    </ScrollBar>
  );
}
