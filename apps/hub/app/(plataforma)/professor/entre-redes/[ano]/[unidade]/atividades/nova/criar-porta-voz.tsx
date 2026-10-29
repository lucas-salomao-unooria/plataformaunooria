"use client";

import { useEffect, useRef, useState } from "react";

import {
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
import { liberarNaSala } from "@/lib/entre-redes/criar-atividade";
import {
  ASSUNTOS,
  AVISO_SEM_IA,
  CONTEXTO_MAX,
  EXP_ID,
  NOME_DO_GRUPO,
  ROTAS_DA_TURMA,
  ROTULO_DO_ITEM,
  TEMA,
  VALORES_DA_SERIE,
  assuntosDoTexto,
  caminhoDaTurma,
  comItemRegenerado,
  erroDaApi,
  problemasDoRecorte,
  rotuloDaDisciplina,
  type ConteudoDoPacote,
  type EmAndamento,
  type FalaDoGrupo,
  type ItemDoPacote,
  type Origem,
  type PacoteDoProfessor,
  type PacotesDaTurmaPortaVoz,
  type RespostaDoGerar,
  type RespostaDoHomologar,
} from "@/lib/porta-voz-tipos";

/** O rascunho na curadoria: o pacote do servidor e o que o professor editou na tela. */
interface Curadoria {
  pacoteId: string;
  origem: Origem;
  disciplina: string;
  tema: string;
  conteudo: ConteudoDoPacote;
}

interface PreparoLido {
  turmaId: string;
  dados: PacotesDaTurmaPortaVoz | null;
  /** O rascunho que ficou sem homologar, inteiro (`GET pacotes/:id`), para voltar à curadoria. */
  rascunho: PacoteDoProfessor | null;
}

interface Recorte {
  disciplina: string;
  tema: string;
  assuntosTexto: string;
  contexto: string;
}

/** O pacote homologado: a atividade PRONTA (ou já no ar, no banco padrão), à espera do último passo. */
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

const RECORTE_VAZIO: Recorte = { disciplina: "", tema: "", assuntosTexto: "", contexto: "" };
const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
const JSON_HEADERS = { "content-type": "application/json" } as const;

/** Copy `prof.gerando.status`, literal. */
const TEXTO_GERANDO = "Gerando simulação de boletins técnicos municipais e mensagens da comunidade...";

const bff = (turmaId: string, rota: string) => `/api/plataforma${caminhoDaTurma(turmaId)}${rota}`;

const curadoriaDe = (p: PacoteDoProfessor): Curadoria => ({
  pacoteId: p.id,
  origem: p.origem,
  disciplina: p.disciplina,
  tema: p.tema,
  conteudo: p.conteudo,
});

/**
 * NOVA ATIVIDADE de O PORTA-VOZ DOS DADOS (ADR-198; ADR-130). O PACOTE — o
 * recorte do grupo da cidade, a tabela do serviço público, a nota técnica, as
 * três informações do compositor, as reações dos moradores e o pós-debate —
 * é a atividade que a turma vive. Os números (95 → 88), o laudo e os cartões
 * da perícia são FIXOS no servidor. O fluxo é o dos wireframes E0-PROF-02 a 05,
 * dentro do assistente de quatro passos da plataforma (sem o das equipes: a
 * missão é individual):
 *
 * 1. **Recorte Pedagógico e Territorial da Missão** (E0-PROF-02): componente
 *    curricular, tema (≤ 60), 3 a 6 assuntos (≤ 600 somados) e o bairro
 *    opcional (≤ 120). "Usar Banco Padrão e Liberar" é o caminho curto: `POST
 *    pacotes/padrao` homologa o banco curado E o põe no ar, e a missão é
 *    liberada na sala no mesmo toque.
 * 2. **A geração** (E0-PROF-03): a ÚNICA IA da missão, antes da aula (quota do
 *    professor). Sem saldo ou com o vendor fora, a api devolve `usouIa: false`
 *    e a tela diz por quê, com "Carregar Banco Padrão Curado". O rascunho do
 *    banco curado que a api gravou NÃO entra na curadoria: homologá-lo seria
 *    dizer que a IA o escreveu.
 * 3. **Curadoria do Pacote de Conteúdo da Turma** (E0-PROF-04): tudo editável
 *    na tela, com "Regenerar Item" por bloco (que troca SÓ aquele bloco e
 *    guarda o que foi editado nos outros). "Homologar Pacote de Conteúdo" manda
 *    o conteúdo editado; a régua da api devolve TODAS as frases de uma vez.
 * 4. **Pronto para Liberação em Sala** (E0-PROF-05): o último passo do
 *    assistente, "Liberar Atividade para a Turma", põe no ar e LIBERA na sala
 *    (`concluirCriacao`). Não há código de sala: a liberação é por turma.
 */
export function CriarPortaVoz({
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
  const [regenerando, setRegenerando] = useState<ItemDoPacote | null>(null);
  const [semIa, setSemIa] = useState<"sem-saldo" | "indisponivel" | null>(null);
  const [erro, setErro] = useState<Erro | null>(null);
  const [errosDaHomologacao, setErrosDaHomologacao] = useState<Erro | null>(null);
  const [avisoDoItem, setAvisoDoItem] = useState<{ item: ItemDoPacote; texto: string; tipo: "warning" | "error" } | null>(null);
  const [avisoDaSala, setAvisoDaSala] = useState<string | null>(null);
  /* A geração pode ser cancelada ("Cancelar e Usar Banco Padrão"): o pedido é abortado no BFF. */
  const geracao = useRef<AbortController | null>(null);

  if (preparo !== preparoVisto) {
    setPreparoVisto(preparo);
    /* Um rascunho da IA que ficou sem homologar volta à curadoria. */
    const rascunho = preparo?.rascunho ?? null;
    if (rascunho && rascunho.origem === "ia" && !curadoria && !gravada) {
      setCuradoria(curadoriaDe(rascunho));
    }
  }

  const assuntos = assuntosDoTexto(recorte.assuntosTexto);
  const problemas = problemasDoRecorte({ ...recorte, assuntos });
  const ocupado = gerando || usandoPadrao || homologando || regenerando !== null;

  function trocar(campo: keyof Recorte, valor: string) {
    setRecorte((atual) => ({ ...atual, [campo]: valor }));
  }

  function mexer(f: (c: ConteudoDoPacote) => ConteudoDoPacote) {
    setCuradoria((atual) => (atual ? { ...atual, conteudo: f(atual.conteudo) } : atual));
    setErrosDaHomologacao(null);
  }

  async function usarPadrao(turmaId: string, dados: PacotesDaTurmaPortaVoz) {
    geracao.current?.abort();
    setUsandoPadrao(true);
    setErro(null);
    setAvisoDaSala(null);
    try {
      const r = await fetch(bff(turmaId, ROTAS_DA_TURMA.padrao), { method: "POST", headers: JSON_HEADERS, body: "{}" });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para usar o banco padrão agora."));
        return;
      }
      const resposta = corpo as EmAndamento;
      /* "e Liberar": o banco padrão já está no ar; a missão abre na sala no mesmo toque (ADR-146). */
      setAvisoDaSala(await liberarNaSala({ expId: EXP_ID, turmaId }));
      setSemIa(null);
      setCuradoria(null);
      setGravada({
        turmaId,
        id: resposta.atividade.pacoteId,
        disciplina: rotuloDaDisciplina(dados.padrao.disciplina),
        tema: dados.padrao.tema,
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
    const controle = new AbortController();
    geracao.current = controle;
    setGerando(true);
    setErro(null);
    setSemIa(null);
    setErrosDaHomologacao(null);
    try {
      const r = await fetch(bff(turmaId, ROTAS_DA_TURMA.gerar), {
        method: "POST",
        headers: JSON_HEADERS,
        signal: controle.signal,
        body: JSON.stringify({
          disciplina: recorte.disciplina,
          tema: recorte.tema.trim(),
          assuntos,
          contexto: recorte.contexto.trim() || null,
        }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para gerar a proposta agora. O banco padrão continua disponível."));
        return;
      }
      const resposta = corpo as RespostaDoGerar;
      if (!resposta.usouIa) {
        /* E0-PROF-03 sem saldo / instabilidade: o caminho é o banco curado, pelo botão da contingência. */
        setCuradoria(null);
        setSemIa(resposta.motivo ?? "indisponivel");
        return;
      }
      setCuradoria(curadoriaDe(resposta.pacote));
    } catch {
      /* Cancelado pelo professor: o banco padrão já está a caminho, sem erro na tela. */
      if (!controle.signal.aborted) setErro({ mensagem: SEM_REDE, erros: [] });
    } finally {
      if (geracao.current === controle) geracao.current = null;
      setGerando(false);
    }
  }

  async function regenerar(turmaId: string, item: ItemDoPacote) {
    if (!curadoria) return;
    setRegenerando(item);
    setAvisoDoItem(null);
    try {
      const r = await fetch(bff(turmaId, ROTAS_DA_TURMA.regenerar(curadoria.pacoteId)), {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ item }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setAvisoDoItem({ item, tipo: "error", texto: erroDaApi(corpo, "Não deu para regenerar este item agora.").mensagem });
        return;
      }
      const resposta = corpo as RespostaDoGerar;
      if (!resposta.usouIa) {
        setAvisoDoItem({
          item,
          tipo: "warning",
          texto:
            resposta.motivo === "sem-saldo"
              ? "Saldo de inteligência artificial esgotado para o período escolar. O item ficou como estava: edite o texto na tela, se quiser."
              : "O serviço de geração encontrou instabilidade temporária. O item ficou como estava: tente de novo ou edite o texto na tela.",
        });
        return;
      }
      setCuradoria((atual) => (atual ? { ...atual, conteudo: comItemRegenerado(atual.conteudo, resposta.pacote.conteudo, item) } : atual));
      setErrosDaHomologacao(null);
    } catch {
      setAvisoDoItem({ item, tipo: "error", texto: SEM_REDE });
    } finally {
      setRegenerando(null);
    }
  }

  async function homologar(turmaId: string) {
    if (!curadoria) return;
    setHomologando(true);
    setErrosDaHomologacao(null);
    try {
      const r = await fetch(bff(turmaId, ROTAS_DA_TURMA.homologar(curadoria.pacoteId)), {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ conteudo: curadoria.conteudo }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErrosDaHomologacao(erroDaApi(corpo, "Não deu para homologar o pacote agora."));
        return;
      }
      const { pacote } = corpo as RespostaDoHomologar;
      setGravada({ turmaId, id: pacote.id, disciplina: rotuloDaDisciplina(pacote.disciplina), tema: pacote.tema, noAr: false });
    } catch {
      setErrosDaHomologacao({ mensagem: SEM_REDE, erros: [] });
    } finally {
      setHomologando(false);
    }
  }

  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (!gravada) return { ok: false, mensagem: "Homologue o pacote no passo Conteúdo.", erros: [] };
    if (gravada.turmaId !== turmaId) {
      return { ok: false, mensagem: "Este pacote foi preparado para outra turma. Volte a ela, ou prepare de novo para esta.", erros: [] };
    }
    return { ok: true, id: gravada.id };
  }

  function recomecar() {
    geracao.current?.abort();
    setGravada(null);
    setCuradoria(null);
    setSemIa(null);
    setErro(null);
    setErrosDaHomologacao(null);
    setAvisoDoItem(null);
    setAvisoDaSala(null);
    setRecorte(RECORTE_VAZIO);
    setTentativa((n) => n + 1);
  }

  return (
    <AssistenteDeAtividade
      expId={EXP_ID}
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={gravada !== null}
      resumoDoConteudo={gravada ? `“${gravada.tema}” · ${gravada.disciplina}` : null}
      rotuloDoCriar={(porNoAr) => (porNoAr ? "Liberar Atividade para a Turma" : "Criar atividade")}
      criar={criar}
      conteudo={(turmaId) => {
        const lido = preparo?.turmaId === turmaId ? preparo : undefined;
        const dados = lido?.dados;
        return (
          <section className="flex flex-col gap-4" data-preparo>
            <LerPreparo key={`${turmaId}-${tentativa}`} turmaId={turmaId} aoLer={setPreparo} />
            {lido === undefined ? (
              <Card variant="outlined">
                <ProgressBar indeterminate label="Abrindo o preparo da turma..." valuePosition="none" />
              </Card>
            ) : !dados ? (
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
              <Ativacao gravada={gravada} turmaId={turmaId} nomeDaTurma={dados.turma.nome} avisoDaSala={avisoDaSala} recomecar={recomecar} />
            ) : curadoria && !gerando ? (
              <CuradoriaDoPacote
                curadoria={curadoria}
                mexer={mexer}
                ocupado={ocupado}
                homologando={homologando}
                regenerando={regenerando}
                avisoDoItem={avisoDoItem}
                erro={errosDaHomologacao}
                regenerar={(item) => void regenerar(turmaId, item)}
                homologar={() => void homologar(turmaId)}
                recomecar={recomecar}
              />
            ) : (
              <>
                <Card variant="elevated">
                  <div className="flex flex-col gap-3" data-caminho-curto>
                    <SectionHeader
                      title="O caminho curto"
                      description={`O banco padrão da Unooria (${dados.padrao.nome}), já homologado: a atividade entra no ar e a missão é liberada para a turma.`}
                    />
                    <div>
                      <Button
                        variant="primary"
                        size="md"
                        leftIcon={<Icon name="bolt" size={18} />}
                        isDisabled={ocupado}
                        isLoading={usandoPadrao}
                        onClick={() => void usarPadrao(turmaId, dados)}
                        data-acao="usar-padrao"
                      >
                        Usar Banco Padrão e Liberar
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card variant="elevated">
                  <div className="flex flex-col gap-4" data-recorte-da-aula>
                    <SectionHeader
                      title="Recorte Pedagógico e Territorial da Missão"
                      description="Ou prepare um pacote com o tema da sua aula: a IA escreve a tabela, a nota técnica e as falas dos moradores, e você revisa tudo antes de liberar."
                    />
                    <div className="flex flex-col gap-4">
                      <Selection
                        label="Componente Curricular:"
                        helperText="Selecione a disciplina integradora da sequência didática."
                        placeholder="Selecione"
                        value={recorte.disciplina || undefined}
                        showOptionCheckbox={false}
                        options={dados.disciplinas.map((d) => ({ value: d.slug, label: d.rotulo }))}
                        onChange={(valor) => trocar("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : String(valor))}
                      />
                      <TextField
                        label="Título do Tema Gerador:"
                        placeholder="Ex.: Monitoramento da Qualidade da Água Tratada"
                        helperText={`Até ${TEMA.max} caracteres.`}
                        value={recorte.tema}
                        maxLength={TEMA.max}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("tema", e.target.value)}
                      />
                      <TextArea
                        label="Objetos de Conhecimento (3 a 6 tópicos):"
                        helperText={`Um por linha · ${assuntos.length} ${assuntos.length === 1 ? "tópico" : "tópicos"} · ${assuntos.join("").length}/${ASSUNTOS.total} caracteres`}
                        rows={4}
                        value={recorte.assuntosTexto}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocar("assuntosTexto", e.target.value)}
                      />
                      <TextField
                        label="Bairro ou Território Local (opcional):"
                        helperText={`Até ${CONTEXTO_MAX} caracteres.`}
                        value={recorte.contexto}
                        maxLength={CONTEXTO_MAX}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("contexto", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Button
                        variant="primary"
                        size="md"
                        leftIcon={<Icon name="auto_awesome" size={18} />}
                        isDisabled={ocupado || problemas.length > 0}
                        isLoading={gerando}
                        onClick={() => void gerar(turmaId)}
                        data-acao="gerar-conteudo"
                      >
                        Gerar Proposta via IA
                      </Button>
                    </div>
                    {problemas.length > 0 && (recorte.tema || recorte.assuntosTexto || recorte.disciplina) ? (
                      <p className="text-[12px] leading-snug text-unooria-neutral-600" role="status">
                        {`Para gerar a proposta: ${problemas.join(" ")}`}
                      </p>
                    ) : null}
                    {erro ? <ErroDaApi erro={erro} /> : null}
                  </div>
                </Card>

                {gerando ? (
                  <Card variant="outlined">
                    <div className="flex flex-col gap-3" role="status" data-gerando>
                      <ProgressBar indeterminate aria-label={TEXTO_GERANDO} valuePosition="none" />
                      <p className="text-[14px] leading-snug text-unooria-neutral-800">{TEXTO_GERANDO}</p>
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          isDisabled={usandoPadrao}
                          isLoading={usandoPadrao}
                          onClick={() => void usarPadrao(turmaId, dados)}
                          data-acao="cancelar-e-usar-padrao"
                        >
                          Cancelar e Usar Banco Padrão
                        </Button>
                      </div>
                    </div>
                  </Card>
                ) : null}

                {semIa && !gerando ? (
                  <Card variant="outlined">
                    <div className="flex flex-col items-start gap-3" data-contingencia={semIa}>
                      <FeedbackAlert type="warning" description={AVISO_SEM_IA[semIa]} />
                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="primary"
                          size="md"
                          isDisabled={ocupado}
                          isLoading={usandoPadrao}
                          onClick={() => void usarPadrao(turmaId, dados)}
                          data-acao="carregar-padrao"
                        >
                          Carregar Banco Padrão Curado
                        </Button>
                        {semIa === "indisponivel" ? (
                          <Button variant="outline" size="md" isDisabled={ocupado} onClick={() => void gerar(turmaId)} data-acao="tentar-de-novo">
                            Tentar nova geração
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ) : null}
              </>
            )}
          </section>
        );
      }}
    />
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

const subtitulo = "text-[14px] font-semibold text-unooria-neutral-950";
const quadro = "flex flex-col gap-3 rounded-lg border border-unooria-neutral-200 p-3";

type Mexer = (f: (c: ConteudoDoPacote) => ConteudoDoPacote) => void;

/**
 * E0-PROF-04: o pacote inteiro, editável, um cartão por item — e cada cartão
 * com o seu "Regenerar Item". Os números da tabela são fixos e aparecem só
 * para leitura, ao lado do período e da situação.
 */
function CuradoriaDoPacote({
  curadoria,
  mexer,
  ocupado,
  homologando,
  regenerando,
  avisoDoItem,
  erro,
  regenerar,
  homologar,
  recomecar,
}: {
  curadoria: Curadoria;
  mexer: Mexer;
  ocupado: boolean;
  homologando: boolean;
  regenerando: ItemDoPacote | null;
  avisoDoItem: { item: ItemDoPacote; texto: string; tipo: "warning" | "error" } | null;
  erro: Erro | null;
  regenerar: (item: ItemDoPacote) => void;
  homologar: () => void;
  recomecar: () => void;
}) {
  const c = curadoria.conteudo;
  const bloco = (item: ItemDoPacote, filhos: React.ReactNode) => (
    <Card variant="outlined" key={item}>
      <div className="flex flex-col gap-3" data-item-do-pacote={item}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={subtitulo}>{ROTULO_DO_ITEM[item]}</h3>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icon name="autorenew" size={16} />}
            isDisabled={ocupado}
            isLoading={regenerando === item}
            onClick={() => regenerar(item)}
            data-acao="regenerar-item"
          >
            Regenerar Item
          </Button>
        </div>
        {avisoDoItem?.item === item ? <FeedbackAlert type={avisoDoItem.tipo} description={avisoDoItem.texto} /> : null}
        {filhos}
      </div>
    </Card>
  );

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-5" data-curadoria>
        <SectionHeader
          title="Curadoria do Pacote de Conteúdo da Turma"
          badge={
            <Tag variant="info" size="sm" pill>
              Gerado com IA
            </Tag>
          }
          description="Revise os textos e percentuais gerados. Você pode editar qualquer string inline antes da homologação final."
        />
        <p className="text-[13px] text-unooria-neutral-600">
          {`${rotuloDaDisciplina(curadoria.disciplina)} · “${curadoria.tema}”. Os percentuais da tabela (${VALORES_DA_SERIE.map((v) => `${v}%`).join(", ")}), o laudo e os cartões da perícia são fixos em toda turma.`}
        </p>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-4">
            {bloco(
              "grupo",
              <>
                <Campo
                  label="Recorte do grupo da cidade"
                  max={60}
                  value={c.grupo}
                  onChange={(v) => mexer((k) => ({ ...k, grupo: v }))}
                />
                <p className="text-[12px] text-unooria-neutral-600">{`O estudante vê: ${NOME_DO_GRUPO} — ${c.grupo}`}</p>
              </>,
            )}

            {bloco(
              "servico",
              <>
                <Campo label="Órgão responsável" max={80} value={c.servico.orgao} onChange={(v) => mexer((k) => ({ ...k, servico: { ...k.servico, orgao: v } }))} />
                <Campo label="Indicador" max={100} value={c.servico.indicador} onChange={(v) => mexer((k) => ({ ...k, servico: { ...k.servico, indicador: v } }))} />
                <Campo label="Unidade de medida" max={100} value={c.servico.unidade} onChange={(v) => mexer((k) => ({ ...k, servico: { ...k.servico, unidade: v } }))} />
                <Campo label="Abrangência" max={140} value={c.servico.abrangencia} onChange={(v) => mexer((k) => ({ ...k, servico: { ...k.servico, abrangencia: v } }))} />
                <Campo label="Periodicidade" max={80} value={c.servico.periodicidade} onChange={(v) => mexer((k) => ({ ...k, servico: { ...k.servico, periodicidade: v } }))} />
                {VALORES_DA_SERIE.map((valor, i) => (
                  <div key={i} className={quadro}>
                    <span className="text-[12px] font-semibold text-unooria-neutral-600">{`Mês ${i + 1} · ${valor}% (fixo)`}</span>
                    <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                      <Campo
                        label="Período"
                        max={24}
                        value={c.servico.periodos[i] ?? ""}
                        onChange={(v) => mexer((k) => ({ ...k, servico: { ...k.servico, periodos: k.servico.periodos.map((x, j) => (j === i ? v : x)) } }))}
                      />
                      <Campo
                        label="Situação"
                        max={100}
                        value={c.servico.situacoes[i] ?? ""}
                        onChange={(v) => mexer((k) => ({ ...k, servico: { ...k.servico, situacoes: k.servico.situacoes.map((x, j) => (j === i ? v : x)) } }))}
                      />
                    </div>
                  </div>
                ))}
              </>,
            )}

            {bloco(
              "notaTecnica",
              <>
                <Campo
                  label="Nome do arquivo (.pdf, sem espaços)"
                  max={60}
                  value={c.notaTecnica.arquivo}
                  onChange={(v) => mexer((k) => ({ ...k, notaTecnica: { ...k.notaTecnica, arquivo: v } }))}
                />
                <Campo label="Título" max={80} value={c.notaTecnica.titulo} onChange={(v) => mexer((k) => ({ ...k, notaTecnica: { ...k.notaTecnica, titulo: v } }))} />
                <Campo label="Órgão" max={100} value={c.notaTecnica.orgao} onChange={(v) => mexer((k) => ({ ...k, notaTecnica: { ...k.notaTecnica, orgao: v } }))} />
                <CampoLongo
                  label="Resumo (a folha que o estudante abre)"
                  max={400}
                  value={c.notaTecnica.resumo}
                  onChange={(v) => mexer((k) => ({ ...k, notaTecnica: { ...k.notaTecnica, resumo: v } }))}
                />
                {c.notaTecnica.secoes.map((s, i) => (
                  <div key={i} className={quadro}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-unooria-neutral-600">{`Seção ${i + 1}`}</span>
                      {c.notaTecnica.secoes.length > 2 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remover a seção ${i + 1}`}
                          leftIcon={<Icon name="delete" size={16} />}
                          onClick={() => mexer((k) => ({ ...k, notaTecnica: { ...k.notaTecnica, secoes: k.notaTecnica.secoes.filter((_, j) => j !== i) } }))}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </div>
                    <Campo
                      label="Título da seção"
                      max={80}
                      value={s.titulo}
                      onChange={(v) => mexer((k) => ({ ...k, notaTecnica: { ...k.notaTecnica, secoes: k.notaTecnica.secoes.map((x, j) => (j === i ? { ...x, titulo: v } : x)) } }))}
                    />
                    <CampoLongo
                      label="Texto"
                      max={900}
                      value={s.texto}
                      onChange={(v) => mexer((k) => ({ ...k, notaTecnica: { ...k.notaTecnica, secoes: k.notaTecnica.secoes.map((x, j) => (j === i ? { ...x, texto: v } : x)) } }))}
                    />
                  </div>
                ))}
                {c.notaTecnica.secoes.length < 5 ? (
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Icon name="add" size={16} />}
                      onClick={() => mexer((k) => ({ ...k, notaTecnica: { ...k.notaTecnica, secoes: [...k.notaTecnica.secoes, { titulo: "", texto: "" }] } }))}
                    >
                      Adicionar seção
                    </Button>
                  </div>
                ) : null}
              </>,
            )}
          </div>

          <div className="flex flex-col gap-4">
            {bloco(
              "camadas",
              <>
                <p className="text-[12px] text-unooria-neutral-600">
                  O texto que cada interruptor do compositor acrescenta ao boletim. A explicação da escala muda com a escala escolhida.
                </p>
                <CampoLongo
                  label="Explicação da escala — eixo em 0%"
                  max={140}
                  value={c.camadas.explicacao.zero}
                  onChange={(v) => mexer((k) => ({ ...k, camadas: { ...k.camadas, explicacao: { ...k.camadas.explicacao, zero: v } } }))}
                />
                <CampoLongo
                  label="Explicação da escala — eixo em 80%"
                  max={140}
                  value={c.camadas.explicacao.oitenta}
                  onChange={(v) => mexer((k) => ({ ...k, camadas: { ...k.camadas, explicacao: { ...k.camadas.explicacao, oitenta: v } } }))}
                />
                <CampoLongo label="Fonte dos dados" max={140} value={c.camadas.fonte} onChange={(v) => mexer((k) => ({ ...k, camadas: { ...k.camadas, fonte: v } }))} />
                <CampoLongo label="Contexto da queda" max={140} value={c.camadas.contexto} onChange={(v) => mexer((k) => ({ ...k, camadas: { ...k.camadas, contexto: v } }))} />
              </>,
            )}

            {bloco(
              "reacoes",
              <>
                <p className="text-[12px] text-unooria-neutral-600">
                  Os mesmos três moradores, conforme a escala que o estudante publicou: o eixo em 0% e o eixo em 80%.
                </p>
                {(["zero", "oitenta"] as const).map((ramo) => (
                  <div key={ramo} className="flex flex-col gap-3">
                    <span className="text-[13px] font-semibold text-unooria-neutral-800">
                      {ramo === "zero" ? "Quem publicou com o eixo em 0%" : "Quem publicou com o eixo em 80%"}
                    </span>
                    {c.reacoes[ramo].map((fala, i) => (
                      <Fala
                        key={i}
                        titulo={`Morador ${i + 1}`}
                        fala={fala}
                        onChange={(nova) => mexer((k) => ({ ...k, reacoes: { ...k.reacoes, [ramo]: k.reacoes[ramo].map((x, j) => (j === i ? nova : x)) } }))}
                      />
                    ))}
                  </div>
                ))}
              </>,
            )}

            {bloco(
              "posAha",
              <>
                <Fala titulo="O morador confuso com os dois gráficos" fala={c.posAha.conflito} onChange={(nova) => mexer((k) => ({ ...k, posAha: { ...k.posAha, conflito: nova } }))} />
                <Fala titulo="O coordenador do grupo" fala={c.posAha.coordenador} onChange={(nova) => mexer((k) => ({ ...k, posAha: { ...k.posAha, coordenador: nova } }))} />
              </>,
            )}
          </div>
        </div>

        {erro ? <ErroDaApi erro={erro} titulo="O que a plataforma recusou no pacote" /> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" isDisabled={ocupado} onClick={recomecar} data-acao="recomecar-preparo">
            Refazer o recorte
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Icon name="verified" size={18} />}
            isDisabled={ocupado}
            isLoading={homologando}
            onClick={homologar}
            data-acao="homologar-conteudo"
          >
            Homologar Pacote de Conteúdo
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Campo({ label, max, value, onChange }: { label: string; max: number; value: string; onChange: (v: string) => void }) {
  return (
    <TextField
      label={`${label} (até ${max} caracteres)`}
      maxLength={max}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}

function CampoLongo({ label, max, value, onChange }: { label: string; max: number; value: string; onChange: (v: string) => void }) {
  return (
    <TextArea
      label={`${label} (até ${max} caracteres)`}
      rows={max > 200 ? 4 : 2}
      maxLength={max}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
    />
  );
}

/** Uma fala do grupo da cidade: quem fala, como se apresenta e o que diz. */
function Fala({ titulo, fala, onChange }: { titulo: string; fala: FalaDoGrupo; onChange: (f: FalaDoGrupo) => void }) {
  return (
    <div className={quadro}>
      <span className="text-[12px] font-semibold text-unooria-neutral-600">{titulo}</span>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Nome" max={40} value={fala.autor} onChange={(v) => onChange({ ...fala, autor: v })} />
        <Campo label="Perfil" max={60} value={fala.perfil} onChange={(v) => onChange({ ...fala, perfil: v })} />
      </div>
      <CampoLongo label="Mensagem" max={240} value={fala.texto} onChange={(v) => onChange({ ...fala, texto: v })} />
    </div>
  );
}

/** E0-PROF-05: o pacote homologado, à espera do último passo do assistente ("Liberar Atividade para a Turma"). */
function Ativacao({
  gravada,
  turmaId,
  nomeDaTurma,
  avisoDaSala,
  recomecar,
}: {
  gravada: AtividadeGravada;
  turmaId: string;
  nomeDaTurma: string;
  avisoDaSala: string | null;
  recomecar: () => void;
}) {
  return (
    <Card variant="outlined">
      <div className="flex flex-col gap-3" data-fase="ativacao">
        <SectionHeader title="Pronto para Liberação em Sala" />
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
              A atividade entra em execução imediata para todos os estudantes conectados na sala. Não requer agendamento prévio.
            </p>
            {avisoDaSala ? <FeedbackAlert type="warning" description={avisoDaSala} /> : null}
            <p className="text-[13px] leading-relaxed text-unooria-neutral-600">
              {gravada.noAr
                ? "O banco padrão já está no ar e a missão foi liberada para esta turma. Continue para conferir e concluir."
                : "Pacote homologado. Continue: no último passo, Liberar Atividade para a Turma põe a atividade no ar e libera a missão na sala de aula."}
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

/**
 * Lê o preparo da turma (`GET pacotes`) e, se há um rascunho sem homologar, o
 * pacote dele inteiro (`GET pacotes/:id`). A `key` com a turma e a tentativa
 * faz cada troca ser uma leitura nova.
 */
function LerPreparo({ turmaId, aoLer }: { turmaId: string; aoLer: (lido: PreparoLido) => void }) {
  useEffect(() => {
    let vivo = true;
    void (async () => {
      let dados: PacotesDaTurmaPortaVoz | null;
      let rascunho: PacoteDoProfessor | null = null;
      try {
        const r = await fetch(bff(turmaId, ROTAS_DA_TURMA.pacotes), { cache: "no-store" });
        dados = r.ok ? ((await r.json()) as PacotesDaTurmaPortaVoz) : null;
        const pendente = dados?.pacotes.find((p) => p.aprovadoEm === null);
        if (pendente) {
          const p = await fetch(bff(turmaId, ROTAS_DA_TURMA.pacote(pendente.id)), { cache: "no-store" });
          rascunho = p.ok ? ((await p.json()) as PacoteDoProfessor) : null;
        }
      } catch {
        dados = null;
      }
      if (vivo) aoLer({ turmaId, dados, rascunho });
    })();
    return () => {
      vivo = false;
    };
  }, [turmaId, aoLer]);
  return null;
}
