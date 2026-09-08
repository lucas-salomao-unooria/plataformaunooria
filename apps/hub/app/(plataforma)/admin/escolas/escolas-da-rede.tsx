"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertBox,
  Button,
  Checkbox,
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
  TextField,
  type TableColumn,
} from "@edu/ui/ds";
import { rotuloDoPapel, type Papel } from "@/lib/papeis";

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
  professores: number;
  turmas: number;
}

/** Um profissional achado na REDE, com as escolas em que ele já está. */
interface Profissional {
  id: string;
  nome: string;
  usuario: string;
  papel: string;
  escolas: Array<{ id: string; nome: string; papel: string }>;
}

/** Os quatro estados da busca, distinguidos porque o card cobra isso: a tela
 *  dizia "nenhum professor encontrado nesta escola" ANTES de qualquer busca. */
type EstadoDaBusca = "inicial" | "buscando" | "vazia" | "erro" | "achou";

/**
 * As escolas do contrato — a tela que faltava para vender a uma rede.
 *
 * Só `gestor_contrato` chega aqui, e a razão é a mesma que impede `orgs.csv` de
 * criar escola para gestor: escola é *tenant*, com RLS, dados de menores e stack
 * por trás. Abrir um inquilino novo não é operação de quem administra uma
 * unidade.
 *
 * SÓ ESCOLAS desde 2026-09-08 (ADR-79). Até então os três níveis conviviam aqui
 * — o tipo numa etiqueta, "—" nas colunas de turma e estudante das regionais,
 * um resumo que somava níveis diferentes ("3 registros · 2 unidades") e um
 * filtro de Tipo que existia só para desfazer a mistura. As regionais têm tela
 * própria (`/admin/regionais`) e este filtro morreu com a separação.
 *
 * A regional AGRUPA e não autoriza: quem dá acesso é a lotação, e é por isso que
 * a seleção de linhas aqui termina em vincular alguém às escolas selecionadas —
 * a diretoria é o insumo da lotação em lote, nunca um poder que a pessoa herda
 * por estar nela.
 */
