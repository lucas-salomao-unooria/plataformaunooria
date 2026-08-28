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
  SearchInput,
  SectionHeader,
  Table,
  TextField,
  type TableColumn,
} from "@edu/ui/ds";

interface Escola extends Record<string, unknown> {
  id: string;
  nome: string;
  tipo: string;
  codigoInep: string | null;
  municipio: string | null;
  uf: string | null;
  alunos: number;
  professores: number;
  turmas: number;
}

/**
 * As escolas do contrato — a tela que faltava para vender a uma rede.
 *
 * Só `admin-contrato` chega aqui, e a razão é a mesma que impede `orgs.csv` de
 * criar escola para gestor: escola é *tenant*, com RLS, dados de menores e stack
 * por trás. Abrir um inquilino novo não é operação de quem administra uma
 * unidade.
 */
export function EscolasDaRede() {
  const router = useRouter();
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aberta, setAberta] = useState<"nova" | Escola | null>(null);
  const [id, setId] = useState("");
  const [nome, setNome] = useState("");
  const [inep, setInep] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set("busca", busca.trim());
      const resposta = await fetch(`/api/plataforma/escolas?${params}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      setEscolas((await resposta.json()) as Escola[]);
    } catch {
      setErro("Não foi possível carregar as escolas.");
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    const id = setTimeout(() => void carregar(), busca ? 300 : 0);
    return () => clearTimeout(id);
  }, [carregar, busca]);

  function abrirNova() {
    setId("");
    setNome("");
    setInep("");
    setMunicipio("");
    setUf("");
    setAberta("nova");
  }

  function abrirEdicao(escola: Escola) {
    setId(escola.id);
    setNome(escola.nome);
    setInep(escola.codigoInep ?? "");
    setMunicipio(escola.municipio ?? "");
    setUf(escola.uf ?? "");
    setAberta(escola);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const corpo = {
      nome: nome.trim(),
      codigoInep: inep.trim(),
      municipio: municipio.trim(),
      uf: uf.trim().toUpperCase(),
    };
    try {
      const nova = aberta === "nova";
      const resposta = await fetch(
        nova ? "/api/plataforma/escolas" : `/api/plataforma/escolas/${id}`,
        {
          method: nova ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nova ? { id: id.trim(), ...corpo } : corpo),
        },
      );
      const dados = (await resposta.json().catch(() => null)) as { message?: string } | null;
      if (!resposta.ok) {
        setErro(
          typeof dados?.message === "string"
            ? dados.message
            : "Não foi possível salvar. Confira o id e o código INEP.",
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

  const colunas = useMemo<TableColumn<Escola>[]>(
    () => [
      { key: "nome", title: "Escola" },
      { key: "id", title: "Id", render: (_, l) => <code>{String(l.id)}</code> },
      { key: "codigoInep", title: "INEP", render: (_, l) => l.codigoInep ?? "—" },
      {
        key: "local",
        title: "Município",
        render: (_, l) => (l.municipio ? `${l.municipio}${l.uf ? `/${l.uf}` : ""}` : "—"),
      },
      { key: "turmas", title: "Turmas", align: "right" },
      { key: "alunos", title: "Alunos", align: "right" },
      { key: "professores", title: "Professores", align: "right" },
      {
        key: "acoes",
        title: "",
        align: "right",
        render: (_, l) => (
          <div className="flex justify-end gap-1">
            {/* Sem isto o admin do contrato teria de digitar o id da escola em
                cada tela — e o id é justamente o que ele não decora. */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/turmas?escolaId=${encodeURIComponent(l.id)}`)}
            >
              Turmas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/usuarios?escolaId=${encodeURIComponent(l.id)}`)}
            >
              Pessoas
            </Button>
            <Button variant="ghost" size="sm" onClick={() => abrirEdicao(l)}>
              Editar
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const totais = escolas.reduce(
    (soma, e) => ({
      alunos: soma.alunos + e.alunos,
      professores: soma.professores + e.professores,
      turmas: soma.turmas + e.turmas,
    }),
    { alunos: 0, professores: 0, turmas: 0 },
  );

  return (
    <div className="plataforma-largura-cheia mx-auto flex max-w-[1180px] flex-col gap-6">
      <SectionHeader
        title="Escolas da rede"
        description="Cada escola é um espaço isolado: os dados de uma nunca aparecem na outra. O que atravessa é a pessoa — professor lotado em várias, aluno transferido."
      />

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-[320px]">
          <SearchInput
            id="busca-escola"
            label="Buscar"
            placeholder="Nome, id, INEP ou município"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button variant="primary" size="md" onClick={abrirNova}>
          Nova escola
        </Button>
      </div>

      <p className="text-[14px] text-unooria-neutral-500">
        {escolas.length} escola{escolas.length === 1 ? "" : "s"} · {totais.turmas} turmas ·{" "}
        {totais.alunos} alunos · {totais.professores} vínculos de professor
      </p>

      <Table<Escola>
        columns={colunas}
        data={escolas}
        keyExtractor={(l) => l.id}
        loading={carregando}
        emptyText="Nenhuma escola encontrada."
        size="md"
        theme="light"
      />

      <FeedbackAlert
        type="info"
        title="Cadastrar uma rede inteira"
        description="Uma escola por vez aqui, ou o orgs.csv do OneRoster em Importar — que só o admin do contrato pode usar para criar escola. Milhares de unidades não entram à mão."
      />

      <Modal isOpen={aberta !== null} onClose={() => setAberta(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>{aberta === "nova" ? "Nova escola" : "Editar escola"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <TextField
              id="escola-id"
              label="Id da escola"
              helperText="Não muda depois. Circula no token e na segurança do banco: use letras minúsculas, números, ponto, hífen (ex.: sp-035001)."
              value={id}
              disabled={aberta !== "nova"}
              onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
            />
            <TextField
              id="escola-nome"
              label="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <TextField
              id="escola-inep"
              label="Código INEP (opcional)"
              helperText="8 dígitos. É por ele que a escola se reconhece na base da rede."
              value={inep}
              onChange={(e) => setInep(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
            <div className="flex gap-3">
              <TextField
                id="escola-municipio"
                label="Município"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
              />
              <div className="w-[90px]">
                <TextField
                  id="escola-uf"
                  label="UF"
                  value={uf}
                  onChange={(e) =>
                    setUf(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))
                  }
                />
              </div>
            </div>
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
            {aberta === "nova" ? "Criar" : "Salvar"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
