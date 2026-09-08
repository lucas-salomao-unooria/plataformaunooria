"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertBox,
  Button,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ScrollBar,
  SearchInput,
  SectionHeader,
  Selection,
  Table,
  Tag,
  TextField,
  type TableColumn,
} from "@edu/ui/ds";

interface Regional extends Record<string, unknown> {
  id: string;
  nome: string;
  tipo: string;
  unidades: number;
  regionalPadrao: boolean;
}

/**
 * AS REGIONAIS DA REDE — Diretoria de Ensino, polo, secretaria municipal.
 *
 * Tela separada de Escolas desde 2026-09-08 (ADR-79). As duas conviviam numa
 * tabela só, com o tipo numa etiqueta e as colunas de turma, estudante e
 * professor imprimindo "—" na metade das linhas; o resumo somava os dois níveis
 * ("3 registros · 2 unidades") e havia um filtro de Tipo cuja única função era
 * desfazer a mistura. Separando, o filtro deixou de existir.
 *
 * A regional AGRUPA e não autoriza: quem dá acesso é a lotação, e é por isso que
 * "Ver escolas" leva à listagem de Escolas filtrada em vez de abrir aqui uma
 * visão somada da diretoria — somar escolas numa métrica só é exatamente a tela
 * que a ADR-34 recusa.
 */
