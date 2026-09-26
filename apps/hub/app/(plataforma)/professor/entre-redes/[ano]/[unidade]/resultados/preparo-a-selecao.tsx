"use client";

import { dataCurta } from "@edu/sdk";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Button,
  Card,
  FeedbackAlert,
  Icon,
  ProgressBar,
  Tag,
  TextArea,
  TextField,
} from "@edu/ui/ds";
import {
  FOCO_MAX,
  ROTULO_DA_LENTE,
  ROTULO_DA_ORIGEM,
  TEMA,
  continuarGerando,
  falhasAcumuladas,
  mesmoLote,
  problemaDaLegenda,
  textoDasRodadas,
  textoDoProgressoDaMidia,
  type CoberturasDaTurma,
  type Enquadramento,
  type ErroDaSelecao,
  type OrigemDaCobertura,
  type PostDaCobertura,
  type ProgressoDaMidia,
  type RascunhoDaCobertura,
  type ResumoDaMidia,
} from "@/lib/a-selecao-tipos";

/**
 * E0-PROF-01 — o PREPARO da cobertura, dentro da tela da aula.
 *
 * Mora AQUI, e não numa rota própria, pela mesma razão da exp05ef1b: a
 * professora já vem a esta tela para conduzir, o preparo é POR TURMA e o
 * seletor de turma já está no topo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A DIFERENÇA PARA A exp05ef1b, e ela muda o formulário inteiro: **esta missão
 * NÃO nasce vazia.** Sem preparo, a turma roda a cobertura curada da praça
 * central (a api cria a cobertura `padrao` na primeira entrada). O formulário
 * abre, então, com a cobertura EM ANDAMENTO — e aprovar não é abrir a porta, é
 * TROCAR a atividade.
 *
 * Por isso "Aprovar Cobertura e Abrir Turma" só acende quando algo MUDOU
 * (`mesmoLote`): aprovar de novo o que já roda criaria uma atividade nova
 * idêntica, e a turma voltaria à rodada 1 sem nada ter mudado — com o painel
 * de habilidades partido em duas atividades iguais. E, quando a cobertura atual
 * já rodou, a tela diz antes do clique que a aula recomeça.
 *
 * `gerar` NÃO persiste: devolve rascunho para os campos, e o que grava é
 * `homologar`. Sem saldo, com o provedor fora ou com a saída fora do molde, a
 * api devolve o banco curado com `usouIa: false` — e a tela diz isso na voz do
 * sheet (`e0.prof.quota_aviso`), em vez de fingir que a IA respondeu.
 *
 * O que é editável é a LEGENDA. Veículo, lente e as tags (fonte ouvida, ângulo)
 * são do molde e sustentam a matriz do Mural; elas aparecem para a professora
 * — conduzir sem saber quem cada post ouviu é impossível — mas não mudam aqui.
 *
 * AS IMAGENS são um laço do cliente (`continuarGerando`): a api gera até duas
 * por chamada, porque o BFF corta em 30 s e doze não cabem. Elas são da
 * cobertura EM ANDAMENTO — com um rascunho na tela o botão apaga, senão ele
 * gastaria a quota ilustrando o lote que a turma deixará de ler.
 *
 * Estado de client, e por isso a página monta este componente com
 * `key={turma}` — a lição registrada em `resultados-quem-mandou-isso.tsx`: sem
 * a `key`, trocar de turma no seletor mantém o formulário da anterior e
 * aprova o lote dela na turma nova.
 */

const LENTES: readonly Enquadramento[] = ["institucional", "comunitario", "estatistico"];

/** O aviso do sheet para o rascunho que voltou sem IA — verbatim de `e0.prof.quota_aviso`. */
const AVISO_SEM_IA =
  "A assistente de curadoria do grêmio está temporariamente sem saldo para novas coberturas personalizadas. O tema padrão oficial do grêmio foi carregado para sua aula.";

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

type Aviso = { tipo: "success" | "warning"; texto: string };

