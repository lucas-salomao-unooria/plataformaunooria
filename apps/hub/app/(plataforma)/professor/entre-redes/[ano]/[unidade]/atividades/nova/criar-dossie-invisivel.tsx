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
  LIMITES_DO_PROJETO,
  LIMITES_DOS_CADERNOS,
  PROJETOS,
  ROTAS_DA_TURMA,
  ROTULO_DO_ITEM,
  TEMA,
  assuntosDoTexto,
  caminhoDaTurma,
  comItemRegenerado,
  erroDaApi,
  itensModificados,
  problemasDoRecorte,
  rotuloDaDisciplina,
  type ConteudoDoPacote,
  type EmAndamento,
  type ItemDoPacote,
  type Origem,
  type PacoteDoProfessor,
  type PacotesDaTurmaDossie,
  type Projeto,
  type ProjetoId,
  type RespostaDoGerar,
  type RespostaDoHomologar,
} from "@/lib/dossie-invisivel-tipos";

/** O rascunho na curadoria: o pacote do servidor (`original`) e o que o professor editou na tela. */
interface Curadoria {
  pacoteId: string;
  origem: Origem;
  disciplina: string;
  tema: string;
  original: ConteudoDoPacote;
  conteudo: ConteudoDoPacote;
}

interface PreparoLido {
  turmaId: string;
  dados: PacotesDaTurmaDossie | null;
  /** O rascunho que ficou sem aprovar, inteiro (`GET pacotes/:id`), para voltar à curadoria. */
  rascunho: PacoteDoProfessor | null;
}

interface Recorte {
  disciplina: string;
  tema: string;
  assuntosTexto: string;
  contexto: string;
}

/** O pacote aprovado: a atividade PRONTA (ou já no ar, no banco padrão), à espera do último passo. */
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

/** Copy `feedback_geracao.status_gerando` e `tempo_estimado`, literais. */
const TEXTO_GERANDO = "Indexando documentos fictícios e relatórios comunitários...";
const TEMPO_ESTIMADO = "Tempo estimado: aproximadamente 20 segundos.";

const bff = (turmaId: string, rota: string) => `/api/plataforma${caminhoDaTurma(turmaId)}${rota}`;

const curadoriaDe = (p: PacoteDoProfessor): Curadoria => ({
  pacoteId: p.id,
  origem: p.origem,
  disciplina: p.disciplina,
  tema: p.tema,
  original: p.conteudo,
  conteudo: p.conteudo,
});

/**
 * NOVA ATIVIDADE de O DOSSIÊ INVISÍVEL (ADR-202; ADR-130). O PACOTE — os três
 * projetos que disputam a verba (nome, coordenação, vagas, custo, área,
 * impacto, o card da abertura e os documentos indexados) e a transcrição dos
 * cadernos — é a atividade que a turma vive. O mecanismo (a verba de R$ 12.000,
 * o volume documental de cada papel, as falas do assistente, os critérios e o
 * protocolo) é FIXO no servidor. O fluxo é o dos quadros E0-PROF-02 a 05,
 * dentro do assistente de quatro passos da plataforma (sem o das equipes: a
 * missão é individual):
 *
 * 1. **O recorte da aula** (E0-PROF-02): componente curricular, tema (≤ 60),
 *    3 a 6 assuntos (≤ 600 somados) e o contexto comunitário opcional (≤ 120).
 *    "Usar banco padrão" é o caminho curto: `POST pacotes/padrao` põe o banco
 *    curado (já homologado) no ar, e a missão é liberada na sala no mesmo toque.
 * 2. **A geração** (E0-PROF-03): a IA do professor, antes da aula (quota do
 *    professor). Sem saldo ou com o vendor fora, a api devolve `usouIa: false`
 *    e a tela diz por quê, com "Prosseguir com Banco Padrão". O rascunho do
 *    banco curado que a api gravou NÃO entra na curadoria: aprová-lo seria
 *    dizer que a IA o escreveu.
 * 3. **Conferência e Curadoria do Pacote de Conteúdo** (E0-PROF-04): os três
 *    projetos e os cadernos editáveis, com "Regenerar item pontual" por item
 *    (troca SÓ aquele e guarda o que foi editado nos outros) e a etiqueta
 *    "Modificado pelo docente". "Aprovar Pacote" manda o conteúdo editado; a
 *    régua da api (que preserva a virada) devolve TODAS as frases de uma vez.
 * 4. **Pôr Atividade no Ar** (E0-PROF-05): o último passo do assistente,
 *    "Liberar para a Turma", põe no ar e LIBERA na sala (`concluirCriacao`).
 *    Não há agendamento nem código de entrada: a liberação é por turma, na hora.
 */
