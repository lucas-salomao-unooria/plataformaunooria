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
  Selection,
  Table,
  Tag,
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
  paiId: string | null;
  pai: string | null;
  estudantes?: number;
  alunos?: number;
  professores: number;
  turmas: number;
}

interface Pessoa extends Record<string, unknown> {
  id: string;
  nome: string;
  usuario: string;
  papel: string;
}

const ROTULO_DO_TIPO: Record<string, string> = {
  escola: "Unidade",
  regional: "Regional",
  rede: "Rede",
};

/**
 * As escolas do contrato — a tela que faltava para vender a uma rede.
 *
 * Só `admin-contrato` chega aqui, e a razão é a mesma que impede `orgs.csv` de
 * criar escola para gestor: escola é *tenant*, com RLS, dados de menores e stack
 * por trás. Abrir um inquilino novo não é operação de quem administra uma
 * unidade.
 *
 * Três níveis convivem na mesma lista (`rede` > `regional` > `escola`) porque
 * uma rede estadual chega organizada em diretorias. A hierarquia AGRUPA e não
 * autoriza: quem dá acesso é a lotação, e é justamente por isso que a seleção de
 * linhas aqui termina em "lotar pessoa nestas escolas" — a diretoria é o insumo
 * da lotação em lote, nunca um poder que a pessoa herda por estar nela.
 */
