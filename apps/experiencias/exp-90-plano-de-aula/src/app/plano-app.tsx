import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  FeedbackAlert,
  Icon,
  ListSectionItem,
  ProgressBar,
  RichTextEditor,
  SectionHeader,
  Selection,
  Stepper,
  Tag,
  TextField,
} from "@edu/ui/ds";

import { api, experiencia, statusDoErro } from "../lib/api";
import { DISCIPLINAS_CATALOGO } from "../lib/curriculo";
import { mensagemDoStatus, rotuloDaSerie, rotuloDoStatus, telaDoStatus, type Tela } from "../lib/estado";
import { baixarDoc } from "../lib/exportar-doc";
import { INSIGHTS_SEMENTE } from "../lib/insights";
import type { Disponivel, PlanoResumo, RespostaObter } from "../lib/tipos";

/**
 * Porte de `app/plano/page.tsx` do app origem, com o que a migração mudou:
 *  - sem header/login/localStorage/useRouter (o hub autentica e emoldura);
 *  - a geração é ASSÍNCRONA: `POST /planos` → polling em `GET /planos/:id`;
 *  - o Markdown vira HTML na api (`marked` saiu do cliente);
 *  - existe persistência: "Meus planos", botão Salvar (+ Ctrl/Cmd+S, aviso de
 *    não salvo), Restaurar original e Excluir;
 *  - insights são só a lista-semente (a versão por IA ficou de fora).
 */

const PASSOS = [
  { id: "novo", label: "Escolha", description: "Disciplina e série", icon: "tune" },
  { id: "gerando", label: "Geração", description: "Leitura do currículo", icon: "auto_awesome" },
  { id: "resultado", label: "Revisão", description: "Edição, salvamento e exportação", icon: "edit_document" },
];
const INDICE_PASSO: Record<Exclude<Tela, "lista">, number> = { novo: 0, gerando: 1, resultado: 2 };

const INTERVALO_INSIGHT_MS = 11_000;
const INTERVALO_POLLING_MS = 3_000;

/** O DS expõe `SelectionValue` como `string | string[]`; aqui o modo é simples. */
const valorSimples = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? "") : String(v ?? ""));

const formatarData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

interface Props {
  professorNome: string;
  planosIniciais: PlanoResumo[];
  disponiveis: Disponivel[];
}