export function CriarDossieInvisivel({
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
  const [aprovando, setAprovando] = useState(false);
  const [regenerando, setRegenerando] = useState<ItemDoPacote | null>(null);
  const [semIa, setSemIa] = useState<"sem-saldo" | "indisponivel" | null>(null);
  const [erro, setErro] = useState<Erro | null>(null);
  const [errosDaAprovacao, setErrosDaAprovacao] = useState<Erro | null>(null);
  const [avisoDoItem, setAvisoDoItem] = useState<{ item: ItemDoPacote; texto: string; tipo: "warning" | "error" } | null>(null);
  const [avisoDaSala, setAvisoDaSala] = useState<string | null>(null);
  /* A geração pode ser cancelada ("Cancelar Geração"): o pedido é abortado no BFF. */
  const geracao = useRef<AbortController | null>(null);

  if (preparo !== preparoVisto) {
    setPreparoVisto(preparo);
    /* Um rascunho da IA que ficou sem aprovar volta à curadoria. */
    const rascunho = preparo?.rascunho ?? null;
    if (rascunho && rascunho.origem === "ia" && !curadoria && !gravada) {
      setCuradoria(curadoriaDe(rascunho));
    }
  }

  const assuntos = assuntosDoTexto(recorte.assuntosTexto);
  const problemas = problemasDoRecorte({ ...recorte, assuntos });
  const ocupado = gerando || usandoPadrao || aprovando || regenerando !== null;

  function trocar(campo: keyof Recorte, valor: string) {
    setRecorte((atual) => ({ ...atual, [campo]: valor }));
  }

  function mexer(f: (c: ConteudoDoPacote) => ConteudoDoPacote) {
    setCuradoria((atual) => (atual ? { ...atual, conteudo: f(atual.conteudo) } : atual));
    setErrosDaAprovacao(null);
  }

  function cancelarGeracao() {
    geracao.current?.abort();
  }

  async function usarPadrao(turmaId: string, dados: PacotesDaTurmaDossie) {
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
      /* O banco padrão já está no ar; a missão abre na sala no mesmo toque (ADR-146). */
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
    setErrosDaAprovacao(null);
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
        setErro(erroDaApi(corpo, "Não deu para gerar o pacote agora. O banco padrão continua disponível."));
        return;
      }
      const resposta = corpo as RespostaDoGerar;
      if (!resposta.usouIa) {
        /* E0-PROF-03 sem saldo / instabilidade: o caminho é o banco padrão, pelo botão da contingência. */
        setCuradoria(null);
        setSemIa(resposta.motivo ?? "indisponivel");
        return;
      }
      setCuradoria(curadoriaDe(resposta.pacote));
    } catch {
      /* Cancelado pelo professor: volta ao recorte, sem erro na tela. */
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
              ? "Cota de processamento temporariamente indisponível. O item ficou como estava: edite o texto na tela, se quiser."
              : "Instabilidade no provedor de inteligência artificial. O item ficou como estava: tente de novo ou edite o texto na tela.",
        });
        return;
      }
      setCuradoria((atual) =>
        atual
          ? {
              ...atual,
              original: comItemRegenerado(atual.original, resposta.pacote.conteudo, item),
              conteudo: comItemRegenerado(atual.conteudo, resposta.pacote.conteudo, item),
            }
          : atual,
      );
      setErrosDaAprovacao(null);
    } catch {
      setAvisoDoItem({ item, tipo: "error", texto: SEM_REDE });
    } finally {
      setRegenerando(null);
    }
  }

  async function aprovar(turmaId: string) {
    if (!curadoria) return;
    setAprovando(true);
    setErrosDaAprovacao(null);
    try {
      const r = await fetch(bff(turmaId, ROTAS_DA_TURMA.homologar(curadoria.pacoteId)), {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ conteudo: curadoria.conteudo }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErrosDaAprovacao(erroDaApi(corpo, "Não deu para aprovar o pacote agora."));
        return;
      }
      const { pacote } = corpo as RespostaDoHomologar;
      setGravada({ turmaId, id: pacote.id, disciplina: rotuloDaDisciplina(pacote.disciplina), tema: pacote.tema, noAr: false });
    } catch {
      setErrosDaAprovacao({ mensagem: SEM_REDE, erros: [] });
    } finally {
      setAprovando(false);
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
    geracao.current?.abort();
    setGravada(null);
    setCuradoria(null);
    setSemIa(null);
    setErro(null);
    setErrosDaAprovacao(null);
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
      rotuloDoCriar={(porNoAr) => (porNoAr ? "Liberar para a Turma" : "Criar atividade")}
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
                aprovando={aprovando}
                regenerando={regenerando}
                avisoDoItem={avisoDoItem}
                erro={errosDaAprovacao}
                regenerar={(item) => void regenerar(turmaId, item)}
                aprovar={() => void aprovar(turmaId)}
                recomecar={recomecar}
              />
            ) : gerando ? (
              /* E0-PROF-03 "gerando": a espera no lugar do formulário, com o cancelamento. */
              <Card variant="elevated">
                <div className="flex flex-col gap-3" role="status" data-gerando>
                  <SectionHeader title="Processando Parametrização da Aula" />
                  <ProgressBar indeterminate aria-label={TEXTO_GERANDO} valuePosition="none" />
                  <p className="text-[14px] leading-snug text-unooria-neutral-800">{TEXTO_GERANDO}</p>
                  <p className="text-[13px] text-unooria-neutral-600">{TEMPO_ESTIMADO}</p>
                  <div>
                    <Button variant="outline" size="sm" onClick={cancelarGeracao} data-acao="cancelar-geracao">
                      Cancelar Geração
                    </Button>
                  </div>
                </div>
              </Card>
            ) : semIa ? (
              /* E0-PROF-03 "429 sem saldo" e "503 falha". */
              <Card variant="elevated">
                <div className="flex flex-col items-start gap-3" data-contingencia={semIa}>
                  <SectionHeader title="Processando Parametrização da Aula" />
                  <FeedbackAlert type="warning" description={AVISO_SEM_IA[semIa]} />
                  <div className="flex flex-wrap gap-3">
                    {semIa === "indisponivel" ? (
                      <Button variant="primary" size="md" isDisabled={ocupado} onClick={() => void gerar(turmaId)} data-acao="tentar-de-novo">
                        Tentar gerar novamente
                      </Button>
                    ) : null}
                    <Button
                      variant={semIa === "indisponivel" ? "outline" : "primary"}
                      size="md"
                      isDisabled={ocupado}
                      isLoading={usandoPadrao}
                      onClick={() => void usarPadrao(turmaId, dados)}
                      data-acao="carregar-padrao"
                    >
                      {semIa === "sem-saldo" ? "Prosseguir com Banco Padrão" : "Usar banco padrão"}
                    </Button>
                  </div>
                  {erro ? <ErroDaApi erro={erro} /> : null}
                </div>
              </Card>
            ) : (
              <RecorteDaAula
                dados={dados}
                recorte={recorte}
                assuntos={assuntos}
                problemas={problemas}
                ocupado={ocupado}
                usandoPadrao={usandoPadrao}
                erro={erro}
                trocar={trocar}
                usarPadrao={() => void usarPadrao(turmaId, dados)}
                gerar={() => void gerar(turmaId)}
              />
            )}
          </section>
        );
      }}
    />
  );
}

