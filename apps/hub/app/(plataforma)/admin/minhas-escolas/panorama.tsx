"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertBox,
  Button,
  EmptyState,
  FeedbackAlert,
  ScrollBar,
  SectionHeader,
  Table,
  Tag,
  type TableColumn,
} from "@edu/ui/ds";
import type { Papel } from "@/lib/papeis";

interface EscolaDoPanorama extends Record<string, unknown> {
  id: string;
  nome: string;
  municipio: string | null;
  uf: string | null;
  regional: string | null;
  papel: string;
  principal: boolean;
  estudantes?: number;
  professores: number;
  turmas: number;
  semPrimeiroAcesso: number;
}

/**
 * O panorama de quem administra MUITAS escolas — o supervisor de uma Diretoria
 * de Ensino.
 *
 * Sem esta tela ele entraria em cinquenta escolas uma a uma para saber onde
 * falta gente. A coluna que mais importa é a última: quantos ainda não fizeram o
 * primeiro acesso é o que sobrou para fazer naquela unidade.
 *
 * "Abrir" troca a ESCOLA ATIVA e vai para as pessoas dela — é o mesmo caminho do
 * seletor no cabeçalho, porque o token carrega uma escola por vez.
 */
export function PanoramaDasEscolas({ ativa, papel }: { ativa: string; papel: Papel }) {
  /* O `gestor_regional` chega aqui por um caminho diferente: o escopo dele é a
     REGIONAL, não a lotação. A tela precisa saber disso para se intitular pela
     diretoria — dizer "as unidades em que você está lotado" a quem não tem
     lotação nenhuma é descrever o produto errado. */
  const ehRegional = papel === "gestor_regional";
  const router = useRouter();
  const [escolas, setEscolas] = useState<EscolaDoPanorama[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const resposta = await fetch("/api/plataforma/escolas/minhas/resumo");
      if (!resposta.ok) throw new Error(String(resposta.status));
      setEscolas((await resposta.json()) as EscolaDoPanorama[]);
    } catch {
      setErro("Não foi possível carregar suas escolas.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrir(escolaId: string) {
    setTrocando(escolaId);
    try {
      if (escolaId !== ativa) {
        const resposta = await fetch("/api/escola-ativa", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ escolaId }),
        });
        if (!resposta.ok) throw new Error(String(resposta.status));
      }
      router.push("/admin/usuarios");
      router.refresh();
    } catch {
      setErro("Não foi possível abrir esta escola.");
      setTrocando(null);
    }
  }

  const colunas = useMemo<TableColumn<EscolaDoPanorama>[]>(
    () => [
      {
        key: "nome",
        title: "Escola",
        render: (_, l) => (
          <span>
            {String(l.nome)}
            {l.principal ? (
              <>
                {" "}
                <Tag variant="brand" size="sm">padrão</Tag>
              </>
            ) : null}
            <span className="block text-[12px] text-unooria-neutral-500">
              {l.municipio ? `${l.municipio}${l.uf ? `/${l.uf}` : ""}` : "—"}
              {l.regional ? ` · ${l.regional}` : ""}
            </span>
          </span>
        ),
      },
      { key: "turmas", title: "Turmas", align: "right" },
      {
        key: "estudantes",
        title: "Estudantes",
        align: "right",
        render: (_, l) => String(l.estudantes),
      },
      { key: "professores", title: "Professores", align: "right" },
      {
        key: "semPrimeiroAcesso",
        title: "Sem 1º acesso",
        align: "right",
        render: (_, l) =>
          Number(l.semPrimeiroAcesso) > 0 ? (
            <Tag variant="warning" size="sm">{String(l.semPrimeiroAcesso)}</Tag>
          ) : (
            <span className="text-unooria-neutral-500">0</span>
          ),
      },
      {
        key: "acoes",
        title: "",
        align: "right",
        render: (_, l) => (
          <Button
            variant="ghost"
            size="sm"
            isLoading={trocando === l.id}
            onClick={() => void abrir(String(l.id))}
          >
            {l.id === ativa ? "Abrir" : "Trocar e abrir"}
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ativa, trocando],
  );

  const totais = (escolas ?? []).reduce(
    (soma, e) => ({
      estudantes: soma.estudantes + (e.estudantes ?? 0),
      turmas: soma.turmas + e.turmas,
      pendentes: soma.pendentes + e.semPrimeiroAcesso,
      /* "vínculos" e não "professores": por escola o número é de PESSOAS, mas o
         total somado conta duas vezes quem dá aula em duas. É a mesma distinção
         que a tela de Escolas faz (ADR-79) — estudante e primeiro acesso somam
         limpo (um estudante tem UMA lotação ativa, garantida por índice único
         parcial; o primeiro acesso é contado por `users.escola_id`, que é uma
         escola por pessoa), professor não. */
      vinculosDeProfessor: soma.vinculosDeProfessor + e.professores,
    }),
    { estudantes: 0, turmas: 0, pendentes: 0, vinculosDeProfessor: 0 },
  );

  /** Todas as linhas de um regional pertencem à MESMA diretoria. */
  const nomeDaRegional = escolas?.[0]?.regional ?? null;

  return (
    <div className="plataforma-largura-cheia flex flex-col gap-6">
      <SectionHeader
        title={ehRegional && nomeDaRegional ? nomeDaRegional : "Minhas escolas"}
        description={
          ehRegional
            ? "As escolas da sua regional. Cada uma é um espaço separado: você abre uma por vez, e o que vê é sempre daquela escola — os números abaixo são a soma delas."
            : "As unidades em que você está lotado. Cada uma é um espaço separado: você abre uma por vez, e o que vê é sempre daquela escola."
        }
      />

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      {escolas && escolas.length === 0 ? (
        <EmptyState
          title={
            ehRegional
              ? "Nenhuma escola nesta regional ainda"
              : "Você está lotado em uma escola só"
          }
          description={
            ehRegional
              ? "A regional existe e você a cobre, mas nenhuma escola foi vinculada a ela. Quem vincula é o administrador do contrato, em Escolas."
              : "Este painel existe para quem administra várias escolas — coordenação regional, polo, secretaria municipal. Com uma escola, o caminho é direto: Usuários e Turmas."
          }
        />
      ) : null}

      {escolas && escolas.length > 0 ? (
        <>
          <p className="text-[14px] text-unooria-neutral-500">
            {escolas.length} escola{escolas.length === 1 ? "" : "s"} · {totais.turmas} turmas ·{" "}
            {totais.estudantes.toLocaleString("pt-BR")} estudantes ·{" "}
            {totais.vinculosDeProfessor} vínculos de professores
            {totais.pendentes > 0 ? ` · ${totais.pendentes} sem primeiro acesso` : ""}
          </p>

          <ScrollBar orientation="both" autoHide className="tabela-rolavel">
            <Table<EscolaDoPanorama>
              columns={colunas}
              data={escolas}
              keyExtractor={(l) => l.id}
              size="md"
              theme="light"
            />
          </ScrollBar>

          {totais.pendentes > 0 ? (
            <FeedbackAlert
              type="info"
              title={
                totais.pendentes === 1
                  ? "1 pessoa ainda não fez o primeiro acesso"
                  : `${totais.pendentes} pessoas ainda não fizeram o primeiro acesso`
              }
              description="A senha da importação vale uma vez. Quem não entrou ainda não tem senha própria — e é onde a folha de senhas costuma ter ficado na gaveta."
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
