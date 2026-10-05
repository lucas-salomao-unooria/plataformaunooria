"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button, FeedbackAlert, Icon, ProgressBar, Tag } from "@edu/ui/ds";
import {
  ROTULO_DA_LENTE,
  continuarGerando,
  estadoDaImagem,
  falhasAcumuladas,
  type Enquadramento,
  type ErroDaSelecao,
  type IdDePost,
  type ImagemRegerada,
  type PostDaCobertura,
  type ProgressoDaMidia,
} from "@/lib/a-selecao-tipos";

const LENTES: readonly Enquadramento[] = ["institucional", "comunitario", "estatistico"];

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

/**
 * A GRADE DA COBERTURA de A Seleção — os 12 posts em três colunas, uma por
 * veículo. É a MESMA grade nas duas fases da aprovação (ADR-146), para o
 * professor nunca trocar de tela entre aprovar os textos e aprovar as imagens:
 * na primeira o card leva a legenda editável e o aviso de que a imagem vem
 * depois; na segunda, a imagem gerada no lugar do aviso.
 */
export function GradeDosPosts({
  posts,
  cartao,
}: {
  posts: readonly PostDaCobertura[];
  cartao: (post: PostDaCobertura) => ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3" data-grade-de-posts>
      {LENTES.map((lente) => (
        <div key={lente} className="flex flex-col gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
            {ROTULO_DA_LENTE[lente]}
          </p>
          {posts.filter((p) => p.enquadramento === lente).map((p) => cartao(p))}
        </div>
      ))}
    </div>
  );
}

/**
 * Um post na grade: o perfil, a ÁREA DA IMAGEM (o que cada fase põe ali), a
 * legenda e as fichas que só o professor vê. O rótulo das fichas é o mesmo que
 * a turma lê quando você as revela (`e4.feedback.label_fonte`/`label_angulo`).
 */
