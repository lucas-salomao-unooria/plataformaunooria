"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertBox,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  SearchInput,
  SectionHeader,
  Selection,
  Table,
  Tabs,
  Tag,
  type TableColumn,
} from "@edu/ui/ds";
import type { Papel } from "@/lib/papeis";
import { rotuloDaSerie, type Serie } from "@/lib/series";

interface Matriculado extends Record<string, unknown> {
  matriculaId: string;
  id: string;
  nome: string;
  usuario: string;
  matricula: string | null;
  ativo: boolean;
  senhaProvisoria: boolean;
  /** Turma de referência do aluno — a que alimenta o cache e o token. */
  principal: boolean;
}

interface TurmaDaEscola {
  id: string;
  nome: string;
  serie: string;
}

interface EscolaDaRede {
  id: string;
  nome: string;
  municipio: string | null;
  uf: string | null;
}

interface Historico {
  aluno: { nome: string; usuario: string; cpf: string | null };
  escolas: Array<{
    id: string;
    nome: string;
    municipio: string | null;
    uf: string | null;
    entrada: string;
    saida: string | null;
    atual: boolean;
  }>;
  turmas: Array<{ escola: string; turma: string; serie: string; periodo: string; entrada: string; saida: string | null }>;
  participacoes: Array<{ escola: string; expId: string; em: string }>;
}

const dataCurta = (iso: string | null) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";

interface DadosDaTurma {
  turma: { id: string; nome: string; serie: string; turno: string | null; periodo: string };
  alunos: Matriculado[];
  professores: Matriculado[];
}

interface Candidato {
  id: string;
  nome: string;
  usuario: string;
  papel: string;
}

/**
 * A lista NOMINAL de quem está na turma — o ponto de todo o enturmamento.
 *
 * Remover alguém aqui ENCERRA a matrícula; não apaga linha nenhuma. O que o
 * aluno fez na Vila, no UnooTube e no unooGPT continua pendurado nela, e apagar
 * deixaria esse histórico órfão de turma.
 */
