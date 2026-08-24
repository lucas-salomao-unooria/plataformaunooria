"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertBox,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Pagination,
  SectionHeader,
  Snackbar,
  Table,
  Tag,
  TextField,
  UploadFileModal,
  type TableColumn,
  type UploadFileItem,
} from "@edu/ui/ds";
import type { Papel } from "@/lib/papeis";

interface LinhaDeUsuario extends Record<string, unknown> {
  id: string;
  usuario: string;
  nome: string;
  papel: string;
  turma: string | null;
  serie: string | null;
}

interface RelatorioImportacao {
  criados: number;
  atualizados: number;
  erros: Array<{ linha: number; campo: string; mensagem: string }>;
}

const POR_PAGINA = 25;

/**
 * Gestão de usuários: listagem + importação por CSV + reset de senha.
 * Fala SEMPRE com o BFF (`/api/plataforma/usuarios...`) — o token nunca
 * chega ao client. Formato do CSV documentado na própria tela.
 */
export function GestaoUsuarios({
  papel,
  escolaIdInicial,
}: {
  papel: Papel;
  escolaIdInicial: string;
}) {
  const [escolaId, setEscolaId] = useState(escolaIdInicial);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [linhas, setLinhas] = useState<LinhaDeUsuario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [importAberto, setImportAberto] = useState(false);
  const [importando, setImportando] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);

  const [resetAlvo, setResetAlvo] = useState<LinhaDeUsuario | null>(null);
  const [resetando, setResetando] = useState(false);
  const [senhaTemporaria, setSenhaTemporaria] = useState<{ usuario: string; senha: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const query = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA), ...extra });
      if (papel === "admin-contrato" && escolaId) params.set("escolaId", escolaId);
      return params.toString();
    },
    [pagina, papel, escolaId],
  );

  const carregar = useCallback(async () => {
    if (papel === "admin-contrato" && !escolaId) return;
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/plataforma/usuarios?${query()}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      const dados = (await resposta.json()) as { total: number; usuarios: LinhaDeUsuario[] };
      setTotal(dados.total);
      setLinhas(dados.usuarios);
    } catch {
      setErro("Não foi possível carregar os usuários. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }, [papel, escolaId, query]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function importarCsv(arquivos: UploadFileItem[]) {
    const arquivo = arquivos[0]?.file;
    if (!arquivo) return;
    setImportando(true);
    setRelatorio(null);
    try {
      const sufixo = papel === "admin-contrato" && escolaId ? `?escolaId=${encodeURIComponent(escolaId)}` : "";
      const resposta = await fetch(`/api/plataforma/usuarios/importar-csv${sufixo}`, {
        method: "POST",
        headers: { "content-type": "text/csv" },
        body: await arquivo.text(),
      });
      const corpo = (await resposta.json().catch(() => null)) as RelatorioImportacao | { mensagem?: string } | null;
      if (!resposta.ok || !corpo || !("criados" in corpo)) {
        setErro((corpo as { mensagem?: string } | null)?.mensagem ?? "Falha na importação. Tente de novo.");
      } else {
        setRelatorio(corpo);
        setImportAberto(false);
        setAviso(`Importação concluída: ${corpo.criados} criados, ${corpo.atualizados} atualizados.`);
        await carregar();
      }
    } catch {
      setErro("Falha na importação. Tente de novo.");
    } finally {
      setImportando(false);
    }
  }

  async function resetarSenha() {
    if (!resetAlvo) return;
    setResetando(true);
    try {
      const sufixo = papel === "admin-contrato" && escolaId ? `?escolaId=${encodeURIComponent(escolaId)}` : "";
      const resposta = await fetch(`/api/plataforma/usuarios/${resetAlvo.id}/reset-senha${sufixo}`, {
        method: "POST",
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      const dados = (await resposta.json()) as { usuario: string; senhaTemporaria: string };
      setSenhaTemporaria({ usuario: dados.usuario, senha: dados.senhaTemporaria });
    } catch {
      setErro("Não foi possível resetar a senha.");
    } finally {
      setResetando(false);
      setResetAlvo(null);
    }
  }

  const colunas = useMemo<TableColumn<LinhaDeUsuario>[]>(
    () => [
      { key: "usuario", title: "Usuário" },
      { key: "nome", title: "Nome" },
      { key: "papel", title: "Papel", render: (_, linha) => <Tag>{String(linha.papel)}</Tag> },
      { key: "turma", title: "Turma", render: (_, linha) => (linha.turma ? `${linha.turma} · ${linha.serie ?? ""}` : "—") },
      {
        key: "acoes",
        title: "",
        align: "right",
        render: (_, linha) => (
          <Button variant="ghost" size="sm" onClick={() => setResetAlvo(linha)}>
            Resetar senha
          </Button>
        ),
      },
    ],
    [],
  );

  const colunasDeErro: TableColumn<Record<string, unknown>>[] = [
    { key: "linha", title: "Linha", width: 80 },
    { key: "campo", title: "Campo", width: 120 },
    { key: "mensagem", title: "Problema" },
  ];

  return (
    <div className="plataforma-largura-cheia mx-auto flex max-w-[1080px] flex-col gap-6">
      <SectionHeader
        title="Usuários"
        description="Contas de acesso desta escola. Novos usuários entram por importação de CSV."
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

      <div className="flex items-center justify-between gap-4">
        <p className="text-[14px] text-unooria-neutral-500">
          {total} usuário{total === 1 ? "" : "s"} · CSV com header{" "}
          <code>nome,usuario,senha,papel,turma,serie</code> (papel: aluno, professor ou gestor;
          senha vazia mantém a atual)
        </p>
        <Button variant="primary" size="md" onClick={() => setImportAberto(true)}>
          Importar CSV
        </Button>
      </div>

      <Table<LinhaDeUsuario>
        columns={colunas}
        data={linhas}
        keyExtractor={(linha) => linha.id}
        loading={carregando}
        emptyText="Nenhum usuário ainda — importe um CSV para começar."
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

      {relatorio && relatorio.erros.length > 0 ? (
        <div className="flex flex-col gap-3">
          <AlertBox
            theme="light"
            variant="warning"
            device="auto"
            title={`${relatorio.erros.length} linha(s) não importadas`}
            description="Corrija as linhas abaixo no arquivo e importe de novo — as demais já entraram."
          />
          <Table columns={colunasDeErro} data={relatorio.erros as unknown as Record<string, unknown>[]} size="sm" theme="light" />
        </div>
      ) : null}

      <UploadFileModal
        isOpen={importAberto}
        onClose={() => setImportAberto(false)}
        title="Importar usuários"
        description="Arquivo .csv em UTF-8, até 1MB / 5.000 linhas, com o header nome,usuario,senha,papel,turma,serie."
        accept=".csv,text/csv"
        multiple={false}
        isSubmitting={importando}
        submitText="Importar"
        cancelText="Cancelar"
        onSubmit={(arquivos) => void importarCsv(arquivos)}
      />

      <Modal isOpen={Boolean(resetAlvo)} onClose={() => setResetAlvo(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>Resetar senha</ModalTitle>
        </ModalHeader>
        <ModalBody>
          Gerar uma senha temporária para <strong>{resetAlvo?.usuario}</strong>? A senha atual
          deixa de valer na hora.
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={() => setResetAlvo(null)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" isLoading={resetando} onClick={() => void resetarSenha()}>
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