export function CartaoDoPost({
  post,
  imagem,
  legenda,
  acoes,
}: {
  post: PostDaCobertura;
  imagem: ReactNode;
  legenda: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3" data-post={post.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-unooria-neutral-950">{post.perfil}</span>
        <Tag variant="neutral" size="sm">
          {ROTULO_DA_LENTE[post.enquadramento]}
        </Tag>
      </div>

      {/* O quadro tem a proporção da imagem da criança (1:1). É MEDIDA, não componente. */}
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-unooria-neutral-100">
        {imagem}
      </div>

      {legenda}
      {acoes}

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

/** A imagem que está sendo gerada: o progresso indeterminado do DS, no lugar dela. */
function Gerando({ rotulo }: { rotulo: string }) {
  return (
    <div className="flex w-3/4 flex-col items-center gap-2" role="status">
      <ProgressBar indeterminate animated label={rotulo} />
    </div>
  );
}

/** A cena por escrito — o que a criança vê no lugar de uma imagem que não existe. */
export function CenaPorEscrito({ post, aviso }: { post: PostDaCobertura; aviso?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 text-center">
      <p className="text-[12px] leading-snug text-unooria-neutral-600">
        {post.grafico ? `Gráfico: ${post.grafico.titulo}` : post.descricaoImagem}
      </p>
      {aviso ? <p className="text-[11px] font-semibold leading-snug text-unooria-neutral-700">{aviso}</p> : null}
    </div>
  );
}

/**
 * A SEGUNDA FASE da aprovação (ADR-146): os textos estão aprovados (a
 * cobertura foi gravada), e as imagens se geram SOZINHAS, duas por vez, cada
 * uma no card do seu post. O professor vê a composição que a criança vai ver
 * — imagem e legenda — e gera outra para a que não serve.
 *
 * "Terminou" é a geração em lote ter parado: tudo pronto, ou o que não saiu
 * (falha, quota) segue com a cena por escrito, que ele vê no mesmo card. Só
 * então — e sem nenhuma regeração no meio — a aprovação acende: no assistente
 * de criação ela é o botão final ("Aprovar Cobertura e Abrir Turma"); na
 * página da atividade, o "Aprovar imagens" daqui (`comAprovacao`).
 *
 * O laço é do cliente, como antes (`continuarGerando`): o BFF corta em 30 s,
 * e doze imagens não cabem numa chamada.
 */
export function FaseDasImagens({
  turmaId,
  coberturaId,
  posts,
  imagensIniciais,
  aoMudarProntidao,
  comAprovacao = false,
}: {
  turmaId: string;
  coberturaId: string;
  posts: readonly PostDaCobertura[];
  imagensIniciais: Readonly<Record<string, string>>;
  /** `true` quando a geração parou e nada está sendo regerado — o professor pode aprovar. */
  aoMudarProntidao?: (pronta: boolean) => void;
  /** Mostra o botão "Aprovar imagens" (a página da atividade que ficou na segunda fase). */
  comAprovacao?: boolean;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const [imagens, setImagens] = useState<Record<string, string>>({ ...imagensIniciais });
  const [gerando, setGerando] = useState(false);
  const [terminou, setTerminou] = useState(false);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [regerando, setRegerando] = useState<ReadonlySet<IdDePost>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);
  const [aprovando, setAprovando] = useState(false);

  /* O laço pode estar no meio quando a tela muda: sem isto ele seguiria gastando a quota. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const base = `/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}`;
  const pedemImagem = posts.filter((p) => !p.grafico).length;

  const gerar = useCallback(async () => {
    setGerando(true);
    setTerminou(false);
    setAviso(null);
    let acumuladas: string[] = [];
    const tetoDeVoltas = Math.max(pedemImagem, 1) + 2;
    try {
      for (let volta = 0; volta < tetoDeVoltas && vivo.current; volta += 1) {
        const r = await fetch(`${base}/gerar-midia?coberturaId=${encodeURIComponent(coberturaId)}`, { method: "POST" });
        if (!r.ok) {
          /* 429 `sem-saldo-de-ia` ou o limite por minuto: a frase da api já
             está na voz certa, e o post segue com a cena por escrito. */
          const corpo = (await r.json().catch(() => ({}))) as ErroDaSelecao;
          setAviso(corpo.mensagem ?? "As imagens não puderam ser geradas agora.");
          break;
        }
        const progresso = (await r.json()) as ProgressoDaMidia;
        acumuladas = falhasAcumuladas(acumuladas, progresso);
        if (!vivo.current) return;
        setImagens((atual) => ({ ...atual, ...progresso.midia }));
        setFalhas(acumuladas);
        if (!continuarGerando(progresso)) break;
      }
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) {
        setGerando(false);
        setTerminou(true);
      }
    }
  }, [base, coberturaId, pedemImagem]);

  /* Ao aprovar os textos, as imagens se geram sem outro clique (o pedido do
     PO). Se a cobertura já tem todas (herdadas de outra com a mesma cena),
     não há o que gerar: a fase começa terminada. */
  const comecou = useRef(false);
  useEffect(() => {
    if (comecou.current) return;
    comecou.current = true;
    const faltam = posts.some((p) => !p.grafico && !imagensIniciais[p.id]);
    if (faltam) void gerar();
    else setTerminou(true);
  }, [gerar, posts, imagensIniciais]);

  const pronta = terminou && !gerando && regerando.size === 0;
  useEffect(() => {
    aoMudarProntidao?.(pronta);
  }, [pronta, aoMudarProntidao]);

  async function regerar(postId: IdDePost) {
    setRegerando((atual) => new Set(atual).add(postId));
    setAviso(null);
    try {
      const r = await fetch(
        `${base}/coberturas/${encodeURIComponent(coberturaId)}/imagens/${encodeURIComponent(postId)}/regerar`,
        { method: "POST" },
      );
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as ErroDaSelecao;
        setAviso(corpo.mensagem ?? "Não deu para gerar outra imagem agora. Tente de novo.");
        return;
      }
      const nova = (await r.json()) as ImagemRegerada;
      if (!vivo.current) return;
      setImagens((atual) => ({ ...atual, [nova.postId]: nova.url }));
      setFalhas((atual) => atual.filter((id) => id !== nova.postId));
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) {
        setRegerando((atual) => {
          const sem = new Set(atual);
          sem.delete(postId);
          return sem;
        });
      }
    }
  }

  async function aprovar() {
    setAprovando(true);
    setAviso(null);
    try {
      const r = await fetch(`${base}/coberturas/${encodeURIComponent(coberturaId)}/aprovar-imagens`, { method: "POST" });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as ErroDaSelecao;
        setAviso(corpo.mensagem ?? "Não deu para aprovar as imagens agora. Tente de novo.");
        return;
      }
      transicionar(() => router.refresh());
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      setAprovando(false);
    }
  }

  const prontas = posts.filter((p) => !p.grafico && imagens[p.id]).length;
  const semImagem = posts.filter((p) => estadoDaImagem(p, imagens, gerando) === "sem-imagem").length;

  return (
    <div className="flex flex-col gap-4" data-fase-das-imagens data-pronta={pronta ? "sim" : "nao"}>
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-semibold text-unooria-neutral-950">
          {gerando
            ? `Gerando as imagens: ${prontas} de ${pedemImagem} prontas`
            : `Confira as imagens: ${prontas} de ${pedemImagem} prontas`}
        </p>
        <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
          Os textos estão aprovados. Cada imagem aparece no card do seu post, junto da legenda, como a turma vai ver.
          Se uma imagem não combinar com o post, use “Gerar outra imagem”. Os posts de números da cobertura pronta são
          gráficos e não pedem imagem.
        </p>
      </div>

      {terminou && semImagem > 0 ? (
        <FeedbackAlert
          type="warning"
          description={`${semImagem === 1 ? "1 post ficou" : `${semImagem} posts ficaram`} sem imagem e ${semImagem === 1 ? "aparece" : "aparecem"} para a turma com a descrição da cena. Tente gerar de novo, ou aprove assim.`}
        />
      ) : null}
      {aviso ? <FeedbackAlert type="warning" description={aviso} /> : null}

      <GradeDosPosts
        posts={posts}
        cartao={(post) => {
          const estado = estadoDaImagem(post, imagens, gerando);
          const url = imagens[post.id];
          const ocupado = regerando.has(post.id);
          return (
            <CartaoDoPost
              key={post.id}
              post={post}
              imagem={
                ocupado ? (
                  <Gerando rotulo="Gerando outra imagem…" />
                ) : estado === "pronta" && url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={post.descricaoImagem} className="h-full w-full object-cover" data-imagem-do-post />
                ) : estado === "gerando" ? (
                  <Gerando rotulo="Gerando a imagem…" />
                ) : (
                  <CenaPorEscrito
                    post={post}
                    aviso={estado === "sem-imagem" ? "Sem imagem: a turma vê esta descrição." : undefined}
                  />
                )
              }
              legenda={<p className="text-[13px] leading-snug text-unooria-neutral-800">{post.legenda}</p>}
              acoes={
                estado === "pronta" || estado === "sem-imagem" ? (
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Icon name="refresh" size={18} />}
                      onClick={() => void regerar(post.id)}
                      isDisabled={gerando || ocupado || aprovando}
                      data-acao="gerar-outra-imagem"
                    >
                      {estado === "pronta" ? "Gerar outra imagem" : "Tentar gerar a imagem"}
                    </Button>
                  </div>
                ) : null
              }
            />
          );
        }}
      />

      {comAprovacao ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => void aprovar()}
            isDisabled={!pronta || aprovando}
            isLoading={aprovando}
            data-acao="aprovar-imagens"
          >
            Aprovar imagens
          </Button>
          {!pronta ? (
            <span className="text-[12px] text-unooria-neutral-600">
              A aprovação acende quando as imagens terminarem de gerar.
            </span>
          ) : null}
        </div>
      ) : null}
      {falhas.length > 0 && !gerando ? (
        <div>
          <Button variant="ghost" size="sm" onClick={() => void gerar()} data-acao="gerar-as-que-faltaram">
            Tentar de novo as que faltaram
          </Button>
        </div>
      ) : null}
    </div>
  );
}
