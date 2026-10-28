"use client";

import { useEffect, useState } from "react";

import {
  Button,
  Card,
  Collapse,
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
  AVISO_SEM_IA,
  CHAVES_DAS_REACOES,
  HABILIDADE_DO_NO,
  MANCHETE_MAX_CARACTERES,
  MANCHETES,
  MINIMOS_DOS_COMENTARIOS,
  PAUTA,
  ROTULO_DA_MANCHETE,
  ROTULO_DA_REACAO,
  ROTULO_DO_NO,
  ROTULO_DO_TIPO,
  TIPOS_DE_COMENTARIO,
  comReacao,
  erroDaApi,
  horarioDeMadrugada,
  problemasDoRecorte,
  reage,
  rotuloDaDisciplina,
  topicosDoTexto,
  type ComentarioDoFeed,
  type ConteudoDoPacote,
  type EmAndamento,
  type Origem,
  type PacoteDaTurma,
  type PacoteDoProfessor,
  type RespostaDoGerar,
  type TipoDeComentario,
} from "@/lib/efeito-amplificador-tipos";

interface Curadoria {
  origem: Origem;
  conteudo: ConteudoDoPacote;
}

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

/** O pacote homologado: a atividade PRONTA (ou já em andamento, no banco padrão), à espera do último passo. */
interface AtividadeGravada {
  turmaId: string;
  id: string;
  disciplina: string;
  tema: string;
  noAr: boolean;
}

interface Erro {
  mensagem: string;
  erros: string[];
}

const RECORTE_VAZIO: Recorte = { disciplina: "", tema: "", topicosTexto: "", contexto: "" };
const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
const JSON_HEADERS = { "content-type": "application/json" } as const;

/** Copy `prof.gerando.*`, literal. */
const TEXTO_GERANDO = "O modelo Vertex Gemini está estruturando o rascunho com os nós éticos e reações simuladas...";
const DICA_DE_CONDUCAO =
  "a descoberta central reside em confrontar a intenção do criador com o incentivo financeiro de retenção da plataforma.";

const caminhoDaTurma = (turmaId: string) => `/api/plataforma/efeito-amplificador/turmas/${encodeURIComponent(turmaId)}`;

const recorteDoPacote = (p: { disciplina: string; tema: string; assuntos: string[]; contexto?: string | null }): Recorte => ({
  disciplina: p.disciplina,
  tema: p.tema,
  topicosTexto: p.assuntos.join("\n"),
  contexto: p.contexto ?? "",
});

/**
 * NOVA ATIVIDADE de O EFEITO AMPLIFICADOR (2.1.0, ADR-191; ADR-130). O PACOTE —
 * a pauta do grêmio, o rascunho do UnooriaAI com os três nós, as manchetes e
 * os comentários da madrugada — é a atividade que a turma vive, e nasce do
 * professor pelo fluxo do protótipo (E0-PROF-02 a 05):
 *
 * 1. **Configuração Pedagógica da Missão** (E0-PROF-02): componente curricular,
 *    tema (≤ 60), 3 a 6 tópicos (≤ 600 somados) e contexto local opcional
 *    (≤ 120). "Usar pacote padrão oficial" é o caminho curto: `POST
 *    banco-padrao` homologa o banco curado E o põe no ar, num toque.
 * 2. **Geração Assíncrona** (E0-PROF-03): a ÚNICA IA da missão, antes da aula
 *    (quota do professor). Sem saldo ou com o vendor fora, a api devolve o
 *    banco curado (`usouIa: false`) e a tela diz por quê, com o caminho curto.
 * 3. **Homologação do Pacote de Conteúdo** (E0-PROF-04): TODO o texto
 *    editável — a pauta, os parágrafos e a correção de cada nó, os nomes que o
 *    UnooriaAI cita, as manchetes e os seis comentários (autor, horário,
 *    categoria, texto). O gabarito (o nó, a categoria) é etiqueta e seletor do
 *    professor: não chega à turma. "Homologar Conteúdo" grava a atividade
 *    PRONTA; a régua da api devolve TODAS as frases de uma vez.
 * 4. **Ativação da Turma** (E0-PROF-05): o último passo do assistente, com
 *    "Iniciar Atividade com a Turma" — que põe no ar e LIBERA na sala (ADR-69,
 *    `concluirCriacao`). Nada de liberação nova aqui.
 *
 * As equipes entram no passo Equipes do assistente, como nas outras missões.
 */
