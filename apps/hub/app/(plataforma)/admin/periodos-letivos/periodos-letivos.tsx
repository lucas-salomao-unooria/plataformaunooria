"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  SectionHeader,
  Selection,
  Table,
  Tag,
  TextField,
  type TableColumn,
} from "@edu/ui/ds";
import type { Papel } from "@/lib/papeis";

interface Periodo extends Record<string, unknown> {
  id: string;
  tipo: string;
  titulo: string;
  ano: number;
  inicio: string;
  fim: string;
  vigente: boolean;
  turmas: number;
}

const TIPOS = [
  { value: "ano_letivo", label: "Ano letivo" },
  { value: "semestre", label: "Semestre" },
  { value: "bimestre", label: "Bimestre" },
  { value: "trimestre", label: "Trimestre" },
];

const soData = (iso: string) => iso.slice(0, 10);
const emPtBr = (iso: string) => soData(iso).split("-").reverse().join("/");

/**
 * O calendário do CONTRATO — a tela da virada do ano.
 *
 * Sem ela, criar o ano letivo seguinte era `curl` ou `psql`: a rota existia e o
 * caminho de gestor não. E é a operação que decide se o histórico sobrevive a
 * fevereiro — turma vive DENTRO de um período, então o "8A de 2027" só pode
 * nascer depois que 2027 existir.
 *
 * `vigente` vem calculado do servidor: é derivado das datas, não coluna, e
 * repetir a regra aqui abriria a chance de a tela discordar de onde a turma nova
 * vai cair.
 */
export function PeriodosLetivos({ papel }: { papel: Papel }) {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("ano_letivo");
  const [ano, setAno] = useState(String(new Date().getFullYear() + 1));
  const [titulo, setTitulo] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/plataforma/periodos-letivos");
      if (!resposta.ok) throw new Error(String(resposta.status));
      setPeriodos((await resposta.json()) as Periodo[]);
    } catch {
      setErro("Não foi possível carregar o calendário.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Sugere ano civil inteiro: o gestor ajusta se a rede começa em fevereiro. */
  function abrir() {
    const proximo = String(new Date().getFullYear() + 1);
    setTipo("ano_letivo");
    setAno(proximo);
    setTitulo(`Ano letivo ${proximo}`);
    setInicio(`${proximo}-01-01`);
    setFim(`${proximo}-12-31`);
    setAberto(true);
  }

  async function criar() {
    setSalvando(true);
    try {
      const resposta = await fetch("/api/plataforma/periodos-letivos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo, titulo: titulo.trim(), ano: Number(ano), inicio, fim }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      setAberto(false);
      await carregar();
    } catch {
      setErro("Não foi possível criar. Confira se já não existe um com este título.");
    } finally {
      setSalvando(false);
    }
  }

  const colunas = useMemo<TableColumn<Periodo>[]>(
    () => [
      { key: "titulo", title: "Período" },
      {
        key: "tipo",
        title: "Tipo",
        render: (_, linha) => TIPOS.find((t) => t.value === linha.tipo)?.label ?? String(linha.tipo),
      },
      {
        key: "datas",
        title: "De / até",
        render: (_, linha) => `${emPtBr(linha.inicio)} — ${emPtBr(linha.fim)}`,
      },
      { key: "turmas", title: "Turmas", align: "right" },
      {
        key: "situacao",
        title: "Situação",
        render: (_, linha) =>
          linha.vigente ? (
            <Tag>vigente hoje</Tag>
          ) : (
            <span className="text-unooria-neutral-500">—</span>
          ),
      },
    ],
    [],
  );

  const semVigente = !carregando && periodos.length > 0 && !periodos.some((p) => p.vigente);

  return (
    <div className="plataforma-largura-cheia mx-auto flex max-w-[1080px] flex-col gap-6">
      <SectionHeader
        title="Ano letivo"
        description="O calendário é do contrato, não da escola: uma rede compartilha o ano letivo. Toda turma vive dentro de um deles."
      />

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      {periodos.length === 0 && !carregando ? (
        <FeedbackAlert
          type="warning"
          title="Nenhum período cadastrado"
          description="Sem um ano letivo não dá para criar turma nem importar pessoas — a turma precisa de um período para morar. Crie o ano letivo corrente para começar."
        />
      ) : null}

      {semVigente ? (
        <FeedbackAlert
          type="warning"
          title="Nenhum período contém a data de hoje"
          description="A plataforma cai no mais recente para não travar, mas turma nova e importação vão para o ano errado. Crie ou corrija as datas do ano letivo corrente."
        />
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-[14px] text-unooria-neutral-500">
          {periodos.length} período{periodos.length === 1 ? "" : "s"}
        </p>
        {papel === "gestor" || papel === "admin-contrato" ? (
          <Button variant="primary" size="md" onClick={abrir}>
            Novo período
          </Button>
        ) : null}
      </div>

      <ScrollBar orientation="both" autoHide className="tabela-rolavel">
        <Table<Periodo>
          columns={colunas}
          data={periodos}
          keyExtractor={(linha) => linha.id}
          loading={carregando}
          emptyText="Nenhum período letivo ainda."
          size="md"
          theme="light"
        />
      </ScrollBar>

      <FeedbackAlert
        type="info"
        title="A virada do ano, em duas etapas"
        description="1) Crie o ano letivo novo aqui — a partir do dia em que ele começa, ele passa a ser o vigente e toda turma nova nasce nele. 2) Importe o enturmamento do ano novo em Importar. As turmas e as matrículas do ano anterior continuam onde estão: é isso que preserva o histórico."
      />

      <Modal isOpen={aberto} onClose={() => setAberto(false)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Novo período letivo</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <Selection
              label="Tipo"
              value={tipo}
              onChange={(valor) => setTipo(String(valor))}
              options={TIPOS}
            />
            <TextField
              id="titulo"
              label="Título"
              helperText="Como aparece nas telas. Precisa ser único."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <TextField
              id="ano"
              label="Ano"
              value={ano}
              onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <div className="flex gap-3">
              <TextField
                id="inicio"
                label="Início"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
              <TextField
                id="fim"
                label="Fim"
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
            <p className="text-[13px] text-unooria-neutral-500">
              As datas decidem qual período é o vigente — é nele que turma nova e importação caem.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={salvando}
            disabled={!titulo.trim() || !inicio || !fim || ano.length !== 4}
            onClick={() => void criar()}
          >
            Criar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