export function PreparoASelecao({
  turmaId,
  inicial,
}: {
  turmaId: string;
  inicial: CoberturasDaTurma;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const { ativa, historico } = inicial;

  const [tema, setTema] = useState(ativa.tema);
  const [foco, setFoco] = useState(ativa.foco ?? "");
  const [origem, setOrigem] = useState<OrigemDaCobertura>(ativa.origem);
  const [posts, setPosts] = useState<PostDaCobertura[]>(ativa.posts);
  /* O tema para o qual OS POSTS NA TELA foram escritos. Trocar o texto do
     tema sem gerar um lote novo deixaria o feed falando da praça sob o título
     de outro evento — a tela avisa, sem bloquear (reescrever o tema do mesmo
     lote é legítimo). */
  const [temaDosPosts, setTemaDosPosts] = useState(ativa.tema);
  const [aberto, setAberto] = useState(false);

  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; erros: string[] } | null>(null);

  const [midia, setMidia] = useState<ResumoDaMidia>(ativa.midia);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [falhas, setFalhas] = useState<string[]>([]);
  const [gerandoMidia, setGerandoMidia] = useState(false);
  const [avisoMidia, setAvisoMidia] = useState<string | null>(null);

  /* A cobertura em andamento MUDOU (a própria aprovação, ou outra aba): o
     formulário passa a mostrar a nova. É o ajuste de estado durante o render
     que o React recomenda para prop que muda — o mesmo do painel de
     habilidades. Um `router.refresh()` que não troca a cobertura (o das
     imagens, o do zerar) entrega um objeto novo com a MESMA cobertura, e isso
     não pode apagar o que a professora está digitando: por isso a comparação é
     pelo id, não pela identidade do objeto. */
  const [ativaVista, setAtivaVista] = useState(ativa.id);
  if (ativa.id !== ativaVista) {
    setAtivaVista(ativa.id);
    setTema(ativa.tema);
    setFoco(ativa.foco ?? "");
    setOrigem(ativa.origem);
    setPosts(ativa.posts);
    setTemaDosPosts(ativa.tema);
    setMidia(ativa.midia);
    setUrls({});
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

  const base = `/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}`;

  const alterado = !mesmoLote({ tema, foco, posts }, { tema: ativa.tema, foco: ativa.foco, posts: ativa.posts });
  const tamanhoDoTema = tema.trim().length;
  const temaInvalido = tamanhoDoTema < TEMA.min || tamanhoDoTema > TEMA.max;
  const problemas = new Map(
    posts.flatMap((p) => {
      const problema = problemaDaLegenda(p.legenda);
      return problema ? [[p.id, problema] as const] : [];
    }),
  );
  const podeAprovar = alterado && !temaInvalido && problemas.size === 0;
  const doHistorico = historico.find((h) => h.id === ativa.id);
  const jaRodou = (doHistorico?.rodadas ?? 0) > 0 || ativa.etapa !== "exploracao";

  async function lerErro(r: Response, padrao: string): Promise<{ mensagem: string; erros: string[] }> {
    const corpo = (await r.json().catch(() => ({}))) as ErroDaSelecao;
    return { mensagem: corpo.mensagem ?? padrao, erros: corpo.erros ?? [] };
  }

  async function gerar() {
    setGerando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(`${base}/gerar-conteudo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tema: tema.trim(), foco: foco.trim() || undefined }),
      });
      if (!r.ok) {
        setErro(await lerErro(r, "O gerador não respondeu. A cobertura em andamento continua valendo."));
        return;
      }
      const rascunho = (await r.json()) as RascunhoDaCobertura;
      setTema(rascunho.tema);
      setFoco(rascunho.foco ?? "");
      /* A ORIGEM vai como o rascunho a trouxe: sem IA, o que está na tela é o
         banco curado, e homologá-lo como `ia` mentiria no único registro que
         responde se a curadoria assistida está sendo usada. */
      setOrigem(rascunho.origem);
      setPosts(rascunho.posts);
      setTemaDosPosts(rascunho.tema);
      setAberto(true);
      setAviso(
        rascunho.usouIa
          ? {
              tipo: "success",
              texto:
                "Lote gerado. Leia os 12 posts e edite o que quiser antes de aprovar — nada vai à turma sem o seu clique.",
            }
          : { tipo: "warning", texto: AVISO_SEM_IA },
      );
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  async function homologar() {
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(`${base}/homologar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tema: tema.trim(), foco: foco.trim() || undefined, origem, posts }),
      });
      if (!r.ok) {
        /* `lote-invalido` traz a LISTA de problemas em frases para a
           professora (`problemasDoLote`, na api) — o termo que antecipa a
           revelação, sobretudo, que só a api sabe conferir. */
        setErro(await lerErro(r, "Não deu para aprovar a cobertura agora."));
        return;
      }
      setAviso({
        tipo: "success",
        texto: "Cobertura aprovada: é ela que a turma lê a partir de agora. Se quiser, gere as imagens abaixo.",
      });
      transicionar(() => router.refresh());
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setSalvando(false);
    }
  }

  function descartar() {
    setTemaDosPosts(ativa.tema);
    setTema(ativa.tema);
    setFoco(ativa.foco ?? "");
    setOrigem(ativa.origem);
    setPosts(ativa.posts);
    setAviso(null);
    setErro(null);
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
          /* 429 `sem-saldo-de-ia` (a quota do professor) ou o limite por
             minuto: a mensagem da api já está na voz certa, e a missão roda
             igual com a descrição da cena. */
          setAvisoMidia((await lerErro(r, "As imagens não puderam ser geradas agora.")).mensagem);
          break;
        }
        const progresso = (await r.json()) as ProgressoDaMidia;
        if (progresso.coberturaId !== ativa.id) {
          // Outra aprovação trocou a cobertura no meio do laço.
          break;
        }
        acumuladas = falhasAcumuladas(acumuladas, progresso);
        setMidia({ total: progresso.total, prontas: progresso.prontas });
        setUrls(progresso.midia);
        setFalhas(acumuladas);
        if (!continuarGerando(progresso)) break;
      }
    } catch {
      setAvisoMidia(SEM_CONEXAO);
    } finally {
      setGerandoMidia(false);
      // O painel da aula lê o resumo da mídia da cobertura: ele anda junto.
      if (vivo.current) transicionar(() => router.refresh());
    }
  }

  function trocarLegenda(id: string, legenda: string) {
    setPosts((atuais) => atuais.map((p) => (p.id === id ? { ...p, legenda } : p)));
  }

  const imagensCompletas = midia.total > 0 && midia.prontas >= midia.total;

  return (
    <Card variant="elevated" title="Preparação da Missão: A Seleção">
      <div className="flex flex-col gap-5" data-preparo-selecao>
        <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
          Escolha o tema da cobertura jornalística simulada para a sua turma.{" "}
          <strong>
            Nenhum texto gerado por inteligência artificial é exibido aos estudantes sem a sua
            aprovação neste painel.
          </strong>
        </p>

        {/* O estado da turma vem antes dos campos: "o que a turma está lendo?"
            é a pergunta que a professora faz antes de mexer em qualquer coisa. */}
        <p className="text-[12px] text-unooria-neutral-600" data-cobertura-ativa={ativa.id}>
          Em andamento nesta turma: <strong className="text-unooria-neutral-900">“{ativa.tema}”</strong>,{" "}
          {ROTULO_DA_ORIGEM[ativa.origem]} · rodada {ativa.rodada}.
        </p>

        <div className="grid gap-3 lg:grid-cols-2">
          <TextField
            label="Evento central coberto pelos veículos"
            helperText={`De ${TEMA.min} a ${TEMA.max} caracteres. É sobre isto que os 12 posts falam.`}
            value={tema}
            maxLength={TEMA.max}
            error={temaInvalido ? `Escreva de ${TEMA.min} a ${TEMA.max} caracteres.` : undefined}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTema(e.target.value)}
          />
          <TextField
            label="Um detalhe da sua cidade ou escola (opcional)"
            helperText={`Bairro, escola ou contexto que a cobertura deve considerar. Até ${FOCO_MAX} caracteres.`}
            value={foco}
            maxLength={FOCO_MAX}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoco(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="auto_awesome" size={18} />}
            onClick={() => void gerar()}
            isDisabled={gerando || salvando || temaInvalido}
            data-acao="gerar-lote"
          >
            {gerando ? "Gerando…" : "Gerar Lote com IA"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Icon name="check_circle" size={18} />}
            onClick={() => void homologar()}
            isDisabled={salvando || gerando || !podeAprovar}
            data-acao="aprovar-cobertura"
          >
            {salvando ? "Aprovando…" : "Aprovar Cobertura e Abrir Turma"}
          </Button>
          {alterado ? (
            <Button variant="ghost" size="sm" onClick={descartar} isDisabled={salvando || gerando}>
              Voltar à cobertura em andamento
            </Button>
          ) : null}
        </div>

        {/* O botão apagado sem motivo escrito é o silêncio que a exp05ef1b
            já pagou: diga o que falta, e onde. */}
        {!alterado ? (
          <p className="text-[12px] leading-snug text-unooria-neutral-600">
            Nada mudou em relação à cobertura em andamento — a turma já pode entrar com ela. Troque
            o tema e gere um lote, ou edite uma legenda, para aprovar uma cobertura nova.
          </p>
        ) : temaInvalido || problemas.size > 0 ? (
          <p className="text-[12px] leading-snug text-unooria-danger" role="status">
            {temaInvalido
              ? `Falta o tema: escreva de ${TEMA.min} a ${TEMA.max} caracteres no campo acima.`
              : `${problemas.size === 1 ? "Um dos 12 posts tem" : `${problemas.size} dos 12 posts têm`} legenda fora do limite de 20 a 45 palavras. ${aberto ? "O campo está marcado abaixo." : "Abra os posts para ver qual."}`}
          </p>
        ) : jaRodou ? (
          <p className="text-[12px] leading-snug text-unooria-neutral-700">
            <strong>Aprovar cria uma atividade nova:</strong> a turma volta ao começo, na rodada 1,
            com a cobertura nova. O que já foi feito na atual continua guardado no histórico abaixo
            e no painel de habilidades.
          </p>
        ) : null}

        {!temaInvalido && tema.trim() !== temaDosPosts.trim() ? (
          <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
            O tema mudou, mas os posts na tela ainda falam de “{temaDosPosts}”. Clique em Gerar Lote
            com IA para escrevê-los sobre o tema novo — ou aprove sabendo que o feed continua sobre o
            anterior.
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

        {/* Renderização CONDICIONAL, e não `Collapse`: fechado, o `Collapse` do
            DS deixa os controles de dentro focáveis sob `aria-hidden` — são 12
            campos (ver o AGENTS da área). Fechado por padrão porque, durante a
            aula, a grade empurraria o painel da turma para fora da tela. */}
        <div className="flex flex-col gap-3">
          <div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Icon name={aberto ? "expand_less" : "expand_more"} size={18} />}
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              data-acao="mostrar-posts"
            >
              {aberto ? "Esconder os 12 posts" : "Ler e editar os 12 posts (só você vê as fichas)"}
            </Button>
          </div>

          {aberto ? (
            <div className="grid gap-4 lg:grid-cols-3" data-grade-de-posts>
              {LENTES.map((lente) => (
                <div key={lente} className="flex flex-col gap-3">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                    {ROTULO_DA_LENTE[lente]}
                  </p>
                  {posts
                    .filter((p) => p.enquadramento === lente)
                    .map((p) => (
                      <PostEditavel
                        key={p.id}
                        post={p}
                        url={urls[p.id]}
                        problema={problemas.get(p.id) ?? null}
                        aoTrocar={(legenda) => trocarLegenda(p.id, legenda)}
                      />
                    ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* ───────────────────────────────────────────── as imagens ───── */}
        <div className="flex flex-col gap-2 border-t border-unooria-neutral-200 pt-4">
          <p className="text-[14px] font-semibold text-unooria-neutral-950">Imagens dos posts</p>
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
            Opcional. As imagens saem duas por vez e podem levar alguns minutos: faça antes da aula.
            Post sem imagem aparece com a descrição da cena, e a missão roda igual. Os posts de
            números da cobertura curada já têm gráfico e não pedem imagem.
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
                Aprove a cobertura antes: as imagens são da cobertura que a turma vai ler.
              </span>
            ) : null}
          </div>
          {falhas.length > 0 ? (
            <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
              {falhas.length === 1
                ? "1 post não ganhou imagem e segue com a descrição da cena."
                : `${falhas.length} posts não ganharam imagem e seguem com a descrição da cena.`}{" "}
              Tente de novo mais tarde.
            </p>
          ) : null}
          {avisoMidia ? <FeedbackAlert type="warning" description={avisoMidia} /> : null}
        </div>

        {/* ──────────────────────────────────────── o histórico ───── */}
        {historico.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-unooria-neutral-200 pt-4">
            <p className="text-[14px] font-semibold text-unooria-neutral-950">
              Coberturas desta turma
            </p>
            <p className="text-[12px] leading-snug text-unooria-neutral-600">
              Cada cobertura aprovada é uma atividade, e o painel de habilidades lá embaixo lê uma
              de cada vez. Zerar a turma abre uma rodada nova da mesma cobertura.
            </p>
            <ul className="flex flex-col gap-2" data-historico-coberturas>
              {historico.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center gap-2 text-[13px] text-unooria-neutral-800"
                >
                  <span className="font-medium text-unooria-neutral-950">“{h.tema}”</span>
                  <span className="text-unooria-neutral-600">
                    {ROTULO_DA_ORIGEM[h.origem]} · {dataCurta(h.criadaEm)} · {textoDasRodadas(h.rodadas)}
                  </span>
                  {h.ativa ? (
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
    </Card>
  );
}

/**
 * Um post na grade do preparo: a cena (imagem, gráfico ou a descrição), a
 * LEGENDA editável e as fichas que só a professora vê.
 *
 * O rótulo das fichas é o mesmo que a turma lê quando você as revela
 * (`e4.feedback.label_fonte`/`label_angulo`): a professora lê aqui, antes, o
 * que a sala vai ler depois.
 */
function PostEditavel({
  post,
  url,
  problema,
  aoTrocar,
}: {
  post: PostDaCobertura;
  url: string | undefined;
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

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={post.descricaoImagem}
          className="aspect-square w-full rounded-md object-cover"
          loading="lazy"
        />
      ) : (
        /* A mesma saída da tela da criança: sem imagem, a cena por escrito. É
           MEDIDA (a proporção do quadro), não componente. */
        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-unooria-neutral-100 p-4">
          <p className="text-center text-[12px] leading-snug text-unooria-neutral-600">
            {post.grafico ? `Gráfico: ${post.grafico.titulo}` : post.descricaoImagem}
          </p>
        </div>
      )}

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
