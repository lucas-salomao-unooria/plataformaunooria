"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import { dataHora } from "@edu/sdk";
import {
  Button,
  Card,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ProgressBar,
  SectionHeader,
  Selection,
  Snackbar,
  Tag,
  TextArea,
  TextField,
} from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import {
  RECORTE_VAZIO,
  TETOS,
  TOTAL_DE_MENSAGENS,
  agruparPorQuadrante,
  assuntosDoTexto,
  conferirAssuntos,
  conferirContexto,
  conferirMensagem,
  conferirTema,
  corpoDaAprovacao,
  distribuirErros,
  erroDaApi,
  limparTexto,
  mensagensEmOrdem,
  recorteDaAula,
  recorteDoPacote,
  trocarCampo,
  type CampoDaMensagem,
  type ErrosDaAprovacao,
  type MensagemNaMatriz,
  type RecorteEmEdicao,
} from "@/lib/quem-mandou-regras";
import {
  AVISO_SEM_IA,
  ROTULO_DA_LEGENDA,
  ROTULO_DA_ORIGEM,
  ROTULO_DO_TIPO,
  type MensagemDoPacote,
  type MotivoSemIa,
  type Origem,
  type PacoteDaTurma,
  type PacoteDoProfessor,
  type RespostaDaGeracao,
} from "@/lib/quem-mandou-tipos";

/** O estado da missão na SALA desta turma (ADR-69) — a segunda porta, além do pacote. */
export interface LiberacaoNaSala {
  estado: "liberada" | "encerrada" | "bloqueada";
  em: string | null;
}

/** O que está na curadoria agora, e de onde veio. */
interface Curadoria {
  origem: Origem;
  mensagens: MensagemDoPacote[];
  /** `rascunho` = voltou do servidor num F5 (a geração é gravada); `ia`/`padrao` = desta visita. */
  de: "rascunho" | "ia" | "padrao";
  em: string | null;
}

const SEM_ERROS: ErrosDaAprovacao = { tema: [], assuntos: [], contexto: [], porMensagem: {}, geral: [] };
const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";

/** As duas frases de progresso da geração (`e0.professor.gerando_status_1/2`), alternadas a cada 2 s. */
const STATUS_DA_GERACAO = [
  "Verificando equilíbrio da matriz 2x2 de tom e veracidade...",
  "Ajustando legendas e previews de links escolares...",
];

/**
 * O PREPARO da exp05ef1b (E0-PROF-02 a 05): o recorte da aula, a geração, a
 * curadoria das oito mensagens e o pacote aprovado.
 *
 * Mora na tela da aula, e não numa rota própria, pela mesma razão da exp08ef4b:
 * o preparo é POR TURMA, o seletor de turma já está no topo, e é aqui que a
 * professora volta para conduzir.
 *
 * ────────────────────────────────────────────────────────────────────────
 * A EXIGÊNCIA QUE ESTE COMPONENTE CUMPRE: **nada chega à turma sem o clique em
 * "Aprovar Pacote"** — e aqui a aprovação é a PORTA, porque a missão nasce
 * vazia (o tema entra na fala da Nina). "Gerar" produz rascunho; o que vai para
 * a turma é o `POST /aprovar`, com o pacote INTEIRO como ela o deixou.
 *
 * O que ela edita é TEXTO: remetente, balão e a legenda da imagem ou do link. O
 * gabarito (`veracidade`, `tom`) e o formato de cada posição não têm campo, de
 * propósito: são do molde sorteado no servidor e sustentam a matriz equilibrada
 * — trocar um deles quebraria as duas por quadrante, e a api recusaria.
 *
 * O que NÃO existe aqui, porque a api não tem: "Salvar Rascunho" (o rascunho é
 * gravado na geração), "Regenerar com IA" por mensagem e "Voltar ao Recorte" (o
 * recorte fica na mesma tela, acima da curadoria). Botão que não faz nada é
 * pior que botão ausente. O "Carregar Pacote Padrão" da copy também não: quando
 * não há saldo ou o serviço cai, a api JÁ devolve o banco curado como rascunho.
 *
 * O `key={turma}` de quem monta este componente NÃO é otimização: o estado
 * inteiro vive em `useState(inicial)`, e trocar de turma pela URL sem remontar
 * aprovaria o texto de uma turma na outra (foi o defeito da v1).
 */
