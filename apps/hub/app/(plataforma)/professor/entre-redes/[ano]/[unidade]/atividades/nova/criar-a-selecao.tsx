"use client";

import { useCallback, useState } from "react";
import { Button, Card, FeedbackAlert, Icon, TextArea, TextField } from "@edu/ui/ds";
import {
  AssistenteDeAtividade,
  type ResultadoDaCriacao,
  type TurmaDoAssistente,
} from "@/components/atividades/assistente-de-atividade";
import { CartaoDoPost, CenaPorEscrito, FaseDasImagens, GradeDosPosts } from "../../grade-da-cobertura";
import {
  FALAS_DO_PODCAST,
  FOCO_MAX,
  TEMA,
  problemaDaFala,
  problemaDaLegenda,
  type CoberturaCriada,
  type ErroDaSelecao,
  type FalasDoPodcast,
  type MaterialDaSelecao,
  type OrigemDaCobertura,
  type PostDaCobertura,
  type RascunhoDaCobertura,
} from "@/lib/a-selecao-tipos";

/** O aviso do sheet para o rascunho que voltou sem IA — verbatim de `e0.prof.quota_aviso`. */
const AVISO_SEM_IA =
  "A assistente de curadoria do grêmio está temporariamente sem saldo para novas coberturas personalizadas. O tema padrão oficial do grêmio foi carregado para sua aula.";

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

type Aviso = { tipo: "success" | "warning"; texto: string };

/** O lote na tela: os 12 posts e as três falas do podcast, como a professora os deixou. */
interface Lote {
  tema: string;
  foco: string;
  origem: OrigemDaCobertura;
  posts: PostDaCobertura[];
  podcast: FalasDoPodcast | null;
}

const VAZIO: Lote = { tema: "", foco: "", origem: "padrao", posts: [], podcast: null };

/** Os textos aprovados (a primeira fase): a cobertura gravada, de UMA turma. */
interface TextosAprovados {
  id: string;
  turmaId: string;
  posts: PostDaCobertura[];
  imagens: Record<string, string>;
}

/** Fase 1, no card de cada post: a imagem vem depois (o pedido do PO, verbatim no espírito). */
const AVISO_DA_IMAGEM = "A imagem será gerada após a aprovação dos textos.";

async function lerErro(r: Response, padrao: string): Promise<{ mensagem: string; erros: string[] }> {
  const corpo = (await r.json().catch(() => ({}))) as ErroDaSelecao;
  return { mensagem: corpo.mensagem ?? padrao, erros: corpo.erros ?? [] };
}

/**
 * NOVA ATIVIDADE de A SELEÇÃO (ADR-130): o preparo da cobertura virou o passo
 * de conteúdo da criação. A missão é o esqueleto; a cobertura — o evento, os
 * 12 posts dos três veículos e as três falas do podcast — é a atividade que a
 * turma lê de fato, e nasce do professor: gerada com IA sobre o tema dele, ou a
 * partir da cobertura pronta da Unooria (a praça central), que ele lê e edita.
 *
 * A APROVAÇÃO EM DUAS FASES, NUMA TELA SÓ (ADR-146, pedido do PO):
 *
 * 1. **Os textos.** A professora lê e edita os 12 posts e as três falas do
 *    podcast; no lugar de cada imagem, o aviso de que ela vem depois. "Aprovar
 *    textos" grava a cobertura (`homologar`) — `gerar-conteudo` NÃO persiste.
 * 2. **As imagens.** Gravados os textos, as imagens se geram sozinhas e
 *    aparecem no MESMO card de cada post (`FaseDasImagens`): a professora vê a
 *    composição que a criança vai ver e gera outra para a que não serve.
 *
 * O botão final do assistente — "Aprovar Cobertura e Abrir Turma" — só acende
 * depois das duas, e é ele que aprova as imagens (`aprovar-imagens`) e, com o
 * "pôr no ar" ligado, abre a turma (`concluirCriacao`, que libera a missão na
 * sala). Gerar imagem para um RASCUNHO gastaria a quota à toa: por isso os
 * textos são gravados antes.
 *
 * O que é editável é a LEGENDA e as falas, e só na primeira fase. Veículo,
 * lente e as tags (fonte ouvida, ângulo) são do molde e sustentam a matriz do
 * Mural; aparecem para a professora — conduzir sem saber quem cada post ouviu
 * é impossível — mas não mudam aqui.
 */
