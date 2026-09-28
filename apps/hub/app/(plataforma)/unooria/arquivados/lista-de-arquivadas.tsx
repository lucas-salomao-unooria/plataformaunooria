"use client";

import { data } from "@edu/sdk";
import { EmptyState, ScrollBar, SectionHeader, Table, type TableColumn } from "@edu/ui/ds";
import type { ExperienciaArquivada } from "./tipos";

/** O `Table` do DS exige `Record<string, unknown>` na linha. */
type Linha = ExperienciaArquivada & Record<string, unknown>;

/** "4º ano, unidade 1" — o lugar que a experiência ocupava na grade. */
function lugarNaGrade(linha: ExperienciaArquivada): string {
  const serie = linha.series[0];
  if (!serie) return "Transversal";
  const [, ano, etapa] = /^(\d)(EF|EM)$/.exec(serie) ?? [];
  const rotulo = etapa === "EM" ? `${ano}ª série do EM` : `${ano}º ano`;
  return linha.unidade ? `${rotulo}, unidade ${linha.unidade}` : rotulo;
}

function contagem(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : plural}`;
}

export function ListaDeArquivadas({ arquivadas }: { arquivadas: ExperienciaArquivada[] }) {
  const colunas: TableColumn<Linha>[] = [
    { key: "nome", title: "Experiência" },
    {
      key: "codigoDeOrigem",
      title: "Código de origem",
      render: (_v, linha) => <code className="whitespace-nowrap">{linha.codigoDeOrigem}</code>,
    },
    { key: "series", title: "Onde ficava", render: (_v, linha) => lugarNaGrade(linha) },
    { key: "versao", title: "Última versão" },
    {
      key: "turmasGuardadas",
      title: "Dados guardados",
      render: (_v, linha) => (
        <span className="whitespace-nowrap">
          {contagem(linha.turmasGuardadas, "turma", "turmas")} ·{" "}
          {contagem(linha.estudantesGuardados, "estudante", "estudantes")}
        </span>
      ),
    },
    { key: "motivo", title: "Por que foi arquivada" },
    {
      key: "arquivadaEm",
      title: "Arquivada em",
      render: (_v, linha) => <span className="whitespace-nowrap">{data(linha.arquivadaEm)}</span>,
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Arquivados"
        description="Experiências tiradas do produto sem serem apagadas: saíram da grade das turmas e do painel de recursos, e os dados continuam guardados."
      />

      {arquivadas.length === 0 ? (
        <EmptyState
          title="Nenhuma experiência arquivada"
          description="Quando uma missão nova ocupar o lugar de outra na grade, a antiga aparece aqui, com os dados que ficaram guardados."
        />
      ) : (
        <ScrollBar orientation="both" autoHide className="tabela-rolavel">
          <Table columns={colunas} data={arquivadas as Linha[]} />
        </ScrollBar>
      )}

      {/* Dito na tela porque a alternativa é alguém procurar o botão que não
          existe. Os números são os do dia em que a experiência foi arquivada. */}
      <p className="text-[13px] text-unooria-neutral-500">
        Os dados guardados são a contagem do dia do arquivamento. Uma experiência arquivada não
        abre para nenhuma turma; trazê-la de volta é um trabalho do time de plataforma.
      </p>
    </section>
  );
}
