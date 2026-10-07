"use client";

import { useCallback, useState } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar, TextArea, TextField } from "@edu/ui/ds";
import {
  AssistenteDeAtividade,
  type ResultadoDaCriacao,
  type TurmaDoAssistente,
} from "@/components/atividades/assistente-de-atividade";
import {
  PARAMETROS,
  TOTAL_DE_NOTICIAS,
  corpoDosParametros,
  distribuirErros,
  erroDaResposta,
  normalizarNoticia,
  problemasDaComposicao,
  problemasDosParametros,
  problemasPorCampo,
  textoDaComposicao,
  type IdDeNoticia,
  type MaterialDoJornal,
  type NoticiaDoPacote,
  type NoticiaRegenerada,
  type OrigemDoPacote,
  type PacoteDaAtividade,
  type PacoteHomologado,
  type RascunhoDoPacote,
} from "@/lib/jornal-escola-tipos";

import { ImagensDoPacote } from "../../resultados/imagens-do-pacote";
import { CartaoDoPreparo, EditorDaNoticia } from "../../resultados/noticia-do-preparo";
import { FalasDoPodcast, falasComProblema, pedirFalasDoTema } from "./falas-do-podcast";
import { falasParaHomologar, type FalasEscritas } from "@/lib/podcast-tipos";

/** A copy revisada (§4a), no que ela sobreviveu à criação. A suíte e2e casa por texto exato. */
const COPY = {
  titulo: "Planejamento da Pauta da Turma",
  atalho: "Usar o banco pronto da Unooria",
  ajudaDoAtalho:
    "Carrega as pautas já revisadas pela Unooria (Feira de Ciências e Notícias da Cidade) para você ler e editar, sem consumo de cotas de inteligência artificial.",
  rotuloDaDisciplina: "Componente Curricular",
  rotuloDoTema: "Tema central da aula",
  ajudaDoTema: "Defina o tema central trabalhado na sua disciplina esta semana.",
  exemploDoTema: "Exemplo: Preservação de animais silvestres e vacinação no município.",
  rotuloDosTopicos: "Tópicos prioritários para as 8 notícias",
  ajudaDosTopicos:
    "Liste de 3 a 6 assuntos ou eventos reais/locais. A inteligência artificial criará 8 notícias com formatos variados equilibrando matérias checadas, desatualizadas e boatos anônimos.",
  gerar: "Gerar Pacote de Notícias com IA",
  gerando: "Bento está organizando as 8 pautas na redação...",
  tituloDaCuradoria: "Homologação da Mesa Editorial",
  instrucaoDaCuradoria:
    "Revise as 8 notícias antes de criar a atividade. Você pode editar textos ou regenerar matérias isoladas.",
  semSaldo:
    "Limite de geração com IA atingido. O banco pronto da Unooria está disponível: carregue-o e revise antes de criar a atividade.",
  falhaDaIa: "O serviço de geração automática oscilou. Tente novamente ou carregue o banco pronto da Unooria.",
} as const;

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

/** O pacote que a tela está editando. `topicos` em texto: vazio = ausente no envio. */
interface Rascunho {
  disciplina: string;
  tema: string;
  topicos: string;
  origem: OrigemDoPacote;
  noticias: NoticiaDoPacote[];
}

const VAZIO: Rascunho = { disciplina: "", tema: "", topicos: "", origem: "padrao", noticias: [] };

/** Os textos aprovados (a fase 1): o pacote GRAVADO, de UMA turma, com as imagens que ele já tem. */
interface TextosAprovados {
  id: string;
  turmaId: string;
  noticias: NoticiaDoPacote[];
  imagens: Record<string, string>;
  aprovadas: IdDeNoticia[];
}

type Aviso = { tipo: "success" | "warning" | "info"; texto: string };

/** De onde veio a falha da IA — é o que o "Tentar de novo" do banner repete. */
type FalhaDaIa = { tipo: "sem-saldo" | "indisponivel"; de: "gerar" | IdDeNoticia };

