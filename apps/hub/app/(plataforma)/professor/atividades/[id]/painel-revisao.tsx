"use client";

import { useCallback, useEffect, useState } from "react";

import { AlertBox, Badge, Button, Card, Tag } from "@edu/ui/ds";

import { CartaoPost } from "./cartao-post";
import { FICHAS, PERFIS } from "@/lib/insta-tipos";

import type { RespostaPosts } from "./tipos-revisao";

interface Filtros {
  lado: string;
  perfil: string;
  intensidade: string;
  categoria: string;
  imagem: string;
  aprovado: string;
  page: number;
}

const FILTROS_INICIAIS: Filtros = {
  lado: "",
  perfil: "",
  intensidade: "",
  categoria: "",
  imagem: "",
  aprovado: "",
  page: 1,
};

/** Tela de revisão do doc 05 §3: filtros, preview, edição e ativação. */
export function PainelRevisao({
  activityId,
  status,
  qtdPostsTese,
}: {
  activityId: string;
  status: string;
  qtdPostsTese: number;
}) {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [dados, setDados] = useState<RespostaPosts | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendencias, setPendencias] = useState<string[]>([]);
  const [ativando, setAtivando] = useState(false);
  const [statusAtual, setStatusAtual] = useState(status);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const query = new URLSearchParams();
      if (filtros.lado) query.set("lado", filtros.lado);
      if (filtros.perfil) query.set("perfil", filtros.perfil);
      if (filtros.intensidade) query.set("intensidade", filtros.intensidade);
      if (filtros.categoria) query.set("categoria", filtros.categoria);
      if (filtros.imagem) query.set("imagem", filtros.imagem);
      if (filtros.aprovado) query.set("aprovado", filtros.aprovado);
      query.set("page", String(filtros.page));

      const resposta = await fetch(
        `/api/plataforma/atividades/${activityId}/posts?${query}`,
        { cache: "no-store" },
      );
      if (!resposta.ok) throw new Error("falha ao listar");
      setDados((await resposta.json()) as RespostaPosts);
    } catch {
      setAviso("Não conseguimos carregar os posts agora.");
    } finally {
      setCarregando(false);
    }
  }, [activityId, filtros]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  async function ativar(forcar: boolean) {
    setAtivando(true);
    setAviso(null);
    try {
      const resposta = await fetch(`/api/plataforma/atividades/${activityId}/ativar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ forcar }),
      });
      const corpo = (await resposta.json().catch(() => null)) as {
        mensagem?: string;
        pendencias?: string[];
      } | null;

      if (!resposta.ok) {
        setPendencias(corpo?.pendencias ?? []);
        setAviso(corpo?.mensagem ?? "Não foi possível ativar a atividade.");
        return;
      }

      setPendencias([]);
      setStatusAtual("ativa");
      setAviso(null);
    } finally {
      setAtivando(false);
    }
  }

  const aprovadosA = dados?.aprovadosPorLado.A ?? 0;
  const aprovadosB = dados?.aprovadosPorLado.B ?? 0;
  const aprovadosNeutro = dados?.aprovadosPorLado.neutro ?? 0;
  const totalAprovados = aprovadosA + aprovadosB + aprovadosNeutro;

  const trocarFiltro = (campo: keyof Filtros, valor: string) =>
    setFiltros((atual) => ({ ...atual, [campo]: valor, page: 1 }));

  return (
    <div className="flex flex-col gap-5">
      <Card variant="elevated">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusAtual === "ativa" ? "success" : "info"}>
              {statusAtual === "ativa" ? "Ativa para a turma" : "Em revisão"}
            </Badge>
            <span className="text-[13px] text-unooria-neutral-700">
              {totalAprovados} de ~{qtdPostsTese} posts aprovados · lado A{" "}
              {aprovadosA} · lado B {aprovadosB} · neutros {aprovadosNeutro}
            </span>
          </div>

          {statusAtual !== "ativa" ? (
            <Button
              variant="primary"
              isLoading={ativando}
              onClick={() => void ativar(false)}
            >
              Ativar atividade
            </Button>
          ) : null}
        </div>
      </Card>

      {/*
        Matriz 2×4 (doc 05 §4). Existe porque a contagem por lado ESCONDE o que
        mais importa agora: os lados podem estar 50/50 e um perfil inteiro estar
        vazio — e aí o aluno daquele perfil nunca receberia, daquele lado, a
        linguagem que mais fala com ele.
      */}
      {dados && dados.matriz.length > 0 ? (
        <Card variant="outlined" title="Cobertura por lado e perfil">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="p-2 text-left font-semibold text-unooria-neutral-700">
                    Lado
                  </th>
                  {PERFIS.map((perfil) => (
                    <th
                      key={perfil}
                      className="p-2 text-left font-semibold text-unooria-neutral-700"
                    >
                      {FICHAS[perfil].rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["A", "B"] as const).map((lado) => (
                  <tr key={lado} className="border-t border-unooria-neutral-200">
                    <td className="p-2 font-semibold text-unooria-neutral-950">
                      Lado {lado}
                    </td>
                    {PERFIS.map((perfil) => {
                      const celula = dados.matriz.find(
                        (linha) => linha.lado === lado && linha.perfil === perfil,
                      );
                      const aprovados = celula?.aprovados ?? 0;
                      const rasa =
                        aprovados < dados.esperadoPorCelula * 0.9 && aprovados > 0;
                      return (
                        <td key={perfil} className="p-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFiltros((atual) => ({
                                ...atual,
                                lado,
                                perfil,
                                page: 1,
                              }));
                            }}
                            className="w-full rounded-md px-2 py-1 text-left hover:bg-unooria-neutral-100"
                            title="Filtrar por esta combinação"
                          >
                            <Tag
                              variant={
                                aprovados === 0
                                  ? "danger"
                                  : rasa
                                    ? "warning"
                                    : "success"
                              }
                              size="sm"
                            >
                              {aprovados}
                            </Tag>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-unooria-neutral-500">
            Esperado ~{dados.esperadoPorCelula} por célula. Vermelho é célula
            vazia (bloqueia a ativação); amarelo é célula rasa. Clique num número
            para filtrar a grade.
          </p>
        </Card>
      ) : null}

      {aviso ? (
        <AlertBox
          theme="light"
          variant={pendencias.length > 0 ? "warning" : "error"}
          device="auto"
          title={pendencias.length > 0 ? "Ainda falta alguma coisa" : undefined}
          description={aviso}
          primaryAction={
            pendencias.length > 0
              ? {
                  label: "Ativar mesmo assim",
                  onClick: () => void ativar(true),
                  variant: "danger",
                }
              : undefined
          }
        />
      ) : null}

      <Card variant="outlined">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            className="unooria-select"
            aria-label="Filtrar por lado"
            value={filtros.lado}
            onChange={(evento) => trocarFiltro("lado", evento.target.value)}
          >
            <option value="">Todos os lados</option>
            <option value="A">Lado A</option>
            <option value="B">Lado B</option>
            <option value="neutro">Neutros</option>
          </select>

          <select
            className="unooria-select"
            aria-label="Filtrar por perfil de linguagem"
            value={filtros.perfil}
            onChange={(evento) => trocarFiltro("perfil", evento.target.value)}
          >
            <option value="">Todos os perfis</option>
            {PERFIS.map((perfil) => (
              <option key={perfil} value={perfil}>
                {FICHAS[perfil].rotulo}
              </option>
            ))}
          </select>

          <select
            className="unooria-select"
            aria-label="Filtrar por intensidade"
            value={filtros.intensidade}
            onChange={(evento) =>
              trocarFiltro("intensidade", evento.target.value)
            }
          >
            <option value="">Todas as intensidades</option>
            <option value="1">Intensidade 1</option>
            <option value="2">Intensidade 2</option>
            <option value="3">Intensidade 3</option>
          </select>

          <select
            className="unooria-select"
            aria-label="Filtrar por categoria"
            value={filtros.categoria}
            onChange={(evento) =>
              trocarFiltro("categoria", evento.target.value)
            }
          >
            <option value="">Todas as categorias</option>
            {(dados?.categorias ?? []).map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>

          <select
            className="unooria-select"
            aria-label="Filtrar por status da imagem"
            value={filtros.imagem}
            onChange={(evento) => trocarFiltro("imagem", evento.target.value)}
          >
            <option value="">Qualquer imagem</option>
            <option value="ok">Imagem gerada</option>
            <option value="fallback">Arte procedural</option>
            <option value="pendente">Na fila</option>
          </select>

          <select
            className="unooria-select"
            aria-label="Filtrar por aprovação"
            value={filtros.aprovado}
            onChange={(evento) => trocarFiltro("aprovado", evento.target.value)}
          >
            <option value="">Aprovados e não aprovados</option>
            <option value="sim">Só aprovados</option>
            <option value="nao">Só fora do feed</option>
          </select>
        </div>
      </Card>

      {carregando && !dados ? (
        <p className="text-[13px] text-unooria-neutral-500">
          Carregando posts…
        </p>
      ) : (
        <>
          <p className="text-[13px] text-unooria-neutral-500">
            {dados?.total ?? 0} posts no filtro atual
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(dados?.posts ?? []).map((post) => (
              <CartaoPost
                key={post.id}
                post={post}
                aoMudar={() => void buscar()}
              />
            ))}
          </div>

          {dados && dados.paginas > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                isDisabled={dados.page <= 1}
                onClick={() =>
                  setFiltros((atual) => ({ ...atual, page: atual.page - 1 }))
                }
              >
                Anterior
              </Button>
              <span className="text-[13px] text-unooria-neutral-700">
                página {dados.page} de {dados.paginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                isDisabled={dados.page >= dados.paginas}
                onClick={() =>
                  setFiltros((atual) => ({ ...atual, page: atual.page + 1 }))
                }
              >
                Próxima
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
