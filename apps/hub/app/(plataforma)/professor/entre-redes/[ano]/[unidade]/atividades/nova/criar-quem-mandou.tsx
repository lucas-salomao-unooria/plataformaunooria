"use client";

import { useEffect, useState } from "react";

import { dataHora } from "@edu/sdk";
import {
  Button,
  Card,
  EmptyState,
  FeedbackAlert,
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
import { falasParaHomologar, type FalasEscritas } from "@/lib/podcast-tipos";
import { EscreverAoChegar, FalasDoPodcast, falasComProblema, pedirFalasDoTema } from "./falas-do-podcast";
import {
  RECORTE_VAZIO,
  TETOS,
  TOTAL_DE_MENSAGENS,
  assuntosDoTexto,
  conferirAssuntos,
  conferirContexto,
  conferirTema,
  corpoDaAprovacao,
  distribuirErros,
  erroDaApi,
  limparTexto,
  mensagensEmOrdem,
  recorteDaAula,
  recorteDoPacote,
  trocarCampo,
  type ErrosDaAprovacao,
  type RecorteEmEdicao,
} from "@/lib/quem-mandou-regras";
import {
  AVISO_SEM_IA,
  type MensagemDoPacote,
  type MotivoSemIa,
  type Origem,
  type PacoteDaTurma,
  type PacoteDoProfessor,
  type RespostaDaGeracao,
} from "@/lib/quem-mandou-tipos";

import { MatrizDoPacote } from "../../resultados/matriz-do-pacote-quem-mandou";

/** O que está na curadoria agora, e de onde veio. */
interface Curadoria {
  origem: Origem;
  mensagens: MensagemDoPacote[];
  /** `rascunho` = o último gerado para a turma (a geração é gravada); `ia`/`padrao` = desta visita. */
  de: "rascunho" | "ia" | "padrao";
  em: string | null;
}

/**
 * O preparo da turma como a api o devolveu — `dados: null` é a leitura que
 * falhou (a turma que não é do professor responde 404). É por turma: o
 * `rascunho` é o da turma, e o assistente deixa voltar e trocar de turma.
 */
interface PreparoLido {
  turmaId: string;
  dados: PacoteDaTurma | null;
}

const SEM_ERROS: ErrosDaAprovacao = { tema: [], assuntos: [], contexto: [], porMensagem: {}, geral: [] };
const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";

/** As duas frases de progresso da geração (`e0.professor.gerando_status_1/2`), alternadas a cada 2 s. */
const STATUS_DA_GERACAO = [
  "Verificando equilíbrio da matriz 2x2 de tom e veracidade...",
  "Ajustando legendas e previews de links escolares...",
];

const caminhoDaTurma = (turmaId: string) => `/api/plataforma/quem-mandou-isso/turmas/${encodeURIComponent(turmaId)}`;

/**
 * NOVA ATIVIDADE de QUEM MANDOU ISSO? (ADR-130): o preparo do pacote virou o
 * passo de conteúdo da criação. A missão é o esqueleto (o grupo da turma, a
 * Nina, o Mural); o PACOTE — o recorte da aula e as oito mensagens da matriz
 * 2x2 — é a atividade que a turma vive de fato, e nasce do professor: gerado
 * com IA sobre o boato que ele escreveu, ou a partir do pacote curado da
 * Unooria ("O Mistério do Passeio ao Museu"), que ele lê e edita.
 *
 * ────────────────────────────────────────────────────────────────────────
 * A EXIGÊNCIA QUE ESTE COMPONENTE CUMPRE: **nada chega à turma sem o clique em
 * "Criar atividade"** — e nem esse clique põe no ar. `POST /gerar` grava um
 * RASCUNHO (um por turma, o preparo custou saldo de IA e um F5 não pode jogá-lo
 * fora); o que vira atividade é o `POST /aprovar` que o `criar` faz, com o
 * pacote INTEIRO como a professora o deixou, e ele nasce PRONTO. O último passo
 * do assistente pergunta se ele já entra em andamento.
 *
 * Por isso aqui não há "Aprovar Pacote", nem a janela de "aprovar um pacote
 * novo volta a aula ao começo": aprovar deixou de mexer na aula que está
 * rodando. O pacote que a turma usa, a liberação na sala e "Ver as 8
 * mensagens" moram na página da atividade (`resultados?pacote=`).
 *
 * O que ela edita é TEXTO: remetente, balão e a legenda da imagem ou do link. O
 * gabarito (`veracidade`, `tom`) e o formato de cada posição não têm campo, de
 * propósito: são do molde sorteado no servidor e sustentam a matriz equilibrada
 * — trocar um deles quebraria as duas por quadrante, e a api recusaria.
 *
 * O PREPARO É DA TURMA: o passo de conteúdo recebe a turma do assistente e lê
 * `GET .../pacote` dela — as disciplinas, o pacote curado e o rascunho que
 * ficou da última geração, que volta à curadoria se ela ainda está vazia. O que
 * a professora já escreveu NÃO é trocado ao mudar de turma: é dela, e o texto
 * do pacote não depende da turma.
 */
export function CriarQuemMandou({
  turmas,
  turmaInicial,
  rotaDaMissao,
}: {
  turmas: TurmaDoAssistente[];
  turmaInicial: string;
  rotaDaMissao: string;
}) {
  const [preparo, setPreparo] = useState<PreparoLido | null>(null);
  /* O ajuste de estado durante o render que o React recomenda para dado que
     muda: a cada preparo lido, o rascunho da turma volta à curadoria — mas só
     se ela está vazia. */
  const [preparoVisto, setPreparoVisto] = useState<PreparoLido | null>(null);
  const [recorte, setRecorte] = useState<RecorteEmEdicao>(RECORTE_VAZIO);
  const [curadoria, setCuradoria] = useState<Curadoria | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [tentou, setTentou] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [statusDaGeracao, setStatusDaGeracao] = useState(0);
  const [semIa, setSemIa] = useState<MotivoSemIa | null>(null);
  const [errosDaApi, setErrosDaApi] = useState<ErrosDaAprovacao>(SEM_ERROS);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /* As falas do podcast que contam ESTE pacote (ADR-150): o professor as revisa
     na curadoria, e elas vão no "Criar". `falasDoPacote` é o pacote para o qual
     foram escritas — mudou o pacote, a tela avisa, sem bloquear. */
  const [falas, setFalas] = useState<FalasEscritas | null>(null);
  const [escrevendoFalas, setEscrevendoFalas] = useState(false);
  const [falhaDasFalas, setFalhaDasFalas] = useState<string | null>(null);
  const [falasDoPacote, setFalasDoPacote] = useState("");

  if (preparo !== preparoVisto) {
    setPreparoVisto(preparo);
    const rascunho = preparo?.dados?.rascunho ?? null;
    if (rascunho && !curadoria) {
      setRecorte(recorteDoPacote(rascunho));
      setCuradoria({ origem: rascunho.origem, mensagens: rascunho.mensagens, de: "rascunho", em: rascunho.atualizadoEm });
    }
  }

  useEffect(() => {
    if (!gerando) return;
    const id = setInterval(() => setStatusDaGeracao((i) => (i + 1) % STATUS_DA_GERACAO.length), 2_000);
    return () => clearInterval(id);
  }, [gerando]);

  const tema = conferirTema(recorte.tema);
  const assuntos = assuntosDoTexto(recorte.assuntosTexto);
  const erroDosAssuntos = conferirAssuntos(assuntos);
  const erroDoContexto = conferirContexto(recorte.contexto);
  /* Com o pacote na curadoria, o recorte já vai ser gravado: as marcas
     aparecem sem esperar um clique, senão o "Continuar" apagado não diria por quê. */
  const cobrar = tentou || curadoria !== null;
  const erroDaDisciplina = cobrar && !recorte.disciplina ? "Selecione o componente curricular." : undefined;
  const erroDoTema =
    tema.erro ??
    (cobrar && tema.caracteres === 0 ? "Escreva o tema." : null) ??
    (errosDaApi.tema.length > 0 ? errosDaApi.tema.join(" ") : null);
  const temaNaFala = limparTexto(recorte.tema).replace(/[\s.!?;:,…]+$/u, "") || "…";
  const recorteEmOrdem =
    Boolean(recorte.disciplina) && tema.caracteres > 0 && !tema.erro && !erroDosAssuntos && !erroDoContexto;
  const emOrdem = curadoria ? mensagensEmOrdem(curadoria.mensagens) : 0;
  const problemasDasFalas = falasComProblema(falas);
  const pronto =
    curadoria !== null &&
    recorteEmOrdem &&
    emOrdem === TOTAL_DE_MENSAGENS &&
    falas !== null &&
    problemasDasFalas === 0 &&
    !escrevendoFalas;

  /* O que falta para o "Continuar" acender, em frases — o botão apagado sozinho não explica nada. */
  const pendencias = curadoria
    ? [
        !recorte.disciplina ? "o componente curricular" : null,
        tema.caracteres === 0 || tema.erro ? "o tema do boato" : null,
        erroDosAssuntos ? "os fatos balizadores" : null,
        erroDoContexto ? "o contexto local" : null,
        emOrdem < TOTAL_DE_MENSAGENS
          ? `${TOTAL_DE_MENSAGENS - emOrdem} ${TOTAL_DE_MENSAGENS - emOrdem === 1 ? "mensagem" : "mensagens"} da matriz`
          : null,
        !escrevendoFalas && (falas === null || problemasDasFalas > 0) ? "as falas do podcast" : null,
      ].filter((p): p is string => p !== null)
    : [];

  /** O pacote como a api do podcast o lê: o tema e as oito mensagens. */
  function pacoteDoPodcast(mensagens: Curadoria["mensagens"]) {
    return { tema: limparTexto(recorte.tema) || "o boato da turma", mensagens };
  }

  /** Pede as falas do podcast para o pacote — o curado volta com as do sheet, sem IA. */
  async function escreverFalas(turmaId: string, mensagens: Curadoria["mensagens"]) {
    const pacote = pacoteDoPodcast(mensagens);
    setEscrevendoFalas(true);
    setFalhaDasFalas(null);
    const r = await pedirFalasDoTema("exp05ef1b", turmaId, pacote);
    if (r.ok) {
      setFalas(r.falas);
      setFalasDoPacote(JSON.stringify(pacote.mensagens));
    } else {
      setFalhaDasFalas(r.mensagem);
    }
    setEscrevendoFalas(false);
  }

  function trocarRecorte(campo: keyof RecorteEmEdicao, valor: string) {
    setRecorte((atual) => ({ ...atual, [campo]: valor }));
    if (campo === "tema" || campo === "assuntosTexto" || campo === "contexto") {
      const chave = campo === "assuntosTexto" ? "assuntos" : campo;
      setErrosDaApi((atual) => ({ ...atual, [chave]: [] }));
    }
  }

  async function gerar(turmaId: string) {
    setTentou(true);
    if (!recorteEmOrdem) return;
    setGerando(true);
    setStatusDaGeracao(0);
    setErro(null);
    setAviso(null);
    setSemIa(null);
    setErrosDaApi(SEM_ERROS);
    try {
      const r = await fetch(`${caminhoDaTurma(turmaId)}/gerar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(recorteDaAula(recorte)),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { mensagem, erros } = erroDaApi(corpo, "Não deu para gerar agora. O pacote curado continua disponível.");
        setErrosDaApi(distribuirErros(erros));
        setErro(mensagem);
        return;
      }
      const resposta = corpo as RespostaDaGeracao;
      /* O recorte VOLTA do rascunho: sem IA, a api devolve o banco curado com o
         tema e os fatos DELE, e gravar o texto do museu com o tema digitado
         faria a Nina falar de uma coisa e o grupo de outra. */
      setRecorte(recorteDoPacote(resposta.rascunho));
      setCuradoria({
        origem: resposta.rascunho.origem,
        mensagens: resposta.rascunho.mensagens,
        de: resposta.usouIa ? "ia" : "padrao",
        em: resposta.rascunho.atualizadoEm,
      });
      setSemIa(resposta.usouIa ? null : (resposta.motivo ?? "indisponivel"));
      if (resposta.usouIa) {
        setAviso("Pacote gerado. Leia as 8 mensagens e edite o que quiser — nada vai à turma sem o seu clique.");
      }
    } catch {
      setErro(SEM_REDE);
    } finally {
      setGerando(false);
    }
  }

  function usarPadrao(padrao: PacoteDaTurma["padrao"]) {
    setErro(null);
    setSemIa(null);
    setErrosDaApi(SEM_ERROS);
    setRecorte((atual) => ({ ...recorteDoPacote(padrao, atual.disciplina), contexto: "" }));
    setCuradoria({ origem: "padrao", mensagens: padrao.mensagens.map((m) => ({ ...m })), de: "padrao", em: null });
    setAviso(`Pacote curado “${padrao.nome}” carregado. Leia e edite o que quiser antes de criar a atividade.`);
  }

  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (!curadoria) return { ok: false, mensagem: "Monte o pacote de mensagens no passo Conteúdo.", erros: [] };
    setErrosDaApi(SEM_ERROS);
    const r = await fetch(`${caminhoDaTurma(turmaId)}/aprovar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...corpoDaAprovacao(recorte, curadoria.origem, curadoria.mensagens),
        podcast: falasParaHomologar(falas?.vagas ?? []),
      }),
    });
    const corpo: unknown = await r.json().catch(() => null);
    if (!r.ok) {
      /* `pacote-invalido` traz TODAS as frases: elas voltam ao passo Conteúdo,
         cada uma perto do campo dela, e a revisão as lista também. */
      const { mensagem, erros } = erroDaApi(corpo, "Não deu para criar a atividade agora.");
      setErrosDaApi(distribuirErros(erros));
      return {
        ok: false,
        mensagem: erros.length > 0 ? `${mensagem} Volte ao passo Conteúdo para ver os campos marcados.` : mensagem,
        erros,
      };
    }
    return { ok: true, id: (corpo as PacoteDoProfessor).id };
  }

  const nomeDaDisciplina = (dados: PacoteDaTurma | null | undefined) =>
    dados?.disciplinas.find((d) => d.slug === recorte.disciplina)?.rotulo ?? null;

  return (
    <AssistenteDeAtividade
      expId="exp05ef1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={pronto}
      resumoDoConteudo={
        curadoria
          ? [`“${limparTexto(recorte.tema)}”`, nomeDaDisciplina(preparo?.dados), `${TOTAL_DE_MENSAGENS} mensagens`]
              .filter(Boolean)
              .join(" · ")
          : null
      }
      criar={criar}
      conteudo={(turmaId) => {
        /* `undefined` = lendo; `null` = a leitura falhou. */
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
                  <Button variant="secondary" size="sm" onClick={() => {
                      setPreparo(null);
                      setTentativa((n) => n + 1);
                    }}>
                    Tentar de novo
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Card variant="elevated">
                  <div className="flex flex-col gap-4">
                    <SectionHeader
                      title="Recorte da Aula — Parametrização Temática"
                      description="Defina o tema do boato escolar que servirá de base para a triagem dos estudantes."
                    />
                    <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
                      A IA escreve as 8 mensagens do grupo sobre o boato que você der, ou você parte do pacote curado
                      da Unooria.{" "}
                      <strong>
                        Nenhum texto gerado por inteligência artificial é exibido aos estudantes sem a sua aprovação.
                      </strong>
                    </p>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Selection
                        label="Componente curricular"
                        helperText="Selecione a área de conhecimento da atividade."
                        placeholder="Selecione"
                        value={recorte.disciplina || undefined}
                        error={erroDaDisciplina}
                        showOptionCheckbox={false}
                        options={dados.disciplinas.map((d) => ({ value: d.slug, label: d.rotulo }))}
                        onChange={(valor) =>
                          trocarRecorte("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : valor)
                        }
                      />
                      <TextField
                        label="Título do boato escolar fictício"
                        placeholder="Ex.: o cancelamento do passeio ao museu"
                        value={recorte.tema}
                        maxLength={TETOS.temaMaxCaracteres}
                        helperText={`Ele completa a fala da Nina: “Rolou uma confusão sobre ${temaNaFala}.” · ${tema.caracteres}/${TETOS.temaMaxCaracteres} caracteres · ${tema.palavras}/${TETOS.temaMaxPalavras} palavras`}
                        error={erroDoTema ?? undefined}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarRecorte("tema", e.target.value)}
                      />
                      <TextArea
                        label="Fatos balizadores da aula (3 a 6 tópicos, um por linha)"
                        placeholder={"Ex.:\nhorário do ônibus\nautorização dos responsáveis\nvagas no museu"}
                        helperText={`Os termos que a IA usa para compor os fatos verdadeiros e as alegações falsas. Aperte Enter entre um fato e outro. · ${assuntos.length} ${assuntos.length === 1 ? "fato reconhecido" : "fatos reconhecidos"} · ${assuntos.join("").length}/${TETOS.assuntosMaxCaracteres} caracteres`}
                        rows={4}
                        value={recorte.assuntosTexto}
                        error={
                          (cobrar || recorte.assuntosTexto.trim() ? erroDosAssuntos : null) ??
                          (errosDaApi.assuntos.length > 0 ? errosDaApi.assuntos.join(" ") : undefined)
                        }
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          trocarRecorte("assuntosTexto", e.target.value)
                        }
                      />
                      {/* O que a plataforma entendeu, um por linha: quem escreveu os
                          três temas numa linha só vê UM item aqui, e sabe na hora
                          por que o Continuar não anda. */}
                      {assuntos.length > 0 ? (
                        <div className="flex flex-col gap-1 text-[12px] text-unooria-neutral-600" data-fatos-reconhecidos>
                          <span>
                            {assuntos.length === 1 ? "O fato que a plataforma reconheceu:" : "Os fatos que a plataforma reconheceu:"}
                          </span>
                          <ol className="flex list-decimal flex-col gap-0.5 pl-5">
                            {assuntos.map((assunto, i) => (
                              <li key={`${i}-${assunto}`}>{assunto}</li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                      <TextField
                        label="Contexto local da escola ou região (opcional)"
                        value={recorte.contexto}
                        maxLength={TETOS.contextoMaxCaracteres}
                        error={
                          erroDoContexto ?? (errosDaApi.contexto.length > 0 ? errosDaApi.contexto.join(" ") : undefined)
                        }
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarRecorte("contexto", e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="secondary"
                        size="md"
                        isDisabled={gerando}
                        onClick={() => usarPadrao(dados.padrao)}
                        data-acao="usar-padrao"
                      >
                        Usar Pacote Curado Padrão
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        isDisabled={gerando}
                        isLoading={gerando}
                        onClick={() => void gerar(turmaId)}
                        data-acao="gerar-pacote"
                      >
                        Gerar Atividade com IA
                      </Button>
                    </div>

                    {gerando ? (
                      <div className="flex flex-col gap-2" role="status">
                        <ProgressBar indeterminate label="Estruturando pacote de mensagens com IA..." valuePosition="none" />
                        <p className="text-[12px] text-unooria-neutral-600">{STATUS_DA_GERACAO[statusDaGeracao]}</p>
                      </div>
                    ) : null}

                    {semIa ? (
                      <FeedbackAlert
                        type="warning"
                        title={AVISO_SEM_IA[semIa].titulo}
                        description={`${AVISO_SEM_IA[semIa].descricao} O pacote curado já está na curadoria abaixo, pronto para revisar.`}
                      />
                    ) : null}
                    {aviso ? <FeedbackAlert type="success" description={aviso} /> : null}
                    {erro && !curadoria ? <FeedbackAlert type="error" description={erro} /> : null}

                    {!curadoria ? (
                      <p className="text-[12px] leading-snug text-unooria-neutral-600">
                        Gere o pacote com IA sobre o seu boato, ou use o pacote curado da Unooria. As 8 mensagens
                        aparecem abaixo para você ler e editar.
                      </p>
                    ) : null}
                  </div>
                </Card>

                {curadoria ? (
                  <Card variant="elevated">
                    <div className="flex flex-col gap-4" data-curadoria>
                      <SectionHeader
                        title="Curadoria do Pacote — Matriz 2x2"
                        badge={
                          <Tag variant={emOrdem === TOTAL_DE_MENSAGENS ? "success" : "warning"} size="sm" pill>
                            {`${emOrdem} / ${TOTAL_DE_MENSAGENS} validados`}
                          </Tag>
                        }
                        description={
                          curadoria.de === "ia"
                            ? `Gerado com IA${curadoria.em ? ` em ${dataHora(curadoria.em)}` : ""}.`
                            : curadoria.de === "rascunho"
                              ? `Rascunho ${curadoria.origem === "ia" ? "gerado com IA" : "do pacote curado"}${curadoria.em ? ` em ${dataHora(curadoria.em)}` : ""}, ainda não virou atividade.`
                              : `Pacote curado da Unooria — “${dados.padrao.nome}”.`
                        }
                      />
                      <FeedbackAlert
                        type="info"
                        description="Confira os textos das 8 mensagens. Os estudantes não verão as marcações de gabarito."
                      />

                      <MatrizDoPacote
                        mensagens={curadoria.mensagens}
                        errosDaApi={errosDaApi.porMensagem}
                        onTrocar={(id, campo, valor) => {
                          setCuradoria((atual) =>
                            atual ? { ...atual, mensagens: trocarCampo(atual.mensagens, id, campo, valor) } : atual,
                          );
                          setErrosDaApi((atual) => ({ ...atual, porMensagem: { ...atual.porMensagem, [id]: [] } }));
                        }}
                      />

                      {/* As falas do podcast, junto do pacote que elas contam (ADR-150).
                          Chegou pacote novo (rascunho, IA ou curado), elas são pedidas. */}
                      <EscreverAoChegar
                        chave={`${turmaId}|${curadoria.de}|${curadoria.origem}|${curadoria.em ?? ""}`}
                        aoChegar={() => void escreverFalas(turmaId, curadoria.mensagens)}
                      />
                      <FalasDoPodcast
                        falas={falas}
                        escrevendo={escrevendoFalas}
                        falha={falhaDasFalas}
                        desatualizadas={falas !== null && falasDoPacote !== JSON.stringify(curadoria.mensagens)}
                        travado={false}
                        aoMudar={(vagas) => setFalas((atual) => (atual ? { ...atual, vagas } : atual))}
                        aoReescrever={() => void escreverFalas(turmaId, curadoria.mensagens)}
                      />

                      {errosDaApi.geral.length > 0 ? (
                        <FeedbackAlert
                          type="error"
                          title="O que a plataforma recusou no pacote"
                          description={
                            <ul className="list-disc pl-5">
                              {errosDaApi.geral.map((frase) => (
                                <li key={frase}>{frase}</li>
                              ))}
                            </ul>
                          }
                        />
                      ) : null}
                      {erro ? <FeedbackAlert type="error" description={erro} /> : null}
                      {pendencias.length > 0 ? (
                        <p className="text-[12px] leading-snug text-unooria-danger" role="status">
                          {`Para continuar, ajuste: ${pendencias.join(", ")}. Os campos estão marcados.`}
                        </p>
                      ) : (
                        <p className="text-[12px] leading-snug text-unooria-neutral-600">
                          O pacote está pronto. Em Continuar, você monta as equipes; a atividade só é criada no último
                          passo.
                        </p>
                      )}
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

/**
 * Lê o preparo da turma (`GET .../pacote`) — nada na tela, só o efeito. É um
 * componente, e não um efeito do pai, porque quem sabe a turma é o assistente
 * (`conteudo(turmaId)`); a `key` com a turma e a tentativa faz cada troca (e o
 * "Tentar de novo") ser uma leitura nova, e a resposta de uma turma que já
 * saiu da tela não sobrescreve a da que entrou.
 */
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
