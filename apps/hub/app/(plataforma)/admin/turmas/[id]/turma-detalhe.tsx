"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertBox,
  Button,
  FeedbackAlert,
  FileUpload,
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
  Tabs,
  Tag,
  type TableColumn,
} from "@edu/ui/ds";
import { RotuloDaTrilha } from "@/components/trilha";
import type { Papel } from "@/lib/papeis";
import { rotuloDaSerie, type Serie } from "@/lib/series";
import type { MissaoDaSalaDoProfessor } from "@/lib/salas";

interface Matriculado extends Record<string, unknown> {
  matriculaId: string;
  id: string;
  nome: string;
  usuario: string;
  matricula: string | null;
  ativo: boolean;
  senhaProvisoria: boolean;
  /** Turma de referência do estudante — a que alimenta o cache e o token. */
  principal: boolean;
}

/** Um perfil que veio de OUTRA instalação da plataforma. */
interface PerfilRecebido {
  id: string;
  emissor: string;
  emissorNome: string | null;
  emissorHub: string;
  emitidoEm: string;
  verificacao: "verificada" | "nao-verificada";
  importadoEm: string;
  escolas: number;
  turmas: number;
  participacoes: number;
  resultados: number;
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
  estudante?: { nome: string; usuario: string; cpf: string | null };
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
  estudantes?: Matriculado[];
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
 * estudante fez na Vila, no UnooTube e no unooGPT continua pendurado nela, e apagar
 * a linha apagaria o histórico da turma.
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
  const [aba, setAba] = useState<"estudantes" | "professores" | "missoes">("estudantes");
  /**
   * A SALA, em LEITURA (ADR-69). O gestor vê o que está aberto na turma e quem
   * abriu; quem libera é quem tem matrícula de professor nela — a rota de
   * escrita recusa o gestor, e a tela não oferece o botão. É a mesma linha que
   * separa administrar a escola de dar a aula.
   */
  const [missoes, setMissoes] = useState<MissaoDaSalaDoProfessor[] | null>(null);
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

  const [portatil, setPortatil] = useState<Matriculado | null>(null);
  const [recebidos, setRecebidos] = useState<PerfilRecebido[] | null>(null);
  const [importando, setImportando] = useState(false);
  const [avisoDoPerfil, setAvisoDoPerfil] = useState<string | null>(null);
  const [perfilVerificado, setPerfilVerificado] = useState(false);
  const [erroDoPerfil, setErroDoPerfil] = useState<string | null>(null);

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

