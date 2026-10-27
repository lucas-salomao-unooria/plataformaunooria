"use client";

import { useEffect, useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeedbackAlert,
  Icon,
  ProgressBar,
  SectionHeader,
  Selection,
  Tag,
  TextArea,
  TextField,
} from "@edu/ui/ds";
import {
  AssistenteDeAtividade,
  type ResultadoDaCriacao,
  type TurmaDoAssistente,
} from "@/components/atividades/assistente-de-atividade";
import {
  CONTEXTO_MAX,
  CRITERIOS_INICIAIS,
  ITENS_DO_PACOTE,
  LIMITES,
  ROTAS_DA_CURADORIA,
  ROTULO_DO_ITEM,
  TEMA,
  TOPICOS,
  caminhoDaTurma as caminhoDaApi,
  codigoDosCriterios,
  erroDaApi,
  idDaAtividade,
  itemTemTitulo,
  limiteDoItem,
  problemasDoRecorte,
  rascunhoDaResposta,
  rotuloDaDisciplina,
  textoDoItem,
  topicosDoTexto,
  type ItemDoPacote,
  type PacoteDaTurma,
  type PacoteDoProfessor,
  type RespostaDoGerar,
} from "@/lib/assistente-invisivel-tipos";

/** E0-PROF-03 "gerando": o texto do Figma ("UnooriaAI" é o nome do clone e pode aparecer). */
const TEXTO_GERANDO = "Criando exercícios e diálogos temáticos no UnooriaAI. Isso leva cerca de 10 segundos...";

interface PreparoLido {
  turmaId: string;
  dados: PacoteDaTurma | null;
}

interface Recorte {
  disciplina: string;
  tema: string;
  topicosTexto: string;
  contexto: string;
}

/** A atividade já gravada (homologada, ou o banco padrão aprovado num toque): o assistente só faz o resto. */
interface AtividadeGravada {
  turmaId: string;
  id: string;
  disciplina: string;
  tema: string;
  /** O banco padrão pode já entrar em andamento (a rota devolve a atividade no ar). */
  noAr: boolean;
}

/** E0-PROF-03: a geração caiu no banco padrão (sem saldo ou vendor fora). O rascunho, quando veio, é o banco. */
interface Contingencia {
  motivo: "sem-saldo" | "indisponivel";
  rascunho: PacoteDoProfessor | null;
}

type Erro = { mensagem: string; erros: string[] };

const RECORTE_VAZIO: Recorte = { disciplina: "", tema: "", topicosTexto: "", contexto: "" };
const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
const BFF = (turmaId: string) => `/api/plataforma${caminhoDaApi(turmaId)}`;
const JSON_HEADERS = { "content-type": "application/json" };
const CONFIGURACAO_INICIAL = `Configuração ativa inicial: ${codigoDosCriterios(CRITERIOS_INICIAIS)} (Restritiva)`;

const recorteDoPacote = (p: { disciplina: string; tema: string; topicos: string[]; contexto: string | null }): Recorte => ({
  disciplina: p.disciplina,
  tema: p.tema,
  topicosTexto: p.topicos.join(", "),
  contexto: p.contexto ?? "",
});

/**
 * NOVA ATIVIDADE de O ASSISTENTE INVISÍVEL (ADR-185, ADR-130). O PACOTE — as
 * duas trilhas, as dúvidas que Lucas, Beatriz e Thiago mandam ao chat, as
 * respostas do assistente e a leitura recomendada — é a atividade que a turma
 * vive, e nasce do professor pelo fluxo do Figma (E0-PROF-02 a 05):
 *
 * 1. **Recorte da Aula** (E0-PROF-02): disciplina (`Selection`), tema (≤ 60),
 *    3 a 5 tópicos e contexto regional opcional (≤ 120). "Gerar Cenários de
 *    Teste com IA" só acende com os campos válidos; "Usar Banco Padrão da Rede"
 *    é o caminho curto (o banco de Língua Portuguesa, sem IA).
 * 2. **Geração** (E0-PROF-03): gerando; sem saldo de IA ("Prosseguir com Banco
 *    Oficial"); serviço instável ("Tentar Novamente" / "Usar Banco Padrão").
 * 3. **Curadoria** (E0-PROF-04): CADA item — inclusive a dúvida do Lucas e as
 *    respostas do assistente (decisão do Vinicius) — com "Editar Texto" e
 *    "Regenerar Este Item"; o editado ganha "Editado pelo professor".
 *    "Aprovar Pacote Homologado" grava a atividade PRONTA.
 * 4. **Liberação** (E0-PROF-05): o último passo do assistente, com o resumo e
 *    "Liberar Atividade para a Turma" — que põe no ar e libera na sala.
 *
 * As equipes entram no passo Equipes do assistente, como nas outras missões.
 */
