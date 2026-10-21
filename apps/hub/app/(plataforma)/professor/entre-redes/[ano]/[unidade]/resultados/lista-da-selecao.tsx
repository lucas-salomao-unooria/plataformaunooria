"use client";

import { hora } from "@edu/sdk";
import { ScrollBar, Table, type TableColumn } from "@edu/ui/ds";
import {
  ROTULO_DO_PASSO,
  descreverMatriz,
  ordenarLinhas,
  rotuloDoPost,
  textoDaLeitura,
  textoDaMarcacao,
  textoDoPar,
  type LinhaDoPainel,
  type PostDaCobertura,
} from "@/lib/a-selecao-tipos";
import { chaveDaLinha, type EquipeNoPainel, type MembroNoPainel } from "@/lib/equipe-no-painel";

import { EquipeNaLinha } from "./equipe-na-linha";

/**
 * A folha da turma da exp07ef1b — UMA LINHA POR COMPUTADOR quando a turma
 * montou equipes (E13), uma por criança quando não.
 *
 * Client component de propósito: `columns[].render` do `Table` do DS é função
 * e não atravessa a fronteira RSC, e o painel ao vivo, acima, repassa a lista
 * nova a cada consulta.
 *
 * O que ela NÃO tem, e cada ausência é regra: coluna de nível, de nota ou de
 * "acerto" (`PROIBIDO_NO_PAINEL`, na api), e ordenação. A ordem é alfabética
 * pelo que a primeira célula mostra (`ordenarLinhas`) e nenhuma coluna é
 * `sortable`: listagem ordenável por lente ou por velocidade vira ranking.
 *
 * `legenda` e `reflexaoTexto` são texto livre de menor. A api os manda só para
 * quem LECIONA a turma (ADR-108); para a coordenação chegam `null`, e a célula
 * diz "entregou" — sem ramo por papel aqui.
 */
interface Linha extends Record<string, unknown>, Omit<LinhaDoPainel, "equipe"> {
  equipe: EquipeNoPainel | null;
}

function primeiraColuna(porComputador: boolean): TableColumn<Linha> {
  return {
    key: "nome",
    title: porComputador ? "Estudante ou equipe" : "Estudante",
    render: (_, l) =>
      l.equipe ? (
        <EquipeNaLinha equipe={l.equipe} representante={l.nome} entrou={l.iniciou} />
      ) : (
        <span className="flex flex-col">
          <span className="font-semibold text-unooria-neutral-950">{l.nome}</span>
          <span className="text-[11px] text-unooria-neutral-500">
            {l.iniciou ? l.usuario : `${l.usuario} · não começou`}
          </span>
        </span>
      ),
  };
}

function demaisColunas(posts: readonly PostDaCobertura[]): TableColumn<Linha>[] {
  return [
    {
      key: "passo",
      title: "Onde está",
      width: 150,
      render: (_, l) => (l.iniciou ? ROTULO_DO_PASSO[l.passo] : "—"),
    },
    {
      key: "publicou",
      title: "Publicou",
      width: 100,
      render: (_, l) => (l.publicou && l.publicadaEm ? `às ${hora(l.publicadaEm)}` : "—"),
    },
    {
      key: "matriz",
      title: "A seleção",
      minWidth: 240,
      render: (_, l) =>
        l.selecao ? (
          <span className="flex flex-col gap-1">
            <strong className="text-unooria-neutral-950">{descreverMatriz(l.matriz)}</strong>
            <span className="flex flex-col text-[11px] leading-snug text-unooria-neutral-600">
              {l.selecao.map((id) => (
                <span key={id}>{rotuloDoPost(id, posts)}</span>
              ))}
            </span>
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "par",
      title: "Par no Mural",
      width: 170,
      render: (_, l) => textoDoPar(l.par) ?? "—",
    },
    {
      key: "legenda",
      title: "Legenda",
      minWidth: 200,
      render: (_, l) =>
        l.publicou ? (
          <span className="flex max-w-[260px] flex-col gap-1">
            {l.legenda ? <span className="text-unooria-neutral-800">“{l.legenda}”</span> : "entregou"}
            {textoDaLeitura(l.leituraDaLegenda) ? (
              <span
                className={`text-[11px] leading-snug ${
                  l.leituraDaLegenda?.estado === "reserva" ? "text-unooria-coral-600" : "text-unooria-neutral-500"
                }`}
              >
                {textoDaLeitura(l.leituraDaLegenda)}
              </span>
            ) : null}
            {l.podados ? (
              <span className="text-[11px] text-unooria-neutral-500">
                Tirou {l.podados} {l.podados === 1 ? "post" : "posts"} dos salvos antes de publicar
              </span>
            ) : null}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "marcacao",
      title: "Marcação do colega",
      minWidth: 220,
      render: (_, l) =>
        textoDaMarcacao(l.marcacao, posts) ? (
          <span className="flex max-w-[260px] flex-col gap-1">
            <span className="text-unooria-neutral-800">{textoDaMarcacao(l.marcacao, posts)}</span>
            {l.marcacaoPorque ? (
              <span className="text-[12px] text-unooria-neutral-700">Por quê: “{l.marcacaoPorque}”</span>
            ) : null}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "reflexao",
      title: "Reflexão",
      minWidth: 220,
      render: (_, l) =>
        l.reflexaoTexto ? (
          <span className="block max-w-[300px] text-unooria-neutral-700">{l.reflexaoTexto}</span>
        ) : l.entregouReflexao ? (
          "entregou"
        ) : (
          "—"
        ),
    },
  ];
}

export function ListaDaSelecao({
  linhas,
  porComputador,
  posts,
  membros,
}: {
  linhas: LinhaDoPainel[];
  porComputador: boolean;
  /** Os posts da cobertura em andamento — é por eles que o post da tríade ganha o começo da legenda. */
  posts: readonly PostDaCobertura[];
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
        columns={[primeiraColuna(porComputador), ...demaisColunas(posts)]}
        data={dados}
        keyExtractor={chaveDaLinha}
        emptyText="Esta turma ainda não tem estudantes."
        size="md"
        theme="light"
      />
    </ScrollBar>
  );
}