  /* Carrega a grade UMA vez, junto com a turma. Falha em silêncio: a tela do
     gestor é de enturmamento, e a sala é informação a mais — derrubá-la inteira
     porque a grade não veio seria trocar um problema por outro maior. */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`/api/plataforma/salas/turma/${turmaId}${sufixo}`);
        if (!r.ok) return;
        const corpo = (await r.json()) as { missoes: MissaoDaSalaDoProfessor[] };
        if (vivo) setMissoes(corpo.missoes);
      } catch {
        /* ver comentário acima */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [turmaId, sufixo]);

  const procurar = useCallback(
    async (termo: string) => {
      setBusca(termo);
      if (termo.trim().length < 2) {
        setCandidatos([]);
        return;
      }
      const params = new URLSearchParams({
        busca: termo.trim(),
        papel: aba === "estudantes" ? "estudante" : "professor",
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
        body: JSON.stringify({ usuarioId, papel: aba === "estudantes" ? "estudante" : "professor" }),
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
      let resposta = await fetch(`/api/plataforma/estudantes/${linha.id}/historico${sufixo}`);
      if (!resposta.ok) {
        resposta = await fetch(`/api/plataforma/estudantes/${linha.id}/historico${sufixo}`);
      }
      if (!resposta.ok) throw new Error(String(resposta.status));
      setHistorico((await resposta.json()) as Historico);
    } catch {
      setErro("Não foi possível carregar o histórico.");
    }
  }

  /** Só a lista. Separada de `abrirPerfilPortatil` porque recarregar DEPOIS de
   *  importar não pode apagar a mensagem que acabou de explicar o que aconteceu. */
  async function carregarRecebidos(estudanteIdDaLinha: string) {
    try {
      let resposta = await fetch(
        `/api/plataforma/estudantes/${estudanteIdDaLinha}/perfis-recebidos${sufixo}`,
      );
      if (!resposta.ok) {
        resposta = await fetch(
          `/api/plataforma/estudantes/${estudanteIdDaLinha}/perfis-recebidos${sufixo}`,
        );
      }
      setRecebidos(resposta.ok ? ((await resposta.json()) as PerfilRecebido[]) : []);
    } catch {
      setRecebidos([]);
    }
  }

  async function abrirPerfilPortatil(linha: Matriculado) {
    setPortatil(linha);
    setRecebidos(null);
    setAvisoDoPerfil(null);
    setErroDoPerfil(null);
    await carregarRecebidos(linha.id);
  }

  /**
   * O download é uma navegação de verdade, e não uma rota do App Router: a
   * resposta é um arquivo com `Content-Disposition`. `router.push` trataria isso
   * como transição de página e não baixaria nada — daí `window.open`, que abre a
   * resposta fora do roteador.
   */
  function emitirPerfil(linha: Matriculado) {
    window.open(`/api/perfil-portatil/${linha.id}`, "_blank", "noopener");
  }

  async function importarPerfil(arquivo: File) {
    if (!portatil) return;
    setImportando(true);
    setAvisoDoPerfil(null);
    setErroDoPerfil(null);
    try {
      const conteudo = JSON.parse(await arquivo.text()) as unknown;
      const resposta = await fetch("/api/perfil-recebido", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ escolaId: escolaId ?? undefined, arquivo: conteudo }),
      });
      const corpo = (await resposta.json().catch(() => null)) as
        | { mensagem?: string; verificacao?: string }
        | null;
      if (!resposta.ok) {
        setErroDoPerfil(corpo?.mensagem ?? "O documento foi recusado.");
        return;
      }
      const conferido = corpo?.verificacao === "verificada";
      setPerfilVerificado(conferido);
      setAvisoDoPerfil(
        conferido
          ? "Perfil recebido, e a assinatura confere com o emissor."
          : "Perfil recebido. Não foi possível conferir a assinatura com o emissor — ele fica na lista marcado como não verificado.",
      );
      await carregarRecebidos(portatil.id);
    } catch {
      setErroDoPerfil("O arquivo não é um JSON legível.");
    } finally {
      setImportando(false);
    }
  }

  async function apagarRecebido(id: string) {
    try {
      const resposta = await fetch(`/api/plataforma/perfis-recebidos/${id}${sufixo}`, {
        method: "DELETE",
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      if (portatil) await carregarRecebidos(portatil.id);
    } catch {
      setErroDoPerfil("Não foi possível apagar.");
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
      let resposta = await fetch(
        `/api/plataforma/estudantes/${transferir.id}/transferir?escolaId=${encodeURIComponent(escolaDestino)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ escolaDestinoId: escolaDestino }),
        },
      );
      if (!resposta.ok) {
        resposta = await fetch(
          `/api/plataforma/estudantes/${transferir.id}/transferir?escolaId=${encodeURIComponent(escolaDestino)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ escolaDestinoId: escolaDestino }),
          },
        );
      }
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
            {aba === "estudantes" && !linha.principal ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void ajustar(linha.matriculaId, { principal: true })}
              >
                Tornar referência
              </Button>
            ) : null}
            {aba === "estudantes" ? (
              <Button variant="ghost" size="sm" onClick={() => void verHistorico(linha)}>
                Histórico
              </Button>
            ) : null}
            {aba === "estudantes" && papel === "admin-contrato" ? (
              <Button variant="ghost" size="sm" onClick={() => void abrirTransferencia(linha)}>
                Transferir
              </Button>
            ) : null}
            {aba === "estudantes" ? (
              <Button variant="ghost" size="sm" onClick={() => void abrirPerfilPortatil(linha)}>
                Perfil portátil
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

  const lista =
    aba === "estudantes"
      ? (dados?.estudantes ?? [])
      : (dados?.professores ?? []);

  return (
    <div className="plataforma-largura-cheia flex flex-col gap-6">
      {/* Quem sabe o nome da turma é esta leitura (a página é uma casca de
          servidor). Enquanto ela não chega, a trilha mostra "Turma" — nunca o
          id do endereço. */}
      <RotuloDaTrilha valor={dados ? `Turma ${dados.turma.nome}` : undefined} />

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
        onChange={(valor) =>
          setAba(
            valor === "professores"
              ? "professores"
              : valor === "missoes"
                ? "missoes"
                : "estudantes",
          )
        }
        items={[
          {
            value: "estudantes",
            label: "Estudantes",
            badge: (dados?.estudantes ?? []).length,
            showIcon: false,
          },
          {
            value: "professores",
            label: "Professores",
            badge: dados?.professores.length ?? 0,
            showIcon: false,
          },
          {
            value: "missoes",
            label: "Missões",
            badge: (missoes ?? []).filter((m) => m.estado === "liberada").length,
            showIcon: false,
          },
        ]}
      />

      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={voltarParaTurmas}>
          Voltar para as turmas
        </Button>
        {/* Sem botão na aba Missões: liberar é de quem dá aula na turma. */}
        {aba === "missoes" ? null : (
          <Button variant="primary" size="md" onClick={() => setAdicionarAberto(true)}>
            {aba === "estudantes" ? "Adicionar estudante" : "Adicionar professor"}
          </Button>
        )}
      </div>

      {aba === "missoes" ? (
        <div className="flex flex-col gap-3">
          <FeedbackAlert
            type="info"
            title="Quem abre a missão para a turma é quem dá aula nela"
            description="Aqui você vê o que está aberto e quem abriu. Liberar e encerrar são do professor com matrícula na turma."
          />
          {missoes === null ? (
            <p className="text-[14px] text-unooria-neutral-500">Carregando as missões…</p>
          ) : missoes.length === 0 ? (
            <p className="text-[14px] text-unooria-neutral-500">
              Nenhuma missão publicada para esta série ainda.
            </p>
          ) : (
            <ul className="flex flex-col rounded-md border border-unooria-neutral-200 px-4">
              {missoes.map((missao) => (
                <li
                  key={missao.expId}
                  className="linha-de-lista flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-unooria-neutral-950">
                      {missao.nome}
                    </span>
                    <span className="block text-[13px] text-unooria-neutral-500">
                      {missao.transversal
                        ? "para qualquer ano"
                        : missao.unidade
                          ? `Unidade ${missao.unidade}`
                          : missao.expId}
                      {missao.liberadaPor ? ` · aberta por ${missao.liberadaPor}` : ""}
                    </span>
                  </span>
                  {missao.estado === "liberada" ? (
                    <Tag variant="success">aberta</Tag>
                  ) : missao.estado === "encerrada" ? (
                    <Tag>encerrada</Tag>
                  ) : (
                    <Tag>fechada</Tag>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ScrollBar orientation="both" autoHide className="tabela-rolavel">
          <Table<Matriculado>
            columns={colunas}
            data={lista}
            keyExtractor={(linha) => linha.matriculaId}
            loading={carregando}
            emptyText={
              aba === "estudantes"
                ? "Nenhum estudante matriculado nesta turma."
                : "Nenhum professor nesta turma — sem isso ele não vê a turma na área dele."
            }
            size="md"
            theme="light"
          />
        </ScrollBar>
      )}

      <Modal
        isOpen={adicionarAberto}
        onClose={() => setAdicionarAberto(false)}
        size="sm"
        theme="light"
      >
        <ModalHeader>
          <ModalTitle>{aba === "estudantes" ? "Adicionar estudante" : "Adicionar professor"}</ModalTitle>
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
          <ModalTitle>Histórico de {historico?.estudante?.nome}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-5">
            <p className="text-[13px] text-unooria-neutral-500">
              {historico?.estudante?.usuario}
              {historico?.estudante?.cpf ? ` · CPF ${historico.estudante.cpf}` : ""}
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

      <Modal isOpen={Boolean(portatil)} onClose={() => setPortatil(null)} size="lg" theme="light">
        <ModalHeader>
          <ModalTitle>Perfil portátil de {portatil?.nome}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <FeedbackAlert
              type="info"
              title="Isto é para sair da REDE, não da escola"
              description="Trocar de escola aqui dentro é Transferir — o histórico continua inteiro. O perfil portátil é o documento assinado que a criança leva quando vai para outra rede, que é outro contrato e outro banco: lá nenhum id daqui existe, e é o CPF que a reconhece."
            />

            <div className="rounded-xl border border-unooria-neutral-200 p-4">
              <p className="text-[15px] font-semibold text-unooria-navy-900">Emitir</p>
              <p className="mt-1 text-[14px] text-unooria-neutral-700">
                Baixa um arquivo assinado com a trajetória, as participações e os resultados desta
                criança. É um direito do titular (LGPD art. 18, V) — a escola emite a pedido da
                família, e o arquivo é legível por quem receber, mesmo numa rede que não use esta
                plataforma. O check-in de bem-estar nunca entra: é dado de saúde, e a posse é do
                professor.
              </p>
              <div className="mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => portatil && emitirPerfil(portatil)}
                >
                  Emitir e baixar
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-unooria-neutral-200 p-4">
              <p className="text-[15px] font-semibold text-unooria-navy-900">Receber</p>
              <p className="mt-1 text-[14px] text-unooria-neutral-700">
                O que vem de fora fica separado do que foi medido aqui, sempre — é a afirmação de
                outra instalação sobre a criança, e misturada ela ficaria indistinguível do dado
                desta rede.
              </p>
              <div className="mt-3">
                <FileUpload
                  label="Documento recebido"
                  accept="application/json,.json"
                  multiple={false}
                  maxFiles={1}
                  disabled={importando}
                  dropzoneTitle="Solte o arquivo aqui ou clique para escolher"
                  dropzoneSubtitle="O .json emitido pela rede de origem"
                  onUpload={(arquivos) => {
                    const arquivo = arquivos[0];
                    if (arquivo) void importarPerfil(arquivo);
                  }}
                />
              </div>
            </div>

            {erroDoPerfil ? (
              <FeedbackAlert type="error" title="Recusado" description={erroDoPerfil} />
            ) : null}
            {avisoDoPerfil ? (
              /* Recebido SEM conferir a assinatura não é sucesso limpo: o aviso
                 sai em âmbar para o gestor não fechar a tela achando que o
                 documento foi validado. */
              <FeedbackAlert
                type={perfilVerificado ? "success" : "warning"}
                title={perfilVerificado ? "Pronto" : "Recebido, mas não conferido"}
                description={avisoDoPerfil}
              />
            ) : null}

            <div>
              <p className="text-[15px] font-semibold text-unooria-navy-900">Recebidos</p>
              {recebidos === null ? (
                <p className="mt-1 text-[14px] text-unooria-neutral-500">Carregando…</p>
              ) : recebidos.length === 0 ? (
                <p className="mt-1 text-[14px] text-unooria-neutral-500">
                  Nenhum perfil de outra rede foi recebido para esta criança.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {recebidos.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-unooria-neutral-200 px-3 py-2"
                    >
                      <span className="text-[14px] text-unooria-neutral-800">
                        <strong>{r.emissorNome ?? r.emissor}</strong>{" "}
                        {r.verificacao === "verificada" ? (
                          <Tag variant="success" size="sm">
                            assinatura conferida
                          </Tag>
                        ) : (
                          <Tag variant="warning" size="sm">
                            não verificado
                          </Tag>
                        )}
                        <span className="block text-[12px] text-unooria-neutral-500">
                          {/* Com hora: reemitir no mesmo dia gera OUTRO documento,
                              e só a data faria dois deles parecerem duplicata. */}
                          emitido em{" "}
                          {new Date(r.emitidoEm).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}{" "}
                          ·{" "}
                          {r.escolas} escola{r.escolas === 1 ? "" : "s"}, {r.participacoes}{" "}
                          participaç{r.participacoes === 1 ? "ão" : "ões"}, {r.resultados} resultado
                          {r.resultados === 1 ? "" : "s"}
                        </span>
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => void apagarRecebido(r.id)}>
                        Apagar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setPortatil(null)}>
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