export function CriarAssistenteInvisivel({
  turmas,
  turmaInicial,
  rotaDaMissao,
}: {
  turmas: TurmaDoAssistente[];
  turmaInicial: string;
  rotaDaMissao: string;
}) {
  const [preparo, setPreparo] = useState<PreparoLido | null>(null);
  const [preparoVisto, setPreparoVisto] = useState<PreparoLido | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [recorte, setRecorte] = useState<Recorte>(RECORTE_VAZIO);
  const [rascunho, setRascunho] = useState<PacoteDoProfessor | null>(null);
  const [contingencia, setContingencia] = useState<Contingencia | null>(null);
  const [gravada, setGravada] = useState<AtividadeGravada | null>(null);
  const [gerando, setGerando] = useState(false);
  const [usandoPadrao, setUsandoPadrao] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);

  if (preparo !== preparoVisto) {
    setPreparoVisto(preparo);
    const existente = preparo?.dados?.rascunho ?? null;
    if (existente && !rascunho) {
      setRascunho(existente);
      setRecorte(recorteDoPacote(existente));
    }
  }

  const topicos = topicosDoTexto(recorte.topicosTexto);
  const problemas = problemasDoRecorte({ ...recorte, topicos });
  const ocupado = gerando || usandoPadrao;

  function trocar(campo: keyof Recorte, valor: string) {
    setRecorte((atual) => ({ ...atual, [campo]: valor }));
  }

  function abrirCuradoria(novo: PacoteDoProfessor) {
    setRascunho(novo);
    setRecorte(recorteDoPacote(novo));
    setContingencia(null);
  }

  async function usarPadrao(turmaId: string) {
    /* Se a geração já devolveu o banco padrão como rascunho, ele vai para a curadoria sem nova chamada. */
    if (contingencia?.rascunho) {
      abrirCuradoria(contingencia.rascunho);
      return;
    }
    setUsandoPadrao(true);
    setErro(null);
    try {
      const r = await fetch(`${BFF(turmaId)}${ROTAS_DA_CURADORIA.bancoPadrao}`, { method: "POST", headers: JSON_HEADERS, body: "{}" });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para usar o banco padrão agora."));
        return;
      }
      /* O banco padrão pode voltar como rascunho (vai à curadoria) ou já como atividade aprovada (vai à liberação). */
      const novo = rascunhoDaResposta(corpo);
      if (novo) {
        abrirCuradoria(novo);
        return;
      }
      const id = idDaAtividade(corpo);
      if (!id) {
        setErro({ mensagem: "Não deu para usar o banco padrão agora.", erros: [] });
        return;
      }
      setContingencia(null);
      setGravada({
        turmaId,
        id,
        disciplina: "Língua Portuguesa",
        tema: "banco padrão da rede",
        noAr: typeof corpo === "object" && corpo !== null && "atividade" in corpo,
      });
    } catch {
      setErro({ mensagem: SEM_REDE, erros: [] });
    } finally {
      setUsandoPadrao(false);
    }
  }

  async function gerar(turmaId: string) {
    if (problemas.length > 0) return;
    setGerando(true);
    setErro(null);
    setContingencia(null);
    try {
      const r = await fetch(`${BFF(turmaId)}${ROTAS_DA_CURADORIA.gerar}`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          disciplina: recorte.disciplina,
          tema: recorte.tema.trim(),
          topicos,
          contexto: recorte.contexto.trim() || null,
        }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (r.status === 429) {
        setContingencia({ motivo: "sem-saldo", rascunho: rascunhoDaResposta(corpo) });
        return;
      }
      if (r.status === 503 || r.status === 502 || r.status === 504) {
        setContingencia({ motivo: "indisponivel", rascunho: rascunhoDaResposta(corpo) });
        return;
      }
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para gerar agora. O banco padrão da rede continua disponível."));
        return;
      }
      const resposta = corpo as RespostaDoGerar;
      if (!resposta.usouIa) {
        /* E0-PROF-03: o rascunho é o banco padrão; a curadoria só abre quando o professor confirma. */
        setContingencia({ motivo: resposta.motivo ?? "indisponivel", rascunho: resposta.rascunho });
        return;
      }
      abrirCuradoria(resposta.rascunho);
    } catch {
      setErro({ mensagem: SEM_REDE, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (!gravada) return { ok: false, mensagem: "Aprove o pacote no passo Conteúdo.", erros: [] };
    if (gravada.turmaId !== turmaId) {
      return { ok: false, mensagem: "Este pacote foi preparado para outra turma. Volte a ela, ou prepare de novo para esta.", erros: [] };
    }
    return { ok: true, id: gravada.id };
  }

  function recomecar() {
    setGravada(null);
    setRascunho(null);
    setContingencia(null);
    setErro(null);
    setRecorte(RECORTE_VAZIO);
    setTentativa((n) => n + 1);
  }

  return (
    <AssistenteDeAtividade
      expId="exp01em1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={gravada !== null}
      resumoDoConteudo={gravada ? `Disciplina: ${gravada.disciplina} · Tema: ${gravada.tema} · ${CONFIGURACAO_INICIAL}` : null}
      rotuloDoCriar={(porNoAr) => (porNoAr ? "Liberar Atividade para a Turma" : "Criar atividade")}
      criar={criar}
      conteudo={(turmaId) => {
        const dados = preparo?.turmaId === turmaId ? preparo.dados : undefined;
        return (
          <section className="flex flex-col gap-4" data-preparo-assistente>
            <LerPreparo key={`${turmaId}-${tentativa}`} turmaId={turmaId} aoLer={setPreparo} />
            {dados === undefined ? (
              <Card variant="outlined">
                <ProgressBar indeterminate label="Abrindo o preparo da turma..." valuePosition="none" />
              </Card>
            ) : dados === null ? (
              <div className="flex flex-col gap-3">
                <EmptyState
                  variant="no-data"
                  size="md"
                  bordered
                  fullWidth
                  title="Não conseguimos abrir o preparo desta turma"
                  description="Confira se a turma é sua e desta escola, e tente de novo."
                />
                <div>
                  <Button variant="secondary" size="sm" onClick={() => { setPreparo(null); setTentativa((n) => n + 1); }}>
                    Tentar de novo
                  </Button>
                </div>
              </div>
            ) : gravada ? (
              <Liberacao gravada={gravada} turmaId={turmaId} nomeDaTurma={dados.turma.nome} recomecar={recomecar} />
            ) : (
              <>
                <Card variant="elevated">
                  <div className="flex flex-col gap-4" data-recorte-da-aula>
                    <SectionHeader
                      title="Recorte da Aula"
                      badge={
                        problemas.length === 0 ? (
                          <Tag variant="success" size="sm" pill>
                            Parâmetros Ativos
                          </Tag>
                        ) : undefined
                      }
                      description="Defina a disciplina e o tema semanal para calibrar os exercícios e as dúvidas simuladas no UnooriaAI."
                    />
                    {/* Uma coluna, como o Figma (1.0.5): em duas, o campo tinha ~460px e o
                        placeholder ("…(máximo de 60 caracteres)...") saía cortado no meio
                        da palavra — o placeholder de um campo de uma linha não quebra. */}
                    <div className="flex flex-col gap-4">
                      <Selection
                        label="Disciplina Escolar"
                        placeholder="Selecione o componente curricular oficial da BNCC..."
                        value={recorte.disciplina || undefined}
                        showOptionCheckbox={false}
                        options={dados.disciplinas.map((d) => ({ value: d.slug, label: d.rotulo }))}
                        onChange={(valor) => trocar("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : String(valor))}
                      />
                      <TextField
                        label="Tema Curricular da Semana"
                        placeholder={`Digite o conteúdo específico trabalhado nas aulas (máximo de ${TEMA.max} caracteres)...`}
                        value={recorte.tema}
                        maxLength={TEMA.max}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("tema", e.target.value)}
                      />
                      <TextArea
                        label="Tópicos e Conceitos-Chave"
                        placeholder={`Liste de ${TOPICOS.min} a ${TOPICOS.max} conceitos centrais que serão abordados nas perguntas simuladas.`}
                        helperText={`${topicos.length} ${topicos.length === 1 ? "tópico" : "tópicos"}, separados por vírgula ou um por linha`}
                        rows={3}
                        value={recorte.topicosTexto}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocar("topicosTexto", e.target.value)}
                      />
                      <TextField
                        label="Contexto ou Foco Regional (Opcional)"
                        placeholder={`Opcional: informe um contexto ou foco regional (máximo de ${CONTEXTO_MAX} caracteres)...`}
                        value={recorte.contexto}
                        maxLength={CONTEXTO_MAX}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("contexto", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="secondary"
                        size="md"
                        leftIcon={<Icon name="library_books" size={18} />}
                        isDisabled={ocupado}
                        isLoading={usandoPadrao}
                        onClick={() => void usarPadrao(turmaId)}
                        data-acao="usar-banco-padrao"
                      >
                        Usar Banco Padrão da Rede
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        leftIcon={<Icon name="auto_awesome" size={18} />}
                        isDisabled={ocupado || problemas.length > 0}
                        isLoading={gerando}
                        onClick={() => void gerar(turmaId)}
                        data-acao="gerar-com-ia"
                      >
                        Gerar Cenários de Teste com IA
                      </Button>
                    </div>
                    {problemas.length > 0 && (recorte.tema || recorte.topicosTexto || recorte.disciplina) ? (
                      <p className="text-[12px] leading-snug text-unooria-neutral-600" role="status">
                        {`Para gerar com IA: ${problemas.join(" ")}`}
                      </p>
                    ) : null}
                    {gerando ? (
                      /* E0-PROF-03 "gerando": o texto do Figma À VISTA, sobre a barra (o `label` do ProgressBar só nomeia a barra). */
                      <div className="flex flex-col gap-2" role="status" data-gerando>
                        <p className="text-[14px] leading-snug text-unooria-neutral-800">{TEXTO_GERANDO}</p>
                        <ProgressBar indeterminate aria-label={TEXTO_GERANDO} valuePosition="none" />
                      </div>
                    ) : null}
                    {contingencia ? (
                      <ContingenciaDaGeracao
                        contingencia={contingencia}
                        ocupado={ocupado}
                        tentarDeNovo={() => void gerar(turmaId)}
                        usarPadrao={() => void usarPadrao(turmaId)}
                      />
                    ) : null}
                    {erro ? <ErroDaApi erro={erro} /> : null}
                  </div>
                </Card>

                {rascunho && !contingencia ? (
                  <Curadoria
                    key={rascunho.id}
                    turmaId={turmaId}
                    rascunho={rascunho}
                    ocupado={ocupado}
                    aoMudarRascunho={setRascunho}
                    aoAprovar={(pacote) =>
                      setGravada({
                        turmaId,
                        id: pacote.id,
                        disciplina: rotuloDaDisciplina(pacote.disciplina),
                        tema: pacote.tema,
                        noAr: false,
                      })
                    }
                  />
                ) : null}
              </>
            )}
          </section>
        );
      }}
    />
  );
}

function ErroDaApi({ erro }: { erro: Erro }) {
  return (
    <FeedbackAlert
      type="error"
      description={
        erro.erros.length > 0 ? (
          <span className="flex flex-col gap-1">
            <span>{erro.mensagem}</span>
            <ul className="list-disc pl-5">
              {erro.erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </span>
        ) : (
          erro.mensagem
        )
      }
    />
  );
}

/** E0-PROF-03: sem saldo de IA ou serviço instável — o caminho é o banco padrão, sem interromper a aula. */
function ContingenciaDaGeracao({
  contingencia,
  ocupado,
  tentarDeNovo,
  usarPadrao,
}: {
  contingencia: Contingencia;
  ocupado: boolean;
  tentarDeNovo: () => void;
  usarPadrao: () => void;
}) {
  if (contingencia.motivo === "sem-saldo") {
    return (
      <Card variant="outlined">
        <div className="flex flex-col items-start gap-3" data-contingencia="sem-saldo">
          <Tag variant="warning" size="sm" pill>
            Aviso Institucional
          </Tag>
          <p className="text-[14px] font-semibold leading-snug text-unooria-neutral-950">
            Cota de inteligência artificial atingida. O assistente carregou o pacote oficial de contingência pedagógica.
          </p>
          <p className="text-[13px] leading-snug text-unooria-neutral-700">
            Aplicando o banco curado padrão de Língua Portuguesa sem interromper a aula.
          </p>
          <Button variant="primary" size="md" isDisabled={ocupado} onClick={usarPadrao} data-acao="prosseguir-com-banco-oficial">
            Prosseguir com Banco Oficial
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card variant="outlined">
      <div className="flex flex-col items-start gap-3" data-contingencia="indisponivel">
        <p className="text-[14px] leading-snug text-unooria-neutral-950">
          Serviço de geração temporariamente instável. Tente novamente ou utilize o banco padrão curado.
        </p>
        <div className="flex flex-wrap gap-3">
          {/* A hierarquia do Figma: "Usar Banco Padrão" é a ação principal (cheia) e
              "Tentar Novamente" a secundária (contorno). O `secondary` do DS também
              é CHEIO (navy) — os dois saíam com o mesmo peso; o `outline` é o
              secundário que se vê. */}
          <Button variant="outline" size="md" isDisabled={ocupado} onClick={tentarDeNovo} data-acao="tentar-novamente">
            Tentar Novamente
          </Button>
          <Button variant="primary" size="md" isDisabled={ocupado} onClick={usarPadrao} data-acao="usar-banco-padrao-503">
            Usar Banco Padrão
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * A CURADORIA do rascunho (E0-PROF-04): os treze itens do pacote, cada um com
 * "Editar Texto" e "Regenerar Este Item". Os dois vão à api, que devolve o
 * rascunho inteiro — o servidor é quem guarda o que o professor viu, e o
 * "Aprovar Pacote Homologado" manda só o `rascunhoId`.
 */
function Curadoria({
  turmaId,
  rascunho,
  ocupado,
  aoMudarRascunho,
  aoAprovar,
}: {
  turmaId: string;
  rascunho: PacoteDoProfessor;
  ocupado: boolean;
  aoMudarRascunho: (r: PacoteDoProfessor) => void;
  aoAprovar: (p: PacoteDoProfessor) => void;
}) {
  const [editando, setEditando] = useState<ItemDoPacote | null>(null);
  const [trabalhando, setTrabalhando] = useState<{ item: ItemDoPacote; acao: "editar" | "regenerar" } | "aprovar" | null>(null);
  const [erro, setErro] = useState<{ item: ItemDoPacote | null; erro: Erro } | null>(null);

  async function enviar(rota: string, corpoDoPedido: object, item: ItemDoPacote | null, padrao: string): Promise<unknown | null> {
    setErro(null);
    try {
      const r = await fetch(`${BFF(turmaId)}${rota}`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(corpoDoPedido) });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro({ item, erro: erroDaApi(corpo, padrao) });
        return null;
      }
      return corpo;
    } catch {
      setErro({ item, erro: { mensagem: SEM_REDE, erros: [] } });
      return null;
    }
  }

  async function regenerar(item: ItemDoPacote) {
    setTrabalhando({ item, acao: "regenerar" });
    const corpo = await enviar(ROTAS_DA_CURADORIA.regenerar, { rascunhoId: rascunho.id, item }, item, "Não deu para regenerar este item agora.");
    const novo = corpo ? rascunhoDaResposta(corpo) : null;
    if (novo) aoMudarRascunho(novo);
    setTrabalhando(null);
  }

  async function salvar(item: ItemDoPacote, titulo: string | null, texto: string): Promise<boolean> {
    setTrabalhando({ item, acao: "editar" });
    const corpo = await enviar(
      ROTAS_DA_CURADORIA.editar,
      { rascunhoId: rascunho.id, item, texto: texto.trim(), ...(titulo !== null ? { titulo: titulo.trim() } : {}) },
      item,
      "Não deu para salvar o texto agora.",
    );
    const novo = corpo ? rascunhoDaResposta(corpo) : null;
    setTrabalhando(null);
    if (!novo) return false;
    aoMudarRascunho(novo);
    setEditando(null);
    return true;
  }

  async function aprovar() {
    setTrabalhando("aprovar");
    const corpo = await enviar(ROTAS_DA_CURADORIA.homologar, { rascunhoId: rascunho.id }, null, "Não deu para aprovar o pacote agora.");
    setTrabalhando(null);
    if (!corpo) return;
    const id = idDaAtividade(corpo);
    if (!id) {
      setErro({ item: null, erro: { mensagem: "A resposta da aprovação veio sem a atividade. Tente de novo.", erros: [] } });
      return;
    }
    const pacote = rascunhoDaResposta(corpo);
    aoAprovar(pacote ? { ...pacote, id } : { ...rascunho, id });
  }

  const travado = ocupado || trabalhando !== null;

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-5" data-curadoria data-rascunho={rascunho.id}>
        <SectionHeader
          title="Curadoria do Pacote Temático"
          badge={
            <Tag variant={rascunho.origem === "ia" ? "info" : "success"} size="sm" pill>
              {`${rotuloDaDisciplina(rascunho.disciplina)} · ${rascunho.tema}`}
            </Tag>
          }
          description="Revise os textos gerados. Você pode alterar enunciados manualmente ou aprovar o pacote para a turma."
        />
        {rascunho.origem === "padrao" || rascunho.contingencia ? (
          <FeedbackAlert
            type="info"
            description="Este é o banco curado padrão da rede (Língua Portuguesa). Você pode editar qualquer texto antes de aprovar."
          />
        ) : null}

        <div className="flex flex-col gap-3">
          {ITENS_DO_PACOTE.map((item) => (
            <ItemDaCuradoria
              key={item}
              item={item}
              rascunho={rascunho}
              editando={editando === item}
              travado={travado}
              regenerando={trabalhando !== null && trabalhando !== "aprovar" && trabalhando.item === item && trabalhando.acao === "regenerar"}
              salvando={trabalhando !== null && trabalhando !== "aprovar" && trabalhando.item === item && trabalhando.acao === "editar"}
              erro={erro?.item === item ? erro.erro : null}
              abrirEdicao={() => {
                setErro(null);
                setEditando(item);
              }}
              cancelarEdicao={() => setEditando(null)}
              salvar={(titulo, texto) => salvar(item, titulo, texto)}
              regenerar={() => void regenerar(item)}
            />
          ))}
        </div>

        {erro && erro.item === null ? <ErroDaApi erro={erro.erro} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="md"
            isDisabled={travado || editando !== null}
            isLoading={trabalhando === "aprovar"}
            onClick={() => void aprovar()}
            data-acao="aprovar-pacote"
          >
            Aprovar Pacote Homologado
          </Button>
          <p className="text-[12px] text-unooria-neutral-600">
            {editando !== null
              ? "Salve ou cancele a edição aberta para aprovar."
              : "Aprovado, o pacote vira uma atividade pronta; você escolhe as equipes e libera para a turma."}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Um item da curadoria: o texto, o selo de editado, e as duas ações. */
function ItemDaCuradoria({
  item,
  rascunho,
  editando,
  travado,
  regenerando,
  salvando,
  erro,
  abrirEdicao,
  cancelarEdicao,
  salvar,
  regenerar,
}: {
  item: ItemDoPacote;
  rascunho: PacoteDoProfessor;
  editando: boolean;
  travado: boolean;
  regenerando: boolean;
  salvando: boolean;
  erro: Erro | null;
  abrirEdicao: () => void;
  cancelarEdicao: () => void;
  salvar: (titulo: string | null, texto: string) => Promise<boolean>;
  regenerar: () => void;
}) {
  const atual = textoDoItem(rascunho.conteudo, item);
  const [titulo, setTitulo] = useState(atual.titulo ?? "");
  const [texto, setTexto] = useState(atual.texto);
  const editado = rascunho.editados.includes(item);
  const comTitulo = itemTemTitulo(item);
  const limite = limiteDoItem(item);
  const valido = texto.trim().length > 0 && (!comTitulo || titulo.trim().length > 0);

  function abrir() {
    setTitulo(atual.titulo ?? "");
    setTexto(atual.texto);
    abrirEdicao();
  }

  return (
    <Card variant="outlined">
      <div className="flex flex-col gap-2" data-item={item} data-editado={editado ? "sim" : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-semibold text-unooria-neutral-950">
            {comTitulo && atual.titulo && !editando
              ? atual.titulo.startsWith(ROTULO_DO_ITEM[item])
                ? atual.titulo
                : `${ROTULO_DO_ITEM[item]}: ${atual.titulo}`
              : ROTULO_DO_ITEM[item]}
          </h3>
          {editado ? (
            <>
              {/* E0-PROF-04 "editado": a tag do Figma no cabeçalho do item, junto do selo. */}
              <Tag variant="neutral" size="sm" pill>
                Item Customizado
              </Tag>
              <Badge variant="info" size="sm">
                Editado pelo professor
              </Badge>
            </>
          ) : null}
        </div>

        {editando ? (
          <div className="flex flex-col gap-3">
            {comTitulo ? (
              <TextField
                label="Título"
                maxLength={LIMITES.titulo}
                value={titulo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitulo(e.target.value)}
              />
            ) : null}
            <TextArea
              label="Texto"
              rows={3}
              maxLength={limite}
              helperText={`${texto.length}/${limite} caracteres`}
              value={texto}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTexto(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                isDisabled={!valido || travado}
                isLoading={salvando}
                onClick={() => void salvar(comTitulo ? titulo : null, texto)}
                data-acao="salvar-texto"
              >
                Salvar Texto
              </Button>
              <Button variant="ghost" size="sm" isDisabled={salvando} onClick={cancelarEdicao}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-unooria-neutral-800">{atual.texto}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" leftIcon={<Icon name="edit" size={16} />} isDisabled={travado} onClick={abrir} data-acao="editar-texto">
                Editar Texto
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Icon name="autorenew" size={16} />}
                isDisabled={travado}
                isLoading={regenerando}
                onClick={regenerar}
                data-acao="regenerar-item"
              >
                Regenerar Este Item
              </Button>
            </div>
          </>
        )}
        {erro ? <ErroDaApi erro={erro} /> : null}
      </div>
    </Card>
  );
}

/** E0-PROF-05: o pacote aprovado, com o resumo da liberação. Liberar é o último passo do assistente. */
function Liberacao({
  gravada,
  turmaId,
  nomeDaTurma,
  recomecar,
}: {
  gravada: AtividadeGravada;
  turmaId: string;
  nomeDaTurma: string;
  recomecar: () => void;
}) {
  return (
    <Card variant="outlined">
      <div className="flex flex-col gap-3" data-fase="liberacao">
        <SectionHeader
          title="Liberação da Atividade Escolar"
          badge={
            <Tag variant="success" size="sm" pill>
              Pronto para Liberação
            </Tag>
          }
        />
        {gravada.turmaId !== turmaId ? (
          <FeedbackAlert
            type="warning"
            description="Este pacote foi preparado para outra turma. Volte à turma anterior, ou prepare de novo para esta."
          />
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
              {gravada.noAr
                ? "O banco padrão já está em andamento nesta turma. Continue para as equipes e deixe ligado “Pôr esta atividade no ar agora” para liberar a missão na sala de aula."
                : "O pacote foi aprovado. Continue para as equipes; no último passo, Liberar Atividade para a Turma dá acesso imediato à missão nos dispositivos dos estudantes."}
            </p>
            <dl className="grid gap-x-6 gap-y-1 text-[14px] text-unooria-neutral-800 sm:grid-cols-[max-content_1fr]">
              <dt className="font-semibold text-unooria-neutral-950">Turma</dt>
              <dd>{nomeDaTurma}</dd>
              <dt className="font-semibold text-unooria-neutral-950">Disciplina</dt>
              <dd>{`${gravada.disciplina} · Tema: ${gravada.tema}`}</dd>
              <dt className="font-semibold text-unooria-neutral-950">Assistente</dt>
              <dd>{CONFIGURACAO_INICIAL}</dd>
            </dl>
          </>
        )}
        <div>
          <Button variant="ghost" size="sm" onClick={recomecar} data-acao="recomecar-preparo">
            Escolher outro conteúdo
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Lê o preparo da turma (`GET …/pacote`) — a `key` com a turma e a tentativa faz cada troca ser uma leitura nova. */
function LerPreparo({ turmaId, aoLer }: { turmaId: string; aoLer: (lido: PreparoLido) => void }) {
  useEffect(() => {
    let vivo = true;
    void (async () => {
      let dados: PacoteDaTurma | null;
      try {
        const r = await fetch(`${BFF(turmaId)}${ROTAS_DA_CURADORIA.pacote}`, { cache: "no-store" });
        dados = r.ok ? ((await r.json()) as PacoteDaTurma) : null;
      } catch {
        dados = null;
      }
      if (vivo) aoLer({ turmaId, dados });
    })();
    return () => {
      vivo = false;
    };
  }, [turmaId, aoLer]);
  return null;
}