export function RegionaisDaRede() {
  const router = useRouter();
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aberta, setAberta] = useState<"nova" | Regional | null>(null);
  const [id, setId] = useState("");
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  /** A regional que o diálogo de exclusão está tratando, e o destino escolhido. */
  const [excluindo, setExcluindo] = useState<Regional | null>(null);
  const [destino, setDestino] = useState("");
  const [apagando, setApagando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ tipo: "regional" });
      if (busca.trim()) params.set("busca", busca.trim());
      const resposta = await fetch(`/api/plataforma/escolas?${params}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      setRegionais((await resposta.json()) as Regional[]);
    } catch {
      setErro("Não foi possível carregar as regionais.");
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), busca ? 300 : 0);
    return () => clearTimeout(t);
  }, [carregar, busca]);

  function abrirNova() {
    setId("");
    setNome("");
    setAberta("nova");
  }

  function abrirEdicao(regional: Regional) {
    setId(regional.id);
    setNome(regional.nome);
    setAberta(regional);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const nova = aberta === "nova";
      const resposta = await fetch(
        nova ? "/api/plataforma/escolas" : `/api/plataforma/escolas/${id}`,
        {
          method: nova ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            nova ? { id: id.trim(), tipo: "regional", nome: nome.trim() } : { nome: nome.trim() },
          ),
        },
      );
      const dados = (await resposta.json().catch(() => null)) as { message?: string } | null;
      if (!resposta.ok) {
        setErro(
          typeof dados?.message === "string"
            ? dados.message
            : "Não foi possível salvar. Confira o id da regional.",
        );
        return;
      }
      setAberta(null);
      await carregar();
    } catch {
      setErro("Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  // ------------------------------------------------------------- exclusão

  /**
   * As outras regionais — os destinos possíveis das escolas desta.
   *
   * Lista vazia só acontece quando esta é a única regional da rede, e nesse caso
   * o diálogo não oferece transferência: ele explica o impedimento. É a razão de
   * o botão abrir SEMPRE o diálogo em vez de decidir aqui — clique sem reação
   * visível é indistinguível de botão quebrado.
   */
  const destinos = useMemo(
    () => regionais.filter((r) => r.id !== excluindo?.id),
    [regionais, excluindo],
  );
  const ultimaDaRede = excluindo !== null && destinos.length === 0;
  const precisaTransferir = (excluindo?.unidades ?? 0) > 0;

  function abrirExclusao(regional: Regional) {
    setDestino("");
    setErro(null);
    setExcluindo(regional);
  }

  async function excluir() {
    if (!excluindo) return;
    setApagando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      /* O destino vai na MESMA chamada da exclusão: em duas, existiria a janela
         em que as escolas já mudaram de regional e a antiga continua na lista —
         e é nessa janela que quem está com a tela aberta recarrega. */
      if (precisaTransferir && destino) params.set("transferirPara", destino);
      const consulta = params.toString();
      const resposta = await fetch(
        `/api/plataforma/escolas/${excluindo.id}${consulta ? `?${consulta}` : ""}`,
        { method: "DELETE" },
      );
      const dados = (await resposta.json().catch(() => null)) as { message?: string } | null;
      if (!resposta.ok) {
        setErro(
          typeof dados?.message === "string"
            ? dados.message
            : "Não foi possível excluir a regional.",
        );
        return;
      }
      setExcluindo(null);
      await carregar();
    } catch {
      setErro("Não foi possível excluir a regional.");
    } finally {
      setApagando(false);
    }
  }

  const colunas = useMemo<TableColumn<Regional>[]>(
    () => [
      {
        key: "nome",
        title: "Regional",
        render: (_, l) => (
          <span>
            {String(l.nome)}
            {l.regionalPadrao ? (
              <>
                {" "}
                <Tag variant="brand" size="sm">
                  Regional padrão
                </Tag>
              </>
            ) : null}
            <span className="block text-[12px] text-unooria-neutral-500">
              <code>{String(l.id)}</code>
            </span>
          </span>
        ),
      },
      {
        key: "unidades",
        title: "Escolas",
        align: "right",
        render: (_, l) => String(l.unidades),
      },
      {
        key: "acoes",
        title: "",
        align: "right",
        render: (_, l) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/escolas?regional=${encodeURIComponent(l.id)}`)}
            >
              Ver escolas
            </Button>
            <Button variant="ghost" size="sm" onClick={() => abrirEdicao(l)}>
              Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => abrirExclusao(l)}>
              Excluir
            </Button>
          </div>
        ),
      },
    ],
    [router],
  );

  const escolasVinculadas = regionais.reduce((soma, r) => soma + r.unidades, 0);

  return (
    <div className="plataforma-largura-cheia flex flex-col gap-6">
      <SectionHeader
        title="Regionais"
        description="Cadastre as regionais da rede e consulte as escolas vinculadas a cada uma."
      />

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-[280px]">
          <SearchInput
            id="busca-regional"
            label="Buscar regional"
            placeholder="Nome ou id"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button variant="primary" size="md" onClick={abrirNova}>
          Cadastrar regional
        </Button>
      </div>

      {/* Os totais são do escopo DESTA tela: regionais, e o quanto elas agrupam.
          Turmas e estudantes não sobem para cá — a regional não é uma escola
          grande, e somar as unidades dela numa métrica só seria a visão que a
          ADR-34 recusa. */}
      <p className="text-[14px] text-unooria-neutral-500">
        {regionais.length} regional{regionais.length === 1 ? "" : "is"} · {escolasVinculadas} escola
        {escolasVinculadas === 1 ? "" : "s"} vinculada{escolasVinculadas === 1 ? "" : "s"}
      </p>

      <ScrollBar orientation="both" autoHide className="tabela-rolavel">
        <Table<Regional>
          columns={colunas}
          data={regionais}
          keyExtractor={(l) => l.id}
          loading={carregando}
          emptyText="Nenhuma regional encontrada."
          size="md"
          theme="light"
        />
      </ScrollBar>

      <FeedbackAlert
        type="info"
        title="Toda escola pertence a uma regional"
        description="A rede sempre tem pelo menos uma. A regional padrão reúne as escolas de redes que não possuem divisão em regionais — o nome dela pode ser trocado em Editar."
      />

      <Modal isOpen={aberta !== null} onClose={() => setAberta(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>{aberta === "nova" ? "Cadastrar regional" : "Editar regional"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <TextField
              id="regional-id"
              /* "Código interno" nas DUAS telas: o formulário de escola diz o
                 mesmo, e um rótulo por tela para o mesmo campo é a divergência
                 que ninguém percebe até alguém comparar as duas. */
              label="Código interno"
              helperText="Não muda depois: use letras minúsculas, números, ponto, hífen (ex.: de-campinas-leste)."
              value={id}
              disabled={aberta !== "nova"}
              onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
            />
            <TextField
              id="regional-nome"
              label="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            {aberta !== "nova" && aberta?.regionalPadrao ? (
              <FeedbackAlert
                type="info"
                title="Regional padrão"
                description="Criada automaticamente para reunir as escolas de redes que não possuem divisão em regionais. O nome pode ser trocado pelo da rede."
              />
            ) : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setAberta(null)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={salvando}
            disabled={!nome.trim() || (aberta === "nova" && id.trim().length < 3)}
            onClick={() => void salvar()}
          >
            {aberta === "nova" ? "Cadastrar" : "Salvar"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={excluindo !== null} onClose={() => setExcluindo(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Excluir regional</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {ultimaDaRede ? (
              <AlertBox
                theme="light"
                variant="error"
                device="auto"
                description="A rede precisa ter pelo menos uma regional."
              />
            ) : precisaTransferir ? (
              <>
                <p className="text-[14px] text-unooria-neutral-700">
                  {excluindo?.nome} agrupa {excluindo?.unidades} escola
                  {excluindo?.unidades === 1 ? "" : "s"}. Transfira as escolas para outra regional
                  antes de excluir esta regional.
                </p>
                <Selection
                  id="destino-da-transferencia"
                  label="Transferir as escolas para"
                  value={destino}
                  options={[
                    { value: "", label: "Selecione uma regional" },
                    ...destinos.map((r) => ({ value: r.id, label: r.nome })),
                  ]}
                  onChange={(v) => setDestino(String(v))}
                />
              </>
            ) : (
              <p className="text-[14px] text-unooria-neutral-700">
                Nenhuma escola está vinculada a {excluindo?.nome}. A exclusão não afeta escola,
                turma nem pessoa.
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setExcluindo(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="md"
            isLoading={apagando}
            disabled={ultimaDaRede || (precisaTransferir && !destino)}
            onClick={() => void excluir()}
          >
            {precisaTransferir ? "Transferir e excluir" : "Excluir"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
