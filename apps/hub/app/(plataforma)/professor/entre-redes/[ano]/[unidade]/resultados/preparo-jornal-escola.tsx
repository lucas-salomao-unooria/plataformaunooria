"use client";

import { dataCurta } from "@edu/sdk";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert, Icon, Modal, ProgressBar, Tag, TextArea, TextField } from "@edu/ui/ds";
import {
  PARAMETROS,
  ROTULO_DA_ORIGEM,
  continuarGerando,
  corpoDosParametros,
  distribuirErros,
  erroDaResposta,
  falhasAcumuladas,
  mesmoPacote,
  normalizarNoticia,
  problemasDaComposicao,
  problemasDosParametros,
  problemasPorCampo,
  textoDaComposicao,
  textoDasRodadas,
  textoDoProgressoDaMidia,
  type IdDeNoticia,
  type MaterialDoJornal,
  type NoticiaDoPacote,
  type NoticiaRegenerada,
  type OrigemDoPacote,
  type PacotesDaTurma,
  type ProgressoDaMidia,
  type RascunhoDoPacote,
  type ResumoDaMidia,
} from "@/lib/jornal-escola-tipos";

import { CartaoDoPreparo, EditorDaNoticia } from "./noticia-do-preparo";

/**
 * E0-PROF-02 a 04 — o PREPARO do pacote de notícias, dentro da tela da aula.
 *
 * Mora AQUI, e não numa rota própria, pela mesma razão da exp07ef1b: o
 * professor já vem a esta tela para conduzir, o preparo é POR TURMA e o seletor
 * de turma já está no topo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * **Esta missão NÃO nasce vazia.** Sem preparo, a turma roda o banco padrão (a
 * api cria o pacote `padrao` na primeira leitura). O formulário abre, então,
 * com o pacote EM ANDAMENTO — e aprovar não é abrir a porta, é TROCAR a
 * atividade. Por isso:
 *
 * - **"Usar Banco Padrão" é UM toque** (copy 4a): lê `GET professor/material`
 *   e homologa na hora, com `origem: "padrao"`, sem passar pela curadoria — o
 *   pacote já vem revisado pela Unooria. É também a saída que os banners de
 *   429 e 503 oferecem.
 * - **"Aprovar Pacote" só acende quando algo MUDOU** (`mesmoPacote`): aprovar
 *   de novo o que já roda criaria uma atividade idêntica, e a turma voltaria à
 *   rodada 1 sem nada ter mudado.
 * - **Quando o pacote atual já rodou, as duas homologações pedem confirmação**:
 *   no meio da aula, um clique errado recomeçaria a turma.
 *
 * `gerar-conteudo` e `regenerar-noticia` NÃO persistem: devolvem rascunho, e o
 * que grava é `homologar`, com as oito notícias INTEIRAS — texto, pistas,
 * gabarito e consequência (PDF §10). O 429 (`sem-saldo-de-ia`) e o 503
 * (`ia-indisponivel`) vêm na voz da copy (`PROF_SEM_SALDO_429`,
 * `PROF_FALHA_IA_503`) e oferecem o banco padrão.
 *
 * AS IMAGENS são um laço do cliente (`continuarGerando`): a api gera até duas
 * por chamada, porque o BFF corta em 30 s. Elas são do pacote EM ANDAMENTO —
 * com um rascunho na tela o botão apaga, senão ele gastaria a quota ilustrando
 * o pacote que a turma deixará de ler.
 *
 * Estado de client, e por isso a página monta este componente com
 * `key={turma}`: sem a `key`, trocar de turma no seletor mantém o formulário
 * da anterior e aprova o pacote dela na turma nova.
 */

