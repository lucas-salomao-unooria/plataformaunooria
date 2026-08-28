"use client";

import { useMemo, useState } from "react";
import {
  AlertBox,
  Button,
  FeedbackAlert,
  Icon,
  RadioButton,
  SectionHeader,
  Table,
  Tabs,
  Tag,
  TextField,
  UploadFileModal,
  type TableColumn,
  type UploadFileItem,
} from "@edu/ui/ds";
import type { Papel } from "@/lib/papeis";

interface ErroDeLinha extends Record<string, unknown> {
  linha: number;
  campo: string;
  mensagem: string;
}

interface Credencial extends Record<string, unknown> {
  nome: string;
  usuario: string;
  senha: string;
  turma: string | null;
}

interface Relatorio {
  criados: number;
  atualizados: number;
  matriculados: number;
  desativados: number;
  candidatosAInativacao: number;
  turmasCriadas: string[];
  erros: ErroDeLinha[];
  avisos: ErroDeLinha[];
  credenciais: Credencial[];
  /** Só no caminho OneRoster. */
  arquivo?: string;
}

interface ContaDeAssento extends Record<string, unknown> {
  id: string;
  usuario: string;
  nome: string;
  papel: string;
  ativo: boolean;
  dados: number;
}

const SENHA_SUGERIDA = "Unooria@2026";

/**
 * Os sete arquivos do binding CSV, NA ORDEM de dependência. Fora de ordem não
 * corrompe nada — a linha que referencia um `sourcedId` inexistente volta no
 * relatório dizendo qual arquivo falta —, mas na ordem o lote passa de primeira.
 */
const ARQUIVOS_ONEROSTER = [
  { nome: "manifest", descricao: "Declara a versão e o que vem no lote. Não escreve nada." },
  { nome: "orgs", descricao: "Só aprende o código INEP desta escola — escola nova não nasce de CSV." },
  { nome: "academicSessions", descricao: "Ano letivo e seus recortes." },
  { nome: "classes", descricao: "Turmas. `homeroom` vira regular; `scheduled`, componente." },
  { nome: "users", descricao: "Pessoas. A coluna `password` do padrão é ignorada." },
  { nome: "enrollments", descricao: "O enturmamento: quem está em qual turma, com que papel." },
  { nome: "roles", descricao: "Papel no nível da escola. Corrige quem entrou como aluno." },
] as const;

/**
 * A porta de entrada das pessoas.
 *
 * Duas decisões estão visíveis nesta tela, e as duas são de propósito:
 *
 * 1. A planilha NÃO tem coluna de senha. Arquivo com senha em texto claro
 *    circula por e-mail, WhatsApp e pen drive; a senha é escolhida aqui e vale
 *    só até o primeiro acesso.
 * 2. As senhas geradas aparecem UMA vez. Elas não ficam em coluna nem em log —
 *    depois de fechar esta tela, o caminho é resetar a senha da pessoa.
 */