export function CriarASelecao({
  turmas,
  turmaInicial,
  rotaDaMissao,
}: {
  turmas: TurmaDoAssistente[];
  turmaInicial: string;
  rotaDaMissao: string;
}) {
  const [lote, setLote] = useState<Lote>(VAZIO);
  /* O tema para o qual OS POSTS NA TELA foram escritos. Trocar o texto do tema
     sem gerar um lote novo deixaria o feed falando da praça sob o título de
     outro evento — a tela avisa, sem bloquear. */
  const [temaDosPosts, setTemaDosPosts] = useState("");
  const [gerando, setGerando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; erros: string[] } | null>(null);
  const [aprovados, setAprovados] = useState<TextosAprovados | null>(null);
  const [aprovandoTextos, setAprovandoTextos] = useState(false);
  const [imagensProntas, setImagensProntas] = useState(false);
  const aoMudarProntidao = useCallback((pronta: boolean) => setImagensProntas(pronta), []);

  const tamanhoDoTema = lote.tema.trim().length;
  const temaInvalido = tamanhoDoTema < TEMA.min || tamanhoDoTema > TEMA.max;
  const problemas = new Map(
    lote.posts.flatMap((p) => {
      const problema = problemaDaLegenda(p.legenda);
      return problema ? [[p.id, problema] as const] : [];
    }),
  );
  const problemasDoPodcast = new Map(
    lote.podcast
      ? FALAS_DO_PODCAST.flatMap(({ campo }) => {
          const problema = problemaDaFala(lote.podcast?.[campo] ?? "");
          return problema ? [[campo, problema] as const] : [];
        })
      : [],
  );
  const temLote = lote.posts.length > 0 && lote.podcast !== null;
  const pronto = temLote && !temaInvalido && problemas.size === 0 && problemasDoPodcast.size === 0;

  async function gerar(turmaId: string) {
    setGerando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(`/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}/gerar-conteudo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tema: lote.tema.trim(), foco: lote.foco.trim() || undefined }),
      });
      if (!r.ok) {
        setErro(await lerErro(r, "O gerador não respondeu. Tente de novo, ou use a cobertura pronta da Unooria."));
        return;
      }
      const rascunho = (await r.json()) as RascunhoDaCobertura;
      /* A ORIGEM vai como o rascunho a trouxe: sem IA, o que está na tela é o
         banco curado, e gravá-lo como `ia` mentiria no único registro que
         responde se a curadoria assistida está sendo usada. */
      setLote({
        tema: rascunho.tema,
        foco: rascunho.foco ?? "",
        origem: rascunho.origem,
        posts: rascunho.posts,
        podcast: rascunho.podcast,
      });
      setTemaDosPosts(rascunho.tema);
      setAviso(
        rascunho.usouIa
          ? {
              tipo: "success",
              texto:
                "Lote gerado. Leia os 12 posts e as três falas do podcast, e edite o que quiser — nada vai à turma sem o seu clique.",
            }
          : { tipo: "warning", texto: AVISO_SEM_IA },
      );
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  async function usarPronta() {
    setGerando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch("/api/plataforma/a-selecao/professor/material", { cache: "no-store" });
      if (!r.ok) {
        setErro(await lerErro(r, "Não deu para carregar a cobertura pronta agora."));
        return;
      }
      const material = (await r.json()) as MaterialDaSelecao;
      setLote({ tema: material.tema, foco: "", origem: "padrao", posts: material.posts, podcast: material.podcast });
      setTemaDosPosts(material.tema);
      setAviso({
        tipo: "success",
        texto: "A cobertura pronta da Unooria foi carregada. Leia e edite o que quiser antes de criar a atividade.",
      });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  /** A PRIMEIRA fase: grava os textos como a professora os deixou, e as imagens começam. */
  async function aprovarTextos(turmaId: string) {
    setAprovandoTextos(true);
    setErro(null);
    try {
      const r = await fetch(`/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}/homologar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tema: lote.tema.trim(),
          foco: lote.foco.trim() || undefined,
          origem: lote.origem,
          posts: lote.posts,
          podcast: lote.podcast,
        }),
      });
      if (!r.ok) {
        /* `lote-invalido` traz a LISTA de problemas em frases para a professora
           (`problemasDoLote`, na api) — o termo que antecipa a revelação,
           sobretudo, que só a api sabe conferir. */
        setErro(await lerErro(r, "Não deu para aprovar os textos agora."));
        return;
      }
      const criada = (await r.json()) as CoberturaCriada & { posts: PostDaCobertura[] };
      /* A cobertura nasce com as imagens HERDADAS de outra da turma com a
         mesma cena; o detalhe as traz, e a fase das imagens não as paga de novo. */
      const detalhe = await fetch(
        `/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}/coberturas/${encodeURIComponent(criada.id)}`,
        { cache: "no-store" },
      );
      const imagens = detalhe.ok ? (((await detalhe.json()) as { imagens?: Record<string, string> }).imagens ?? {}) : {};
      setAprovados({ id: criada.id, turmaId, posts: criada.posts, imagens });
      setAviso(null);
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setAprovandoTextos(false);
    }
  }

  /** O botão final do assistente: a SEGUNDA fase — as imagens que a professora viu, aprovadas. */
  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (!aprovados || aprovados.turmaId !== turmaId) {
      return { ok: false, mensagem: "Aprove os textos e as imagens desta turma antes de continuar.", erros: [] };
    }
    const r = await fetch(
      `/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}/coberturas/${encodeURIComponent(aprovados.id)}/aprovar-imagens`,
      { method: "POST" },
    );
    if (!r.ok) return { ok: false, ...(await lerErro(r, "Não deu para aprovar as imagens agora.")) };
    return { ok: true, id: aprovados.id };
  }

  function recomecar() {
    setAprovados(null);
    setImagensProntas(false);
  }

  const trocarLegenda = (id: string, legenda: string) =>
    setLote((atual) => ({ ...atual, posts: atual.posts.map((p) => (p.id === id ? { ...p, legenda } : p)) }));

  return (
    <AssistenteDeAtividade
      expId="exp07ef1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={aprovados !== null && imagensProntas}
      resumoDoConteudo={
        aprovados ? `“${lote.tema.trim()}” · 12 posts com os textos e as imagens aprovados, e as três falas do podcast` : null
      }
      criar={criar}
      rotuloDoCriar={(noAr) => (noAr ? "Aprovar Cobertura e Abrir Turma" : "Aprovar cobertura")}
      conteudo={(turmaId) => {
        const fase2 = aprovados !== null && aprovados.turmaId === turmaId;
        const travado = aprovados !== null;
        return (
        <Card variant="outlined" title="A cobertura que a turma vai ler">
          <div className="flex flex-col gap-5" data-preparo-selecao data-fase={fase2 ? "imagens" : "textos"}>
            <p className="text-[13px] font-semibold text-unooria-neutral-950" data-fase-da-aprovacao>
              {fase2 ? "Fase 2 de 2: as imagens" : "Fase 1 de 2: os textos"}
            </p>
            {aprovados && !fase2 ? (
              <FeedbackAlert
                type="warning"
                description={
                  <span className="flex flex-col items-start gap-2">
                    <span>
                      Os textos desta cobertura foram aprovados para outra turma. Volte à turma anterior para continuar,
                      ou comece uma cobertura nova para esta.
                    </span>
                    <Button variant="secondary" size="sm" onClick={recomecar} data-acao="recomecar-cobertura">
                      Começar uma cobertura nova
                    </Button>
                  </span>
                }
              />
            ) : null}
            <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
              Escolha o evento que os três veículos cobrem: a IA escreve os 12 posts sobre o tema que você der, ou
              você parte da cobertura pronta da Unooria.{" "}
              <strong>
                Nenhum texto gerado por inteligência artificial é exibido aos estudantes sem a sua aprovação.
              </strong>
            </p>

            <div className="grid gap-3 lg:grid-cols-2">
              <TextField
                label="Evento central coberto pelos veículos"
                helperText={`De ${TEMA.min} a ${TEMA.max} caracteres. É sobre isto que os 12 posts falam.`}
                value={lote.tema}
                maxLength={TEMA.max}
                disabled={travado}
                error={lote.tema && temaInvalido ? `Escreva de ${TEMA.min} a ${TEMA.max} caracteres.` : undefined}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLote((a) => ({ ...a, tema: e.target.value }))}
              />
              <TextField
                label="Um detalhe da sua cidade ou escola (opcional)"
                helperText={`Bairro, escola ou contexto que a cobertura deve considerar. Até ${FOCO_MAX} caracteres.`}
                value={lote.foco}
                maxLength={FOCO_MAX}
                disabled={travado}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLote((a) => ({ ...a, foco: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Icon name="auto_awesome" size={18} />}
                onClick={() => void gerar(turmaId)}
                isDisabled={gerando || temaInvalido || travado}
                data-acao="gerar-lote"
              >
                {gerando ? "Gerando…" : "Gerar Lote com IA"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void usarPronta()}
                isDisabled={gerando || travado}
                data-acao="usar-cobertura-pronta"
              >
                Usar a cobertura pronta da Unooria
              </Button>
            </div>

            {!temLote ? (
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                Gere o lote com IA sobre o seu tema, ou use a cobertura pronta da Unooria. Os 12 posts aparecem aqui
                para você ler e editar.
              </p>
            ) : problemas.size > 0 || problemasDoPodcast.size > 0 ? (
              <p className="text-[12px] leading-snug text-unooria-danger" role="status">
                {problemas.size > 0
                  ? `${problemas.size === 1 ? "Um dos 12 posts tem" : `${problemas.size} dos 12 posts têm`} legenda fora do limite de 20 a 45 palavras. O campo está marcado abaixo.`
                  : `${problemasDoPodcast.size === 1 ? "Uma das falas do podcast precisa" : `${problemasDoPodcast.size} falas do podcast precisam`} de ajuste. O campo está marcado abaixo.`}
              </p>
            ) : null}

            {temLote && !temaInvalido && lote.tema.trim() !== temaDosPosts.trim() ? (
              <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
                O tema mudou, mas os posts na tela ainda falam de “{temaDosPosts}”. Clique em Gerar Lote com IA para
                escrevê-los sobre o tema novo — ou siga sabendo que o feed continua sobre o anterior.
              </p>
            ) : null}

            {aviso ? <FeedbackAlert type={aviso.tipo} description={aviso.texto} /> : null}
            {erro ? (
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
            ) : null}

            {fase2 && aprovados ? (
              <FaseDasImagens
                key={aprovados.id}
                turmaId={turmaId}
                coberturaId={aprovados.id}
                posts={aprovados.posts}
                imagensIniciais={aprovados.imagens}
                aoMudarProntidao={aoMudarProntidao}
              />
            ) : temLote && !travado ? (
              <GradeDosPosts
                posts={lote.posts}
                cartao={(p) => {
                  const problema = problemas.get(p.id) ?? null;
                  return (
                    <CartaoDoPost
                      key={p.id}
                      post={p}
                      imagem={<CenaPorEscrito post={p} aviso={p.grafico ? undefined : AVISO_DA_IMAGEM} />}
                      legenda={
                        <TextArea
                          label="Legenda"
                          value={p.legenda}
                          rows={4}
                          maxLength={400}
                          error={problema ?? undefined}
                          helperText={problema ? undefined : "De 20 a 45 palavras."}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocarLegenda(p.id, e.target.value)}
                        />
                      }
                    />
                  );
                }}
              />
            ) : null}

            {lote.podcast ? (
              /* As três falas do Bloco 2 do podcast, junto dos posts que elas
                 resumem: é o único trecho do roteiro que muda com o tema. */
              <div
                className="flex flex-col gap-3 rounded-lg border border-unooria-neutral-200 p-4"
                data-falas-do-podcast
              >
                <div className="flex flex-col gap-1">
                  <p className="text-[14px] font-semibold text-unooria-neutral-950">
                    O podcast de recapitulação: o que ele diz de cada veículo
                  </p>
                  <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
                    O podcast é seu, para tocar à turma depois da aula. O roteiro é o aprovado pela Unooria; só estas
                    três falas mudam com o tema, porque contam o que cada veículo mostrou.
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  {FALAS_DO_PODCAST.map(({ campo, falante, veiculo }) => {
                    const problema = problemasDoPodcast.get(campo) ?? null;
                    return (
                      <TextArea
                        key={campo}
                        label={`${falante}, sobre ${veiculo}`}
                        value={lote.podcast?.[campo] ?? ""}
                        rows={5}
                        maxLength={600}
                        disabled={travado}
                        error={problema ?? undefined}
                        helperText={problema ? undefined : "De 12 a 60 palavras, sem link nem @."}
                        data-fala={campo}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setLote((a) => (a.podcast ? { ...a, podcast: { ...a.podcast, [campo]: e.target.value } } : a))
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}

            {temLote && !travado ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void aprovarTextos(turmaId)}
                  isDisabled={!pronto || aprovandoTextos || gerando}
                  isLoading={aprovandoTextos}
                  data-acao="aprovar-textos"
                >
                  Aprovar textos e gerar as imagens
                </Button>
                <span className="max-w-xl text-[12px] leading-snug text-unooria-neutral-600">
                  Depois de aprovados, os textos não mudam mais. As imagens são geradas em seguida, no card de cada
                  post, para você conferir antes de abrir a turma.
                </span>
              </div>
            ) : null}
          </div>
        </Card>
        );
      }}
    />
  );
}