export function TurmaDetalhe({
  turmaId,
  papel,
  escolaId: escolaIdDaSessao,
}: {
  turmaId: string;
  papel: Papel;
  escolaId: string;
}) {
  const router = useRouter();
  /* `admin-contrato` chega com `?escolaId=` (a escola vem da lista de escolas,
     não do token dele, que não tem escola). Sem ler a URL, a api recusa com
     "informe ?escolaId=" e a tela abre vazia. */
  const escolaDaUrl = useSearchParams().get("escolaId") ?? "";
  const escolaId = escolaDaUrl || escolaIdDaSessao;
  const [dados, setDados] = useState<DadosDaTurma | null>(null);
  const [aba, setAba] = useState<"alunos" | "professores">("alunos");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [remover, setRemover] = useState<Matriculado | null>(null);
  const [mover, setMover] = useState<Matriculado | null>(null);
  const [destino, setDestino] = useState("");
  const [turmas, setTurmas] = useState<TurmaDaEscola[]>([]);

  const [historico, setHistorico] = useState<Historico | null>(null);
  const [transferir, setTransferir] = useState<Matriculado | null>(null);
  const [escolasDaRede, setEscolasDaRede] = useState<EscolaDaRede[]>([]);
  const [escolaDestino, setEscolaDestino] = useState("");

  const sufixo = useMemo(
    () => (papel === "admin-contrato" && escolaId ? `?escolaId=${encodeURIComponent(escolaId)}` : ""),
    [papel, escolaId],
  );

  const voltarParaTurmas = () =>
    router.push(`/admin/turmas${escolaDaUrl ? `?escolaId=${encodeURIComponent(escolaDaUrl)}` : ""}`);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/plataforma/turmas/${turmaId}${sufixo}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      setDados((await resposta.json()) as DadosDaTurma);
    } catch {
      setErro("Não foi possível carregar a turma.");
    } finally {
      setCarregando(false);
    }
  }, [turmaId, sufixo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const procurar = useCallback(
    async (termo: string) => {
      setBusca(termo);
      if (termo.trim().length < 2) {
        setCandidatos([]);
        return;
      }
      const params = new URLSearchParams({
        busca: termo.trim(),
        papel: aba === "alunos" ? "aluno" : "professor",
        porPagina: "10",
      });
      if (papel === "admin-contrato" && escolaId) params.set("escolaId", escolaId);
      const resposta = await fetch(`/api/plataforma/usuarios?${params}`);
      if (!resposta.ok) return;
      const corpo = (await resposta.json()) as { usuarios: Candidato[] };
      setCandidatos(corpo.usuarios);
    },
    [aba, papel, escolaId],
  );

  async function matricular(usuarioId: string) {
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/plataforma/turmas/${turmaId}/matriculas${sufixo}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuarioId, papel: aba === "alunos" ? "aluno" : "professor" }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      setAdicionarAberto(false);
      setBusca("");
      setCandidatos([]);
      await carregar();
    } catch {
      setErro("Não foi possível matricular.");
    } finally {
      setSalvando(false);
    }
  }

  async function abrirMover(linha: Matriculado) {
    setMover(linha);
    setDestino("");
    if (turmas.length === 0) {
      const resposta = await fetch(`/api/plataforma/turmas${sufixo}`);
      if (resposta.ok) setTurmas((await resposta.json()) as TurmaDaEscola[]);
    }
  }

  async function ajustar(matriculaId: string, corpo: Record<string, unknown>) {
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/plataforma/matriculas/${matriculaId}${sufixo}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      setMover(null);
      await carregar();
    } catch {
      setErro("Não foi possível ajustar a matrícula.");
    } finally {
      setSalvando(false);
    }
  }

  async function verHistorico(linha: Matriculado) {
    setHistorico(null);
    try {
      const resposta = await fetch(`/api/plataforma/alunos/${linha.id}/historico${sufixo}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      setHistorico((await resposta.json()) as Historico);
    } catch {
      setErro("Não foi possível carregar o histórico.");
    }
  }

  async function abrirTransferencia(linha: Matriculado) {
    setTransferir(linha);
    setEscolaDestino("");
    if (escolasDaRede.length === 0) {
      const resposta = await fetch("/api/plataforma/escolas");
      if (resposta.ok) setEscolasDaRede((await resposta.json()) as EscolaDaRede[]);
    }
  }

  async function confirmarTransferencia() {
    if (!transferir || !escolaDestino) return;
    setSalvando(true);
    try {
      const resposta = await fetch(
        `/api/plataforma/alunos/${transferir.id}/transferir?escolaId=${encodeURIComponent(escolaDestino)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ escolaDestinoId: escolaDestino }),
        },
      );
      if (!resposta.ok) throw new Error(String(resposta.status));
      setTransferir(null);
      await carregar();
    } catch {
      setErro("Não foi possível transferir.");
    } finally {
      setSalvando(false);
    }
  }

  async function encerrar() {
    if (!remover) return;
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/plataforma/matriculas/${remover.matriculaId}${sufixo}`, {
        method: "DELETE",
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      setRemover(null);
      await carregar();
    } catch {
      setErro("Não foi possível remover da turma.");
    } finally {
      setSalvando(false);
    }
  }

  const colunas = useMemo<TableColumn<Matriculado>[]>(
    () => [
      { key: "nome", title: "Nome" },
      { key: "usuario", title: "Login" },
      { key: "matricula", title: "Matrícula", render: (_, linha) => linha.matricula ?? "—" },
      {
        key: "situacao",
        title: "Situação",
        render: (_, linha) => {
          if (!linha.ativo) return <Tag>inativo</Tag>;
          if (linha.senhaProvisoria) return <Tag>sem primeiro acesso</Tag>;
          if (linha.principal) return <Tag>turma de referência</Tag>;
          return <span className="text-unooria-neutral-500">ativo</span>;
        },
      },
      {
        key: "acoes",
        title: "",
        align: "right",
        render: (_, linha) => (
          <div className="flex justify-end gap-1">
            {aba === "alunos" && !linha.principal ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void ajustar(linha.matriculaId, { principal: true })}
              >
                Tornar referência
              </Button>
            ) : null}
            {aba === "alunos" ? (
              <Button variant="ghost" size="sm" onClick={() => void verHistorico(linha)}>
                Histórico
              </Button>
            ) : null}
            {aba === "alunos" && papel === "admin-contrato" ? (
              <Button variant="ghost" size="sm" onClick={() => void abrirTransferencia(linha)}>
                Transferir
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => void abrirMover(linha)}>
              Mover
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRemover(linha)}>
              Remover
            </Button>
          </div>
        ),
      },
    ],
    // `ajustar` e `abrirMover` fecham sobre estado que muda a cada render; as
    // colunas só precisam ser recriadas quando a aba muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aba, papel],
  );

  const lista = aba === "alunos" ? (dados?.alunos ?? []) : (dados?.professores ?? []);

  return (
    <div className="plataforma-largura-cheia mx-auto flex max-w-[1080px] flex-col gap-6">
      <SectionHeader
        title={dados ? `Turma ${dados.turma.nome}` : "Turma"}
        description={
          dados
            ? `${rotuloDaSerie(dados.turma.serie as Serie)} · ${dados.turma.periodo}${
                dados.turma.turno ? ` · ${dados.turma.turno}` : ""
              }`
            : "Carregando…"
        }
      />

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      <Tabs
        theme="light"
        value={aba}
        onChange={(valor) => setAba(valor === "professores" ? "professores" : "alunos")}
        items={[
          { value: "alunos", label: "Alunos", badge: dados?.alunos.length ?? 0, showIcon: false },
          {
            value: "professores",
            label: "Professores",
            badge: dados?.professores.length ?? 0,
            showIcon: false,
          },
        ]}
      />

      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={voltarParaTurmas}>
          Voltar para as turmas
        </Button>
        <Button variant="primary" size="md" onClick={() => setAdicionarAberto(true)}>
          {aba === "alunos" ? "Adicionar aluno" : "Adicionar professor"}
        </Button>
      </div>

      <Table<Matriculado>
        columns={colunas}
        data={lista}
        keyExtractor={(linha) => linha.matriculaId}
        loading={carregando}
        emptyText={
          aba === "alunos"
            ? "Nenhum aluno matriculado nesta turma."
            : "Nenhum professor nesta turma — sem isso ele não vê a turma na área dele."
        }
        size="md"
        theme="light"
      />

      <Modal
        isOpen={adicionarAberto}
        onClose={() => setAdicionarAberto(false)}
        size="sm"
        theme="light"
      >
        <ModalHeader>
          <ModalTitle>{aba === "alunos" ? "Adicionar aluno" : "Adicionar professor"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3">
            <SearchInput
              id="buscar-pessoa"
              label="Buscar por nome, login ou matrícula"
              value={busca}
              onChange={(e) => void procurar(e.target.value)}
            />
            <ul className="flex flex-col gap-1">
              {candidatos.map((candidato) => (
                <li key={candidato.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-unooria-neutral-100"
                    onClick={() => void matricular(candidato.id)}
                    disabled={salvando}
                  >
                    <span className="text-unooria-neutral-950">{candidato.nome}</span>{" "}
                    <span className="text-unooria-neutral-500">({candidato.usuario})</span>
                  </button>
                </li>
              ))}
              {busca.trim().length >= 2 && candidatos.length === 0 ? (
                <li className="px-3 py-2 text-[14px] text-unooria-neutral-500">
                  Ninguém com esse nome. Quem ainda não existe entra pela importação.
                </li>
              ) : null}
            </ul>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setAdicionarAberto(false)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(historico)} onClose={() => setHistorico(null)} size="md" theme="light">
        <ModalHeader>
          <ModalTitle>Histórico de {historico?.aluno.nome}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-5">
            <p className="text-[13px] text-unooria-neutral-500">
              {historico?.aluno.usuario}
              {historico?.aluno.cpf ? ` · CPF ${historico.aluno.cpf}` : ""}
            </p>

            <section className="flex flex-col gap-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
                Escolas
              </h3>
              <ul className="flex flex-col gap-1">
                {historico?.escolas.map((escola) => (
                  <li key={`${escola.id}-${escola.entrada}`} className="text-[14px]">
                    <strong className="text-unooria-neutral-950">{escola.nome}</strong>
                    {escola.municipio ? (
                      <span className="text-unooria-neutral-500">
                        {" "}
                        · {escola.municipio}
                        {escola.uf ? `/${escola.uf}` : ""}
                      </span>
                    ) : null}
                    <span className="text-unooria-neutral-500">
                      {" "}
                      · {dataCurta(escola.entrada)} —{" "}
                      {escola.atual ? "hoje" : dataCurta(escola.saida)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
                Turmas
              </h3>
              <ul className="flex flex-col gap-1">
                {historico?.turmas.map((t, i) => (
                  <li key={i} className="text-[14px] text-unooria-neutral-700">
                    {t.escola} · <strong className="text-unooria-neutral-950">{t.turma}</strong> ·{" "}
                    {t.periodo} · {dataCurta(t.entrada)} — {t.saida ? dataCurta(t.saida) : "hoje"}
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
                Missões em que esteve
              </h3>
              {historico && historico.participacoes.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {historico.participacoes.map((p, i) => (
                    <li key={i} className="text-[14px] text-unooria-neutral-700">
                      {p.expId} · {p.escola} · {dataCurta(p.em)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-unooria-neutral-500">
                  Nenhuma missão registrada ainda.
                </p>
              )}
              <p className="text-[13px] text-unooria-neutral-500">
                O que a criança fez em cada missão fica com quem tem a posse pedagógica na escola
                onde aconteceu — aqui aparece que ela esteve, não o que respondeu.
              </p>
            </section>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" size="md" onClick={() => setHistorico(null)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(transferir)} onClose={() => setTransferir(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Transferir de escola</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-unooria-neutral-700">
              <strong>{transferir?.nome}</strong> sai desta escola e entra na escolhida. A conta é a
              mesma pessoa — o que ela já fez continua registrado na escola onde aconteceu, e o
              histórico dela passa a mostrar as duas.
            </p>
            <Selection
              label="Escola de destino"
              value={escolaDestino}
              onChange={(valor) => setEscolaDestino(String(valor))}
              options={escolasDaRede
                .filter((e) => e.id !== escolaId)
                .map((e) => ({
                  value: e.id,
                  label: e.municipio ? `${e.nome} · ${e.municipio}` : e.nome,
                }))}
            />
            <p className="text-[13px] text-unooria-neutral-500">
              Ela chega sem turma na escola nova — quem enturma é a coordenação de lá.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setTransferir(null)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={salvando}
            disabled={!escolaDestino}
            onClick={() => void confirmarTransferencia()}
          >
            Transferir
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(mover)} onClose={() => setMover(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Mover de turma</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-unooria-neutral-700">
              <strong>{mover?.nome}</strong> sai desta turma e entra na escolhida, num passo. A
              matrícula antiga é encerrada, não apagada — é ela que dá turma ao que a pessoa já fez.
            </p>
            <Selection
              label="Turma de destino"
              value={destino}
              onChange={(valor) => setDestino(String(valor))}
              options={turmas
                .filter((t) => t.id !== turmaId)
                .map((t) => ({ value: t.id, label: `${t.nome} · ${t.serie}` }))}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setMover(null)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={salvando}
            disabled={!destino}
            onClick={() => void ajustar(mover!.matriculaId, { turmaDestinoId: destino })}
          >
            Mover
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(remover)} onClose={() => setRemover(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Remover da turma</ModalTitle>
        </ModalHeader>
        <ModalBody>
          Tirar <strong>{remover?.nome}</strong> desta turma? A conta continua existindo e o que já
          foi feito nas missões continua guardado — só o vínculo com a turma é encerrado.
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setRemover(null)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" isLoading={salvando} onClick={() => void encerrar()}>
            Remover
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
