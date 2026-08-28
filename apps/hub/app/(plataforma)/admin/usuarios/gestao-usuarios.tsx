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
  Pagination,
  SearchInput,
  SectionHeader,
  Selection,
  Snackbar,
  Table,
  Tag,
  TextField,
  type TableColumn,
} from "@edu/ui/ds";
import type { Papel } from "@/lib/papeis";

interface LinhaDeUsuario extends Record<string, unknown> {
  id: string;
  usuario: string;
  nome: string;
  papel: string;
  matricula: string | null;
  email: string | null;
  ativo: boolean;
  senhaProvisoria: boolean;
  turma: string | null;
  serie: string | null;
  turmas: Array<{ matriculaId: string; nome: string; serie: string; papel: string }>;
}

const POR_PAGINA = 25;

const PAPEIS = [
  { value: "", label: "Todos os papéis" },
  { value: "aluno", label: "Alunos" },
  { value: "professor", label: "Professores" },
  { value: "gestor", label: "Coordenação" },
];

const SITUACOES = [
  { value: "", label: "Todas as situações" },
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
  { value: "sem-primeiro-acesso", label: "Sem primeiro acesso" },
];

/**
 * As contas da escola: buscar, editar, desativar e resetar senha.
 *
 * A ENTRADA de pessoas não está mais aqui — é `/admin/importar`. A turma que
 * aparece na linha vem da MATRÍCULA, não de uma coluna do usuário: uma pessoa
 * pode estar em mais de uma turma, e o professor está nas dele.
 */