/** 429/503 pelo status OU pelo código: o BFF repassa os dois. */
function falhaDaIa(status: number, codigo: string | null): FalhaDaIa["tipo"] | null {
  if (status === 429 || codigo === "sem-saldo-de-ia") return "sem-saldo";
  if (status === 503 || codigo === "ia-indisponivel") return "indisponivel";
  return null;
}

/**
 * NOVA ATIVIDADE do JORNAL DA ESCOLA (ADR-130): o preparo do pacote de notícias
 * virou o passo de conteúdo da criação. A missão é o esqueleto; o PACOTE — as
 * oito notícias, com as pistas, o gabarito e a reação do leitor de cada uma —
 * é a atividade que a turma investiga na mesa da redação, e nasce do
 * professor: gerado com IA sobre o tema dele, ou a partir do banco pronto da
 * Unooria, que ele lê e edita.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * **A criação nasce VAZIA.** Antes, sem preparo, a turma rodava o banco padrão
 * (a api criava o pacote `padrao` na primeira leitura), o formulário abria com
 * o pacote em andamento e o atalho do banco padrão homologava num toque. Nada
 * disso sobrevive à regra de que a plataforma não cria atividade:
 *
 * - **"Usar o banco pronto da Unooria" CARREGA, não grava**: lê `GET
 *   professor/material` para dentro da mesa, com `origem: "padrao"`, e o
 *   professor o lê como leria um pacote gerado. É também a saída que os banners
 *   de 429 e 503 oferecem.
 * - **A aprovação tem DUAS fases, na mesma tela** (ADR-147, pedido do PO, no
 *   molde da A Seleção — ADR-146): primeiro os TEXTOS ("Aprovar textos e
 *   gerar as imagens" grava o pacote por `homologar`, PRONTO e fora do ar);
 *   depois as IMAGENS, que se geram sozinhas na grade
 *   (`resultados/imagens-do-pacote.tsx`), onde o professor vê cada uma, gera
 *   outra para a que não serve e aprova. Gerar imagem para um rascunho gastaria
 *   a quota à toa — por isso os textos são gravados antes. O "Continuar" só
 *   acende com TODAS aprovadas: a atividade não vai ao ar sem isso (409
 *   `imagens-nao-aprovadas`), e o "Pôr no ar agora" do último passo depende.
 * - O "Criar atividade" do assistente não grava mais nada: o pacote já existe,
 *   e ele faz o resto (`concluirCriacao`: pôr no ar, se marcado, e equipes).
 *   Criar não troca o que está no ar.
 *
 * `gerar-conteudo` e `regenerar-noticia` NÃO persistem: devolvem rascunho, e o
 * que grava é `homologar`, com as oito notícias INTEIRAS — texto, pistas,
 * gabarito e consequência (PDF §10). O 429 (`sem-saldo-de-ia`) e o 503
 * (`ia-indisponivel`) vêm na voz da copy e oferecem o banco pronto.
 *
 * O `pacote-invalido` da api traz a LISTA de problemas em frases — cada uma
 * começa pela notícia —, e ela fica também AQUI (`erro`), não só no passo
 * final: ao voltar ao conteúdo, o cartão de cada notícia mostra o que a api
 * recusou nele.
 */
