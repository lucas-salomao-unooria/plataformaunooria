"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertBox,
  Button,
  EmptyState,
  FeedbackAlert,
  ScrollBar,
  SectionHeader,
  Selection,
  Table,
  type TableColumn,
} from "@edu/ui/ds";
import { ehDoContrato, type Papel } from "@/lib/papeis";

interface MissaoNoRelatorio extends Record<string, unknown> {
  expId: string;
  nome: string;
  turmasLiberadas: number;
  turmasEncerradas: number;
  estudantes: number;
}

interface EscolaNoRelatorio extends Record<string, unknown> {
  id: string;
  nome: string;
  municipio: string | null;
  uf: string | null;
  turmasComMissaoLiberada: number;
  turmasComMissaoEncerrada: number;
  estudantesComRegistro: number;
}

interface Relatorio {
  regional: { id: string; nome: string };
  escolas: EscolaNoRelatorio[];
  experiencias: MissaoNoRelatorio[];
}

/**
 * O RELATÓRIO DA DIRETORIA — consolidado e por escola (ADR-82).
 *
 * DUAS MEDIDAS, e elas não se somam nem se substituem: `estudantes` é a CRIANÇA
 * com registro na missão; `turmas*` é a AULA. A tela as mostra lado a lado
 * porque a diferença entre elas é a informação — turma encerrada com poucos
 * registros é aula que passou sem a sala entrar; muitos registros com turma
 * aberta é sala no meio do caminho. Uma coluna só apagaria os dois casos.
 *
 * NOME DE CRIANÇA NÃO APARECE AQUI, e não é esquecimento: o relatório da
 * diretoria é contagem. Para ver uma criança, o supervisor abre a escola dela —
 * o caminho que o panorama já dá. Uma coluna de nome nesta tela seria a lista
 * ordenável de crianças de várias escolas que este projeto recusa em quatro
 * lugares diferentes.
 */