export function PreparoQuemMandou({
  turmaId,
  inicial,
  podeConduzir,
  liberacao,
  rotaDaSala,
  rotaDaFicha,
}: {
  turmaId: string;
  inicial: PacoteDaTurma;
  /** Só o professor gera e aprova (a api recusaria o resto). */
  podeConduzir: boolean;
  /** `null` = a sala não respondeu; a tela não afirma nada sobre a liberação. */
  liberacao: LiberacaoNaSala | null;
  rotaDaSala: string;
  rotaDaFicha: string;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const idDoTituloDaConfirmacao = useId();

  /* O `router.refresh()` do painel entrega um `inicial` novo a cada mudança da
     evidência. Só o pacote APROVADO acompanha o servidor; o que está em edição
     (recorte, curadoria) é da professora e não pode ser apagado por um refresh
     que ela nem pediu. */
  const [inicialVisto, setInicialVisto] = useState(inicial);
  const [aprovadoAgora, setAprovadoAgora] = useState<PacoteDoProfessor | null>(null);
  if (inicial !== inicialVisto) {
    setInicialVisto(inicial);
    setAprovadoAgora(null);
  }
  const ativo = aprovadoAgora ?? inicial.ativo;

  const base = inicial.rascunho ?? inicial.ativo;
  const [recorte, setRecorte] = useState<RecorteEmEdicao>(() => (base ? recorteDoPacote(base) : RECORTE_VAZIO));
  const [curadoria, setCuradoria] = useState<Curadoria | null>(() =>
    inicial.rascunho
      ? {
          origem: inicial.rascunho.origem,
          mensagens: inicial.rascunho.mensagens,
          de: "rascunho",
          em: inicial.rascunho.atualizadoEm,
        }
      : null,
  );
  const [formAberto, setFormAberto] = useState(!inicial.ativo);
  const [tentou, setTentou] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [statusDaGeracao, setStatusDaGeracao] = useState(0);
  const [aprovando, setAprovando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [semIa, setSemIa] = useState<MotivoSemIa | null>(null);
  const [errosDaApi, setErrosDaApi] = useState<ErrosDaAprovacao>(SEM_ERROS);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!gerando) return;
    const id = setInterval(() => setStatusDaGeracao((i) => (i + 1) % STATUS_DA_GERACAO.length), 2_000);
    return () => clearInterval(id);
  }, [gerando]);

  const url = `/api/plataforma/quem-mandou-isso/turmas/${encodeURIComponent(turmaId)}`;

  if (!podeConduzir) {
    return <PacoteSomenteLeitura ativo={inicial.ativo} disciplinas={inicial.disciplinas} />;
  }

  const tema = conferirTema(recorte.tema);
  const assuntos = assuntosDoTexto(recorte.assuntosTexto);
  const erroDosAssuntos = conferirAssuntos(assuntos);
  const erroDoContexto = conferirContexto(recorte.contexto);
  const erroDaDisciplina = tentou && !recorte.disciplina ? "Selecione o componente curricular." : undefined;
  const erroDoTema =
    tema.erro ??
    (tentou && tema.caracteres === 0 ? "Escreva o tema." : null) ??
    (errosDaApi.tema.length > 0 ? errosDaApi.tema.join(" ") : null);
  const temaNaFala = limparTexto(recorte.tema).replace(/[\s.!?;:,…]+$/u, "") || "…";

  function trocarRecorte(campo: keyof RecorteEmEdicao, valor: string) {
    setRecorte((atual) => ({ ...atual, [campo]: valor }));
    if (campo === "tema" || campo === "assuntosTexto" || campo === "contexto") {
      const chave = campo === "assuntosTexto" ? "assuntos" : campo;
      setErrosDaApi((atual) => ({ ...atual, [chave]: [] }));
    }
  }

  function recorteProntoParaGerar(): boolean {
    setTentou(true);
    return Boolean(recorte.disciplina) && tema.caracteres > 0 && !tema.erro && !erroDosAssuntos && !erroDoContexto;
  }

  async function gerar() {
    if (!recorteProntoParaGerar()) return;
    setGerando(true);
    setStatusDaGeracao(0);
    setErro(null);
    setSemIa(null);
    setErrosDaApi(SEM_ERROS);
    try {
      const r = await fetch(`${url}/gerar`, {
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
         tema e os fatos DELE, e aprovar o texto do museu com o tema digitado
         faria a Nina falar de uma coisa e o grupo de outra. */
      setRecorte(recorteDoPacote(resposta.rascunho));
      setCuradoria({
        origem: resposta.rascunho.origem,
        mensagens: resposta.rascunho.mensagens,
        de: resposta.usouIa ? "ia" : "padrao",
        em: resposta.rascunho.atualizadoEm,
      });
      setSemIa(resposta.usouIa ? null : (resposta.motivo ?? "indisponivel"));
      if (resposta.usouIa) setAviso("Pacote gerado. Leia as 8 mensagens antes de aprovar.");
    } catch {
      setErro(SEM_REDE);
    } finally {
      setGerando(false);
    }
  }

  function usarPadrao() {
    setErro(null);
    setSemIa(null);
    setErrosDaApi(SEM_ERROS);
    setRecorte((atual) => ({ ...recorteDoPacote(inicial.padrao, atual.disciplina), contexto: "" }));
    setCuradoria({ origem: "padrao", mensagens: inicial.padrao.mensagens.map((m) => ({ ...m })), de: "padrao", em: null });
    setAviso(`Pacote curado “${inicial.padrao.nome}” carregado na curadoria.`);
  }

  function pedirAprovacao() {
    setTentou(true);
    if (!curadoria || !recorte.disciplina) return;
    /* Aprovar um pacote DIFERENTE do ativo abre uma atividade nova e volta a
       aula ao começo: é a única ação deste preparo que desfaz algo que a turma
       já está vivendo, e por isso pede confirmação. */
    if (ativo) setConfirmando(true);
    else void aprovar();
  }

  async function aprovar() {
    if (!curadoria) return;
    setAprovando(true);
    setErro(null);
    setErrosDaApi(SEM_ERROS);
    try {
      const r = await fetch(`${url}/aprovar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpoDaAprovacao(recorte, curadoria.origem, curadoria.mensagens)),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { mensagem, erros } = erroDaApi(corpo, "Não deu para aprovar agora.");
        setErrosDaApi(distribuirErros(erros));
        setErro(erros.length > 0 ? `${mensagem} Veja os campos marcados.` : mensagem);
        return;
      }
      setAprovadoAgora(corpo as PacoteDoProfessor);
      setCuradoria(null);
      setFormAberto(false);
      setSemIa(null);
      setTentou(false);
      setAviso("Pacote aprovado para a turma.");
      transicionar(() => router.refresh());
    } catch {
      setErro(SEM_REDE);
    } finally {
      setAprovando(false);
      setConfirmando(false);
    }
  }

  function abrirPreparoNovo() {
    setFormAberto(true);
    if (ativo && !curadoria) setRecorte(recorteDoPacote(ativo));
  }

  const emOrdem = curadoria ? mensagensEmOrdem(curadoria.mensagens) : 0;

  return (
    <section className="flex flex-col gap-4" data-preparo>
      {aviso ? <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} /> : null}

      {ativo ? (
        <PacoteAprovado
          ativo={ativo}
          disciplinas={inicial.disciplinas}
          liberacao={liberacao}
          rotaDaSala={rotaDaSala}
          rotaDaFicha={rotaDaFicha}
          formAberto={formAberto}
          onPrepararNovo={abrirPreparoNovo}
        />
      ) : null}

      {formAberto ? (
        <>
          <Card variant="elevated">
            <div className="flex flex-col gap-4">
              <SectionHeader
                title="Recorte da Aula — Parametrização Temática"
                description="Defina o tema do boato escolar que servirá de base para a triagem dos estudantes."
              />
              {ativo ? (
                <FeedbackAlert
                  type="info"
                  description="A turma continua com o pacote aprovado acima até você aprovar outro. Gerar aqui não muda nada para ela."
                />
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <Selection
                  label="Componente curricular"
                  helperText="Selecione a área de conhecimento da atividade."
                  placeholder="Selecione"
                  value={recorte.disciplina || undefined}
                  error={erroDaDisciplina}
                  showOptionCheckbox={false}
                  options={inicial.disciplinas.map((d) => ({ value: d.slug, label: d.rotulo }))}
                  onChange={(valor) => trocarRecorte("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : valor)}
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
                  label="Fatos balizadores da aula (3 a 6 tópicos)"
                  helperText={`Liste os termos que a IA utilizará para compor os fatos verdadeiros e as alegações falsas. Um por linha. · ${assuntos.length} ${assuntos.length === 1 ? "fato" : "fatos"} · ${assuntos.join("").length}/${TETOS.assuntosMaxCaracteres} caracteres`}
                  rows={4}
                  value={recorte.assuntosTexto}
                  error={
                    (tentou || recorte.assuntosTexto.trim() ? erroDosAssuntos : null) ??
                    (errosDaApi.assuntos.length > 0 ? errosDaApi.assuntos.join(" ") : undefined)
                  }
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocarRecorte("assuntosTexto", e.target.value)}
                />
                <TextField
                  label="Contexto local da escola ou região (opcional)"
                  value={recorte.contexto}
                  maxLength={TETOS.contextoMaxCaracteres}
                  error={erroDoContexto ?? (errosDaApi.contexto.length > 0 ? errosDaApi.contexto.join(" ") : undefined)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarRecorte("contexto", e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="md" isDisabled={gerando || aprovando} onClick={usarPadrao} data-acao="usar-padrao">
                  Usar Pacote Curado Padrão
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  isDisabled={gerando || aprovando}
                  isLoading={gerando}
                  onClick={() => void gerar()}
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
                  description={`${AVISO_SEM_IA[semIa].descricao} O pacote curado já está na curadoria abaixo, pronto para revisar e aprovar.`}
                />
              ) : null}

              {erro && !curadoria ? <FeedbackAlert type="error" description={erro} /> : null}
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
                        ? `Rascunho ${curadoria.origem === "ia" ? "gerado com IA" : "do pacote curado"}${curadoria.em ? ` em ${dataHora(curadoria.em)}` : ""}, ainda não aprovado.`
                        : `Pacote curado da Unooria — “${inicial.padrao.nome}”.`
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
                {erroDaDisciplina ? (
                  <p className="text-[12px] text-unooria-danger" role="status">
                    Falta o componente curricular, no recorte acima.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    isDisabled={aprovando || gerando}
                    isLoading={aprovando}
                    onClick={pedirAprovacao}
                    data-acao="aprovar-pacote"
                  >
                    Aprovar Pacote
                  </Button>
                  <span className="text-[12px] text-unooria-neutral-600">
                    Nenhum texto gerado por inteligência artificial chega aos estudantes sem este clique.
                  </span>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      <Modal
        isOpen={confirmando}
        onClose={() => (aprovando ? undefined : setConfirmando(false))}
        size="sm"
        theme="light"
        aria-labelledby={idDoTituloDaConfirmacao}
      >
        <ModalHeader showCloseButton={false}>
          <ModalTitle id={idDoTituloDaConfirmacao}>Aprovar um pacote novo para a turma?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
            Aprovar um pacote diferente abre uma atividade nova: a turma recomeça do grupo, com estas
            mensagens, e a aula volta ao começo. O que a turma fez com o pacote atual fica guardado, com
            as habilidades de cada estudante.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" isDisabled={aprovando} onClick={() => setConfirmando(false)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" isDisabled={aprovando} isLoading={aprovando} onClick={() => void aprovar()}>
            Aprovar Pacote
          </Button>
        </ModalFooter>
      </Modal>
    </section>
  );
}

/**
 * E0-PROF-05 — o pacote que a turma usa, e as duas outras portas da aula: a
 * liberação na SALA (ADR-69; o botão da copy, "Liberar Missão para a Turma",
 * leva para lá, onde a liberação de fato acontece) e o arranjo de sala, que
 * nesta plataforma são as equipes da ficha (E13).
 */
function PacoteAprovado({
  ativo,
  disciplinas,
  liberacao,
  rotaDaSala,
  rotaDaFicha,
  formAberto,
  onPrepararNovo,
}: {
  ativo: PacoteDoProfessor;
  disciplinas: PacoteDaTurma["disciplinas"];
  liberacao: LiberacaoNaSala | null;
  rotaDaSala: string;
  rotaDaFicha: string;
  formAberto: boolean;
  onPrepararNovo: () => void;
}) {
  const [vendo, setVendo] = useState(false);
  const disciplina = disciplinas.find((d) => d.slug === ativo.disciplina)?.rotulo ?? ativo.disciplina;

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-4" data-pacote-aprovado={ativo.id}>
        <SectionHeader
          title="Ativar Missão para a Turma"
          badge={
            <Tag variant="success" size="sm" pill>
              Pacote aprovado
            </Tag>
          }
          description={`Tema: ${ativo.tema} • ${ativo.mensagens.length} mensagens validadas`}
        />
        <dl className="grid gap-x-6 gap-y-1 text-[13px] text-unooria-neutral-700 sm:grid-cols-[max-content_1fr]">
          <dt className="font-semibold text-unooria-neutral-500">Componente</dt>
          <dd>{disciplina}</dd>
          <dt className="font-semibold text-unooria-neutral-500">Origem</dt>
          <dd>{ROTULO_DA_ORIGEM[ativo.origem]}</dd>
          <dt className="font-semibold text-unooria-neutral-500">Aprovado em</dt>
          <dd>{ativo.aprovadoEm ? dataHora(ativo.aprovadoEm) : "—"}</dd>
          <dt className="font-semibold text-unooria-neutral-500">Aplicação</dt>
          <dd>{ativo.rodadaAtual === 1 ? "1ª rodada" : `${ativo.rodadaAtual}ª rodada`}</dd>
        </dl>

        {liberacao?.estado === "liberada" ? (
          <p className="text-[13px] text-unooria-neutral-700">
            <Tag variant="success" size="sm">
              Liberada na sala
            </Tag>{" "}
            {liberacao.em ? `desde ${dataHora(liberacao.em)}. ` : ""}A turma já pode entrar no grupo.
          </p>
        ) : liberacao ? (
          <FeedbackAlert
            type="warning"
            title={
              liberacao.estado === "encerrada"
                ? "A missão está encerrada na sala desta turma"
                : "A missão ainda não está liberada para esta turma"
            }
            description="Sem a liberação na sala de aula, o card fica com cadeado para as crianças — o pacote aprovado não basta."
            action={
              <LinkButton href={rotaDaSala} size="sm">
                Liberar Missão para a Turma
              </LinkButton>
            }
          />
        ) : null}

        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-semibold text-unooria-neutral-800">
            Arranjo de sala: 1 estudante por aparelho, duplas ou projeção única
          </p>
          <p className="text-[12px] leading-snug text-unooria-neutral-600">
            Se a turma divide computadores, monte as equipes na ficha da missão: quem entra representa a
            equipe, e o painel conta por computador.
          </p>
          <div className="pt-1">
            <LinkButton href={rotaDaFicha} variant="outline" size="sm">
              Montar as equipes na ficha
            </LinkButton>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" onClick={() => setVendo((v) => !v)} aria-expanded={vendo}>
            {vendo ? "Esconder as 8 mensagens" : "Ver as 8 mensagens"}
          </Button>
          {!formAberto ? (
            <Button variant="outline" size="sm" onClick={onPrepararNovo} data-acao="preparar-novo">
              Preparar um pacote novo
            </Button>
          ) : null}
        </div>

        {/* Renderização condicional, e não `Collapse`: fechado, ele deixa os
            controles focáveis dentro de `aria-hidden` (a lacuna registrada na
            exp-92). */}
        {vendo ? <MatrizDoPacote mensagens={ativo.mensagens} /> : null}
      </div>
    </Card>
  );
}

/** A visão de quem só LÊ (a coordenação): o pacote, sem ação nenhuma. */
function PacoteSomenteLeitura({
  ativo,
  disciplinas,
}: {
  ativo: PacoteDoProfessor | null;
  disciplinas: PacoteDaTurma["disciplinas"];
}) {
  if (!ativo) {
    return (
      <Card variant="outlined" title="Esta turma ainda não tem pacote aprovado">
        <p className="text-[14px] text-unooria-neutral-700">
          Quem prepara e conduz a aula é o professor da turma. Sem pacote aprovado, a missão não abre
          para os estudantes.
        </p>
      </Card>
    );
  }
  const disciplina = disciplinas.find((d) => d.slug === ativo.disciplina)?.rotulo ?? ativo.disciplina;
  return (
    <Card variant="outlined">
      <div className="flex flex-col gap-4">
        <SectionHeader title="Pacote aprovado" description={`Tema: ${ativo.tema} • ${disciplina}`} />
        <MatrizDoPacote mensagens={ativo.mensagens} />
      </div>
    </Card>
  );
}

/**
 * As oito mensagens nos quatro quadrantes, com os selos que SÓ o professor vê.
 * Com `onTrocar`, cada card ganha "Editar texto"; sem, é leitura.
 */
function MatrizDoPacote({
  mensagens,
  errosDaApi = {},
  onTrocar,
}: {
  mensagens: readonly MensagemDoPacote[];
  errosDaApi?: Record<string, string[]>;
  onTrocar?: (id: string, campo: CampoDaMensagem, valor: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {agruparPorQuadrante(mensagens).map((grupo) => (
        <section
          key={grupo.quadrante}
          className="flex flex-col gap-3 rounded-lg border border-unooria-neutral-200 p-3"
          data-quadrante={grupo.quadrante}
        >
          <Tag
            variant={grupo.quadrante.startsWith("V") ? "success" : "danger"}
            size="md"
            pill
          >
            {grupo.rotulo}
          </Tag>
          {grupo.mensagens.map((item) => (
            <CartaoDaMensagem
              key={item.mensagem.id}
              item={item}
              errosDaApi={errosDaApi[item.mensagem.id] ?? []}
              onTrocar={onTrocar}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function CartaoDaMensagem({
  item,
  errosDaApi,
  onTrocar,
}: {
  item: MensagemNaMatriz;
  errosDaApi: string[];
  onTrocar?: (id: string, campo: CampoDaMensagem, valor: string) => void;
}) {
  const { mensagem: m, posicao } = item;
  const [editando, setEditando] = useState(false);
  const conferencia = onTrocar ? conferirMensagem(m) : {};
  const temErro = Object.keys(conferencia).length > 0 || errosDaApi.length > 0;

  return (
    <article
      className={`flex flex-col gap-2 rounded-md border p-3 ${temErro ? "border-unooria-danger" : "border-unooria-neutral-200"}`}
      data-mensagem={m.id}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
        {posicao}ª mensagem · {ROTULO_DO_TIPO[m.tipo]}
      </p>

      {editando && onTrocar ? (
        <div className="flex flex-col gap-3">
          <TextField
            label="Quem manda"
            value={m.remetente}
            maxLength={TETOS.remetenteMaxCaracteres}
            error={conferencia.remetente}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTrocar(m.id, "remetente", e.target.value)}
          />
          <TextArea
            label="A mensagem, como a turma lê"
            rows={4}
            value={m.texto}
            maxLength={TETOS.textoMaxCaracteres}
            helperText={`Até ${TETOS.textoMaxPalavras} palavras.`}
            error={conferencia.texto}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onTrocar(m.id, "texto", e.target.value)}
          />
          {m.tipo !== "texto" ? (
            <TextArea
              label={ROTULO_DA_LEGENDA[m.tipo]}
              rows={2}
              value={m.legenda ?? ""}
              maxLength={TETOS.legendaMaxCaracteres}
              helperText={`Até ${TETOS.legendaMaxPalavras} palavras.`}
              error={conferencia.legenda}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onTrocar(m.id, "legenda", e.target.value)}
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-semibold text-unooria-neutral-950">{m.remetente}</p>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">{m.texto}</p>
          {m.tipo !== "texto" ? (
            <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
              <span className="text-unooria-neutral-500">{ROTULO_DA_LEGENDA[m.tipo]}:</span> {m.legenda}
            </p>
          ) : null}
          {Object.values(conferencia).map((frase) => (
            <p key={frase} className="text-[12px] text-unooria-danger">
              {frase}
            </p>
          ))}
        </div>
      )}

      {errosDaApi.length > 0 ? (
        <ul className="list-disc pl-5 text-[12px] text-unooria-danger" role="status">
          {errosDaApi.map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ul>
      ) : null}

      {onTrocar ? (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setEditando((v) => !v)} aria-expanded={editando}>
            {editando ? "Concluir edição" : "Editar texto"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