export function GestaoUsuarios({
  papel,
  escolaIdInicial,
}: {
  papel: Papel;
  escolaIdInicial: string;
}) {
  const router = useRouter();
  const [escolaId, setEscolaId] = useState(escolaIdInicial);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [linhas, setLinhas] = useState<LinhaDeUsuario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroPapel, setFiltroPapel] = useState("");
  const [situacao, setSituacao] = useState("");

  const [edicao, setEdicao] = useState<LinhaDeUsuario | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [emailEditado, setEmailEditado] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [resetAlvo, setResetAlvo] = useState<LinhaDeUsuario | null>(null);
  const [senhaTemporaria, setSenhaTemporaria] = useState<{ usuario: string; senha: string } | null>(
    null,
  );
  const [aviso, setAviso] = useState<string | null>(null);

  const sufixo = useMemo(
    () => (papel === "admin-contrato" && escolaId ? `?escolaId=${encodeURIComponent(escolaId)}` : ""),
    [papel, escolaId],
  );

  const carregar = useCallback(async () => {
    if (papel === "admin-contrato" && !escolaId) return;
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
      if (busca.trim()) params.set("busca", busca.trim());
      if (filtroPapel) params.set("papel", filtroPapel);
      if (situacao) params.set("situacao", situacao);
      if (papel === "admin-contrato" && escolaId) params.set("escolaId", escolaId);

      const resposta = await fetch(`/api/plataforma/usuarios?${params}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      const dados = (await resposta.json()) as { total: number; usuarios: LinhaDeUsuario[] };
      setTotal(dados.total);
      setLinhas(dados.usuarios);
    } catch {
      setErro("Não foi possível carregar os usuários. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }, [papel, escolaId, pagina, busca, filtroPapel, situacao]);

  useEffect(() => {
    const id = setTimeout(() => void carregar(), busca ? 300 : 0);
    return () => clearTimeout(id);
  }, [carregar, busca]);

  async function salvarEdicao() {
    if (!edicao) return;
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/plataforma/usuarios/${edicao.id}${sufixo}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: nomeEditado.trim(), email: emailEditado.trim() }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      setEdicao(null);
      setAviso("Cadastro atualizado.");
      await carregar();
    } catch {
      setErro("Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(linha: LinhaDeUsuario) {
    try {
      const resposta = await fetch(`/api/plataforma/usuarios/${linha.id}${sufixo}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ativo: !linha.ativo }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      setAviso(linha.ativo ? `${linha.nome} foi desativado.` : `${linha.nome} voltou a ter acesso.`);
      await carregar();
    } catch {
      setErro("Não foi possível mudar a situação da conta.");
    }
  }

  async function resetarSenha() {
    if (!resetAlvo) return;
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/plataforma/usuarios/${resetAlvo.id}/reset-senha${sufixo}`, {
        method: "POST",
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      const dados = (await resposta.json()) as { usuario: string; senhaTemporaria: string };
      setSenhaTemporaria({ usuario: dados.usuario, senha: dados.senhaTemporaria });
      await carregar();
    } catch {
      setErro("Não foi possível resetar a senha.");
    } finally {
      setSalvando(false);
      setResetAlvo(null);
    }
  }

  const colunas = useMemo<TableColumn<LinhaDeUsuario>[]>(
    () => [
      { key: "nome", title: "Nome" },
      { key: "usuario", title: "Login" },
      { key: "matricula", title: "Matrícula", render: (_, linha) => linha.matricula ?? "—" },
      { key: "papel", title: "Papel", render: (_, linha) => <Tag>{String(linha.papel)}</Tag> },
      {
        key: "turmas",
        title: "Turmas",
        render: (_, linha) =>
          linha.turmas.length === 0
            ? "—"
            : linha.turmas.map((t) => `${t.nome} (${t.serie})`).join(", "),
      },
      {
        key: "situacao",
        title: "Situação",
        render: (_, linha) => {
          if (!linha.ativo) return <Tag>inativo</Tag>;
          if (linha.senhaProvisoria) return <Tag>sem primeiro acesso</Tag>;
          return <span className="text-unooria-neutral-500">ativo</span>;
        },
      },
      {
        key: "acoes",
        title: "",
        align: "right",
        render: (_, linha) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEdicao(linha);
                setNomeEditado(linha.nome);
                setEmailEditado(linha.email ?? "");
              }}
            >
              Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setResetAlvo(linha)}>
              Resetar senha
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void alternarAtivo(linha)}>
              {linha.ativo ? "Desativar" : "Reativar"}
            </Button>
          </div>
        ),
      },
    ],
    // `alternarAtivo` fecha sobre estado que muda a cada render; as colunas só
    // precisam ser recriadas quando o sufixo de escola muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sufixo],
  );

  return (
    <div className="plataforma-largura-cheia mx-auto flex max-w-[1180px] flex-col gap-6">
      <SectionHeader
        title="Usuários"
        description="Uma conta por pessoa — a mesma no hub e em todas as experiências."
      />

      {papel === "admin-contrato" ? (
        <div className="max-w-[320px]">
          <TextField
            id="escola"
            label="Escola (id)"
            value={escolaId}
            onChange={(e) => {
              setPagina(1);
              setEscolaId(e.target.value);
            }}
          />
        </div>
      ) : null}

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[280px]">
            <SearchInput
              id="busca"
              label="Buscar"
              placeholder="Nome, login ou matrícula"
              value={busca}
              onChange={(e) => {
                setPagina(1);
                setBusca(e.target.value);
              }}
            />
          </div>
          <div className="w-[200px]">
            <Selection
              label="Papel"
              value={filtroPapel}
              onChange={(valor) => {
                setPagina(1);
                setFiltroPapel(String(valor));
              }}
              options={PAPEIS}
            />
          </div>
          <div className="w-[220px]">
            <Selection
              label="Situação"
              value={situacao}
              onChange={(valor) => {
                setPagina(1);
                setSituacao(String(valor));
              }}
              options={SITUACOES}
            />
          </div>
        </div>
        <Button variant="primary" size="md" onClick={() => router.push("/admin/importar")}>
          Importar pessoas
        </Button>
      </div>

      <p className="text-[14px] text-unooria-neutral-500">
        {total} pessoa{total === 1 ? "" : "s"}
      </p>

      <Table<LinhaDeUsuario>
        columns={colunas}
        data={linhas}
        keyExtractor={(linha) => linha.id}
        loading={carregando}
        emptyText="Ninguém por aqui ainda — importe a planilha de pessoas para começar."
        size="md"
        theme="light"
      />

      {total > POR_PAGINA ? (
        <Pagination
          totalPages={Math.ceil(total / POR_PAGINA)}
          currentPage={pagina}
          onPageChange={(p: number) => setPagina(p)}
          theme="light"
        />
      ) : null}

      <Modal isOpen={Boolean(edicao)} onClose={() => setEdicao(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Editar cadastro</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <TextField
              id="nome"
              label="Nome"
              value={nomeEditado}
              onChange={(e) => setNomeEditado(e.target.value)}
            />
            <TextField
              id="email"
              label="E-mail (opcional)"
              value={emailEditado}
              onChange={(e) => setEmailEditado(e.target.value)}
            />
            <p className="text-[13px] text-unooria-neutral-500">
              Login e matrícula não mudam por aqui: os dois identificam a pessoa e vêm da
              importação.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setEdicao(null)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" isLoading={salvando} onClick={() => void salvarEdicao()}>
            Salvar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={Boolean(resetAlvo)} onClose={() => setResetAlvo(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Resetar senha</ModalTitle>
        </ModalHeader>
        <ModalBody>
          Gerar uma senha temporária para <strong>{resetAlvo?.usuario}</strong>? A senha atual deixa
          de valer na hora, e a pessoa terá de criar uma nova no próximo acesso.
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setResetAlvo(null)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" isLoading={salvando} onClick={() => void resetarSenha()}>
            Resetar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={Boolean(senhaTemporaria)}
        onClose={() => setSenhaTemporaria(null)}
        size="sm"
        theme="light"
        title="Senha temporária"
        description="Anote agora — ela não aparece de novo."
      >
        <ModalBody>
          <p className="text-[15px] text-unooria-neutral-950">
            <strong>{senhaTemporaria?.usuario}</strong>: <code>{senhaTemporaria?.senha}</code>
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" size="md" onClick={() => setSenhaTemporaria(null)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      {aviso ? (
        <div className="fixed bottom-6 right-6 z-50">
          <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} duration={6000} />
        </div>
      ) : null}
    </div>
  );
}