export function ImportarPessoas({
  papel,
  escolaIdInicial,
}: {
  papel: Papel;
  escolaIdInicial: string;
}) {
  const [escolaId, setEscolaId] = useState(escolaIdInicial);
  const [modoSenha, setModoSenha] = useState<"padrao" | "por-pessoa">("padrao");
  const [senhaPadrao, setSenhaPadrao] = useState(SENHA_SUGERIDA);
  const [aberto, setAberto] = useState(false);
  const [importando, setImportando] = useState(false);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [aba, setAba] = useState<"planilha" | "oneroster">("planilha");
  const [modoLote, setModoLote] = useState<"delta" | "bulk">("delta");
  const [arquivoAlvo, setArquivoAlvo] = useState<string | null>(null);
  const [enviados, setEnviados] = useState<Record<string, Relatorio>>({});

  const [assentos, setAssentos] = useState<{
    total: number;
    truncado: boolean;
    contas: ContaDeAssento[];
  } | null>(null);
  const [carregandoAssentos, setCarregandoAssentos] = useState(false);

  const sufixoEscola = useMemo(
    () => (papel === "admin-contrato" && escolaId ? `escolaId=${encodeURIComponent(escolaId)}` : ""),
    [papel, escolaId],
  );

  const linkDoModelo = (arquivo: string) =>
    `/api/plataforma/rostering/modelos/${arquivo}${sufixoEscola ? `?${sufixoEscola}` : ""}`;

  async function importar(arquivos: UploadFileItem[]) {
    const arquivo = arquivos[0]?.file;
    if (!arquivo) return;
    setImportando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (sufixoEscola) params.set("escolaId", escolaId);
      if (modoSenha === "padrao") params.set("senhaPadrao", senhaPadrao);
      else params.set("gerarSenhas", "1");

      const resposta = await fetch(`/api/plataforma/rostering/importar?${params}`, {
        method: "POST",
        headers: { "content-type": "text/csv" },
        body: await arquivo.text(),
      });
      const corpo = (await resposta.json().catch(() => null)) as
        | Relatorio
        | { mensagem?: string }
        | null;
      if (!resposta.ok || !corpo || !("criados" in corpo)) {
        setErro((corpo as { mensagem?: string } | null)?.mensagem ?? "Falha na importação.");
        return;
      }
      setRelatorio(corpo);
      setAberto(false);
    } catch {
      setErro("Falha na importação. Tente de novo.");
    } finally {
      setImportando(false);
    }
  }

  async function importarOneRoster(arquivos: UploadFileItem[]) {
    const arquivo = arquivos[0]?.file;
    if (!arquivo || !arquivoAlvo) return;
    setImportando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ modo: modoLote });
      if (sufixoEscola) params.set("escolaId", escolaId);
      if (arquivoAlvo === "users") {
        if (modoSenha === "padrao") params.set("senhaPadrao", senhaPadrao);
        else params.set("gerarSenhas", "1");
      }

      const resposta = await fetch(
        `/api/plataforma/rostering/oneroster/${arquivoAlvo}?${params}`,
        { method: "POST", headers: { "content-type": "text/csv" }, body: await arquivo.text() },
      );
      const corpo = (await resposta.json().catch(() => null)) as
        | Relatorio
        | { mensagem?: string }
        | null;
      if (!resposta.ok || !corpo || !("criados" in corpo)) {
        setErro((corpo as { mensagem?: string } | null)?.mensagem ?? "Falha na importação.");
        return;
      }
      setEnviados((antes) => ({ ...antes, [arquivoAlvo]: corpo }));
      setRelatorio(corpo);
      setArquivoAlvo(null);
    } catch {
      setErro("Falha na importação. Tente de novo.");
    } finally {
      setImportando(false);
    }
  }

  async function carregarAssentos() {
    setCarregandoAssentos(true);
    try {
      const resposta = await fetch(
        `/api/plataforma/rostering/contas-de-assento${sufixoEscola ? `?${sufixoEscola}` : ""}`,
      );
      if (!resposta.ok) throw new Error(String(resposta.status));
      setAssentos((await resposta.json()) as { total: number; truncado: boolean; contas: ContaDeAssento[] });
    } catch {
      setErro("Não foi possível listar as contas sem matrícula.");
    } finally {
      setCarregandoAssentos(false);
    }
  }

  async function desativar(conta: ContaDeAssento) {
    try {
      const resposta = await fetch(`/api/plataforma/usuarios/${conta.id}${sufixoEscola ? `?${sufixoEscola}` : ""}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ativo: false }),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      await carregarAssentos();
    } catch {
      setErro("Não foi possível desativar a conta.");
    }
  }

  function baixarSenhas() {
    if (!relatorio) return;
    const linhas = [
      "nome,usuario,senha,turma",
      ...relatorio.credenciais.map((c) =>
        [c.nome, c.usuario, c.senha, c.turma ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${linhas}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "senhas-do-primeiro-acesso.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const colunasDeErro: TableColumn<ErroDeLinha>[] = [
    { key: "linha", title: "Linha", width: 80 },
    { key: "campo", title: "Campo", width: 140 },
    { key: "mensagem", title: "Problema" },
  ];

  const colunasDeSenha: TableColumn<Credencial>[] = [
    { key: "nome", title: "Nome" },
    { key: "usuario", title: "Login" },
    { key: "senha", title: "Senha do primeiro acesso" },
    { key: "turma", title: "Turma", render: (_, linha) => linha.turma ?? "—" },
  ];

  return (
    <div className="plataforma-largura-cheia mx-auto flex max-w-[1080px] flex-col gap-6">
      <SectionHeader
        title="Importar pessoas"
        description="Uma linha por pessoa. As turmas informadas na planilha são criadas e o enturmamento é feito junto."
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

      {/* Dois caminhos para o mesmo núcleo: a planilha simples é de quem não tem
          sistema de gestão; o OneRoster é de quem tem. */}
      <Tabs
        theme="light"
        value={aba}
        onChange={(valor) => setAba(valor === "oneroster" ? "oneroster" : "planilha")}
        items={[
          { value: "planilha", label: "Planilha da escola", showIcon: false },
          { value: "oneroster", label: "OneRoster 1.2", showIcon: false },
        ]}
      />

      {aba === "planilha" ? (
      <>
      <section className="flex flex-col gap-3 rounded-xl border border-unooria-neutral-200 bg-unooria-neutral-50 p-5">
        <h2 className="text-[16px] font-bold text-unooria-neutral-950">1. Baixe o modelo</h2>
        <p className="text-[14px] text-unooria-neutral-700">
          Colunas: <code>matricula, nome, usuario, email, papel, turma, serie, turno</code>.
          Obrigatórias: <strong>nome</strong> e <strong>papel</strong> (
          <code>aluno</code>, <code>professor</code> ou <code>coordenacao</code>); para aluno,
          também <strong>turma</strong> e <strong>serie</strong>. A ordem das colunas não importa.
        </p>
        <p className="text-[14px] text-unooria-neutral-700">
          <strong>matricula</strong> é o número da pessoa na rede (RA). É o que permite reimportar a
          planilha corrigida sem criar ninguém duas vezes. <strong>usuario</strong> pode ficar em
          branco — o login é gerado e devolvido na folha de senhas.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href={linkDoModelo("usuarios.csv")} download>
            <Button variant="secondary" size="md" leftIcon={<Icon name="download" size={18} />}>
              Baixar modelo
            </Button>
          </a>
          <a href={linkDoModelo("exemplo.csv")} download>
            <Button variant="ghost" size="md">
              Baixar exemplo preenchido
            </Button>
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-unooria-neutral-200 bg-unooria-neutral-50 p-5">
        <h2 className="text-[16px] font-bold text-unooria-neutral-950">2. Escolha a senha inicial</h2>
        <p className="text-[14px] text-unooria-neutral-700">
          Vale só para quem está entrando agora; a pessoa é obrigada a trocá-la no primeiro acesso.
          Quem já tem conta não tem a senha alterada por uma reimportação.
        </p>
        <div className="flex flex-col gap-2">
          <RadioButton
            id="modo-padrao"
            name="modo-senha"
            label="Uma senha para todo o lote"
            checked={modoSenha === "padrao"}
            onChange={() => setModoSenha("padrao")}
          />
          <RadioButton
            id="modo-por-pessoa"
            name="modo-senha"
            label="Uma senha diferente por pessoa (recomendado para alunos)"
            checked={modoSenha === "por-pessoa"}
            onChange={() => setModoSenha("por-pessoa")}
          />
        </div>
        {modoSenha === "padrao" ? (
          <>
            <div className="max-w-[320px]">
              <TextField
                id="senha-padrao"
                label="Senha do lote"
                value={senhaPadrao}
                onChange={(e) => setSenhaPadrao(e.target.value)}
                helperText="Mínimo 8 caracteres."
              />
            </div>
            <FeedbackAlert
              type="warning"
              description="Com uma senha só, qualquer aluno consegue entrar na conta de outro até o primeiro acesso dele. Em turma grande, prefira uma senha por pessoa."
            />
          </>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-unooria-neutral-200 bg-unooria-neutral-50 p-5">
        <h2 className="text-[16px] font-bold text-unooria-neutral-950">3. Envie a planilha</h2>
        <Button
          variant="primary"
          size="md"
          disabled={modoSenha === "padrao" && senhaPadrao.length < 8}
          onClick={() => setAberto(true)}
        >
          Enviar arquivo
        </Button>
      </section>
      </>
      ) : (
      <section className="flex flex-col gap-4 rounded-xl border border-unooria-neutral-200 bg-unooria-neutral-50 p-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-[16px] font-bold text-unooria-neutral-950">
            Arquivos do padrão, um por vez
          </h2>
          <p className="text-[14px] text-unooria-neutral-700">
            Envie na ordem abaixo. Fora de ordem não corrompe nada: a linha que aponta para um
            <code> sourcedId</code> que ainda não existe volta no relatório dizendo qual arquivo
            falta — em vez de criar meia entidade.
          </p>
          <p className="text-[14px] text-unooria-neutral-700">
            A reimportação é idempotente pelo <code>sourcedId</code>. O que o padrão chama de
            exclusão (<code>status = tobedeleted</code>) <strong>desativa</strong> aqui: pessoa fica
            inativa, matrícula é encerrada, e nada é apagado.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <RadioButton
            id="modo-delta"
            name="modo-lote"
            label="Delta — só o que mudou desde o último envio"
            checked={modoLote === "delta"}
            onChange={() => setModoLote("delta")}
          />
          <RadioButton
            id="modo-bulk"
            name="modo-lote"
            label="Bulk — lote completo da rede"
            checked={modoLote === "bulk"}
            onChange={() => setModoLote("bulk")}
          />
          {modoLote === "bulk" ? (
            <FeedbackAlert
              type="info"
              description="Num lote completo, quem não vier no arquivo NÃO é desativado — só contado e listado no relatório. Ausência de linha não é ordem de exclusão."
            />
          ) : null}
        </div>

        <ul className="flex flex-col divide-y divide-unooria-neutral-200">
          {ARQUIVOS_ONEROSTER.map((arquivo, indice) => {
            const feito = enviados[arquivo.nome];
            return (
              <li key={arquivo.nome} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <span className="text-[15px] font-semibold text-unooria-neutral-950">
                    {indice + 1}. {arquivo.nome}.csv
                  </span>
                  <span className="block text-[13px] text-unooria-neutral-500">
                    {arquivo.descricao}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {feito ? (
                    <Tag>
                      {feito.erros.length > 0
                        ? `${feito.erros.length} erro(s)`
                        : `${feito.criados} novos · ${feito.atualizados} atualizados`}
                    </Tag>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={() => setArquivoAlvo(arquivo.nome)}>
                    Enviar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-[13px] text-unooria-neutral-500">
          Em <code>users.csv</code> a senha inicial é a escolhida na aba
          <strong> Planilha da escola</strong> — a coluna <code>password</code> do padrão é
          ignorada. Sem a coluna <code>role</code>, a pessoa entra como <strong>aluno</strong> (o
          menor privilégio) e o <code>roles.csv</code> corrige.
        </p>
      </section>
      )}

      {relatorio ? (
        <section className="flex flex-col gap-4">
          <FeedbackAlert
            type={relatorio.erros.length > 0 ? "warning" : "success"}
            title={[
              relatorio.arquivo ? `${relatorio.arquivo}.csv:` : "",
              `${relatorio.criados} criados`,
              `${relatorio.atualizados} atualizados`,
              `${relatorio.matriculados} enturmados`,
              relatorio.desativados > 0 ? `${relatorio.desativados} desativados` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
            description={
              relatorio.turmasCriadas.length > 0
                ? `Turmas criadas: ${relatorio.turmasCriadas.join(", ")}.`
                : "Nenhuma turma nova foi criada."
            }
          />

          {relatorio.credenciais.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[16px] font-bold text-unooria-neutral-950">
                  Senhas do primeiro acesso ({relatorio.credenciais.length})
                </h2>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={baixarSenhas}>
                    Baixar CSV
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => window.print()}>
                    Imprimir
                  </Button>
                </div>
              </div>
              <FeedbackAlert
                type="warning"
                description="Guarde agora: estas senhas não aparecem de novo. Depois desta tela, o caminho é resetar a senha da pessoa em Usuários."
              />
              <Table<Credencial>
                columns={colunasDeSenha}
                data={relatorio.credenciais}
                keyExtractor={(linha) => linha.usuario}
                size="sm"
                theme="light"
              />
            </div>
          ) : null}

          {relatorio.avisos.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-[16px] font-bold text-unooria-neutral-950">
                Avisos ({relatorio.avisos.length})
              </h2>
              <Table<ErroDeLinha>
                columns={colunasDeErro}
                data={relatorio.avisos}
                keyExtractor={(linha) => `${linha.linha}-${linha.campo}`}
                size="sm"
                theme="light"
              />
            </div>
          ) : null}

          {relatorio.erros.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-[16px] font-bold text-unooria-neutral-950">
                {relatorio.erros.length} linha(s) não importadas
              </h2>
              <p className="text-[14px] text-unooria-neutral-500">
                Corrija estas linhas no arquivo e importe de novo — as demais já entraram.
              </p>
              <Table<ErroDeLinha>
                columns={colunasDeErro}
                data={relatorio.erros}
                keyExtractor={(linha) => `${linha.linha}-${linha.campo}-${linha.mensagem}`}
                size="sm"
                theme="light"
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-unooria-neutral-200 bg-unooria-neutral-50 p-5">
        <h2 className="text-[16px] font-bold text-unooria-neutral-950">
          Contas sem matrícula da rede
        </h2>
        <p className="text-[14px] text-unooria-neutral-700">
          São as candidatas a <strong>conta de assento</strong> — a conta do aparelho, que uma turma
          usava depois da outra. Depois de importar as pessoas de verdade, elas viram sobra. A
          coluna <strong>dados</strong> mostra quanto cada uma acumulou de partidas e sessões, para
          a decisão não ser às cegas.
        </p>
        {/* Faixa de contexto, não diálogo: `AlertBox` é o diálogo de 436px do
            DS e aparece centralizado no meio da seção. */}
        <FeedbackAlert
          type="warning"
          description="Não existe fundir contas: juntar duas move o que uma criança fez para outra pessoa, e depois ninguém consegue auditar de quem era."
        />
        <div>
          <Button variant="secondary" size="md" isLoading={carregandoAssentos} onClick={() => void carregarAssentos()}>
            {assentos ? "Atualizar lista" : "Listar contas sem matrícula"}
          </Button>
        </div>
        {assentos ? (
          <Table<ContaDeAssento>
            columns={[
              { key: "nome", title: "Nome" },
              { key: "usuario", title: "Login" },
              { key: "papel", title: "Papel" },
              { key: "dados", title: "Dados", align: "right" },
              {
                key: "acoes",
                title: "",
                align: "right",
                render: (_, linha) =>
                  linha.ativo ? (
                    <Button variant="ghost" size="sm" onClick={() => void desativar(linha)}>
                      Desativar
                    </Button>
                  ) : (
                    <Tag>inativa</Tag>
                  ),
              },
            ]}
            data={assentos.contas}
            keyExtractor={(linha) => linha.id}
            emptyText="Nenhuma conta sem matrícula — todo mundo aqui veio de uma importação com RA."
            size="sm"
            theme="light"
          />
        ) : null}
        {assentos?.truncado ? (
          <p className="text-[13px] text-unooria-neutral-500">
            Mostrando as {assentos.total} primeiras. Há mais contas sem matrícula — a lista é
            diagnóstico, não fila de trabalho: importe as pessoas com RA e ela encolhe sozinha.
          </p>
        ) : null}
      </section>

      <UploadFileModal
        isOpen={Boolean(arquivoAlvo)}
        onClose={() => setArquivoAlvo(null)}
        title={`Enviar ${arquivoAlvo}.csv`}
        description={`Arquivo .csv do OneRoster 1.2, modo ${modoLote}. Até 10MB.`}
        accept=".csv,text/csv"
        multiple={false}
        isSubmitting={importando}
        submitText="Enviar"
        cancelText="Cancelar"
        onSubmit={(arquivos) => void importarOneRoster(arquivos)}
      />

      <UploadFileModal
        isOpen={aberto}
        onClose={() => setAberto(false)}
        title="Importar pessoas"
        description="Arquivo .csv em UTF-8, até 10MB."
        accept=".csv,text/csv"
        multiple={false}
        isSubmitting={importando}
        submitText="Importar"
        cancelText="Cancelar"
        onSubmit={(arquivos) => void importar(arquivos)}
      />
    </div>
  );
}