/** E0-PROF-02: o banco curado padrão em destaque e o recorte da aula para a IA. */
function RecorteDaAula({
  dados,
  recorte,
  assuntos,
  problemas,
  ocupado,
  usandoPadrao,
  erro,
  trocar,
  usarPadrao,
  gerar,
}: {
  dados: PacotesDaTurmaDossie;
  recorte: Recorte;
  assuntos: string[];
  problemas: string[];
  ocupado: boolean;
  usandoPadrao: boolean;
  erro: Erro | null;
  trocar: (campo: keyof Recorte, valor: string) => void;
  usarPadrao: () => void;
  gerar: () => void;
}) {
  const nomes = PROJETOS.map((p) => dados.padrao.conteudo.projetos[p].nome).join(", ");
  return (
    <>
      <Card variant="elevated">
        <div className="flex flex-col gap-3" data-caminho-curto>
          <SectionHeader
            title="Banco Curado Padrão"
            description={`${dados.padrao.tema} (${nomes}). Já homologado: a atividade entra no ar e a missão é liberada para a turma.`}
          />
          <div>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="bolt" size={18} />}
              isDisabled={ocupado}
              isLoading={usandoPadrao}
              onClick={usarPadrao}
              data-acao="usar-padrao"
            >
              Usar banco padrão
            </Button>
          </div>
        </div>
      </Card>

      <Card variant="elevated">
        <div className="flex flex-col gap-4" data-recorte-da-aula>
          <SectionHeader
            title="Parametrização da Atividade — O Dossiê Invisível"
            description="Ou prepare um pacote com o tema da sua aula: a IA escreve os três projetos e os cadernos, e você confere tudo antes de liberar."
          />
          <div className="flex flex-col gap-4">
            <Selection
              label="Componente Curricular da BNCC"
              helperText="Selecione o componente para contextualizar os projetos fictícios gerados."
              placeholder="Selecione"
              value={recorte.disciplina || undefined}
              showOptionCheckbox={false}
              options={dados.disciplinas.map((d) => ({ value: d.slug, label: d.rotulo }))}
              onChange={(valor) => trocar("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : String(valor))}
            />
            <TextField
              label="Tema ou Recorte Social da Aula"
              placeholder="Ex.: Acesso à literatura e combate à desinformação periférica"
              helperText={`Máximo de ${TEMA.max} caracteres.`}
              value={recorte.tema}
              maxLength={TEMA.max}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("tema", e.target.value)}
            />
            <TextArea
              label="Assuntos e Conceitos Específicos"
              placeholder="Ex.: Bibliotecas comunitárias, inclusão digital, fake news, mediação"
              helperText={`Insira de ${ASSUNTOS.min} a ${ASSUNTOS.max} termos para orientar o vocabulário das propostas. · ${assuntos.length} ${assuntos.length === 1 ? "termo" : "termos"} · ${assuntos.join("").length}/${ASSUNTOS.total} caracteres`}
              rows={3}
              value={recorte.assuntosTexto}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocar("assuntosTexto", e.target.value)}
            />
            <TextField
              label="Contexto Comunitário (Opcional)"
              placeholder="Ex.: Bairro periférico com desigualdade de conectividade"
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
              onClick={gerar}
              data-acao="gerar-conteudo"
            >
              Gerar com IA
            </Button>
          </div>
          {problemas.length > 0 && (recorte.tema || recorte.assuntosTexto || recorte.disciplina) ? (
            <p className="text-[12px] leading-snug text-unooria-neutral-600" role="status">
              {`Para gerar o pacote: ${problemas.join(" ")}`}
            </p>
          ) : null}
          {erro ? <ErroDaApi erro={erro} /> : null}
        </div>
      </Card>
    </>
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

const quadro = "flex flex-col gap-3 rounded-lg border border-unooria-neutral-200 p-3";

type Mexer = (f: (c: ConteudoDoPacote) => ConteudoDoPacote) => void;

/**
 * E0-PROF-04: os três projetos e os cadernos, editáveis inline, um cartão por
 * item — cada cartão com o seu "Regenerar item pontual" e, quando o professor
 * mexeu, a etiqueta "Modificado pelo docente". O volume de documentos de cada
 * projeto é fixo (1, 7 e 12): edita-se o texto de cada um, não a quantidade.
 */
function CuradoriaDoPacote({
  curadoria,
  mexer,
  ocupado,
  aprovando,
  regenerando,
  avisoDoItem,
  erro,
  regenerar,
  aprovar,
  recomecar,
}: {
  curadoria: Curadoria;
  mexer: Mexer;
  ocupado: boolean;
  aprovando: boolean;
  regenerando: ItemDoPacote | null;
  avisoDoItem: { item: ItemDoPacote; texto: string; tipo: "warning" | "error" } | null;
  erro: Erro | null;
  regenerar: (item: ItemDoPacote) => void;
  aprovar: () => void;
  recomecar: () => void;
}) {
  const c = curadoria.conteudo;
  const modificados = itensModificados(curadoria.original, c);
  const bloco = (item: ItemDoPacote, filhos: React.ReactNode) => (
    <Card variant="outlined" key={item}>
      <div className="flex flex-col gap-3" data-item-do-pacote={item}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-semibold text-unooria-neutral-950">{ROTULO_DO_ITEM[item]}</h3>
            {modificados.includes(item) ? (
              <Tag variant="warning" size="sm" pill>
                Modificado pelo docente
              </Tag>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icon name="autorenew" size={16} />}
            isDisabled={ocupado}
            isLoading={regenerando === item}
            onClick={() => regenerar(item)}
            data-acao="regenerar-item"
          >
            Regenerar item pontual
          </Button>
        </div>
        {avisoDoItem?.item === item ? <FeedbackAlert type={avisoDoItem.tipo} description={avisoDoItem.texto} /> : null}
        {filhos}
      </div>
    </Card>
  );

  const mexerNoProjeto = (id: ProjetoId, f: (p: Projeto) => Projeto) =>
    mexer((k) => ({ ...k, projetos: { ...k.projetos, [id]: f(k.projetos[id]) } }));

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-5" data-curadoria>
        <SectionHeader
          title="Conferência e Curadoria do Pacote de Conteúdo"
          badge={
            <Tag variant="info" size="sm" pill>
              Gerado com IA
            </Tag>
          }
          description="Você pode editar os nomes dos projetos, dados das fichas e pareceres do assistente antes de liberar."
        />
        <p className="text-[13px] text-unooria-neutral-600">
          {`${rotuloDaDisciplina(curadoria.disciplina)} · “${curadoria.tema}”. A verba de R$ 12.000, o número de documentos de cada projeto (1, 7 e 12), os 180 registros dos cadernos e as falas do assistente são fixos em toda turma.`}
        </p>

        <div className="grid gap-4 xl:grid-cols-3">
          {PROJETOS.map((id) =>
            bloco(id, <FichaDoProjeto projeto={c.projetos[id]} mexer={(f) => mexerNoProjeto(id, f)} />),
          )}
        </div>

        {bloco(
          "cadernos",
          <>
            <Campo
              label="Nome do arquivo (.dat, sem espaços)"
              max={LIMITES_DO_PROJETO.arquivo}
              value={c.cadernos.arquivo}
              onChange={(v) => mexer((k) => ({ ...k, cadernos: { ...k.cadernos, arquivo: v } }))}
            />
            {c.cadernos.amostras.map((amostra, i) => (
              <CampoLongo
                key={i}
                label={`Amostra do caderno ${i + 1}`}
                max={LIMITES_DOS_CADERNOS.amostra}
                value={amostra}
                onChange={(v) => mexer((k) => ({ ...k, cadernos: { ...k.cadernos, amostras: k.cadernos.amostras.map((x, j) => (j === i ? v : x)) } }))}
              />
            ))}
            <CampoLongo
              label="Resumo da leitura óptica"
              max={LIMITES_DOS_CADERNOS.resumo}
              value={c.cadernos.resumo}
              onChange={(v) => mexer((k) => ({ ...k, cadernos: { ...k.cadernos, resumo: v } }))}
            />
          </>,
        )}

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
            isLoading={aprovando}
            onClick={aprovar}
            data-acao="aprovar-pacote"
          >
            Aprovar Pacote
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** A ficha de um projeto: os campos do card e os documentos indexados (só o texto de cada um). */
function FichaDoProjeto({ projeto, mexer }: { projeto: Projeto; mexer: (f: (p: Projeto) => Projeto) => void }) {
  const L = LIMITES_DO_PROJETO;
  return (
    <>
      <Campo label="Nome do projeto" max={L.nome} value={projeto.nome} onChange={(v) => mexer((p) => ({ ...p, nome: v }))} />
      <Campo label="Coordenação" max={L.coordenador} value={projeto.coordenador} onChange={(v) => mexer((p) => ({ ...p, coordenador: v }))} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Numero label="Idade" faixa={L.idade} value={projeto.idade} onChange={(n) => mexer((p) => ({ ...p, idade: n }))} />
        <Numero label="Vagas" faixa={L.vagas} value={projeto.vagas} onChange={(n) => mexer((p) => ({ ...p, vagas: n }))} />
        <Numero label="R$ por vaga" faixa={L.custoPorVaga} value={projeto.custoPorVaga} onChange={(n) => mexer((p) => ({ ...p, custoPorVaga: n }))} />
      </div>
      <CampoLongo label="Card da abertura" max={L.card} value={projeto.card} onChange={(v) => mexer((p) => ({ ...p, card: v }))} />
      <Campo label="Área de atuação" max={L.area} value={projeto.area} onChange={(v) => mexer((p) => ({ ...p, area: v }))} />
      <CampoLongo label="Impacto no repositório digital" max={L.impacto} value={projeto.impacto} onChange={(v) => mexer((p) => ({ ...p, impacto: v }))} />
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold text-unooria-neutral-600">
          {`${projeto.documentos.length} ${projeto.documentos.length === 1 ? "documento indexado" : "documentos indexados"}`}
        </span>
        {projeto.documentos.map((d, i) => (
          <div key={i} className={quadro}>
            <Campo
              label={`Arquivo ${i + 1} (.pdf, sem espaços)`}
              max={L.arquivo}
              value={d.arquivo}
              onChange={(v) => mexer((p) => ({ ...p, documentos: p.documentos.map((x, j) => (j === i ? { ...x, arquivo: v } : x)) }))}
            />
            <CampoLongo
              label="Resumo"
              max={L.resumoDoDocumento}
              value={d.resumo}
              onChange={(v) => mexer((p) => ({ ...p, documentos: p.documentos.map((x, j) => (j === i ? { ...x, resumo: v } : x)) }))}
            />
          </div>
        ))}
      </div>
    </>
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
      rows={2}
      maxLength={max}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
    />
  );
}

/** Um número inteiro com a faixa do Zod da api; fora da faixa a régua recusa no "Aprovar Pacote". */
function Numero({
  label,
  faixa,
  value,
  onChange,
}: {
  label: string;
  faixa: { min: number; max: number };
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <TextField
      label={label}
      helperText={`De ${faixa.min} a ${faixa.max}.`}
      type="number"
      inputMode="numeric"
      min={faixa.min}
      max={faixa.max}
      step={1}
      value={Number.isFinite(value) ? String(value) : ""}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Math.trunc(Number(e.target.value)))}
    />
  );
}

/** E0-PROF-05: o pacote aprovado, à espera do último passo do assistente ("Liberar para a Turma"). */
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
        <SectionHeader title="Pôr Atividade no Ar" />
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
              A liberação ocorre em tempo real durante a aula para os estudantes conectados.
            </p>
            {avisoDaSala ? <FeedbackAlert type="warning" description={avisoDaSala} /> : null}
            <p className="text-[13px] leading-relaxed text-unooria-neutral-600">
              {gravada.noAr
                ? "Missão Ativa — Sessões Liberadas para Conselheiros. O banco padrão já está no ar e a missão foi liberada para esta turma. Continue para conferir e concluir."
                : "Pacote aprovado. Continue: no último passo, Liberar para a Turma põe a atividade no ar e libera a missão na sala de aula."}
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
 * Lê o preparo da turma (`GET pacotes`) e, se há um rascunho sem aprovar, o
 * pacote dele inteiro (`GET pacotes/:id`). A `key` com a turma e a tentativa
 * faz cada troca ser uma leitura nova.
 */
function LerPreparo({ turmaId, aoLer }: { turmaId: string; aoLer: (lido: PreparoLido) => void }) {
  useEffect(() => {
    let vivo = true;
    void (async () => {
      let dados: PacotesDaTurmaDossie | null;
      let rascunho: PacoteDoProfessor | null = null;
      try {
        const r = await fetch(bff(turmaId, ROTAS_DA_TURMA.pacotes), { cache: "no-store" });
        dados = r.ok ? ((await r.json()) as PacotesDaTurmaDossie) : null;
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
