"use client";

import { useState } from "react";
import { Button, Card, FeedbackAlert, Icon, Tag, TextArea, TextField } from "@edu/ui/ds";
import {
  AssistenteDeAtividade,
  type ResultadoDaCriacao,
  type TurmaDoAssistente,
} from "@/components/atividades/assistente-de-atividade";
import {
  FALAS_DO_PODCAST,
  FOCO_MAX,
  ROTULO_DA_LENTE,
  TEMA,
  problemaDaFala,
  problemaDaLegenda,
  type CoberturaCriada,
  type Enquadramento,
  type ErroDaSelecao,
  type FalasDoPodcast,
  type MaterialDaSelecao,
  type OrigemDaCobertura,
  type PostDaCobertura,
  type RascunhoDaCobertura,
} from "@/lib/a-selecao-tipos";

const LENTES: readonly Enquadramento[] = ["institucional", "comunitario", "estatistico"];

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
 * Nada vai à turma sem o clique em "Criar atividade" — e nem esse clique põe no
 * ar: a atividade nasce PRONTA, e o último passo pergunta se ela já entra em
 * andamento. `gerar-conteudo` NÃO persiste; o que grava é `homologar`.
 *
 * O que é editável é a LEGENDA e as falas. Veículo, lente e as tags (fonte
 * ouvida, ângulo) são do molde e sustentam a matriz do Mural; aparecem para a
 * professora — conduzir sem saber quem cada post ouviu é impossível — mas não
 * mudam aqui. As IMAGENS se geram depois, na página da atividade: são da
 * cobertura gravada, e gerar para um rascunho gastaria a quota à toa.
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

  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
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
      return { ok: false, ...(await lerErro(r, "Não deu para criar a atividade agora.")) };
    }
    const criada = (await r.json()) as CoberturaCriada;
    return { ok: true, id: criada.id };
  }

  const trocarLegenda = (id: string, legenda: string) =>
    setLote((atual) => ({ ...atual, posts: atual.posts.map((p) => (p.id === id ? { ...p, legenda } : p)) }));

  return (
    <AssistenteDeAtividade
      expId="exp07ef1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={pronto}
      resumoDoConteudo={temLote ? `“${lote.tema.trim()}” · 12 posts e as três falas do podcast` : null}
      criar={criar}
      conteudo={(turmaId) => (
        <Card variant="outlined" title="A cobertura que a turma vai ler">
          <div className="flex flex-col gap-5" data-preparo-selecao>
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
                error={lote.tema && temaInvalido ? `Escreva de ${TEMA.min} a ${TEMA.max} caracteres.` : undefined}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLote((a) => ({ ...a, tema: e.target.value }))}
              />
              <TextField
                label="Um detalhe da sua cidade ou escola (opcional)"
                helperText={`Bairro, escola ou contexto que a cobertura deve considerar. Até ${FOCO_MAX} caracteres.`}
                value={lote.foco}
                maxLength={FOCO_MAX}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLote((a) => ({ ...a, foco: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Icon name="auto_awesome" size={18} />}
                onClick={() => void gerar(turmaId)}
                isDisabled={gerando || temaInvalido}
                data-acao="gerar-lote"
              >
                {gerando ? "Gerando…" : "Gerar Lote com IA"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void usarPronta()}
                isDisabled={gerando}
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

            {temLote ? (
              <div className="grid gap-4 lg:grid-cols-3" data-grade-de-posts>
                {LENTES.map((lente) => (
                  <div key={lente} className="flex flex-col gap-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                      {ROTULO_DA_LENTE[lente]}
                    </p>
                    {lote.posts
                      .filter((p) => p.enquadramento === lente)
                      .map((p) => (
                        <PostEditavel
                          key={p.id}
                          post={p}
                          problema={problemas.get(p.id) ?? null}
                          aoTrocar={(legenda) => trocarLegenda(p.id, legenda)}
                        />
                      ))}
                  </div>
                ))}
              </div>
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
          </div>
        </Card>
      )}
    />
  );
}

/**
 * Um post na grade da criação: a cena (o gráfico ou a descrição — a imagem se
 * gera depois, na página da atividade), a LEGENDA editável e as fichas que só
 * a professora vê. O rótulo das fichas é o mesmo que a turma lê quando você as
 * revela (`e4.feedback.label_fonte`/`label_angulo`).
 */
function PostEditavel({
  post,
  problema,
  aoTrocar,
}: {
  post: PostDaCobertura;
  problema: string | null;
  aoTrocar: (legenda: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3" data-post={post.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-unooria-neutral-950">{post.perfil}</span>
        <Tag variant="neutral" size="sm">
          {ROTULO_DA_LENTE[post.enquadramento]}
        </Tag>
      </div>

      {/* A mesma saída da tela da criança: sem imagem, a cena por escrito. É
          MEDIDA (a proporção do quadro), não componente. */}
      <div className="flex aspect-square w-full items-center justify-center rounded-md bg-unooria-neutral-100 p-4">
        <p className="text-center text-[12px] leading-snug text-unooria-neutral-600">
          {post.grafico ? `Gráfico: ${post.grafico.titulo}` : post.descricaoImagem}
        </p>
      </div>

      <TextArea
        label="Legenda"
        value={post.legenda}
        rows={4}
        maxLength={400}
        error={problema ?? undefined}
        helperText={problema ? undefined : "De 20 a 45 palavras."}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => aoTrocar(e.target.value)}
      />

      <div className="flex flex-col gap-1">
        <Tag variant="info" size="sm">
          Fonte ouvida: {post.tagFonte}
        </Tag>
        <Tag variant="info" size="sm">
          Ângulo da imagem: {post.tagAngulo}
        </Tag>
        {post.autoridadeCitada ? (
          <span className="text-[11px] text-unooria-neutral-500">Cita: {post.autoridadeCitada}</span>
        ) : null}
      </div>
    </div>
  );
}
