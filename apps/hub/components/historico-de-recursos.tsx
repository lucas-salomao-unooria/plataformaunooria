"use client";

import { dataHora } from "@edu/sdk";
import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyState, FeedbackAlert, ScrollBar, Table, type TableColumn } from "@edu/ui/ds";

/**
 * O HISTÓRICO do painel de recursos (ADR-89), em DOIS lugares.
 *
 * A mesma componente serve `/unooria/recursos` (a Unooria, que faz) e
 * `/admin/recursos` (a rede, que sofre). Não são duas telas parecidas: é a
 * mesma pergunta — "quem mudou isto, quando e por quê" — e duplicá-la faria as
 * duas divergirem na primeira coluna nova.
 *
 * A rede NÃO escreve nada aqui. Ligar e desligar continua sendo só do `admin`
 * (ADR-88); o que ela ganha é ver o motivo, em vez de descobrir que a missão
 * sumiu e ligar para perguntar.
 */

interface LinhaDoHistorico extends Record<string, unknown> {
  id: string;
  recursoId: string;
  escolaId: string | null;
  acao: string;
  versao: string | null;
  motivo: string | null;
  /** Só em `quota-alterada` (ADR-105): o teto que valia e o que passou a valer. */
  detalhe: { de: number; para: number } | null;
  autorNome: string;
  quando: string;
}

/** Rótulo e cor de cada ação. `Record` para ação nova não passar sem rótulo. */
const ACOES: Record<string, { rotulo: string; cor: "success" | "error" | "info" | "neutral" }> = {
  ligado: { rotulo: "Ligado", cor: "success" },
  desligado: { rotulo: "Desligado", cor: "error" },
  herdado: { rotulo: "Voltou a herdar", cor: "neutral" },
  "versao-ativada": { rotulo: "Versão ativada", cor: "info" },
  "versao-fixada": { rotulo: "Versão fixada", cor: "info" },
  "versao-soltada": { rotulo: "Fixação removida", cor: "neutral" },
  "quota-alterada": { rotulo: "Quota de IA alterada", cor: "info" },
};

/** `quota:estudante` vira "Quota de IA · estudantes"; o resto fica como está. */
function rotuloDoRecurso(recursoId: string): string {
  if (recursoId === "quota:estudante") return "Quota de IA · estudantes";
  if (recursoId === "quota:professor") return "Quota de IA · professores";
  return recursoId;
}

const numero = (n: number) => n.toLocaleString("pt-BR");

const quando = dataHora;

export function HistoricoDeRecursos({
  escolaId,
  prefixo,
}: {
  escolaId?: string | null;
  /** Recorta por prefixo de `recursoId` — `quota:` é a tela de uso de IA (ADR-105). */
  prefixo?: string;
}) {
  const [linhas, setLinhas] = useState<LinhaDoHistorico[] | null>(null);
  const [truncado, setTruncado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ler = useCallback(async () => {
    const query = new URLSearchParams();
    if (escolaId) query.set("escolaId", escolaId);
    if (prefixo) query.set("prefixo", prefixo);
    const sufixo = query.size > 0 ? `?${query.toString()}` : "";
    const r = await fetch(`/api/plataforma/recursos/auditoria${sufixo}`, { cache: "no-store" });
    if (!r.ok) {
      setErro("O histórico não carregou.");
      return;
    }
    const dados = (await r.json()) as { truncado: boolean; linhas: LinhaDoHistorico[] };
    setLinhas(dados.linhas);
    setTruncado(dados.truncado);
  }, [escolaId, prefixo]);

  useEffect(() => {
    void ler();
  }, [ler]);

  /* `title` e não `header`, e `render(valor, linha)` — a assinatura real do
     `Table` do DS. As duas invenções passaram no editor e morreram no
     typecheck, que é onde elas têm de morrer. */
  const colunas: TableColumn<LinhaDoHistorico>[] = [
    {
      key: "quando",
      title: "Quando",
      render: (_v, linha) => <span className="whitespace-nowrap">{quando(linha.quando)}</span>,
    },
    {
      key: "acao",
      title: "O que",
      render: (_v, linha) => {
        const acao = ACOES[linha.acao];
        return (
          <Badge variant={acao?.cor ?? "neutral"}>
            {acao?.rotulo ?? linha.acao}
            {linha.versao ? ` · v${linha.versao}` : ""}
            {linha.detalhe ? ` · de ${numero(linha.detalhe.de)} para ${numero(linha.detalhe.para)}` : ""}
          </Badge>
        );
      },
    },
    {
      key: "recursoId",
      title: "Recurso",
      render: (_v, linha) => <span className="text-[13px]">{rotuloDoRecurso(linha.recursoId)}</span>,
    },
    {
      key: "escolaId",
      title: "Escopo",
      /* "A rede inteira" e não um campo em branco: escopo-contrato é a
         informação mais importante da linha, e é a que o vazio esconderia. */
      render: (_v, linha) => (
        <span className="text-[13px]">{linha.escolaId ?? "a rede inteira"}</span>
      ),
    },
    { key: "autorNome", title: "Quem" },
    {
      key: "motivo",
      title: "Por quê",
      render: (_v, linha) => (
        <span className="text-[13px] text-unooria-neutral-700">{linha.motivo ?? "—"}</span>
      ),
    },
  ];

  if (erro) return <FeedbackAlert type="error" title="Não deu" description={erro} />;
  if (linhas === null) {
    return <p className="text-[14px] text-unooria-neutral-500">Carregando o histórico…</p>;
  }
  if (linhas.length === 0) {
    return (
      <EmptyState
        title="Nada mudou por aqui ainda"
        description={
          prefixo === "quota:"
            ? "Quando o teto diário de IA de um perfil for alterado, a mudança aparece nesta lista com o valor anterior, o novo, o motivo e quem a fez."
            : "Quando um produto ou uma versão for ligado, desligado ou trocado, a mudança aparece nesta lista com o motivo e quem a fez."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* `ScrollBar` do DS, nunca `overflow` num `<div>`: é a regra do
          AGENTS.md, e `.tabela-rolavel` cuida só da altura e do cabeçalho preso. */}
      <ScrollBar orientation="horizontal" autoHide>
        <div className="tabela-rolavel">
          <Table columns={colunas} data={linhas} />
        </div>
      </ScrollBar>
      {truncado ? (
        <p className="text-[13px] text-unooria-neutral-500">
          Mostrando as 200 mudanças mais recentes — há mais no histórico.
        </p>
      ) : null}
    </div>
  );
}
