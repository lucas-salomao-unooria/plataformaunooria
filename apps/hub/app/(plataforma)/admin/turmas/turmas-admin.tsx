"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertBox,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  SectionHeader,
  Selection,
  Table,
  TextField,
  type TableColumn,
} from "@edu/ui/ds";
import type { Papel } from "@/lib/papeis";
import { SERIES, rotuloDaSerie, type Serie } from "@/lib/series";

interface LinhaDeTurma extends Record<string, unknown> {
  id: string;
  nome: string;
  serie: string;
  turno: string | null;
  periodo: string | null;
  alunos: number;
  professores: number;
}

const TURNOS = [
  { valor: "manha", rotulo: "Manhã" },
  { valor: "tarde", rotulo: "Tarde" },
  { valor: "noite", rotulo: "Noite" },
  { valor: "integral", rotulo: "Integral" },
] as const;

/**
 * As turmas da escola, com quantas pessoas cada uma tem.
 *
 * A contagem na lista não é enfeite: turma com 0 alunos é o sintoma nº 1 de
 * importação que entrou pela metade, e sem ela o gestor só descobriria pela
 * reclamação do professor.
 */
export function TurmasAdmin({ papel, escolaIdInicial }: { papel: Papel; escolaIdInicial: string }) {
  const router = useRouter();
  const [escolaId, setEscolaId] = useState(escolaIdInicial);
  const [linhas, setLinhas] = useState<LinhaDeTurma[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [novaAberta, setNovaAberta] = useState(false);
  const [nome, setNome] = useState("");
  const [serie, setSerie] = useState<Serie | "">("");
  const [turno, setTurno] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const sufixo = useMemo(
    () => (papel === "admin-contrato" && escolaId ? `?escolaId=${encodeURIComponent(escolaId)}` : ""),
    [papel, escolaId],
  );

  const carregar = useCallback(async () => {
    if (papel === "admin-contrato" && !escolaId) return;
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/plataforma/turmas${sufixo}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      setLinhas((await resposta.json()) as LinhaDeTurma[]);
    } catch {
      setErro("Não foi possível carregar as turmas. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }, [papel, escolaId, sufixo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criar() {
    if (!nome.trim() || !serie) return;
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/plataforma/turmas${sufixo}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), serie, ...(turno ? { turno } : {}) }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      setNovaAberta(false);
      setNome("");
      setSerie("");
      setTurno("");
      await carregar();
    } catch {
      setErro("Não foi possível criar a turma. Confira se o nome já existe neste ano letivo.");
    } finally {
      setSalvando(false);
    }
  }

  const colunas = useMemo<TableColumn<LinhaDeTurma>[]>(
    () => [
      { key: "nome", title: "Turma" },
      {
        key: "serie",
        title: "Série",
        render: (_, linha) => rotuloDaSerie(linha.serie as Serie),
      },
      {
        key: "turno",
        title: "Turno",
        render: (_, linha) =>
          TURNOS.find((t) => t.valor === linha.turno)?.rotulo ?? "—",
      },
      { key: "periodo", title: "Ano letivo", render: (_, linha) => linha.periodo ?? "—" },
      { key: "alunos", title: "Alunos", align: "right" },
      { key: "professores", title: "Professores", align: "right" },
      {
        key: "acoes",
        title: "",
        align: "right",
        render: (_, linha) => (
          <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/turmas/${linha.id}`)}>
            Abrir
          </Button>
        ),
      },
    ],
    [router],
  );

  return (
    <div className="plataforma-largura-cheia mx-auto flex max-w-[1080px] flex-col gap-6">
      <SectionHeader
        title="Turmas"
        description="Enturmamento da escola no ano letivo corrente. Abrir uma turma mostra quem está nela."
      />

      {papel === "admin-contrato" ? (
        <div className="max-w-[320px]">
          <TextField
            id="escola"
            label="Escola (id)"
            value={escolaId}
            onChange={(e) => setEscolaId(e.target.value)}
          />
        </div>
      ) : null}

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-[14px] text-unooria-neutral-500">
          {linhas.length} turma{linhas.length === 1 ? "" : "s"}
        </p>
        <Button variant="primary" size="md" onClick={() => setNovaAberta(true)}>
          Nova turma
        </Button>
      </div>

      <Table<LinhaDeTurma>
        columns={colunas}
        data={linhas}
        keyExtractor={(linha) => linha.id}
        loading={carregando}
        emptyText="Nenhuma turma ainda — importe a planilha de pessoas e as turmas nascem com ela."
        size="md"
        theme="light"
      />

      <Modal isOpen={novaAberta} onClose={() => setNovaAberta(false)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Nova turma</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <TextField
              id="turma-nome"
              label="Nome"
              placeholder="8A"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <Selection
              label="Série"
              value={serie}
              onChange={(valor) => setSerie(String(valor) as Serie)}
              options={SERIES.map((s) => ({ value: s, label: rotuloDaSerie(s) }))}
            />
            <Selection
              label="Turno"
              value={turno}
              onChange={(valor) => setTurno(String(valor))}
              options={TURNOS.map((t) => ({ value: t.valor, label: t.rotulo }))}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setNovaAberta(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={salvando}
            disabled={!nome.trim() || !serie}
            onClick={() => void criar()}
          >
            Criar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