export function EscolasDaRede() {
  const router = useRouter();
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [regional, setRegional] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aberta, setAberta] = useState<"nova" | Escola | null>(null);
  const [id, setId] = useState("");
  const [nome, setNome] = useState("");
  const [tipoNova, setTipoNova] = useState("escola");
  const [paiId, setPaiId] = useState("");
  const [inep, setInep] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [salvando, setSalvando] = useState(false);

  /** Seleção de linhas → lotação em lote. */
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  /* O lote trabalha sobre uma FOTOGRAFIA da seleção, não sobre a seleção viva:
     ao terminar eu desmarco as linhas da tabela, e um diálogo que lesse a
     seleção passaria a dizer "em 0 unidades" logo depois de ter lotado em duas. */
  const [loteAberto, setLoteAberto] = useState<Escola[] | null>(null);
  const [escolaDeOrigem, setEscolaDeOrigem] = useState("");
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [pessoaId, setPessoaId] = useState("");
  const [lotando, setLotando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set("busca", busca.trim());
      if (tipo) params.set("tipo", tipo);
      if (regional) params.set("paiId", regional);
      const resposta = await fetch(`/api/plataforma/escolas?${params}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      setEscolas((await resposta.json()) as Escola[]);
    } catch {
      setErro("Não foi possível carregar as escolas.");
    } finally {
      setCarregando(false);
    }
  }, [busca, tipo, regional]);

  useEffect(() => {
    const id = setTimeout(() => void carregar(), busca ? 300 : 0);
    return () => clearTimeout(id);
  }, [carregar, busca]);

  /**
   * As regionais alimentam dois seletores (o filtro e o campo "pertence a"), e
   * elas não podem vir da lista da tela: com o filtro ligado a lista tem
   * exatamente uma. Busca própria, sem filtro.
   */
  const [regionais, setRegionais] = useState<Escola[]>([]);
  const carregarRegionais = useCallback(async () => {
    try {
      const resposta = await fetch("/api/plataforma/escolas?tipo=regional");
      if (resposta.ok) setRegionais((await resposta.json()) as Escola[]);
    } catch {
      /* o seletor fica só com "nenhuma" — não é motivo para travar a tela */
    }
  }, []);
  useEffect(() => {
    void carregarRegionais();
  }, [carregarRegionais]);

  function abrirNova(comTipo: "escola" | "regional") {
    setId("");
    setNome("");
    setTipoNova(comTipo);
    setPaiId(comTipo === "regional" ? "" : regional);
    setInep("");
    setMunicipio("");
    setUf("");
    setAberta("nova");
  }

  function abrirEdicao(escola: Escola) {
    setId(escola.id);
    setNome(escola.nome);
    setTipoNova(escola.tipo);
    setPaiId(escola.paiId ?? "");
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
      paiId,
    };
    try {
      const nova = aberta === "nova";
      const resposta = await fetch(
        nova ? "/api/plataforma/escolas" : `/api/plataforma/escolas/${id}`,
        {
          method: nova ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nova ? { id: id.trim(), tipo: tipoNova, ...corpo } : corpo),
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
      await Promise.all([carregar(), carregarRegionais()]);
    } catch {
      setErro("Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  // ------------------------------------------------------------- lote

  /** Regional e rede não recebem lotação: não têm turma, estudante nem dado. */
  const unidadesSelecionadas = useMemo(
    () => escolas.filter((e) => selecionadas.includes(e.id) && e.tipo === "escola"),
    [escolas, selecionadas],
  );
  const unidadesDoLote = loteAberto ?? [];

  const buscarPessoas = useCallback(async () => {
    if (!escolaDeOrigem) {
      setPessoas([]);
      return;
    }
    const params = new URLSearchParams({ escolaId: escolaDeOrigem, porPagina: "25" });
    if (buscaPessoa.trim()) params.set("busca", buscaPessoa.trim());
    try {
      const resposta = await fetch(`/api/plataforma/usuarios?${params}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      const dados = (await resposta.json()) as { usuarios?: Pessoa[] };
      setPessoas(
        (dados.usuarios ?? []).filter((p) => p.papel === "professor" || p.papel === "gestor"),
      );
    } catch {
      setPessoas([]);
    }
  }, [escolaDeOrigem, buscaPessoa]);

  useEffect(() => {
    if (loteAberto === null) return;
    const t = setTimeout(() => void buscarPessoas(), buscaPessoa ? 300 : 0);
    return () => clearTimeout(t);
  }, [loteAberto, buscarPessoas, buscaPessoa]);

  function abrirLote() {
    setEscolaDeOrigem(unidadesSelecionadas[0]?.id ?? "");
    setBuscaPessoa("");
    setPessoas([]);
    setPessoaId("");
    setFeito(null);
    setLoteAberto(unidadesSelecionadas);
  }

  function fecharLote() {
    setLoteAberto(null);
    if (feito) setSelecionadas([]);
  }

  async function lotarEmLote() {
    const pessoa = pessoas.find((p) => p.id === pessoaId);
    if (!pessoa) return;
    setLotando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/plataforma/escolas/lotacoes-em-lote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          usuarioId: pessoa.id,
          papel: pessoa.papel === "gestor" ? "gestor" : "professor",
          escolaIds: unidadesDoLote.map((e) => e.id),
        }),
      });
      const dados = (await resposta.json().catch(() => null)) as
        | { lotadas?: number; message?: string }
        | null;
      if (!resposta.ok) {
        setErro(typeof dados?.message === "string" ? dados.message : "Não foi possível lotar.");
        return;
      }
      setFeito(
        `${pessoa.nome} agora está em ${dados?.lotadas ?? 0} unidade${
          dados?.lotadas === 1 ? "" : "s"
        }. A troca de escola é no seletor do cabeçalho, uma por vez.`,
      );
      await carregar();
    } catch {
      setErro("Não foi possível lotar.");
    } finally {
      setLotando(false);
    }
  }

  const colunas = useMemo<TableColumn<Escola>[]>(
    () => [
      {
        key: "nome",
        title: "Escola",
        render: (_, l) => (
          <span>
            {String(l.nome)}
            {l.tipo !== "escola" ? (
              <>
                {" "}
                <Tag variant="brand" size="sm">
                  {ROTULO_DO_TIPO[String(l.tipo)] ?? String(l.tipo)}
                </Tag>
              </>
            ) : null}
            <span className="block text-[12px] text-unooria-neutral-500">
              <code>{String(l.id)}</code>
              {l.pai ? ` · ${String(l.pai)}` : ""}
            </span>
          </span>
        ),
      },
      { key: "codigoInep", title: "INEP", render: (_, l) => l.codigoInep ?? "—" },
      {
        key: "local",
        title: "Município",
        render: (_, l) => (l.municipio ? `${l.municipio}${l.uf ? `/${l.uf}` : ""}` : "—"),
      },
      {
        key: "turmas",
        title: "Turmas",
        align: "right",
        render: (_, l) => (l.tipo === "escola" ? String(l.turmas) : "—"),
      },
      {
        key: "estudantes",
        title: "Estudantes",
        align: "right",
        render: (_, l) => (l.tipo === "escola" ? String(l.estudantes ?? l.alunos) : "—"),
      },
      {
        key: "professores",
        title: "Professores",
        align: "right",
        render: (_, l) => (l.tipo === "escola" ? String(l.professores) : "—"),
      },
      {
        key: "acoes",
        title: "",
        align: "right",
        render: (_, l) => (
          <div className="flex justify-end gap-1">
            {/* Sem isto o admin do contrato teria de digitar o id da escola em
                cada tela — e o id é justamente o que ele não decora. */}
            {l.tipo === "escola" ? (
              <>
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
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTipo("escola");
                  setRegional(String(l.id));
                }}
              >
                Ver unidades
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => abrirEdicao(l)}>
              Editar
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [regional],
  );

  const unidades = escolas.filter((e) => e.tipo === "escola");
  const totais = unidades.reduce(
    (soma, e) => ({
      estudantes: soma.estudantes + (e.estudantes ?? e.alunos ?? 0),
      alunos: soma.alunos + (e.alunos ?? e.estudantes ?? 0),
      professores: soma.professores + e.professores,
      turmas: soma.turmas + e.turmas,
    }),
    { estudantes: 0, alunos: 0, professores: 0, turmas: 0 },
  );

  const opcoesDeRegional = [
    { value: "", label: "Sem regional" },
    ...regionais.map((r) => ({ value: r.id, label: r.nome })),
  ];

  return (
    <div className="plataforma-largura-cheia mx-auto flex max-w-[1180px] flex-col gap-6">
      <SectionHeader
        title="Escolas da rede"
        description="Cada escola é um espaço isolado: os dados de uma nunca aparecem na outra. O que atravessa é a pessoa — professor lotado em várias, estudante transferido. A regional agrupa unidades para você trabalhar em lote; ela não dá acesso a nada."
      />

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[280px]">
            <SearchInput
              id="busca-escola"
              label="Buscar"
              placeholder="Nome, id, INEP ou município"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="w-[180px]">
            <Selection
              id="filtro-regional"
              label="Regional"
              value={regional}
              options={opcoesDeRegional}
              onChange={(v) => setRegional(String(v))}
            />
          </div>
          <div className="w-[180px]">
            <Selection
              id="filtro-tipo"
              label="Tipo"
              value={tipo}
              options={[
                { value: "", label: "Todos os tipos" },
                { value: "escola", label: "Unidades" },
                { value: "regional", label: "Regionais" },
                { value: "rede", label: "Redes" },
              ]}
              onChange={(v) => setTipo(String(v))}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {unidadesSelecionadas.length > 0 ? (
            <Button
              variant="primary"
              size="md"
              onClick={abrirLote}
            >
              Lotação em lote ({unidadesSelecionadas.length})
            </Button>
          ) : null}
          <Button variant="ghost" size="md" onClick={() => abrirNova("regional")}>
            Nova regional
          </Button>
          <Button variant="primary" size="md" onClick={() => abrirNova("escola")}>
            Nova escola
          </Button>
        </div>
      </div>

      <p className="text-[14px] text-unooria-neutral-500">
        {escolas.length} registro{escolas.length === 1 ? "" : "s"} · {unidades.length} unidade
        {unidades.length === 1 ? "" : "s"} · {totais.turmas} turmas · {totais.estudantes} estudantes ·{" "}
        {totais.professores} vínculos de professor
      </p>

      {unidadesSelecionadas.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-unooria-neutral-200 bg-unooria-neutral-50 px-4 py-3">
          <span className="text-[14px] text-unooria-neutral-700">
            {unidadesSelecionadas.length} unidade
            {unidadesSelecionadas.length === 1 ? "" : "s"} selecionada
            {unidadesSelecionadas.length === 1 ? "" : "s"}
            {selecionadas.length !== unidadesSelecionadas.length
              ? " (regionais marcadas são ignoradas — não recebem lotação)"
              : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelecionadas([])}>
              Limpar
            </Button>
            <Button variant="primary" size="sm" onClick={abrirLote}>
              Lotar pessoa nestas escolas
            </Button>
          </div>
        </div>
      ) : null}

      <Table<Escola>
        columns={colunas}
        data={escolas}
        keyExtractor={(l) => l.id}
        selectable
        selectedKeys={selecionadas}
        onSelectionChange={(chaves) => setSelecionadas(chaves.map(String))}
        loading={carregando}
        emptyText="Nenhuma escola encontrada."
        size="md"
        theme="light"
      />

      <FeedbackAlert
        type="info"
        title="Cadastrar uma rede inteira"
        description="Uma escola por vez aqui, ou o orgs.csv do OneRoster em Importar — que aceita a coluna parentSourcedId e monta as diretorias junto. Milhares de unidades não entram à mão."
      />

      <Modal isOpen={aberta !== null} onClose={() => setAberta(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>
            {aberta === "nova"
              ? tipoNova === "regional"
                ? "Nova regional"
                : "Nova escola"
              : "Editar escola"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <TextField
              id="escola-id"
              label={tipoNova === "regional" ? "Id da regional" : "Id da escola"}
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
            {tipoNova !== "rede" ? (
              <Selection
                label="Pertence a"
                value={paiId}
                onChange={(valor) => setPaiId(String(valor))}
                options={opcoesDeRegional}
              />
            ) : null}
            {tipoNova === "escola" ? (
              <>
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
              </>
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
            {aberta === "nova" ? "Criar" : "Salvar"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={loteAberto !== null} onClose={fecharLote} size="md" theme="light">
        <ModalHeader>
          <ModalTitle>
            Lotar pessoa em {unidadesDoLote.length} unidade
            {unidadesDoLote.length === 1 ? "" : "s"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <FeedbackAlert
              type="info"
              title="É assim que nasce o supervisor de uma diretoria"
              description="Sem papel novo: um gestor lotado nas unidades da regional. Ele continua vendo uma escola por vez — troca no seletor do cabeçalho — e nunca vê duas somadas."
            />

            {/* A pessoa já existe em ALGUMA escola: a lista de pessoas é por
                escola porque a leitura é escopada por tenant. Escolher onde ela
                está hoje é o passo que substitui uma busca cross-escola. */}
            <Selection
              label="Onde a pessoa está hoje"
              value={escolaDeOrigem}
              onChange={(valor) => {
                setEscolaDeOrigem(String(valor));
                setPessoaId("");
              }}
              options={[
                { value: "", label: "Escolha a escola" },
                ...unidadesDoLote.map((e) => ({ value: e.id, label: e.nome })),
                ...escolas
                  .filter((e) => e.tipo === "escola" && !unidadesDoLote.some((u) => u.id === e.id))
                  .map((e) => ({ value: e.id, label: e.nome })),
              ]}
            />

            <SearchInput
              id="busca-pessoa-lote"
              label="Professor ou gestor"
              placeholder="Nome, login ou CPF"
              value={buscaPessoa}
              onChange={(e) => setBuscaPessoa(e.target.value)}
            />

            {pessoas.length === 0 ? (
              <p className="text-[14px] text-unooria-neutral-500">
                {escolaDeOrigem
                  ? "Nenhum professor ou gestor encontrado nesta escola."
                  : "Escolha a escola em que a pessoa já está cadastrada."}
              </p>
            ) : (
              <Selection
                label="Pessoa"
                value={pessoaId}
                onChange={(valor) => setPessoaId(String(valor))}
                options={pessoas.map((p) => ({
                  value: p.id,
                  label: `${p.nome} · ${p.usuario} · ${p.papel}`,
                }))}
              />
            )}

            <p className="text-[13px] text-unooria-neutral-500">
              Escolas: {unidadesDoLote.map((e) => e.nome).join(", ")}
            </p>

            {feito ? <FeedbackAlert type="success" title="Pronto" description={feito} /> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={fecharLote}>
            Fechar
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={lotando}
            disabled={!pessoaId || unidadesDoLote.length === 0}
            onClick={() => void lotarEmLote()}
          >
            Lotar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