export function PlanoApp({ professorNome, planosIniciais, disponiveis }: Props) {
  const [tela, setTela] = useState<Tela>("lista");
  const [planos, setPlanos] = useState<PlanoResumo[]>(planosIniciais);
  const [disciplina, setDisciplina] = useState("");
  const [serie, setSerie] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  // O plano aberto (gerando ou em edição) e o HTML que veio da api.
  const [atual, setAtual] = useState<PlanoResumo | null>(null);
  const [html, setHtml] = useState("");
  /** Espelha o HTML do editor sem re-renderizar a cada tecla. */
  const htmlRef = useRef("");
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  /** Muda a cada carga/restauração para o editor reaplicar o `defaultValue`. */
  const [versaoEditor, setVersaoEditor] = useState(0);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [tituloRascunho, setTituloRascunho] = useState("");
  const jaSalvouAlgumaVez = useRef(new Set<string>());

  const [indiceInsight, setIndiceInsight] = useState(0);

  const disciplinaAtual = disponiveis.find((d) => d.disciplina === disciplina);

  // Mapeia todas as 15 disciplinas da BNCC: ativas e "em breve" (como no app original)
  const opcoesDisciplina = (() => {
    const conhecidas = new Set(DISCIPLINAS_CATALOGO.map((d) => d.slug));
    const catalogo = DISCIPLINAS_CATALOGO.map((d) => {
      const disp = disponiveis.find((x) => x.disciplina === d.slug);
      const ativa = Boolean(disp && disp.series.length > 0);
      return {
        value: d.slug,
        label: ativa ? d.label : `${d.label} (em breve)`,
        disabled: !ativa,
      };
    });

    const extras = disponiveis
      .filter((d) => !conhecidas.has(d.disciplina) && d.series.length > 0)
      .map((d) => ({
        value: d.disciplina,
        label: d.rotulo,
        disabled: false,
      }));

    return [...catalogo, ...extras];
  })();

  const opcoesSerie = (disciplinaAtual?.series ?? []).map((s) => ({ value: s, label: rotuloDaSerie(s) }));

  // ------------------------------------------------------------ insights

  useEffect(() => {
    if (tela !== "gerando" || INSIGHTS_SEMENTE.length < 2) return;
    const id = setTimeout(() => setIndiceInsight((i) => (i + 1) % INSIGHTS_SEMENTE.length), INTERVALO_INSIGHT_MS);
    return () => clearTimeout(id);
  }, [tela, indiceInsight]);

  const passarInsight = useCallback(
    (direcao: 1 | -1) => setIndiceInsight((i) => (i + direcao + INSIGHTS_SEMENTE.length) % INSIGHTS_SEMENTE.length),
    [],
  );

  // ------------------------------------------------------------- polling

  const abrirResultado = useCallback((resposta: RespostaObter) => {
    setAtual(resposta.plano);
    const conteudo = resposta.html ?? "";
    setHtml(conteudo);
    htmlRef.current = conteudo;
    setSujo(false);
    setSalvoEm(null);
    setVersaoEditor((v) => v + 1);
    setTela("resultado");
  }, []);

  useEffect(() => {
    if (tela !== "gerando" || !atual) return;
    let ativo = true;
    const id = atual.id;
    const consultar = async () => {
      try {
        const resposta = await api.get<RespostaObter>(`/planos/${id}`);
        if (!ativo) return;
        setPlanos((lista) => lista.map((p) => (p.id === id ? resposta.plano : p)));
        const destino = telaDoStatus(resposta.plano.status);
        if (destino === "resultado") abrirResultado(resposta);
        if (destino === "novo") {
          setErro(resposta.plano.erro ?? "A geração falhou. Tente novamente.");
          setAtual(null);
          setTela("novo");
        }
      } catch {
        // Rede da escola oscila: o próximo tique tenta de novo.
      }
    };
    void consultar();
    const timer = setInterval(() => void consultar(), INTERVALO_POLLING_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [tela, atual, abrirResultado]);

  // -------------------------------------------------------------- ações

  const irParaLista = useCallback(async () => {
    if (sujo && !window.confirm("Há alterações não salvas. Sair mesmo assim?")) return;
    setErro("");
    setAviso("");
    setAtual(null);
    setSujo(false);
    setEditandoTitulo(false);
    try {
      const { planos: lista } = await api.get<{ planos: PlanoResumo[] }>("/planos");
      setPlanos(lista);
    } catch {
      // mantém a lista que já está na tela
    }
    setTela("lista");
  }, [sujo]);

  const novoPlano = useCallback(() => {
    setErro("");
    setAviso("");
    setAtual(null);
    const ativas = disponiveis.filter((d) => d.series.length > 0);
    setDisciplina(ativas.length === 1 ? ativas[0]!.disciplina : "");
    setSerie("");
    setTela("novo");
  }, [disponiveis]);

  const gerarPlano = useCallback(async () => {
    if (!disciplina || !serie) {
      setErro("Selecione a disciplina e a série.");
      return;
    }
    setErro("");
    setIndiceInsight(0);
    try {
      const { id } = await api.post<{ id: string }>("/planos", { disciplina, serie });
      experiencia().track("attempted", "plano", { contexto: { disciplina, serie } });
      const resposta = await api.get<RespostaObter>(`/planos/${id}`);
      setPlanos((lista) => [resposta.plano, ...lista]);
      setAtual(resposta.plano);
      if (resposta.plano.status === "pronto") abrirResultado(resposta);
      else setTela("gerando");
    } catch (falha) {
      setErro(mensagemDoStatus(statusDoErro(falha), "Não deu para iniciar a geração. Tente de novo."));
    }
  }, [disciplina, serie, abrirResultado]);

  const abrirPlano = useCallback(
    async (plano: PlanoResumo) => {
      setErro("");
      setAviso("");
      try {
        const resposta = await api.get<RespostaObter>(`/planos/${plano.id}`);
        setAtual(resposta.plano);
        const destino = telaDoStatus(resposta.plano.status);
        if (destino === "resultado") abrirResultado(resposta);
        else if (destino === "gerando") setTela("gerando");
        else {
          setErro(resposta.plano.erro ?? "A geração desse plano falhou.");
          setDisciplina(resposta.plano.disciplina);
          setSerie(resposta.plano.serie);
          setAtual(null);
          setTela("novo");
        }
      } catch (falha) {
        setErro(mensagemDoStatus(statusDoErro(falha)));
      }
    },
    [abrirResultado],
  );

  const salvar = useCallback(async () => {
    if (!atual || salvando || !htmlRef.current) return;
    setSalvando(true);
    setErro("");
    try {
      const r = await api.put<{ ok: boolean; salvoEm: string }>(`/planos/${atual.id}/conteudo`, { html: htmlRef.current });
      setSujo(false);
      setSalvoEm(r.salvoEm);
      if (!jaSalvouAlgumaVez.current.has(atual.id)) {
        jaSalvouAlgumaVez.current.add(atual.id);
        experiencia().track("completed", "plano", { contexto: { planoId: atual.id } });
      }
    } catch (falha) {
      setErro(mensagemDoStatus(statusDoErro(falha), "Não foi possível salvar. Sua edição continua aqui — tente de novo."));
    } finally {
      setSalvando(false);
    }
  }, [atual, salvando]);

  const exportar = useCallback(() => {
    if (!atual || !htmlRef.current) return;
    baixarDoc(htmlRef.current, atual.titulo);
    experiencia().track("interacted", "exportar-doc", { contexto: { planoId: atual.id } });
  }, [atual]);

  const restaurar = useCallback(async () => {
    if (!atual) return;
    if (!window.confirm("Voltar ao texto original gerado pela IA? Suas edições serão perdidas.")) return;
    try {
      const r = await api.post<{ ok: boolean; html: string }>(`/planos/${atual.id}/restaurar`);
      setHtml(r.html);
      htmlRef.current = r.html;
      setSujo(false);
      setSalvoEm(new Date().toISOString());
      setVersaoEditor((v) => v + 1);
      experiencia().track("interacted", "restaurar-original", { contexto: { planoId: atual.id } });
    } catch (falha) {
      setErro(mensagemDoStatus(statusDoErro(falha)));
    }
  }, [atual]);

  const excluir = useCallback(
    async (plano: PlanoResumo) => {
      if (!window.confirm(`Excluir "${plano.titulo}"? Essa ação não pode ser desfeita.`)) return;
      try {
        await api.delete(`/planos/${plano.id}`);
        setPlanos((lista) => lista.filter((p) => p.id !== plano.id));
        experiencia().track("interacted", "excluir-plano", { contexto: { planoId: plano.id } });
        if (atual?.id === plano.id) {
          setAtual(null);
          setTela("lista");
        }
      } catch (falha) {
        setErro(mensagemDoStatus(statusDoErro(falha), "Não foi possível excluir agora."));
      }
    },
    [atual],
  );

  const salvarTitulo = useCallback(async () => {
    if (!atual) return;
    const titulo = tituloRascunho.trim();
    if (titulo.length < 3) {
      setErro("O título precisa de pelo menos 3 caracteres.");
      return;
    }
    try {
      await api.patch(`/planos/${atual.id}`, { titulo });
      setAtual({ ...atual, titulo });
      setPlanos((lista) => lista.map((p) => (p.id === atual.id ? { ...p, titulo } : p)));
      setEditandoTitulo(false);
    } catch (falha) {
      setErro(mensagemDoStatus(statusDoErro(falha)));
    }
  }, [atual, tituloRascunho]);

  // Ctrl/Cmd+S salva; sair da página com edição pendente avisa.
  useEffect(() => {
    if (tela !== "resultado") return;
    const aoTeclar = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        void salvar();
      }
    };
    const aoSair = (ev: BeforeUnloadEvent) => {
      if (!sujo) return;
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("beforeunload", aoSair);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("beforeunload", aoSair);
    };
  }, [tela, sujo, salvar]);

  // ----------------------------------------------------------------- UI

  const insightAtual = INSIGHTS_SEMENTE[indiceInsight];

  return (
    <div className="app-shell">
      <main className="app-main">
        <div className="app-col-main app-stack unooria-gap-m">
          {tela !== "lista" && (
            <Stepper steps={PASSOS} currentStep={INDICE_PASSO[tela]} size="sm" fillCompletedConnectors />
          )}

          {/* ------------------------------------------------ 0. Meus planos -- */}
          {tela === "lista" && (
            <>
              <SectionHeader
                title="Meus planos de aula"
                description={`Olá, ${primeiroNome(professorNome)}. Os planos ficam salvos aqui — abra para continuar editando ou gere um novo.`}
                actions={
                  <Button
                    variant="primary"
                    size="md"
                    onClick={novoPlano}
                    isDisabled={!disponiveis.some((d) => d.series.length > 0)}
                    leftIcon={<Icon name="add" size="xs" />}
                  >
                    Novo plano
                  </Button>
                }
                divider
              />

              {erro && <FeedbackAlert type="error" description={erro} />}
              {!disponiveis.some((d) => d.series.length > 0) && (
                <FeedbackAlert
                  type="warning"
                  description="Ainda não há material de referência (currículo da rede, material didático) cadastrado para a sua rede. Peça à coordenação para importá-lo."
                />
              )}

              {planos.length === 0 ? (
                <div className="app-surface unooria-p-l">
                  <EmptyState
                    variant="no-data"
                    title="Nenhum plano ainda"
                    description="Escolha a disciplina e a série: o currículo da rede e o material didático já cadastrados são lidos automaticamente."
                    primaryAction={disponiveis.some((d) => d.series.length > 0) ? { label: "Gerar meu primeiro plano", onClick: novoPlano } : undefined}
                  />
                </div>
              ) : (
                <div className="app-surface app-lista">
                  {planos.map((plano) => {
                    const status = rotuloDoStatus(plano.status);
                    return (
                      <ListSectionItem
                        key={plano.id}
                        visual="icon"
                        icon="edit_document"
                        title={plano.titulo}
                        description={`${plano.disciplinaRotulo} · ${plano.serieRotulo} · atualizado em ${formatarData(plano.atualizadoEm)}`}
                        tag={
                          <Tag variant={status.variante === "success" ? "brand" : "neutral"} size="sm">
                            {status.texto}
                          </Tag>
                        }
                        showChevron
                        onClick={() => void abrirPlano(plano)}
                        actions={
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Excluir ${plano.titulo}`}
                            onClick={(ev: React.MouseEvent) => {
                              ev.stopPropagation();
                              void excluir(plano);
                            }}
                          >
                            <Icon name="delete" size="xs" />
                          </Button>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* --------------------------------------------------- 1. Escolha -- */}
          {tela === "novo" && (
            <>
              <SectionHeader
                title="Novo plano de aula"
                description="Escolha a disciplina e a série — o currículo da rede e o material didático já cadastrados são usados automaticamente."
                actions={
                  <Button variant="ghost" size="sm" onClick={() => void irParaLista()}>
                    Meus planos
                  </Button>
                }
                divider
              />

              {erro && <FeedbackAlert type="error" description={erro} />}

              <div className="app-fields">
                <Selection
                  name="disciplina"
                  label="Disciplina"
                  placeholder="Selecione a disciplina"
                  options={opcoesDisciplina}
                  value={disciplina}
                  onChange={(v) => {
                    setDisciplina(valorSimples(v));
                    setSerie("");
                  }}
                  helperText="As disciplinas marcadas como “em breve” ainda estão em preparação."
                  required
                  fullWidth
                  showOptionCheckbox={false}
                  maxBoxHeight={288}
                />
                <Selection
                  name="serie"
                  label="Ano / série"
                  placeholder={disciplina ? "Selecione a série" : "Escolha a disciplina primeiro"}
                  options={opcoesSerie}
                  value={serie}
                  onChange={(v) => setSerie(valorSimples(v))}
                  helperText="Só aparecem as séries com material de referência cadastrado."
                  required
                  fullWidth
                  disabled={!disciplina}
                  showOptionCheckbox={false}
                  maxBoxHeight={288}
                />
              </div>

              <Button variant="primary" size="lg" fullWidth onClick={() => void gerarPlano()} isDisabled={!disciplina || !serie}>
                Gerar plano de aula
              </Button>
            </>
          )}

          {/* --------------------------------------------------- 2. Geração -- */}
          {tela === "gerando" && atual && (
            <section className="app-surface unooria-p-l app-stack unooria-gap-m">
              <SectionHeader
                title="Montando o plano anual"
                description="Estamos lendo o currículo da rede e o material de referência da série escolhida. Isso costuma levar alguns minutos — você pode voltar para a lista; o plano continua sendo gerado."
                badge={
                  <Badge variant="info" size="md">
                    {atual.disciplinaRotulo} · {atual.serieRotulo}
                  </Badge>
                }
                actions={
                  <Button variant="ghost" size="sm" onClick={() => void irParaLista()}>
                    Meus planos
                  </Button>
                }
                variant="compact"
              />

              <ProgressBar indeterminate variant="brand" size="md" label="Gerando plano de aula…" valuePosition="none" />

              {insightAtual && (
                <div className="app-insight">
                  <ListSectionItem
                    key={`${indiceInsight}-${insightAtual.titulo}`}
                    className="app-insight__item"
                    visual="icon"
                    icon={insightAtual.icone}
                    category="Enquanto isso — IA na educação"
                    title={insightAtual.titulo}
                    description={insightAtual.texto}
                    tag={
                      <Tag variant="brand" size="sm">
                        {insightAtual.categoria}
                      </Tag>
                    }
                  />
                  <div className="app-insight__nav">
                    <Button variant="ghost" size="sm" aria-label="Insight anterior" onClick={() => passarInsight(-1)}>
                      <Icon name="chevron_left" size="xs" />
                    </Button>
                    <span className="app-insight__counter" aria-live="polite">
                      {indiceInsight + 1} de {INSIGHTS_SEMENTE.length}
                    </span>
                    <Button variant="ghost" size="sm" aria-label="Próximo insight" onClick={() => passarInsight(1)}>
                      <Icon name="chevron_right" size="xs" />
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ------------------------------------------------- 3. Resultado -- */}
          {tela === "resultado" && atual && (
            <>
              {editandoTitulo ? (
                <div className="app-titulo">
                  <TextField
                    label="Título do plano"
                    value={tituloRascunho}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setTituloRascunho(ev.target.value)}
                    maxLength={160}
                  />
                  <Button variant="primary" size="md" onClick={() => void salvarTitulo()}>
                    Aplicar
                  </Button>
                  <Button variant="ghost" size="md" onClick={() => setEditandoTitulo(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <SectionHeader
                  title={atual.titulo}
                  description="Edite o documento abaixo. Salve para guardar; exporte quando estiver pronto."
                  badge={
                    <Badge variant="primary" size="md">
                      {atual.serieRotulo}
                    </Badge>
                  }
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Renomear plano"
                        onClick={() => {
                          setTituloRascunho(atual.titulo);
                          setEditandoTitulo(true);
                        }}
                      >
                        <Icon name="edit" size="xs" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void irParaLista()}>
                        Meus planos
                      </Button>
                    </>
                  }
                  divider
                />
              )}

              {erro && <FeedbackAlert type="error" description={erro} />}
              {aviso && <FeedbackAlert type="success" description={aviso} />}

              <div className="app-acoes">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void salvar()}
                  isDisabled={!sujo || salvando}
                  leftIcon={<Icon name="save" size="xs" />}
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </Button>
                <Button variant="outline" size="sm" onClick={exportar} leftIcon={<Icon name="download" size="xs" />}>
                  Exportar .doc
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void restaurar()} leftIcon={<Icon name="history" size="xs" />}>
                  Restaurar original
                </Button>
                <span className={`app-acoes__estado${sujo ? " app-acoes__estado--sujo" : ""}`} aria-live="polite">
                  {sujo
                    ? "Alterações não salvas · Ctrl/Cmd+S"
                    : salvoEm
                      ? `Salvo às ${new Date(salvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                      : "Tudo salvo"}
                </span>
              </div>

              {html ? (
                <RichTextEditor
                  key={`${atual.id}-${versaoEditor}`}
                  defaultValue={html}
                  minHeight="60vh"
                  maxHeight="none"
                  helperText="Documento totalmente editável — clique em qualquer parte do texto para alterar, adicionar ou remover conteúdo."
                  toolbarConfig={{ media: false }}
                  onChange={(novoHtml: string) => {
                    htmlRef.current = novoHtml;
                    setSujo(true);
                    setAviso("");
                  }}
                />
              ) : (
                <div className="app-surface unooria-p-l">
                  <EmptyState
                    variant="no-data"
                    title="O plano voltou vazio"
                    description="A geração terminou sem conteúdo. Restaure o original ou gere um plano novo."
                    primaryAction={{ label: "Restaurar original", onClick: () => void restaurar() }}
                    secondaryAction={{ label: "Novo plano", onClick: novoPlano }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** "Prof. Demo" → "Demo": ignora títulos abreviados no cumprimento. */
function primeiroNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return (partes.find((p) => !p.endsWith(".")) ?? partes[0] ?? "").replace(/[.,]$/, "");
}