/** Verbatim da copy revisada (§4a). A suíte e2e casa por texto exato. */
const COPY = {
  titulo: "Planejamento da Pauta da Turma",
  atalho: "Usar Banco Padrão: Feira de Ciências e Notícias da Cidade",
  ajudaDoAtalho:
    "Inicia a aula imediatamente com pautas jornalísticas pré-homologadas, sem consumo de cotas de inteligência artificial.",
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
    "Revise as 8 notícias antes de liberar para os estudantes. Você pode editar textos ou regenerar matérias isoladas.",
  aprovar: "Aprovar Pacote",
  sucesso: "Pacote homologado com sucesso! As 8 notícias estão prontas para a bancada das duplas.",
  semSaldo: "Limite de geração com IA atingido. O banco curado padrão está disponível para iniciar a aula imediatamente.",
  falhaDaIa: "O serviço de geração automática oscilou. Tente novamente ou carregue o banco oficial da missão.",
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

type Aviso = { tipo: "success" | "warning" | "info"; texto: string };

/** De onde veio a falha da IA — é o que o "Tentar de novo" do banner repete. */
type FalhaDaIa = { tipo: "sem-saldo" | "indisponivel"; de: "gerar" | IdDeNoticia };

type Confirmacao = "aprovar" | "padrao";

function rascunhoDoAtivo(ativo: PacotesDaTurma["ativo"]): Rascunho {
  return {
    disciplina: ativo.disciplina,
    tema: ativo.tema,
    topicos: ativo.topicos ?? "",
    origem: ativo.origem,
    noticias: ativo.noticias,
  };
}

/** 429/503 pelo status OU pelo código: o BFF repassa os dois. */
function falhaDaIa(status: number, codigo: string | null): FalhaDaIa["tipo"] | null {
  if (status === 429 || codigo === "sem-saldo-de-ia") return "sem-saldo";
  if (status === 503 || codigo === "ia-indisponivel") return "indisponivel";
  return null;
}

export function PreparoJornalEscola({ turmaId, inicial }: { turmaId: string; inicial: PacotesDaTurma }) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const { ativo, historico } = inicial;

  const [rascunho, setRascunho] = useState<Rascunho>(() => rascunhoDoAtivo(ativo));
  /* O tema para o qual AS NOTÍCIAS NA TELA foram escritas. Trocar o texto do
     tema sem gerar um pacote novo deixaria a mesa falando da feira sob o título
     de outro assunto — a tela avisa, sem bloquear. */
  const [temaDasNoticias, setTemaDasNoticias] = useState(ativo.tema);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<IdDeNoticia | null>(null);

  const [gerando, setGerando] = useState(false);
  const [regenerando, setRegenerando] = useState<IdDeNoticia | null>(null);
  /* QUAL homologação está rodando: o "Aprovando…" vai para o botão que foi apertado. */
  const [homologando, setHomologando] = useState<Confirmacao | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [falha, setFalha] = useState<FalhaDaIa | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; erros: string[] } | null>(null);

  const [midia, setMidia] = useState<ResumoDaMidia>(ativo.midia);
  const [urls, setUrls] = useState<Record<string, string>>(ativo.imagens);
  const [falhas, setFalhas] = useState<IdDeNoticia[]>([]);
  const [gerandoMidia, setGerandoMidia] = useState(false);
  const [avisoMidia, setAvisoMidia] = useState<string | null>(null);

  /* O pacote em andamento MUDOU (a própria homologação, ou outra aba): o
     formulário passa a mostrar o novo. Um `router.refresh()` que não troca o
     pacote (o das imagens, o do zerar) entrega um objeto novo com o MESMO
     pacote, e isso não pode apagar o que o professor está editando — por isso a
     comparação é pelo id. */
  const [ativoVisto, setAtivoVisto] = useState(ativo.id);
  if (ativo.id !== ativoVisto) {
    setAtivoVisto(ativo.id);
    setRascunho(rascunhoDoAtivo(ativo));
    setTemaDasNoticias(ativo.tema);
    setEditando(null);
    setMidia(ativo.midia);
    setUrls(ativo.imagens);
    setFalhas([]);
    setAvisoMidia(null);
  }

  /* O laço das imagens pode estar no meio quando a turma troca (a `key`
     desmonta este componente): sem isto ele seguiria gastando a quota. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const base = `/api/plataforma/jornal-escola/turmas/${encodeURIComponent(turmaId)}`;

  const parametros = { disciplina: rascunho.disciplina, tema: rascunho.tema, topicos: rascunho.topicos };
  const errosDosParametros = problemasDosParametros(parametros);
  const parametrosValidos = Object.keys(errosDosParametros).length === 0;
  const alterado = !mesmoPacote(rascunho, ativo);
  const problemasDeCampo = new Map(rascunho.noticias.map((n) => [n.id, problemasPorCampo(n)] as const));
  const noticiasComProblema = rascunho.noticias.filter((n) => Object.keys(problemasDeCampo.get(n.id) ?? {}).length > 0);
  const problemasDoConjunto = problemasDaComposicao(rascunho.noticias);
  const errosDaApi = distribuirErros(erro?.erros ?? []);
  const podeAprovar = alterado && parametrosValidos && noticiasComProblema.length === 0 && problemasDoConjunto.length === 0;
  const doHistorico = historico.find((h) => h.id === ativo.id);
  const jaRodou = (doHistorico?.rodadas ?? 0) > 0 || ativo.etapa !== "exploracao" || ativo.rodada > 1;
  const ocupado = gerando || homologando !== null || regenerando !== null;
  const noticiaEmEdicao = editando ? rascunho.noticias.find((n) => n.id === editando) ?? null : null;

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

  async function gerar() {
    if (!parametrosValidos) return;
    setGerando(true);
    limparRecados();
    try {
      const r = await fetch(`${base}/gerar-conteudo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpoDosParametros(parametros)),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { codigo, mensagem } = erroDaResposta(corpo, "O gerador não respondeu. O pacote em andamento continua valendo.");
        const tipo = falhaDaIa(r.status, codigo);
        if (tipo) setFalha({ tipo, de: "gerar" });
        else setErro({ mensagem, erros: [] });
        return;
      }
      const novo = corpo as RascunhoDoPacote;
      /* A ORIGEM vai como o rascunho a trouxe: sem IA, o que está na tela é o
         banco padrão, e homologá-lo como `ia` mentiria no único registro que
         responde se a curadoria assistida está sendo usada. */
      setRascunho({
        disciplina: novo.disciplina,
        tema: novo.tema,
        topicos: novo.topicos ?? "",
        origem: novo.origem,
        noticias: novo.noticias,
      });
      setTemaDasNoticias(novo.tema);
      setAberto(true);
      setAviso(
        novo.usouIa
          ? { tipo: "success", texto: "Pacote gerado. Leia as 8 notícias e edite o que quiser antes de aprovar — nada vai à turma sem o seu clique." }
          : {
              tipo: "warning",
              texto: "A inteligência artificial não respondeu desta vez, e o que está abaixo é o banco padrão da Unooria. Você pode aprová-lo assim ou tentar gerar de novo.",
            },
      );
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  async function regenerar(id: IdDeNoticia) {
    if (!parametrosValidos) {
      setErro({ mensagem: "Para regenerar uma notícia, preencha o componente curricular e o tema acima.", erros: [] });
      return;
    }
    setRegenerando(id);
    limparRecados();
    try {
      const r = await fetch(`${base}/regenerar-noticia`, {
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
        const { codigo, mensagem } = erroDaResposta(
          corpo,
          "Não deu para regenerar agora. Tente de novo em instantes.",
        );
        const tipo = falhaDaIa(r.status, codigo);
        if (tipo) setFalha({ tipo, de: id });
        else setErro({ mensagem, erros: [] });
        return;
      }
      const { noticia, usouIa } = corpo as NoticiaRegenerada;
      if (!usouIa) {
        /* Sem IA, a notícia fica como estava: trocar por outra do banco padrão
           poria a feira de ciências no meio de um pacote de outro tema. */
        setAviso({ tipo: "warning", texto: "A inteligência artificial não respondeu desta vez, e a notícia ficou como estava." });
        return;
      }
      trocarNoticia({ ...noticia, id });
      // O pacote passa a ter texto escrito pela IA: a origem diz isso.
      setRascunho((atual) => ({ ...atual, origem: "ia" }));
      setAviso({
        tipo: "success",
        texto: "Notícia regenerada, com as pistas, o gabarito e a reação do leitor. Leia de novo antes de aprovar.",
      });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setRegenerando(null);
    }
  }

  async function homologar(
    qual: Confirmacao,
    corpo: { disciplina: string; tema: string; topicos?: string; origem: OrigemDoPacote; noticias: NoticiaDoPacote[] },
  ) {
    setHomologando(qual);
    limparRecados();
    try {
      const r = await fetch(`${base}/homologar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...corpo, noticias: corpo.noticias.map(normalizarNoticia) }),
      });
      if (!r.ok) {
        /* `pacote-invalido` traz a LISTA de problemas em frases para o
           professor — cada uma começa pela notícia, e vai para o cartão dela. */
        const { mensagem, erros } = erroDaResposta(await r.json().catch(() => null), "Não deu para aprovar o pacote agora.");
        setErro({ mensagem, erros });
        setAberto(true);
        return;
      }
      setEditando(null);
      setAviso({ tipo: "success", texto: COPY.sucesso });
      transicionar(() => router.refresh());
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setHomologando(null);
      setConfirmacao(null);
    }
  }

  function aprovarRascunho() {
    return homologar("aprovar", { ...corpoDosParametros(parametros), origem: rascunho.origem, noticias: rascunho.noticias });
  }

  /** O atalho de 1 toque: o banco padrão, pronto e revisado, direto para a turma. */
  async function aplicarPadrao() {
    setHomologando("padrao");
    limparRecados();
    let material: MaterialDoJornal;
    try {
      const r = await fetch("/api/plataforma/jornal-escola/professor/material", { cache: "no-store" });
      if (!r.ok) {
        setErro({ mensagem: erroDaResposta(await r.json().catch(() => null), "O banco padrão não carregou. Tente de novo.").mensagem, erros: [] });
        setHomologando(null);
        setConfirmacao(null);
        return;
      }
      material = (await r.json()) as MaterialDoJornal;
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
      setHomologando(null);
      setConfirmacao(null);
      return;
    }
    await homologar("padrao", { disciplina: material.disciplina, tema: material.tema, origem: "padrao", noticias: material.noticias });
  }

  function pedir(qual: Confirmacao) {
    /* Trocar o pacote de uma turma que já rodou recomeça a aula: é a única ação
       deste preparo que desfaz algo que a turma está vivendo. */
    if (jaRodou) setConfirmacao(qual);
    else void (qual === "aprovar" ? aprovarRascunho() : aplicarPadrao());
  }

  function repetirAposFalha() {
    if (!falha) return;
    if (falha.de === "gerar") void gerar();
    else void regenerar(falha.de);
  }

  function descartar() {
    setRascunho(rascunhoDoAtivo(ativo));
    setTemaDasNoticias(ativo.tema);
    setEditando(null);
    limparRecados();
  }

  async function gerarImagens() {
    setGerandoMidia(true);
    setAvisoMidia(null);
    let acumuladas = falhas;
    /* Teto de voltas por precaução: `continuarGerando` já para quando uma
       chamada não anda, e cada volta faz até duas imagens. */
    const tetoDeVoltas = Math.max(midia.total, 1) + 2;
    try {
      for (let volta = 0; volta < tetoDeVoltas && vivo.current; volta += 1) {
        const r = await fetch(`${base}/gerar-midia`, { method: "POST" });
        if (!r.ok) {
          /* 429 (a quota do professor) ou o provedor fora: a missão roda igual,
             com o cartão desenhado pelo meio. */
          setAvisoMidia(erroDaResposta(await r.json().catch(() => null), "As imagens não puderam ser geradas agora.").mensagem);
          break;
        }
        const progresso = (await r.json()) as ProgressoDaMidia;
        // Outra homologação trocou o pacote no meio do laço.
        if (progresso.pacoteId !== ativo.id) break;
        acumuladas = falhasAcumuladas(acumuladas, progresso);
        setMidia({ total: progresso.total, prontas: progresso.prontas });
        setUrls(progresso.imagens);
        setFalhas(acumuladas);
        if (!continuarGerando(progresso)) break;
      }
    } catch {
      setAvisoMidia(SEM_CONEXAO);
    } finally {
      setGerandoMidia(false);
      // O painel da aula lê o resumo da mídia do pacote: ele anda junto.
      if (vivo.current) transicionar(() => router.refresh());
    }
  }

  /** A imagem gerada vale enquanto a descrição dela é a do pacote em andamento. */
  function imagemDa(n: NoticiaDoPacote): string | undefined {
    const doAtivo = ativo.noticias.find((a) => a.id === n.id);
    const mesmaCena = (doAtivo?.descricaoImagem ?? "").trim() === (n.descricaoImagem ?? "").trim();
    return mesmaCena ? urls[n.id] : undefined;
  }

  const imagensCompletas = midia.total > 0 && midia.prontas >= midia.total;
  const temaInvalido = Boolean(errosDosParametros.tema);

  return (
    <Card variant="elevated" title={COPY.titulo}>
      <div className="flex flex-col gap-5" data-preparo-jornal>
        <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
          Escolha as notícias que a turma vai investigar na mesa da redação.{" "}
          <strong>Nenhum texto gerado por inteligência artificial é exibido aos estudantes sem a sua aprovação neste painel.</strong>
        </p>

        {/* O estado da turma vem antes dos campos: "o que a turma está lendo?"
            é a pergunta que o professor faz antes de mexer em qualquer coisa. */}
        <p className="text-[12px] text-unooria-neutral-600" data-pacote-ativo={ativo.id}>
          Em andamento nesta turma: <strong className="text-unooria-neutral-900">“{ativo.tema}”</strong> ({ativo.disciplina}),{" "}
          {ROTULO_DA_ORIGEM[ativo.origem]} · rodada {ativo.rodada}.
        </p>

        {/* ─────────────────────────────────── o caminho rápido ───── */}
        <div className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-4">
          <div>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icon name="newspaper" size={18} />}
              onClick={() => pedir("padrao")}
              isDisabled={ocupado}
              data-acao="usar-banco-padrao"
            >
              {homologando === "padrao" ? "Aprovando…" : COPY.atalho}
            </Button>
          </div>
          <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">{COPY.ajudaDoAtalho}</p>
        </div>

        {/* ─────────────────────────────── o caminho personalizado ───── */}
        <div className="flex flex-col gap-3">
          <p className="text-[14px] font-semibold text-unooria-neutral-950">Ou prepare um pacote sobre o tema da sua aula</p>
          <div className="grid gap-3 lg:grid-cols-2">
            <TextField
              label={COPY.rotuloDaDisciplina}
              helperText={errosDosParametros.disciplina ? undefined : "Ciências, História, Língua Portuguesa…"}
              value={rascunho.disciplina}
              maxLength={PARAMETROS.disciplina.max}
              error={errosDosParametros.disciplina}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarParametro("disciplina", e.target.value)}
            />
            <TextField
              label={COPY.rotuloDoTema}
              placeholder={COPY.exemploDoTema}
              helperText={errosDosParametros.tema ? undefined : `${COPY.ajudaDoTema} Até ${PARAMETROS.tema.max} caracteres.`}
              value={rascunho.tema}
              maxLength={PARAMETROS.tema.max}
              error={errosDosParametros.tema}
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
              onClick={() => void gerar()}
              isDisabled={ocupado || !parametrosValidos}
              data-acao="gerar-pacote"
            >
              {gerando ? "Gerando…" : COPY.gerar}
            </Button>
          </div>
          {gerando ? <ProgressBar indeterminate label={COPY.gerando} variant="brand" /> : null}
          {!temaInvalido && rascunho.tema.trim() !== temaDasNoticias.trim() ? (
            <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
              O tema mudou, mas as notícias na tela ainda falam de “{temaDasNoticias}”. Clique em {COPY.gerar} para
              escrevê-las sobre o tema novo — ou aprove sabendo que a mesa continua sobre o anterior.
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
                    <Button variant="secondary" size="sm" onClick={repetirAposFalha} isDisabled={ocupado}>
                      Tentar de novo
                    </Button>
                  ) : null}
                  <Button variant="primary" size="sm" onClick={() => pedir("padrao")} isDisabled={ocupado} data-acao="banco-padrao-da-falha">
                    Usar Banco Padrão
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
                  {Object.keys(errosDaApi.porNoticia).length > 0 ? <span>As notícias com ajuste estão marcadas abaixo.</span> : null}
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
          <p className="max-w-3xl text-[13px] leading-snug text-unooria-neutral-700">{COPY.instrucaoDaCuradoria}</p>
          <p className="text-[12px] text-unooria-neutral-600" data-composicao>
            {textoDaComposicao(rascunho.noticias)}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icon name="check_circle" size={18} />}
              onClick={() => pedir("aprovar")}
              isDisabled={ocupado || !podeAprovar}
              data-acao="aprovar-pacote"
            >
              {homologando === "aprovar" ? "Aprovando…" : COPY.aprovar}
            </Button>
            {alterado ? (
              <Button variant="ghost" size="sm" onClick={descartar} isDisabled={ocupado}>
                Voltar ao pacote em andamento
              </Button>
            ) : null}
          </div>

          {/* O botão apagado sem motivo escrito é o silêncio que a exp05ef1b já
              pagou: diga o que falta, e onde. */}
          {!alterado ? (
            <p className="text-[12px] leading-snug text-unooria-neutral-600">
              Nada mudou em relação ao pacote em andamento — a turma já pode entrar com ele. Gere um pacote
              sobre o seu tema, ou edite uma notícia, para aprovar um pacote novo.
            </p>
          ) : !parametrosValidos || noticiasComProblema.length > 0 || problemasDoConjunto.length > 0 ? (
            <div className="flex flex-col gap-1 text-[12px] leading-snug text-unooria-danger" role="status">
              {!parametrosValidos ? <p>Falta o componente curricular ou o tema, nos campos acima.</p> : null}
              {noticiasComProblema.length > 0 ? (
                <p>
                  {noticiasComProblema.length === 1 ? "Uma notícia precisa" : `${noticiasComProblema.length} notícias precisam`} de ajuste.{" "}
                  {aberto ? "Elas estão marcadas abaixo." : "Abra as notícias para ver qual."}
                </p>
              ) : null}
              {problemasDoConjunto.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ) : jaRodou ? (
            <p className="text-[12px] leading-snug text-unooria-neutral-700">
              <strong>Aprovar cria uma atividade nova:</strong> a turma volta ao começo, na rodada 1, com as
              notícias novas. O que já foi feito continua no histórico abaixo e no painel de habilidades.
            </p>
          ) : null}

          {/* Renderização CONDICIONAL, e não `Collapse`: fechado, o `Collapse`
              do DS deixa os controles de dentro focáveis sob `aria-hidden` (ver
              o AGENTS da área). Fechado por padrão porque, durante a aula, a
              mesa empurraria o painel da turma para fora da tela. */}
          <div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Icon name={aberto ? "expand_less" : "expand_more"} size={18} />}
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              data-acao="mostrar-noticias"
            >
              {aberto ? "Esconder as 8 notícias" : "Ler e editar as 8 notícias (só você vê o gabarito)"}
            </Button>
          </div>

          {aberto ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-mesa-do-preparo>
              {rascunho.noticias.map((n) => (
                <CartaoDoPreparo
                  key={n.id}
                  noticia={n}
                  imagem={imagemDa(n)}
                  problemas={Object.keys(problemasDeCampo.get(n.id) ?? {}).length}
                  errosDaApi={errosDaApi.porNoticia[n.id] ?? []}
                  aoEditar={() => setEditando(n.id)}
                  aoRegenerar={() => void regenerar(n.id)}
                  regenerando={regenerando === n.id}
                  ocupado={ocupado}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* ───────────────────────────────────────────── as imagens ───── */}
        <div className="flex flex-col gap-2 border-t border-unooria-neutral-200 pt-4">
          <p className="text-[14px] font-semibold text-unooria-neutral-950">Imagens das notícias</p>
          {midia.total > 0 ? (
            <ProgressBar
              label={textoDoProgressoDaMidia(midia)}
              value={midia.prontas}
              max={midia.total}
              valueFormatter={(v, m) => `${v} de ${m}`}
              variant={imagensCompletas ? "success" : "brand"}
              data-progresso-midia
            />
          ) : (
            <p className="text-[12px] text-unooria-neutral-600">{textoDoProgressoDaMidia(midia)}</p>
          )}
          <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
            Opcional. As imagens saem duas por vez e podem levar alguns minutos: faça antes da aula. Notícia sem
            imagem aparece com o desenho do meio, e a missão roda igual.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Icon name="image" size={18} />}
              onClick={() => void gerarImagens()}
              isDisabled={gerandoMidia || alterado || imagensCompletas || midia.total === 0}
              data-acao="gerar-imagens"
            >
              {gerandoMidia ? "Gerando imagens…" : "Gerar imagens"}
            </Button>
            {alterado ? (
              <span className="text-[12px] text-unooria-neutral-600">
                Aprove o pacote antes: as imagens são do pacote que a turma vai ler.
              </span>
            ) : null}
          </div>
          {falhas.length > 0 ? (
            <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
              {falhas.length === 1
                ? "1 notícia não ganhou imagem e segue com o desenho do meio."
                : `${falhas.length} notícias não ganharam imagem e seguem com o desenho do meio.`}{" "}
              Tente de novo mais tarde.
            </p>
          ) : null}
          {avisoMidia ? <FeedbackAlert type="warning" description={avisoMidia} /> : null}
        </div>

        {/* ──────────────────────────────────────── o histórico ───── */}
        {historico.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-unooria-neutral-200 pt-4">
            <p className="text-[14px] font-semibold text-unooria-neutral-950">Pacotes desta turma</p>
            <p className="text-[12px] leading-snug text-unooria-neutral-600">
              Cada pacote aprovado é uma atividade, e o painel de habilidades lá embaixo lê um de cada vez.
              Zerar a turma abre uma rodada nova do mesmo pacote.
            </p>
            <ul className="flex flex-col gap-2" data-historico-pacotes>
              {historico.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 text-[13px] text-unooria-neutral-800">
                  <span className="font-medium text-unooria-neutral-950">“{h.tema}”</span>
                  <span className="text-unooria-neutral-600">
                    {h.disciplina} · {ROTULO_DA_ORIGEM[h.origem]} · {dataCurta(h.criadoEm)} · {textoDasRodadas(h.rodadas)}
                  </span>
                  {h.ativo ? (
                    <Tag variant="success" size="sm" pill>
                      em andamento
                    </Tag>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {noticiaEmEdicao ? (
        <EditorDaNoticia
          noticia={noticiaEmEdicao}
          problemas={problemasDeCampo.get(noticiaEmEdicao.id) ?? {}}
          errosDaApi={errosDaApi.porNoticia[noticiaEmEdicao.id] ?? []}
          aoMudar={trocarNoticia}
          aoFechar={() => setEditando(null)}
          aoRegenerar={() => void regenerar(noticiaEmEdicao.id)}
          regenerando={regenerando === noticiaEmEdicao.id}
          ocupado={ocupado}
        />
      ) : null}

      <Modal
        isOpen={confirmacao !== null}
        onClose={() => (homologando ? undefined : setConfirmacao(null))}
        title="Trocar o pacote de uma turma que já começou?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            A turma está com “{ativo.tema}” em andamento, na rodada {ativo.rodada}.{" "}
            <strong>Aprovar cria uma atividade nova</strong>: a turma volta ao começo, na rodada 1, com{" "}
            {confirmacao === "padrao" ? "o banco padrão da Unooria" : "as notícias que você revisou"}. O que já foi feito
            continua no histórico e no painel de habilidades.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => void (confirmacao === "padrao" ? aplicarPadrao() : aprovarRascunho())}
              isDisabled={homologando !== null}
              data-acao="confirmar-troca-de-pacote"
            >
              {homologando ? "Aprovando…" : "Aprovar e recomeçar"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmacao(null)} isDisabled={homologando !== null}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