export function CriarEfeitoAmplificador({
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
  const [curadoria, setCuradoria] = useState<Curadoria | null>(null);
  const [gravada, setGravada] = useState<AtividadeGravada | null>(null);
  const [gerando, setGerando] = useState(false);
  const [usandoPadrao, setUsandoPadrao] = useState(false);
  const [homologando, setHomologando] = useState(false);
  const [semIa, setSemIa] = useState<"sem-saldo" | "indisponivel" | null>(null);
  const [erro, setErro] = useState<Erro | null>(null);
  const [errosDaHomologacao, setErrosDaHomologacao] = useState<Erro | null>(null);

  if (preparo !== preparoVisto) {
    setPreparoVisto(preparo);
    /* Um rascunho da IA que ficou sem homologar volta à curadoria. */
    const rascunho = preparo?.dados?.rascunho ?? null;
    if (rascunho && !curadoria && !gravada) {
      setRecorte(recorteDoPacote(rascunho));
      setCuradoria({ origem: rascunho.origem, conteudo: rascunho.conteudo });
    }
  }

  const topicos = topicosDoTexto(recorte.topicosTexto);
  const problemas = problemasDoRecorte({ ...recorte, topicos });
  const ocupado = gerando || usandoPadrao || homologando;

  function trocar(campo: keyof Recorte, valor: string) {
    setRecorte((atual) => ({ ...atual, [campo]: valor }));
  }

  function mexer(f: (c: ConteudoDoPacote) => ConteudoDoPacote) {
    setCuradoria((atual) => (atual ? { ...atual, conteudo: f(atual.conteudo) } : atual));
    setErrosDaHomologacao(null);
  }

  async function usarPadrao(turmaId: string, padrao: PacoteDaTurma["padrao"]) {
    setUsandoPadrao(true);
    setErro(null);
    try {
      const r = await fetch(`${caminhoDaTurma(turmaId)}/banco-padrao`, { method: "POST", headers: JSON_HEADERS, body: "{}" });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para usar o pacote padrão agora."));
        return;
      }
      const resposta = corpo as EmAndamento;
      setSemIa(null);
      setCuradoria(null);
      setGravada({
        turmaId,
        id: resposta.atividade.pacoteId,
        disciplina: rotuloDaDisciplina(padrao.disciplina),
        tema: padrao.tema,
        noAr: true,
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
    setSemIa(null);
    setErrosDaHomologacao(null);
    try {
      const r = await fetch(`${caminhoDaTurma(turmaId)}/gerar-conteudo`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          disciplina: recorte.disciplina,
          tema: recorte.tema.trim(),
          assuntos: topicos,
          contexto: recorte.contexto.trim() || null,
        }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para gerar agora. O pacote padrão oficial continua disponível."));
        return;
      }
      const resposta = corpo as RespostaDoGerar;
      if (!resposta.usouIa) {
        /* E0-PROF-03 sem saldo / falha: o caminho é o pacote curado, pelo botão da contingência. */
        setCuradoria(null);
        setSemIa(resposta.motivo ?? "indisponivel");
        return;
      }
      setRecorte(recorteDoPacote(resposta.rascunho));
      setCuradoria({ origem: resposta.rascunho.origem, conteudo: resposta.rascunho.conteudo });
    } catch {
      setErro({ mensagem: SEM_REDE, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  async function homologar(turmaId: string) {
    if (!curadoria || problemas.length > 0) return;
    setHomologando(true);
    setErrosDaHomologacao(null);
    try {
      const r = await fetch(`${caminhoDaTurma(turmaId)}/homologar`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          disciplina: recorte.disciplina,
          tema: recorte.tema.trim(),
          assuntos: topicos,
          contexto: recorte.contexto.trim() || null,
          origem: curadoria.origem,
          conteudo: curadoria.conteudo,
        }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErrosDaHomologacao(erroDaApi(corpo, "Não deu para homologar o pacote agora."));
        return;
      }
      const pacote = corpo as PacoteDoProfessor;
      setGravada({ turmaId, id: pacote.id, disciplina: rotuloDaDisciplina(pacote.disciplina), tema: pacote.tema, noAr: false });
    } catch {
      setErrosDaHomologacao({ mensagem: SEM_REDE, erros: [] });
    } finally {
      setHomologando(false);
    }
  }

  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (!gravada) return { ok: false, mensagem: "Homologue o conteúdo no passo Conteúdo.", erros: [] };
    if (gravada.turmaId !== turmaId) {
      return { ok: false, mensagem: "Este pacote foi preparado para outra turma. Volte a ela, ou prepare de novo para esta.", erros: [] };
    }
    return { ok: true, id: gravada.id };
  }

  function recomecar() {
    setGravada(null);
    setCuradoria(null);
    setSemIa(null);
    setErro(null);
    setErrosDaHomologacao(null);
    setRecorte(RECORTE_VAZIO);
    setTentativa((n) => n + 1);
  }

  return (
    <AssistenteDeAtividade
      expId="exp02em1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={gravada !== null}
      resumoDoConteudo={gravada ? `“${gravada.tema}” · ${gravada.disciplina}` : null}
      rotuloDoCriar={(porNoAr) => (porNoAr ? "Iniciar Atividade com a Turma" : "Criar atividade")}
      criar={criar}
      conteudo={(turmaId) => {
        const dados = preparo?.turmaId === turmaId ? preparo.dados : undefined;
        return (
          <section className="flex flex-col gap-4" data-preparo>
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
              <Ativacao gravada={gravada} turmaId={turmaId} nomeDaTurma={dados.turma.nome} recomecar={recomecar} />
            ) : (
              <>
                <Card variant="elevated">
                  <div className="flex flex-col gap-4" data-recorte-da-aula>
                    <SectionHeader title="Configuração Pedagógica da Missão" />
                    <div className="flex flex-col gap-4">
                      <Selection
                        label="Componente Curricular BNCC"
                        placeholder="Selecione"
                        value={recorte.disciplina || undefined}
                        showOptionCheckbox={false}
                        options={dados.disciplinas.map((d) => ({ value: d.slug, label: d.rotulo }))}
                        onChange={(valor) => trocar("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : String(valor))}
                      />
                      <TextField
                        label="Tema da Campanha (até 60 caracteres)"
                        helperText="Exemplo: Convivência Escolar e Celular ou Impacto das Telas no Sono."
                        value={recorte.tema}
                        maxLength={60}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("tema", e.target.value)}
                      />
                      <TextArea
                        label="Tópicos da Aula (3 a 6 tópicos, até 600 caracteres)"
                        helperText={`Um tópico por linha · ${topicos.length} ${topicos.length === 1 ? "tópico" : "tópicos"} · ${topicos.join("").length}/600 caracteres`}
                        rows={4}
                        value={recorte.topicosTexto}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocar("topicosTexto", e.target.value)}
                      />
                      <TextField
                        label="Contexto Local da Escola (opcional, até 120 caracteres)"
                        value={recorte.contexto}
                        maxLength={120}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("contexto", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button
                        variant="outline"
                        size="md"
                        leftIcon={<Icon name="library_books" size={18} />}
                        isDisabled={ocupado}
                        isLoading={usandoPadrao}
                        onClick={() => void usarPadrao(turmaId, dados.padrao)}
                        data-acao="usar-padrao"
                      >
                        Usar pacote padrão oficial
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        leftIcon={<Icon name="auto_awesome" size={18} />}
                        isDisabled={ocupado || problemas.length > 0}
                        isLoading={gerando}
                        onClick={() => void gerar(turmaId)}
                        data-acao="gerar-conteudo"
                      >
                        Gerar Pacote com IA
                      </Button>
                    </div>
                    {problemas.length > 0 && (recorte.tema || recorte.topicosTexto || recorte.disciplina) ? (
                      <p className="text-[12px] leading-snug text-unooria-neutral-600" role="status">
                        {`Para gerar com IA: ${problemas.join(" ")}`}
                      </p>
                    ) : null}
                    {erro ? <ErroDaApi erro={erro} /> : null}
                  </div>
                </Card>

                {gerando ? <GeracaoEmAndamento /> : null}

                {semIa && !gerando ? (
                  <Card variant="outlined">
                    <div className="flex flex-col items-start gap-3" data-contingencia={semIa}>
                      <SectionHeader title="Geração Assíncrona em Andamento" />
                      <FeedbackAlert type="warning" description={AVISO_SEM_IA[semIa]} />
                      <Button
                        variant="primary"
                        size="md"
                        isDisabled={ocupado}
                        isLoading={usandoPadrao}
                        onClick={() => void usarPadrao(turmaId, dados.padrao)}
                        data-acao="usar-padrao-contingencia"
                      >
                        Usar pacote padrão oficial
                      </Button>
                    </div>
                  </Card>
                ) : null}

                {curadoria && !gerando ? (
                  <CuradoriaDoPacote
                    curadoria={curadoria}
                    mexer={mexer}
                    ocupado={ocupado}
                    homologando={homologando}
                    erro={errosDaHomologacao}
                    problemasDoRecorte={problemas}
                    homologar={() => void homologar(turmaId)}
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

/** E0-PROF-03 "gerando": o texto à vista, a barra e a dica de condução. */
function GeracaoEmAndamento() {
  return (
    <Card variant="outlined">
      <div className="flex flex-col gap-3" role="status" data-gerando>
        <SectionHeader title="Geração Assíncrona em Andamento" />
        <ProgressBar indeterminate aria-label={TEXTO_GERANDO} valuePosition="none" />
        <p className="text-[14px] leading-snug text-unooria-neutral-800">{TEXTO_GERANDO}</p>
        <p className="rounded-lg border border-unooria-neutral-200 bg-unooria-neutral-50 p-3 text-[13px] leading-snug text-unooria-neutral-700">
          <strong className="text-unooria-neutral-950">Dica de condução:</strong> {DICA_DE_CONDUCAO}
        </p>
      </div>
    </Card>
  );
}

function ErroDaApi({ erro, titulo }: { erro: Erro; titulo?: string }) {
  return (
    <FeedbackAlert
      type="error"
      title={titulo}
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

const subtitulo = "text-[15px] font-semibold text-unooria-neutral-950";
const quadro = "flex flex-col gap-3 rounded-lg border border-unooria-neutral-200 p-3";

/**
 * E0-PROF-04: o pacote inteiro, editável. O gabarito (o nó de cada parágrafo,
 * a categoria de cada comentário) não chega aos estudantes.
 */
function CuradoriaDoPacote({
  curadoria,
  mexer,
  ocupado,
  homologando,
  erro,
  problemasDoRecorte,
  homologar,
}: {
  curadoria: Curadoria;
  mexer: (f: (c: ConteudoDoPacote) => ConteudoDoPacote) => void;
  ocupado: boolean;
  homologando: boolean;
  erro: Erro | null;
  problemasDoRecorte: string[];
  homologar: () => void;
}) {
  const c = curadoria.conteudo;
  const porTipo = (tipo: TipoDeComentario) => c.comentarios.filter((x) => x.tipo === tipo).length;
  const faltam = (Object.entries(MINIMOS_DOS_COMENTARIOS) as [TipoDeComentario, number][]).filter(([tipo, min]) => porTipo(tipo) < min);

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-5" data-curadoria>
        <SectionHeader
          title="Homologação do Pacote de Conteúdo"
          badge={
            <Tag variant={curadoria.origem === "ia" ? "info" : "success"} size="sm" pill>
              {curadoria.origem === "ia" ? "Gerado com IA" : "Pacote padrão oficial"}
            </Tag>
          }
          description="Revise os textos gerados. Você pode editar diretamente as frases ou aprovar a versão pronta."
        />

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3" data-pauta>
              <h3 className={subtitulo}>Pauta do grêmio</h3>
              <TextField
                label={`Título (até ${PAUTA.titulo} caracteres)`}
                maxLength={PAUTA.titulo}
                value={c.pauta.titulo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, pauta: { ...k.pauta, titulo: v } })); }}
              />
              <TextArea
                label={`Descrição (até ${PAUTA.descricao} caracteres)`}
                rows={3}
                maxLength={PAUTA.descricao}
                value={c.pauta.descricao}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { const v = e.target.value; mexer((k) => ({ ...k, pauta: { ...k.pauta, descricao: v } })); }}
              />
              {c.pauta.orientacoes.map((o, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField
                      label={`Orientação ${i + 1} (até ${PAUTA.orientacao} caracteres)`}
                      maxLength={PAUTA.orientacao}
                      value={o}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.value;
                        mexer((k) => ({ ...k, pauta: { ...k.pauta, orientacoes: k.pauta.orientacoes.map((x, j) => (j === i ? v : x)) } }));
                      }}
                    />
                  </div>
                  {c.pauta.orientacoes.length > PAUTA.orientacoes.min ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover a orientação ${i + 1}`}
                      leftIcon={<Icon name="delete" size={16} />}
                      onClick={() => mexer((k) => ({ ...k, pauta: { ...k.pauta, orientacoes: k.pauta.orientacoes.filter((_, j) => j !== i) } }))}
                    >
                      Remover
                    </Button>
                  ) : null}
                </div>
              ))}
              {c.pauta.orientacoes.length < PAUTA.orientacoes.max ? (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Icon name="add" size={16} />}
                    onClick={() => mexer((k) => ({ ...k, pauta: { ...k.pauta, orientacoes: [...k.pauta.orientacoes, ""] } }))}
                  >
                    Adicionar orientação
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3" data-rascunho>
              <h3 className={subtitulo}>Rascunho da postagem (UnooriaAI)</h3>
              {c.rascunho.map((p, i) => (
                <div key={p.id} className={quadro} data-paragrafo={p.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag variant={p.no ? "warning" : "neutral"} size="sm" pill>
                      {p.no ? ROTULO_DO_NO[p.no] : `Parágrafo ${i + 1}`}
                    </Tag>
                    {p.no ? <span className="text-[12px] text-unooria-neutral-600">{HABILIDADE_DO_NO[p.no]}</span> : null}
                  </div>
                  <TextArea
                    label={p.no ? "Como o UnooriaAI escreve (o problema)" : "Texto"}
                    rows={3}
                    value={p.texto}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      const texto = e.target.value;
                      mexer((k) => ({ ...k, rascunho: k.rascunho.map((x) => (x.id === p.id ? { ...x, texto } : x)) }));
                    }}
                  />
                  {p.no ? (
                    <TextArea
                      label="Versão corrigida (quando o estudante pede)"
                      rows={3}
                      value={p.corrigido ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        const corrigido = e.target.value;
                        mexer((k) => ({ ...k, rascunho: k.rascunho.map((x) => (x.id === p.id ? { ...x, corrigido } : x)) }));
                      }}
                    />
                  ) : null}
                </div>
              ))}
              <div className="grid gap-3 lg:grid-cols-2">
                <TextField
                  label="Fonte inventada (como aparece no texto)"
                  maxLength={60}
                  value={c.fonteInventada}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, fonteInventada: v })); }}
                />
                <TextField
                  label="Colega exposto (como aparece no texto)"
                  maxLength={80}
                  value={c.colega}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, colega: v })); }}
                />
                <TextField
                  label="Autoria do trecho copiado"
                  maxLength={100}
                  value={c.fonteOriginal}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, fonteOriginal: v })); }}
                />
                <TextField
                  label="Frase que o algoritmo destaca no feed"
                  helperText="Precisa estar num parágrafo que continua no post depois das correções."
                  maxLength={160}
                  value={c.recorte}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, recorte: v })); }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3" data-manchetes>
              <h3 className={subtitulo}>Manchetes de capa</h3>
              {MANCHETES.map((m) => (
                <TextField
                  key={m}
                  label={ROTULO_DA_MANCHETE[m]}
                  maxLength={MANCHETE_MAX_CARACTERES}
                  value={c.manchetes[m]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, manchetes: { ...k.manchetes, [m]: v } })); }}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3" data-comentarios>
              <h3 className={subtitulo}>Comentários da madrugada (Unoovista)</h3>
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                {`Saúde física: ${porTipo("saude_fisica")} · Saúde mental: ${porTipo("saude_mental")} · Contas anônimas agressivas: ${porTipo("anonimo_agressivo")} · Engajamento: ${porTipo("engajamento")}`}
              </p>
              {faltam.length > 0 ? (
                <FeedbackAlert
                  type="warning"
                  description={`O feed precisa de pelo menos ${faltam.map(([tipo, min]) => `${min} de ${ROTULO_DO_TIPO[tipo].toLowerCase()}`).join(", ")}.`}
                />
              ) : null}
              {c.comentarios.map((com, i) => {
                const horarioValido = horarioDeMadrugada(com.horario);
                const trocarComentario = (campo: "autor" | "horario" | "tipo" | "texto", valor: string) =>
                  mexer((k) => ({ ...k, comentarios: k.comentarios.map((x) => (x.id === com.id ? { ...x, [campo]: valor } : x)) }));
                return (
                  <div key={com.id} className={quadro} data-comentario={com.id}>
                    <span className="text-[12px] font-semibold text-unooria-neutral-600">{`Comentário ${i + 1}`}</span>
                    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                      <TextField
                        label="Autor"
                        maxLength={40}
                        value={com.autor}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarComentario("autor", e.target.value)}
                      />
                      <TextField
                        label="Horário"
                        maxLength={5}
                        value={com.horario}
                        error={horarioValido ? undefined : "Entre 01h00 e 03h30, como 02h40."}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarComentario("horario", e.target.value)}
                      />
                    </div>
                    <Selection
                      label="Categoria"
                      value={com.tipo}
                      showOptionCheckbox={false}
                      options={TIPOS_DE_COMENTARIO.map((t) => ({ value: t, label: ROTULO_DO_TIPO[t] }))}
                      onChange={(valor) => {
                        const v = Array.isArray(valor) ? valor[0] : valor;
                        if (typeof v === "string" && (TIPOS_DE_COMENTARIO as readonly string[]).includes(v)) trocarComentario("tipo", v);
                      }}
                    />
                    <TextArea
                      label="Texto"
                      rows={2}
                      value={com.texto}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocarComentario("texto", e.target.value)}
                    />
                    {c.reacoes && reage(com.tipo) ? <ReacoesDoComentario comentario={com} reacoes={c.reacoes} mexer={mexer} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {erro ? <ErroDaApi erro={erro} titulo="O que a plataforma recusou no pacote" /> : null}
        {problemasDoRecorte.length > 0 ? (
          <p className="text-[12px] leading-snug text-unooria-danger" role="status">{`Para homologar, ajuste a configuração: ${problemasDoRecorte.join(" ")}`}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="primary"
            size="md"
            leftIcon={<Icon name="verified" size={18} />}
            isDisabled={ocupado || problemasDoRecorte.length > 0}
            isLoading={homologando}
            onClick={homologar}
            data-acao="homologar-conteudo"
          >
            Homologar Conteúdo
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * As seis variantes de um comentário que REAGE ao post (ADR-192), só quando o
 * pacote as trouxe da geração. O "Texto" acima continua valendo: é o que o
 * feed mostra quando a variante não tem texto.
 *
 * COMPENSAÇÃO MARCADA (lacuna do DS 0.2.24): o `Collapse` fechado deixa o
 * corpo focável dentro de `aria-hidden` (seis campos por comentário que o Tab
 * alcançaria sem o leitor de tela anunciar). Por isso ele é CONTROLADO e o
 * corpo só é renderizado aberto. Quando o pacote tirar o corpo fechado do
 * foco, o `{aberto ? … : null}` pode virar o filho direto.
 */
function ReacoesDoComentario({
  comentario,
  reacoes,
  mexer,
}: {
  comentario: ComentarioDoFeed;
  reacoes: NonNullable<ConteudoDoPacote["reacoes"]>;
  mexer: (f: (c: ConteudoDoPacote) => ConteudoDoPacote) => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="flex flex-col gap-2" data-reacoes-do-comentario={comentario.id}>
      <p className="text-[12px] leading-snug text-unooria-neutral-600">
        Este comentário muda conforme a manchete e o trecho que viralizaram no post de cada estudante: cada um lê a
        variante do post que publicou.
      </p>
      <Collapse
        title="As seis reações ao post"
        size="sm"
        variant="bordered"
        isOpen={aberto}
        onToggle={(abrir) => setAberto(abrir)}
      >
        {aberto ? (
          <div className="flex flex-col gap-3 pt-2">
            {CHAVES_DAS_REACOES.map((chave) => (
              <TextArea
                key={chave}
                label={ROTULO_DA_REACAO[chave]}
                rows={2}
                value={reacoes[chave]?.[comentario.id] ?? ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  const v = e.target.value;
                  mexer((k) => comReacao(k, chave, comentario.id, v));
                }}
              />
            ))}
          </div>
        ) : null}
      </Collapse>
    </div>
  );
}

/** E0-PROF-05: o pacote homologado, à espera do último passo do assistente ("Iniciar Atividade com a Turma"). */
function Ativacao({
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
      <div className="flex flex-col gap-3" data-fase="ativacao">
        <SectionHeader title="Ativação da Turma" />
        {gravada.turmaId !== turmaId ? (
          <FeedbackAlert
            type="warning"
            description="Este pacote foi preparado para outra turma. Volte à turma anterior, ou prepare de novo para esta."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Tag variant="neutral" size="sm" pill>
                {nomeDaTurma}
              </Tag>
              <Tag variant="info" size="sm" pill>
                {`Pacote: ${gravada.disciplina} · ${gravada.tema}`}
              </Tag>
            </div>
            <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
              A atividade será disponibilizada instantaneamente para todos os estudantes conectados da turma.
            </p>
            <p className="text-[13px] leading-relaxed text-unooria-neutral-600">
              {gravada.noAr
                ? "O pacote padrão oficial já está em andamento nesta turma. Continue para as equipes e, no último passo, Iniciar Atividade com a Turma libera a missão na sala de aula."
                : "Conteúdo homologado. Continue para as equipes; no último passo, Iniciar Atividade com a Turma põe a atividade no ar e libera a missão na sala de aula."}
            </p>
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

/** Lê o preparo da turma (`GET .../pacote`) — a `key` com a turma e a tentativa faz cada troca ser uma leitura nova. */
function LerPreparo({ turmaId, aoLer }: { turmaId: string; aoLer: (lido: PreparoLido) => void }) {
  useEffect(() => {
    let vivo = true;
    void (async () => {
      let dados: PacoteDaTurma | null;
      try {
        const r = await fetch(`${caminhoDaTurma(turmaId)}/pacote`, { cache: "no-store" });
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