export function RelatorioDaRegional({
  papel,
  regionais,
}: {
  papel: Papel;
  /** Vazio para o `gestor_regional`: a regional dele vem do token, e o seletor
   *  não existe. Os perfis de contrato escolhem qual diretoria olhar. */
  regionais: Array<{ id: string; nome: string }>;
}) {
  const daContrato = ehDoContrato(papel);
  const [regionalId, setRegionalId] = useState(daContrato ? (regionais[0]?.id ?? "") : "");
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (daContrato && !regionalId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (daContrato && regionalId) params.set("regionalId", regionalId);
      const consulta = params.toString();
      const resposta = await fetch(
        `/api/plataforma/escolas/minhas/relatorio${consulta ? `?${consulta}` : ""}`,
      );
      if (!resposta.ok) throw new Error(String(resposta.status));
      setRelatorio((await resposta.json()) as Relatorio);
    } catch {
      setErro("Não foi possível carregar o relatório da regional.");
    } finally {
      setCarregando(false);
    }
  }, [daContrato, regionalId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const totais = useMemo(
    () =>
      (relatorio?.experiencias ?? []).reduce(
        (soma, e) => ({
          turmasLiberadas: soma.turmasLiberadas + e.turmasLiberadas,
          turmasEncerradas: soma.turmasEncerradas + e.turmasEncerradas,
          estudantes: soma.estudantes + e.estudantes,
        }),
        { turmasLiberadas: 0, turmasEncerradas: 0, estudantes: 0 },
      ),
    [relatorio],
  );

  const colunasDeMissao = useMemo<TableColumn<MissaoNoRelatorio>[]>(
    () => [
      { key: "nome", title: "Missão", render: (_, l) => l.nome },
      {
        key: "turmasLiberadas",
        title: "Turmas abertas",
        align: "right",
        render: (_, l) => String(l.turmasLiberadas),
      },
      {
        key: "turmasEncerradas",
        title: "Turmas encerradas",
        align: "right",
        render: (_, l) => String(l.turmasEncerradas),
      },
      {
        key: "estudantes",
        title: "Estudantes com registro",
        align: "right",
        render: (_, l) => l.estudantes.toLocaleString("pt-BR"),
      },
    ],
    [],
  );

  const colunasDeEscola = useMemo<TableColumn<EscolaNoRelatorio>[]>(
    () => [
      {
        key: "nome",
        title: "Escola",
        render: (_, l) => (
          <span>
            {String(l.nome)}
            <span className="block text-[12px] text-unooria-neutral-500">
              {l.municipio ? `${l.municipio}${l.uf ? `/${l.uf}` : ""}` : String(l.id)}
            </span>
          </span>
        ),
      },
      {
        key: "turmasComMissaoLiberada",
        title: "Turmas abertas",
        align: "right",
        render: (_, l) => String(l.turmasComMissaoLiberada),
      },
      {
        key: "turmasComMissaoEncerrada",
        title: "Turmas encerradas",
        align: "right",
        render: (_, l) => String(l.turmasComMissaoEncerrada),
      },
      {
        key: "estudantesComRegistro",
        title: "Estudantes com registro",
        align: "right",
        render: (_, l) => l.estudantesComRegistro.toLocaleString("pt-BR"),
      },
    ],
    [],
  );

  /** CSV do que está na tela. Montado no cliente porque os números já estão
   *  aqui: uma rota de exportação seria uma segunda fonte da mesma conta, e as
   *  duas divergiriam na primeira coluna nova. O BOM (`﻿`) é o que faz o
   *  Excel abrir acento certo. */
  function baixarCsv() {
    if (!relatorio) return;
    const linhas = [
      [
        "escola",
        "municipio",
        "uf",
        "turmas_abertas",
        "turmas_encerradas",
        "estudantes_com_registro",
      ],
      ...relatorio.escolas.map((e) => [
        e.nome,
        e.municipio ?? "",
        e.uf ?? "",
        String(e.turmasComMissaoLiberada),
        String(e.turmasComMissaoEncerrada),
        String(e.estudantesComRegistro),
      ]),
    ];
    const csv = linhas
      .map((l) => l.map((c) => (/[",;\n]/.test(c) ? `"${c.replaceAll('"', '""')}"` : c)).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${relatorio.regional.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="plataforma-largura-cheia flex flex-col gap-6">
      <SectionHeader
        title={relatorio ? `Relatório — ${relatorio.regional.nome}` : "Relatório da regional"}
        description="O consolidado da regional e a quebra por escola. Duas medidas lado a lado: a turma diz o que a aula fez; o estudante, quem entrou na missão."
      />

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      {daContrato ? (
        <div className="w-[320px] max-w-full">
          <Selection
            id="regional-do-relatorio"
            label="Regional"
            value={regionalId}
            options={regionais.map((r) => ({ value: r.id, label: r.nome }))}
            onChange={(v) => setRegionalId(String(v))}
          />
        </div>
      ) : null}

      {!carregando && relatorio && relatorio.escolas.length === 0 ? (
        <EmptyState
          title="Nenhuma escola nesta regional"
          description="A regional existe, mas nenhuma escola foi vinculada a ela. Quem vincula é o administrador do contrato, em Escolas."
        />
      ) : null}

      {relatorio && relatorio.escolas.length > 0 ? (
        <>
          <p className="text-[14px] text-unooria-neutral-500">
            {relatorio.escolas.length} escola{relatorio.escolas.length === 1 ? "" : "s"} ·{" "}
            {totais.turmasLiberadas} turmas com missão aberta · {totais.turmasEncerradas} encerradas
            · {totais.estudantes.toLocaleString("pt-BR")} registros de estudante
          </p>

          <div className="flex flex-col gap-2">
            <h3 className="text-[16px] font-semibold text-unooria-neutral-950">
              Consolidado por missão
            </h3>
            <ScrollBar orientation="both" autoHide className="tabela-rolavel">
              <Table<MissaoNoRelatorio>
                columns={colunasDeMissao}
                data={relatorio.experiencias}
                keyExtractor={(l) => l.expId}
                loading={carregando}
                emptyText="Nenhuma missão liberada nesta regional ainda."
                size="md"
                theme="light"
              />
            </ScrollBar>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-[16px] font-semibold text-unooria-neutral-950">Por escola</h3>
            <ScrollBar orientation="both" autoHide className="tabela-rolavel">
              <Table<EscolaNoRelatorio>
                columns={colunasDeEscola}
                data={relatorio.escolas}
                keyExtractor={(l) => l.id}
                loading={carregando}
                emptyText="Nenhuma escola."
                size="md"
                theme="light"
              />
            </ScrollBar>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" size="md" onClick={baixarCsv}>
              Baixar CSV
            </Button>
          </div>

          <FeedbackAlert
            type="info"
            title="O que estes números são, e o que não são"
            description="Turma encerrada com poucos registros é aula que passou sem a sala entrar; muitos registros com turma aberta é sala no meio do caminho. O relatório é contagem: para ver uma criança, abra a escola dela. Bem-estar não entra aqui — é dado de saúde, e só o professor da turma lê."
          />
        </>
      ) : null}
    </div>
  );
}