export function CriarJornalEscola({
  turmas,
  turmaInicial,
  rotaDaMissao,
}: {
  turmas: TurmaDoAssistente[];
  turmaInicial: string;
  rotaDaMissao: string;
}) {
  const [rascunho, setRascunho] = useState<Rascunho>(VAZIO);
  /* O tema para o qual AS NOTÍCIAS NA TELA foram escritas. Trocar o texto do
     tema sem gerar um pacote novo deixaria a mesa falando da feira sob o título
     de outro assunto — a tela avisa, sem bloquear. */
  const [temaDasNoticias, setTemaDasNoticias] = useState("");
  const [editando, setEditando] = useState<IdDeNoticia | null>(null);

  const [gerando, setGerando] = useState(false);
  const [carregandoBanco, setCarregandoBanco] = useState(false);
  const [regenerando, setRegenerando] = useState<IdDeNoticia | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [falha, setFalha] = useState<FalhaDaIa | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; erros: string[] } | null>(null);
  const [aprovados, setAprovados] = useState<TextosAprovados | null>(null);
  const [aprovandoTextos, setAprovandoTextos] = useState(false);
  const [imagensAprovadas, setImagensAprovadas] = useState(false);
  /* As falas do podcast que contam ESTA mesa (ADR-150): o professor as revisa
     aqui, e elas vão na homologação. `falasDaMesa` é a mesa para a qual foram
     escritas — mudou a mesa, a tela avisa, sem bloquear. */
  const [falas, setFalas] = useState<FalasEscritas | null>(null);
  const [escrevendoFalas, setEscrevendoFalas] = useState(false);
  const [falhaDasFalas, setFalhaDasFalas] = useState<string | null>(null);
  const [falasDaMesa, setFalasDaMesa] = useState("");
  const aoMudarAprovacao = useCallback((tudo: boolean) => setImagensAprovadas(tudo), []);

  const parametros = { disciplina: rascunho.disciplina, tema: rascunho.tema, topicos: rascunho.topicos };
  const errosDosParametros = problemasDosParametros(parametros);
  const parametrosValidos = Object.keys(errosDosParametros).length === 0;
  const temNoticias = rascunho.noticias.length === TOTAL_DE_NOTICIAS;
  const problemasDeCampo = new Map(rascunho.noticias.map((n) => [n.id, problemasPorCampo(n)] as const));
  const noticiasComProblema = rascunho.noticias.filter((n) => Object.keys(problemasDeCampo.get(n.id) ?? {}).length > 0);
  const problemasDoConjunto = temNoticias ? problemasDaComposicao(rascunho.noticias) : [];
  const errosDaApi = distribuirErros(erro?.erros ?? []);
  const problemasDasFalas = falasComProblema(falas);
  const pronto =
    temNoticias &&
    parametrosValidos &&
    noticiasComProblema.length === 0 &&
    problemasDoConjunto.length === 0 &&
    falas !== null &&
    problemasDasFalas === 0 &&
    !escrevendoFalas;
  const ocupado = gerando || carregandoBanco || regenerando !== null;
  const noticiaEmEdicao = editando ? (rascunho.noticias.find((n) => n.id === editando) ?? null) : null;
  const temaInvalido = Boolean(errosDosParametros.tema);
  /* A criação nasce vazia: o erro de um campo só aparece depois que o
     professor escreveu nele — campo vazio de saída não é engano dele. */
  const erroDoCampo = (campo: "disciplina" | "tema") =>
    rascunho[campo] ? errosDosParametros[campo] : undefined;

  /** A mesa como a api do podcast a lê: o tema e as oito notícias na forma gravada. */
  function mesaDoPodcast(tema: string, noticias: NoticiaDoPacote[]) {
    return { tema: tema.trim(), noticias: noticias.map(normalizarNoticia) };
  }

  /** Pede as falas do podcast para a mesa — o banco pronto volta com as do sheet, sem IA. */
  async function escreverFalas(turmaId: string, tema: string, noticias: NoticiaDoPacote[]) {
    const mesa = mesaDoPodcast(tema, noticias);
    setEscrevendoFalas(true);
    setFalhaDasFalas(null);
    const r = await pedirFalasDoTema("exp04ef1b", turmaId, mesa);
    if (r.ok) {
      setFalas(r.falas);
      setFalasDaMesa(JSON.stringify(mesa));
    } else {
      setFalhaDasFalas(r.mensagem);
    }
    setEscrevendoFalas(false);
  }

  function limparRecados() {
    setErro(null);
    setAviso(null);
    setFalha(null);
  }

  function trocarParametro(campo: "disciplina" | "tema" | "topicos", valor: string) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
  }

  function trocarNoticia(nova: NoticiaDoPacote) {
    setRascunho((atual) => ({ ...atual, noticias: atual.noticias.map((n) => (n.id === nova.id ? nova : n)) }));
  }

  async function gerar(turmaId: string) {
    if (!parametrosValidos) return;
    setGerando(true);
    limparRecados();
    try {
      const r = await fetch(`/api/plataforma/jornal-escola/turmas/${encodeURIComponent(turmaId)}/gerar-conteudo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpoDosParametros(parametros)),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { codigo, mensagem } = erroDaResposta(
          corpo,
          "O gerador não respondeu. Tente de novo, ou use o banco pronto da Unooria.",
        );
        const tipo = falhaDaIa(r.status, codigo);
        if (tipo) setFalha({ tipo, de: "gerar" });
        else setErro({ mensagem, erros: [] });
        return;
      }
      const novo = corpo as RascunhoDoPacote;
      /* A ORIGEM vai como o rascunho a trouxe: sem IA, o que está na tela é o
         banco padrão, e gravá-lo como `ia` mentiria no único registro que
         responde se a curadoria assistida está sendo usada. */
      setRascunho({
        disciplina: novo.disciplina,
        tema: novo.tema,
        topicos: novo.topicos ?? "",
        origem: novo.origem,
        noticias: novo.noticias,
      });
      setTemaDasNoticias(novo.tema);
      setEditando(null);
      void escreverFalas(turmaId, novo.tema, novo.noticias);
      setAviso(
        novo.usouIa
          ? {
              tipo: "success",
              texto:
                "Pacote gerado. Leia as 8 notícias e edite o que quiser antes de criar a atividade — nada vai à turma sem o seu clique.",
            }
          : {
              tipo: "warning",
              texto:
                "A inteligência artificial não respondeu desta vez, e o que está abaixo é o banco pronto da Unooria. Você pode criar a atividade com ele ou tentar gerar de novo.",
            },
      );
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  async function regenerar(turmaId: string, id: IdDeNoticia) {
    if (!parametrosValidos) {
      setErro({ mensagem: "Para regenerar uma notícia, preencha o componente curricular e o tema acima.", erros: [] });
      return;
    }
    setRegenerando(id);
    limparRecados();
    try {
      const r = await fetch(`/api/plataforma/jornal-escola/turmas/${encodeURIComponent(turmaId)}/regenerar-noticia`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...corpoDosParametros(parametros),
          noticiaId: id,
          noticias: rascunho.noticias.map(normalizarNoticia),
        }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { codigo, mensagem } = erroDaResposta(corpo, "Não deu para regenerar agora. Tente de novo em instantes.");
        const tipo = falhaDaIa(r.status, codigo);
        if (tipo) setFalha({ tipo, de: id });
        else setErro({ mensagem, erros: [] });
        return;
      }
      const { noticia, usouIa } = corpo as NoticiaRegenerada;
      if (!usouIa) {
        /* Sem IA, a notícia fica como estava: trocar por outra do banco padrão
           poria a feira de ciências no meio de um pacote de outro tema. */
        setAviso({
          tipo: "warning",
          texto: "A inteligência artificial não respondeu desta vez, e a notícia ficou como estava.",
        });
        return;
      }
      trocarNoticia({ ...noticia, id });
      // O pacote passa a ter texto escrito pela IA: a origem diz isso.
      setRascunho((atual) => ({ ...atual, origem: "ia" }));
      setAviso({
        tipo: "success",
        texto: "Notícia regenerada, com as pistas, o gabarito e a reação do leitor. Leia de novo antes de criar a atividade.",
      });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setRegenerando(null);
    }
  }

  /** O banco pronto da Unooria, PARA DENTRO da mesa — não grava nada (ADR-130). */
  async function usarBancoPronto(turmaId: string) {
    setCarregandoBanco(true);
    limparRecados();
    try {
      const r = await fetch("/api/plataforma/jornal-escola/professor/material", { cache: "no-store" });
      if (!r.ok) {
        setErro({
          mensagem: erroDaResposta(await r.json().catch(() => null), "O banco pronto não carregou. Tente de novo.")
            .mensagem,
          erros: [],
        });
        return;
      }
      const material = (await r.json()) as MaterialDoJornal;
      setRascunho({
        disciplina: material.disciplina,
        tema: material.tema,
        topicos: "",
        origem: "padrao",
        noticias: material.noticias,
      });
      setTemaDasNoticias(material.tema);
      setEditando(null);
      void escreverFalas(turmaId, material.tema, material.noticias);
      setAviso({
        tipo: "success",
        texto: "O banco pronto da Unooria foi carregado. Leia as 8 notícias e edite o que quiser antes de criar a atividade.",
      });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setCarregandoBanco(false);
    }
  }

  function repetirAposFalha(turmaId: string) {
    if (!falha) return;
    if (falha.de === "gerar") void gerar(turmaId);
    else void regenerar(turmaId, falha.de);
  }

  /** A FASE 1: grava os textos como o professor os deixou, e as imagens começam. */
  async function aprovarTextos(turmaId: string) {
    setAprovandoTextos(true);
    limparRecados();
    try {
      const r = await fetch(`/api/plataforma/jornal-escola/turmas/${encodeURIComponent(turmaId)}/homologar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...corpoDosParametros(parametros),
        origem: rascunho.origem,
        noticias: rascunho.noticias.map(normalizarNoticia),
        podcast: falasParaHomologar(falas?.vagas ?? []),
        }),
      });
      if (!r.ok) {
        /* `pacote-invalido` traz a LISTA de problemas em frases para o
           professor — cada uma começa pela notícia, e vai também para o
           cartão dela. */
        setErro(erroDaResposta(await r.json().catch(() => null), "Não deu para aprovar os textos agora."));
        return;
      }
      const criado = (await r.json()) as PacoteHomologado;
      /* O pacote nasce com as imagens HERDADAS de outro da turma com a mesma
         descrição (e o mesmo conteúdo devolve o próprio pacote, que pode já
         estar aprovado): o detalhe as traz, e a fase 2 não as paga de novo. */
      const detalhe = await fetch(
        `/api/plataforma/jornal-escola/turmas/${encodeURIComponent(turmaId)}/pacotes/${encodeURIComponent(criado.id)}`,
        { cache: "no-store" },
      );
      const lido = detalhe.ok ? ((await detalhe.json()) as PacoteDaAtividade) : null;
      setImagensAprovadas(false);
      setAprovados({
        id: criado.id,
        turmaId,
        noticias: criado.noticias,
        imagens: lido?.imagens ?? {},
        aprovadas: lido?.aprovadas ?? [],
      });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setAprovandoTextos(false);
    }
  }

  /** O "Criar atividade" do assistente: o pacote já está gravado, com as imagens aprovadas. */
  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (!aprovados || aprovados.turmaId !== turmaId || !imagensAprovadas) {
      return { ok: false, mensagem: "Aprove os textos e as imagens desta turma antes de criar a atividade.", erros: [] };
    }
    return { ok: true, id: aprovados.id };
  }

  function recomecar() {
    setAprovados(null);
    setImagensAprovadas(false);
  }

  return (
    <AssistenteDeAtividade
      expId="exp04ef1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={aprovados !== null && imagensAprovadas}
      resumoDoConteudo={
        aprovados
          ? `“${rascunho.tema.trim()}” · ${rascunho.disciplina.trim()} · ${TOTAL_DE_NOTICIAS} notícias, com os textos e as imagens aprovados`
          : null
      }
      criar={criar}
      conteudo={(turmaId) => {
        const fase2 = aprovados !== null && aprovados.turmaId === turmaId;
        const travado = aprovados !== null;
        return (
          <Card variant="outlined" title={COPY.titulo}>
            <div className="flex flex-col gap-5" data-preparo-jornal data-fase={fase2 ? "imagens" : "textos"}>
              <p className="text-[13px] font-semibold text-unooria-neutral-950" data-fase-da-aprovacao>
                {fase2 ? "Fase 2 de 2: as imagens" : "Fase 1 de 2: os textos"}
              </p>
              {aprovados && !fase2 ? (
                <FeedbackAlert
                  type="warning"
                  description={
                    <span className="flex flex-col items-start gap-2">
                      <span>
                        Os textos deste pacote foram aprovados para outra turma. Volte à turma anterior para continuar, ou
                        comece um pacote novo para esta.
                      </span>
                      <Button variant="secondary" size="sm" onClick={recomecar} data-acao="recomecar-pacote">
                        Começar um pacote novo
                      </Button>
                    </span>
                  }
                />
              ) : null}
              {fase2 && aprovados ? (
                <>
                  <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
                    Os textos de “{rascunho.tema.trim()}” estão aprovados e a atividade está gravada, ainda fora do ar.
                    Agora as imagens: <strong>nenhuma imagem gerada por inteligência artificial é exibida aos estudantes
                    sem a sua aprovação.</strong> Com todas aprovadas, continue para as equipes.
                  </p>
                  <ImagensDoPacote
                    key={aprovados.id}
                    turmaId={turmaId}
                    pacoteId={aprovados.id}
                    noticias={aprovados.noticias}
                    imagensIniciais={aprovados.imagens}
                    aprovadasIniciais={aprovados.aprovadas}
                    podeEditar
                    gerarAoAbrir
                    aoMudarAprovacao={aoMudarAprovacao}
                    moldura={false}
                  />
                </>
              ) : null}
              {!travado ? (
                <>
                  <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
                    Escolha as notícias que a turma vai investigar na mesa da redação: parta do banco pronto da Unooria, ou
                    deixe a IA escrever as 8 sobre o tema da sua aula.{" "}
                    <strong>
                      Nenhum texto gerado por inteligência artificial é exibido aos estudantes sem a sua aprovação.
                    </strong>
                  </p>

                  {/* ─────────────────────────────── o ponto de partida pronto ───── */}
                  <div className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-4">
                    <div>
                      <Button
                        variant="primary"
                        size="md"
                        leftIcon={<Icon name="newspaper" size={18} />}
                        onClick={() => void usarBancoPronto(turmaId)}
                        isDisabled={ocupado}
                        data-acao="usar-banco-pronto"
                      >
                        {carregandoBanco ? "Carregando…" : COPY.atalho}
                      </Button>
                    </div>
                    <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">{COPY.ajudaDoAtalho}</p>
                  </div>

                  {/* ─────────────────────────────── o caminho personalizado ───── */}
                  <div className="flex flex-col gap-3">
                    <p className="text-[14px] font-semibold text-unooria-neutral-950">
                      Ou prepare um pacote sobre o tema da sua aula
                    </p>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <TextField
                        label={COPY.rotuloDaDisciplina}
                        helperText={erroDoCampo("disciplina") ? undefined : "Ciências, História, Língua Portuguesa…"}
                        value={rascunho.disciplina}
                        maxLength={PARAMETROS.disciplina.max}
                        error={erroDoCampo("disciplina")}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarParametro("disciplina", e.target.value)}
                      />
                      <TextField
                        label={COPY.rotuloDoTema}
                        placeholder={COPY.exemploDoTema}
                        helperText={
                          erroDoCampo("tema") ? undefined : `${COPY.ajudaDoTema} Até ${PARAMETROS.tema.max} caracteres.`
                        }
                        value={rascunho.tema}
                        maxLength={PARAMETROS.tema.max}
                        error={erroDoCampo("tema")}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarParametro("tema", e.target.value)}
                      />
                    </div>
                    <TextArea
                      label={COPY.rotuloDosTopicos}
                      helperText={errosDosParametros.topicos ? undefined : COPY.ajudaDosTopicos}
                      value={rascunho.topicos}
                      rows={3}
                      maxLength={PARAMETROS.topicosMax}
                      error={errosDosParametros.topicos}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocarParametro("topicos", e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="ai"
                        size="sm"
                        leftIcon={<Icon name="auto_awesome" size={18} />}
                        onClick={() => void gerar(turmaId)}
                        isDisabled={ocupado || !parametrosValidos}
                        data-acao="gerar-pacote"
                      >
                        {gerando ? "Gerando…" : COPY.gerar}
                      </Button>
                    </div>
                    {gerando ? <ProgressBar indeterminate label={COPY.gerando} variant="brand" /> : null}
                    {temNoticias && !temaInvalido && rascunho.tema.trim() !== temaDasNoticias.trim() ? (
                      <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
                        O tema mudou, mas as notícias na tela ainda falam de “{temaDasNoticias}”. Clique em {COPY.gerar}{" "}
                        para escrevê-las sobre o tema novo — ou siga sabendo que a mesa continua sobre o anterior.
                      </p>
                    ) : null}
                  </div>

                  {falha ? (
                    <div data-falha-da-ia={falha.tipo}>
                      <FeedbackAlert
                        type={falha.tipo === "sem-saldo" ? "warning" : "error"}
                        description={falha.tipo === "sem-saldo" ? COPY.semSaldo : COPY.falhaDaIa}
                        action={
                          <span className="flex flex-wrap gap-2">
                            {falha.tipo === "indisponivel" ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => repetirAposFalha(turmaId)}
                                isDisabled={ocupado}
                              >
                                Tentar de novo
                              </Button>
                            ) : null}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void usarBancoPronto(turmaId)}
                              isDisabled={ocupado}
                              data-acao="banco-pronto-da-falha"
                            >
                              {COPY.atalho}
                            </Button>
                          </span>
                        }
                      />
                    </div>
                  ) : null}
                  {aviso ? <FeedbackAlert type={aviso.tipo} description={aviso.texto} /> : null}
                  {erro ? (
                    <FeedbackAlert
                      type="error"
                      description={
                        errosDaApi.geral.length > 0 || Object.keys(errosDaApi.porNoticia).length > 0 ? (
                          <span className="flex flex-col gap-1">
                            <span>{erro.mensagem}</span>
                            {errosDaApi.geral.length > 0 ? (
                              <ul className="list-disc pl-5">
                                {errosDaApi.geral.map((e) => (
                                  <li key={e}>{e}</li>
                                ))}
                              </ul>
                            ) : null}
                            {Object.keys(errosDaApi.porNoticia).length > 0 ? (
                              <span>As notícias com ajuste estão marcadas abaixo.</span>
                            ) : null}
                          </span>
                        ) : (
                          erro.mensagem
                        )
                      }
                    />
                  ) : null}

                  {/* ──────────────────────────── a homologação da mesa ───── */}
                  <div className="flex flex-col gap-3 border-t border-unooria-neutral-200 pt-4">
                    <p className="text-[14px] font-semibold text-unooria-neutral-950">{COPY.tituloDaCuradoria}</p>
                    {!temNoticias ? (
                      <p className="text-[12px] leading-snug text-unooria-neutral-600" data-mesa-vazia>
                        Use o banco pronto da Unooria, ou gere o pacote com IA sobre o seu tema. As 8 notícias aparecem aqui
                        para você ler e editar — só você vê o gabarito.
                      </p>
                    ) : (
                      <>
                        <p className="max-w-3xl text-[13px] leading-snug text-unooria-neutral-700">
                          {COPY.instrucaoDaCuradoria}
                        </p>
                        <p className="text-[12px] text-unooria-neutral-600" data-composicao>
                          {textoDaComposicao(rascunho.noticias)}
                        </p>

                        {/* O "Continuar" apagado sem motivo escrito é o silêncio que a
                            exp05ef1b já pagou: diga o que falta, e onde. */}
                        {!parametrosValidos ||
                        noticiasComProblema.length > 0 ||
                        problemasDoConjunto.length > 0 ||
                        (!escrevendoFalas && (falas === null || problemasDasFalas > 0)) ? (
                          <div className="flex flex-col gap-1 text-[12px] leading-snug text-unooria-danger" role="status">
                            {!parametrosValidos ? <p>Falta o componente curricular ou o tema, nos campos acima.</p> : null}
                            {!escrevendoFalas && falas === null ? (
                              <p>Faltam as falas do podcast de recapitulação, logo abaixo da mesa.</p>
                            ) : null}
                            {problemasDasFalas > 0 ? (
                              <p>
                                {problemasDasFalas === 1
                                  ? "Uma fala do podcast precisa"
                                  : `${problemasDasFalas} falas do podcast precisam`}{" "}
                                de ajuste. O campo está marcado abaixo.
                              </p>
                            ) : null}
                            {noticiasComProblema.length > 0 ? (
                              <p>
                                {noticiasComProblema.length === 1
                                  ? "Uma notícia precisa"
                                  : `${noticiasComProblema.length} notícias precisam`}{" "}
                                de ajuste. Elas estão marcadas abaixo.
                              </p>
                            ) : null}
                            {problemasDoConjunto.map((p) => (
                              <p key={p}>{p}</p>
                            ))}
                          </div>
                        ) : null}

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-mesa-do-preparo>
                          {rascunho.noticias.map((n) => (
                            <CartaoDoPreparo
                              key={n.id}
                              noticia={n}
                              /* A imagem vem na fase 2, depois de aprovar os
                                 textos: aqui, o cartão sai com o desenho do meio. */
                              imagem={undefined}
                              problemas={Object.keys(problemasDeCampo.get(n.id) ?? {}).length}
                              errosDaApi={errosDaApi.porNoticia[n.id] ?? []}
                              aoEditar={() => setEditando(n.id)}
                              aoRegenerar={() => void regenerar(turmaId, n.id)}
                              regenerando={regenerando === n.id}
                              ocupado={ocupado}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {noticiaEmEdicao ? (
                    <EditorDaNoticia
                      noticia={noticiaEmEdicao}
                      problemas={problemasDeCampo.get(noticiaEmEdicao.id) ?? {}}
                      errosDaApi={errosDaApi.porNoticia[noticiaEmEdicao.id] ?? []}
                      aoMudar={trocarNoticia}
                      aoFechar={() => setEditando(null)}
                      aoRegenerar={() => void regenerar(turmaId, noticiaEmEdicao.id)}
                      regenerando={regenerando === noticiaEmEdicao.id}
                      ocupado={ocupado}
                    />
                  ) : null}

                  {/* As falas do podcast, junto da mesa que elas contam (ADR-150). */}
                  {temNoticias ? (
                    <FalasDoPodcast
                      falas={falas}
                      escrevendo={escrevendoFalas}
                      falha={falhaDasFalas}
                      desatualizadas={
                        falas !== null && falasDaMesa !== JSON.stringify(mesaDoPodcast(rascunho.tema, rascunho.noticias))
                      }
                      travado={travado}
                      aoMudar={(vagas) => setFalas((atual) => (atual ? { ...atual, vagas } : atual))}
                      aoReescrever={() => void escreverFalas(turmaId, rascunho.tema, rascunho.noticias)}
                    />
                  ) : null}

                  {/* A FASE 1 fecha aqui: grava os textos e abre as imagens. */}
                  {temNoticias ? (
                    <div className="flex flex-wrap items-center gap-3 border-t border-unooria-neutral-200 pt-4">
                      <Button
                        variant="primary"
                        size="md"
                        leftIcon={<Icon name="check" size={18} />}
                        onClick={() => void aprovarTextos(turmaId)}
                        isDisabled={!pronto || ocupado || aprovandoTextos}
                        isLoading={aprovandoTextos}
                        data-acao="aprovar-textos"
                      >
                        Aprovar textos e gerar as imagens
                      </Button>
                      <span className="text-[12px] text-unooria-neutral-600">
                        Os textos ficam gravados e as imagens começam a ser geradas. Depois disso, os textos não mudam aqui.
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </Card>
        );
      }}
    />
  );
}