export function EscolasDaRede() {
  const router = useRouter();
  /** "Ver escolas", na tela de Regionais, chega por aqui já filtrado. */
  const regionalDaUrl = useSearchParams().get("regional") ?? "";
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [busca, setBusca] = useState("");
  const [regional, setRegional] = useState(regionalDaUrl);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aberta, setAberta] = useState<"nova" | Escola | null>(null);
  const [id, setId] = useState("");
  const [nome, setNome] = useState("");
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
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [achados, setAchados] = useState<Profissional[]>([]);
  const [estadoDaBusca, setEstadoDaBusca] = useState<EstadoDaBusca>("inicial");
  const [pessoaId, setPessoaId] = useState("");
  /** Os destinos, editáveis: a seleção da tabela entra como SUGESTÃO. */
  const [destinos, setDestinos] = useState<string[]>([]);
  const [lotando, setLotando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      // `tipo=escola` é fixo: esta tela é só de escolas, e as regionais têm a
      // própria. Sem ele a listagem voltaria a misturar níveis.
      const params = new URLSearchParams({ tipo: "escola" });
      if (busca.trim()) params.set("busca", busca.trim());
      if (regional) params.set("paiId", regional);
      const resposta = await fetch(`/api/plataforma/escolas?${params}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      setEscolas((await resposta.json()) as Escola[]);
    } catch {
      setErro("Não foi possível carregar as escolas.");
    } finally {
      setCarregando(false);
    }
  }, [busca, regional]);

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

  function abrirNova() {
    setId("");
    setNome("");
    /* A regional já vem escolhida quando não há escolha a fazer: o filtro em uso
       manda, e com UMA regional na rede é ela. Com várias, o campo abre vazio e
       o formulário não salva sem seleção — é a regra do vínculo obrigatório
       aparecendo como ausência de atalho, não como erro depois de digitar. */
    setPaiId(regional || (regionais.length === 1 ? (regionais[0]?.id ?? "") : ""));
    setInep("");
    setMunicipio("");
    setUf("");
    setAberta("nova");
  }

  function abrirEdicao(escola: Escola) {
    setId(escola.id);
    setNome(escola.nome);
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
          body: JSON.stringify(nova ? { id: id.trim(), tipo: "escola", ...corpo } : corpo),
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

  /* A tabela só tem escolas, então toda linha marcada recebe lotação. Havia um
     filtro por tipo aqui — e um aviso de "regionais marcadas são ignoradas" na
     barra de seleção — porque a listagem misturava níveis. */
  const unidadesSelecionadas = useMemo(
    () => escolas.filter((e) => selecionadas.includes(e.id)),
    [escolas, selecionadas],
  );

  /**
   * A busca é na REDE inteira, sem escola de origem.
   *
   * O campo "Onde a pessoa está hoje" saiu, e não por gosto: ele filtrava por
   * `users.escola_id`, que é o CACHE da lotação principal — quem trabalha em
   * duas escolas só era encontrado pela principal, e procurando pela outra a
   * lista voltava VAZIA. O administrador concluía que a pessoa não existe,
   * exatamente na população que esta tela existe para administrar.
   */
  const buscarProfissionais = useCallback(async () => {
    const termo = buscaPessoa.trim();
    if (termo.length < 2) {
      setAchados([]);
      setEstadoDaBusca("inicial");
      return;
    }
    setEstadoDaBusca("buscando");
    try {
      const params = new URLSearchParams({ busca: termo, limite: "25" });
      const resposta = await fetch(`/api/plataforma/escolas/profissionais?${params}`);
      if (!resposta.ok) throw new Error(String(resposta.status));
      const dados = (await resposta.json()) as Profissional[];
      setAchados(dados);
      /* "vazia" só DEPOIS de uma busca concluída. O estado inicial orienta a
         pesquisa; dizer "nenhum encontrado" antes de procurar é afirmar sobre
         uma consulta que nunca aconteceu. */
      setEstadoDaBusca(dados.length === 0 ? "vazia" : "achou");
    } catch {
      setAchados([]);
      setEstadoDaBusca("erro");
    }
  }, [buscaPessoa]);

  useEffect(() => {
    if (loteAberto === null) return;
    const t = setTimeout(() => void buscarProfissionais(), 300);
    return () => clearTimeout(t);
  }, [loteAberto, buscarProfissionais]);

  const escolhido = achados.find((p) => p.id === pessoaId) ?? null;
  /** As escolas em que ele JÁ está — o vínculo não se oferece duas vezes. */
  const jaVinculado = useMemo(
    () => new Set(escolhido?.escolas.map((e) => e.id) ?? []),
    [escolhido],
  );
  const destinosNovos = destinos.filter((id) => !jaVinculado.has(id));
  const todosJaVinculados = destinos.length > 0 && destinosNovos.length === 0;

  function abrirLote() {
    setBuscaPessoa("");
    setAchados([]);
    setEstadoDaBusca("inicial");
    setPessoaId("");
    /* A seleção da tabela é SUGESTÃO de destino, não restrição: a busca da
       pessoa é independente dela, e os destinos são editáveis no diálogo. */
    setDestinos(unidadesSelecionadas.map((e) => e.id));
    setFeito(null);
    setLoteAberto(unidadesSelecionadas);
  }

  function fecharLote() {
    setLoteAberto(null);
    if (feito) setSelecionadas([]);
  }

  async function lotarEmLote() {
    if (!escolhido || destinosNovos.length === 0) return;
    setLotando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/plataforma/escolas/lotacoes-em-lote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          usuarioId: escolhido.id,
          /* O papel é o DA PESSOA, não uma escolha: a api recusa divergência,
             porque a chave de `lotacoes` inclui o papel e um papel diferente
             criaria uma SEGUNDA linha na mesma escola. */
          papel: escolhido.papel,
          /* Só os destinos NOVOS: o card pede "criar somente os novos
             vínculos", e mandar os já vinculados faria a api devolvê-los em
             `jaVinculadas` — correto, mas é trabalho que não precisava sair. */
          escolaIds: destinosNovos,
        }),
      });
      const dados = (await resposta.json().catch(() => null)) as
        | { criadas?: string[]; reabertas?: string[]; message?: string }
        | null;
      if (!resposta.ok) {
        setErro(
          typeof dados?.message === "string" ? dados.message : "Não foi possível vincular.",
        );
        return;
      }
      const nomeDaEscola = (id: string) => escolas.find((e) => e.id === id)?.nome ?? id;
      const criadas = dados?.criadas ?? [];
      const reabertas = dados?.reabertas ?? [];
      setFeito(
        [
          criadas.length > 0
            ? `Vínculo criado em: ${criadas.map(nomeDaEscola).join(", ")}.`
            : null,
          reabertas.length > 0
            ? `Vínculo reaberto em: ${reabertas.map(nomeDaEscola).join(", ")}.`
            : null,
          "A troca de escola é no seletor do cabeçalho, uma por vez.",
        ]
          .filter(Boolean)
          .join(" "),
      );
      await carregar();
    } catch {
      setErro("Não foi possível vincular.");
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
            {/* A regional é informação DA ESCOLA, na segunda linha junto do id:
                ela não é mais uma linha da tabela, e sem isto o filtro de
                regional seria o único lugar do produto que diz a qual diretoria
                a unidade pertence. */}
            <span className="block text-[12px] text-unooria-neutral-500">
              <code>{String(l.id)}</code>
              {l.pai ? ` · ${String(l.pai)}` : ""}
            </span>
          </span>
        ),
      },
      { key: "codigoInep", title: "Código INEP", render: (_, l) => l.codigoInep ?? "—" },
      {
        key: "local",
        title: "Município",
        render: (_, l) => (l.municipio ? `${l.municipio}${l.uf ? `/${l.uf}` : ""}` : "—"),
      },
      { key: "turmas", title: "Turmas", align: "right", render: (_, l) => String(l.turmas) },
      {
        key: "estudantes",
        title: "Estudantes",
        align: "right",
        render: (_, l) => String(l.estudantes ?? 0),
      },
      {
        key: "professores",
        title: "Professores",
        align: "right",
        render: (_, l) => String(l.professores),
      },
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
              Ver turmas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/usuarios?escolaId=${encodeURIComponent(l.id)}`)}
            >
              Ver pessoas
            </Button>
            <Button variant="ghost" size="sm" onClick={() => abrirEdicao(l)}>
              Editar
            </Button>
          </div>
        ),
      },
    ],
    [router],
  );

  const totais = escolas.reduce(
    (soma, e) => ({
      estudantes: soma.estudantes + (e.estudantes ?? 0),
      professores: soma.professores + e.professores,
      turmas: soma.turmas + e.turmas,
    }),
    { estudantes: 0, professores: 0, turmas: 0 },
  );

  /* "Todas as regionais" e não "Sem regional": o rótulo antigo MENTIA — o valor
     vazio nunca filtrou órfãs, ele limpava o filtro e mostrava a rede inteira.
     E hoje não haveria o que mostrar: toda escola tem regional (ADR-79). */
  const opcoesDoFiltro = [
    { value: "", label: "Todas as regionais" },
    ...regionais.map((r) => ({ value: r.id, label: r.nome })),
  ];
  /* No FORMULÁRIO, "Selecione uma regional" aparece só quando há ESCOLHA a
     fazer. Com uma regional na rede, `abrirNova` já a deixou marcada e a opção
     vazia seria um convite a desfazer o único caminho possível. Com várias, ela
     é o estado inicial honesto — sem ela o campo abriria mostrando a primeira
     regional como se alguém a tivesse escolhido. */
  const opcoesDoCadastro = [
    ...(regionais.length > 1 ? [{ value: "", label: "Selecione uma regional" }] : []),
    ...regionais.map((r) => ({ value: r.id, label: r.nome })),
  ];

  return (
    <div className="plataforma-largura-cheia flex flex-col gap-6">
      <SectionHeader
        title="Escolas"
        description="Cadastre escolas, consulte suas informações e acesse turmas e pessoas cadastradas."
      />

      {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[280px]">
            <SearchInput
              id="busca-escola"
              label="Buscar escola"
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
              options={opcoesDoFiltro}
              onChange={(v) => setRegional(String(v))}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {/* SEMPRE visível: a operação deixou de exigir seleção prévia. A busca
              da pessoa é independente das escolas marcadas, e as marcadas entram
              como sugestão de destino — o que o card pede. Antes o botão só
              aparecia com linha marcada, e ele duplicava o da barra de seleção:
              dois botões idênticos lado a lado. */}
          <Button variant="secondary" size="md" onClick={abrirLote}>
            Vincular professor ou gestor
          </Button>
          <Button variant="primary" size="md" onClick={abrirNova}>
            Cadastrar escola
          </Button>
        </div>
      </div>

      {/* "vínculos de professores" e não "professores": por escola o número é de
          PESSOAS (índice único por escola+pessoa+papel), mas o total somado
          conta duas vezes o professor lotado em duas escolas. A coluna diz
          pessoa; o resumo, vínculo. */}
      <p className="text-[14px] text-unooria-neutral-500">
        {escolas.length} escola{escolas.length === 1 ? "" : "s"} · {totais.turmas} turmas ·{" "}
        {totais.estudantes.toLocaleString("pt-BR")} estudantes · {totais.professores} vínculos de
        professores
        {/* A explicação que o card oferece como opcional, e que entrou porque a
            confusão pessoa/vínculo já custou duas conversas: a coluna conta
            pessoas na escola, o total conta vínculos na rede. */}
        <span className="block text-[13px]">
          Um professor pode ter vínculo com mais de uma escola.
        </span>
      </p>

      {unidadesSelecionadas.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-unooria-neutral-200 bg-unooria-neutral-50 px-4 py-3">
          <span className="text-[14px] text-unooria-neutral-700">
            {unidadesSelecionadas.length} escola
            {unidadesSelecionadas.length === 1 ? "" : "s"} selecionada
            {unidadesSelecionadas.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelecionadas([])}>
              Limpar seleção
            </Button>
            <Button variant="primary" size="sm" onClick={abrirLote}>
              Vincular professor ou gestor às escolas selecionadas
            </Button>
          </div>
        </div>
      ) : null}

      <ScrollBar orientation="both" autoHide className="tabela-rolavel">
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
      </ScrollBar>

      {/* O detalhe de formato (orgs.csv, OneRoster, parentSourcedId) mora nas
          instruções ao lado do envio do arquivo, em Importar: aqui ele só
          atravancava a leitura de quem chega pela primeira vez. */}
      <FeedbackAlert
        type="info"
        title="Cadastrar várias escolas"
        description="Para cadastrar várias escolas de uma só vez, acesse Importar."
      />

      <Modal isOpen={aberta !== null} onClose={() => setAberta(null)} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>{aberta === "nova" ? "Cadastrar escola" : "Editar escola"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <TextField
              id="escola-id"
              /* "Código interno" e não "Id da escola": é o nome que o card pede
                 nos DETALHES, e é o que quem chega entende. Ele CONTINUA na
                 listagem, sem rótulo, porque é a chave que a secretaria usa nas
                 planilhas de importação — a suíte e2e registra isso como prova. */
              label="Código interno"
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
            <Selection
              id="escola-regional"
              label="Regional"
              value={paiId}
              onChange={(valor) => setPaiId(String(valor))}
              options={opcoesDoCadastro}
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
            /* Sem regional não salva — a api reprovaria com o mesmo texto, mas
               descobrir isso depois de preencher o formulário inteiro é pior
               que o botão dizer que ainda falta algo. */
            disabled={!nome.trim() || !paiId || (aberta === "nova" && id.trim().length < 3)}
            onClick={() => void salvar()}
          >
            {aberta === "nova" ? "Cadastrar" : "Salvar"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={loteAberto !== null} onClose={fecharLote} size="md" theme="light">
        <ModalHeader>
          {/* A contagem é DINÂMICA, dos destinos marcados agora — não da seleção
              da tabela no momento em que o diálogo abriu. O card pede o número
              no título; capturá-lo na abertura o deixaria velho no primeiro
              clique numa caixa, porque os destinos são editáveis aqui dentro. */}
          <ModalTitle>
            {destinosNovos.length === 1
              ? "Vincular professor ou gestor a 1 escola"
              : `Vincular professor ou gestor a ${destinosNovos.length} escolas`}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-unooria-neutral-700">
              Busque um professor ou gestor na rede. Depois, escolha as escolas às quais deseja
              vinculá-lo.
            </p>

            {/* 1. A PESSOA, buscada na rede — sem escola de origem. */}
            <SearchInput
              id="busca-pessoa-lote"
              label="Buscar professor ou gestor"
              placeholder="Nome, login, matrícula ou CPF"
              value={buscaPessoa}
              onChange={(e) => {
                setBuscaPessoa(e.target.value);
                setPessoaId("");
              }}
            />

            {estadoDaBusca === "inicial" ? (
              <p className="text-[14px] text-unooria-neutral-500">
                Digite o nome, login ou CPF de um professor ou gestor da rede.
              </p>
            ) : null}
            {estadoDaBusca === "buscando" ? (
              <p className="text-[14px] text-unooria-neutral-500">Buscando na rede…</p>
            ) : null}
            {estadoDaBusca === "vazia" ? (
              <p className="text-[14px] text-unooria-neutral-500">
                Nenhum professor ou gestor encontrado para esta busca na rede. Confira os dados
                informados.
              </p>
            ) : null}
            {estadoDaBusca === "erro" ? (
              <AlertBox
                theme="light"
                variant="error"
                device="auto"
                description="Não foi possível consultar a rede. Tente de novo."
              />
            ) : null}

            {estadoDaBusca === "achou" ? (
              <Selection
                id="profissional-encontrado"
                label="Professor ou gestor encontrado"
                value={pessoaId}
                onChange={(valor) => setPessoaId(String(valor))}
                options={[
                  { value: "", label: "Selecione o professor ou gestor" },
                  ...achados.map((p) => ({
                    value: p.id,
                    label: `${p.nome} · ${p.usuario} · ${rotuloDoPapel(p.papel as Papel)}`,
                  })),
                ]}
              />
            ) : null}

            {/* 2. OS VÍNCULOS QUE ELE JÁ TEM. Mostrados antes dos destinos: é o
                   que evita o administrador pedir o que já existe. */}
            {escolhido ? (
              <div className="rounded-xl border border-unooria-neutral-200 bg-unooria-neutral-50 px-4 py-3">
                <p className="text-[13px] font-semibold text-unooria-neutral-700">
                  Escolas com vínculo
                </p>
                {escolhido.escolas.length === 0 ? (
                  <p className="text-[13px] text-unooria-neutral-500">
                    Nenhuma ainda — este será o primeiro vínculo dele.
                  </p>
                ) : (
                  <p className="text-[13px] text-unooria-neutral-700">
                    {escolhido.escolas.map((e) => e.nome).join(", ")}
                  </p>
                )}
              </div>
            ) : null}

            {/* 3. OS DESTINOS, editáveis. A seleção da tabela entrou marcada. */}
            {escolhido ? (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-semibold text-unooria-neutral-700">
                  Escolas que receberão o vínculo:
                </p>
                <ScrollBar orientation="vertical" autoHide className="max-h-[220px]">
                  <div className="flex flex-col gap-2 pr-2">
                    {escolas.map((e) => {
                      const vinculado = jaVinculado.has(e.id);
                      return (
                        <label key={e.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`destino-${e.id}`}
                            checked={destinos.includes(e.id)}
                            disabled={vinculado}
                            onChange={() =>
                              setDestinos((atual) =>
                                atual.includes(e.id)
                                  ? atual.filter((x) => x !== e.id)
                                  : [...atual, e.id],
                              )
                            }
                          />
                          <span className="text-[14px] text-unooria-neutral-700">
                            {e.nome}
                            {vinculado ? (
                              <span className="text-unooria-neutral-500">
                                {" "}
                                — Já vinculado a esta escola
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollBar>
              </div>
            ) : null}

            {todosJaVinculados ? (
              <FeedbackAlert
                type="info"
                title="Nada a criar"
                description="O profissional já está vinculado a todas as escolas selecionadas."
              />
            ) : null}

            {/* 4. PERFIL E ACESSO, antes de confirmar. UM perfil, e a frase diz
                   que ele vale em todas: `users.role` é global, e o papel da
                   lotação não autoriza. Um seletor por escola prometeria o que
                   o `RolesGuard` não cumpre. */}
            {escolhido && destinosNovos.length > 0 ? (
              <div className="rounded-xl border border-unooria-neutral-200 px-4 py-3">
                <p className="text-[13px] text-unooria-neutral-700">
                  <span className="font-semibold">Professor ou gestor selecionado:</span>{" "}
                  {escolhido.nome} ({escolhido.usuario})
                </p>
                <p className="text-[13px] text-unooria-neutral-700">
                  <span className="font-semibold">Perfil nas escolas de destino:</span>{" "}
                  {rotuloDoPapel(escolhido.papel as Papel)} — o mesmo em todas, hoje o perfil é da pessoa e
                  não da escola.
                </p>
                {/* As escolas do vínculo NOVO, pelo NOME. Numa seleção mista —
                    algumas já vinculadas, outras não — dizer só "3 escolas"
                    deixa quem confirma sem saber quais das marcadas vão receber
                    o vínculo. O card pede que isso seja explícito. */}
                <p className="text-[13px] text-unooria-neutral-700">
                  <span className="font-semibold">Escolas que receberão vínculo novo:</span>{" "}
                  {destinosNovos
                    .map((id) => escolas.find((e) => e.id === id)?.nome ?? id)
                    .join(", ")}
                </p>
                <p className="text-[13px] text-unooria-neutral-700">
                  <span className="font-semibold">Acesso concedido:</span> passa a abrir{" "}
                  {destinosNovos.length === 1 ? "esta escola" : `estas ${destinosNovos.length} escolas`}{" "}
                  no seletor do cabeçalho, uma por vez. Os vínculos que ele já tem continuam
                  valendo.
                </p>
              </div>
            ) : null}

            {feito ? <FeedbackAlert type="success" title="Pronto" description={feito} /> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" onClick={fecharLote}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={lotando}
            disabled={!escolhido || destinosNovos.length === 0}
            onClick={() => void lotarEmLote()}
          >
            {destinosNovos.length === 1 ? "Vincular à escola" : "Vincular às escolas"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
