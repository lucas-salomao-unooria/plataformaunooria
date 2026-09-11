/**
 * As telas DENTRO do clone (E2 Navegar, E3 Decidir + PICO, E4 Aha) —
 * família `ds-insta`, nunca a da plataforma. O nome que o app real usa em
 * português FICA (`@turma_mural` é handle, "COMPARTILHAR" é o verbo nativo).
 */
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { AvatarInsta, BadgeInsta, ButtonInsta, PostCard, TopBar } from "@edu/ui/ds-insta";
import { AUDIO, SFX, tocar } from "../lib/audio";
import { TEXTO } from "../lib/textos";
import {
  CADENCIA_AHA,
  GATILHO_CRIAR,
  INACAO,
  type ComentariosDoPar,
  type PacotePublico,
  type PostDaGaleria,
} from "../lib/tipos";
import {
  AudioReplayButtonClone,
  CaptionPictogramCard,
  MicroSpinnerOverlay,
  PhotoComparisonSelector,
  urlDaFoto,
} from "./componentes/clone";

/* ------------------------------ E2: o mural ------------------------------- */

export function TelaFeed({
  pacote,
  aoCriar,
}: {
  pacote: PacotePublico;
  aoCriar: (dados: { curtidas: number; permanenciaMs: number }) => void;
}): JSX.Element {
  const [curtidas, setCurtidas] = useState<Record<string, boolean>>({});
  const [rolou, setRolou] = useState(false);
  const [mostraScaffold, setMostraScaffold] = useState(false);
  const [podeCriar, setPodeCriar] = useState(false);
  const entradaRef = useRef(Date.now());
  const ultimoLikeRef = useRef(0);

  const totalCurtidas = useMemo(
    () => Object.values(curtidas).filter(Boolean).length,
    [curtidas],
  );

  // Scaffolding motor: 30s sem rolar → seta animada + áudio (bloco 7).
  useEffect(() => {
    if (rolou) {
      setMostraScaffold(false);
      return;
    }
    const t = setTimeout(() => {
      setMostraScaffold(true);
      tocar(AUDIO.e2DegenScroll);
    }, INACAO.feedMs);
    return () => clearTimeout(t);
  }, [rolou]);

  // Gatilho do botão criar: ≥15s no feed OU ≥1 curtida.
  useEffect(() => {
    if (totalCurtidas >= GATILHO_CRIAR.curtidas) {
      setPodeCriar(true);
      return;
    }
    const resto = GATILHO_CRIAR.permanenciaMs - (Date.now() - entradaRef.current);
    const t = setTimeout(() => setPodeCriar(true), Math.max(0, resto));
    return () => clearTimeout(t);
  }, [totalCurtidas]);

  function curtir(postId: string) {
    // Debounce motor de 500ms: toques repetitivos não empilham likes.
    const agora = Date.now();
    if (agora - ultimoLikeRef.current < 500) return;
    ultimoLikeRef.current = agora;
    if (curtidas[postId]) return;
    setCurtidas((c) => ({ ...c, [postId]: true }));
    tocar(SFX.like);
  }

  return (
    <div className="fc-tela fc-tela-clone">
      <TopBar title={TEXTO.e2.feedHeader} />
      <div
        className="fc-feed"
        onScroll={() => setRolou(true)}
        data-testid="feed"
      >
        {pacote.feed.map((post) => (
          <PostCard key={post.id}>
            <PostCard.Header username={TEXTO.e2.feedHeader} initials="TM" />
            <div
              onDoubleClick={() => curtir(post.id)}
              onTouchEnd={(e) => {
                // Duplo toque rápido (≤350ms) — o gesto nativo do clone.
                if (e.detail >= 2) curtir(post.id);
              }}
            >
              <PostCard.Media src={urlDaFoto(post.fotoId)} alt="" />
            </div>
            <PostCard.Actions liked={Boolean(curtidas[post.id])} />
            <PostCard.Caption username={TEXTO.e2.feedHeader}>{post.legenda}</PostCard.Caption>
          </PostCard>
        ))}
      </div>

      {mostraScaffold && !rolou ? (
        <div className="fc-scaffold-scroll" aria-live="polite">
          <span className="fc-seta-baixo" aria-hidden>↓</span>
          {TEXTO.e2.degenScroll}
        </div>
      ) : null}

      {podeCriar ? (
        <ButtonInsta
          variant="primary"
          className="fc-botao-criar"
          onClick={() =>
            aoCriar({
              curtidas: totalCurtidas,
              permanenciaMs: Date.now() - entradaRef.current,
            })
          }
        >
          {TEXTO.e2.botaoCriar}
        </ButtonInsta>
      ) : null}
    </div>
  );
}

/* --------------------- E3: o dilema da lente + o PICO --------------------- */

export function TelaDecidir({
  pacote,
  aoPublicar,
}: {
  pacote: PacotePublico;
  aoPublicar: (dados: { fotoId: string; legendaId: string; latenciaMs: number }) => void;
}): JSX.Element {
  const [fotoId, setFotoId] = useState<string | null>(null);
  const [legendaId, setLegendaId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [scaffold, setScaffold] = useState(false);
  const entradaRef = useRef(Date.now());
  const enviouRef = useRef(false);

  useEffect(() => {
    tocar(AUDIO.e3SelFoto);
  }, []);

  // Scaffolding de inação (45s sem selecionar nada): pulso + voz de Nina.
  useEffect(() => {
    if (fotoId || legendaId) {
      setScaffold(false);
      return;
    }
    const t = setTimeout(() => {
      setScaffold(true);
      tocar(AUDIO.e3DegenInacao);
    }, INACAO.decidirMs);
    return () => clearTimeout(t);
  }, [fotoId, legendaId]);

  const parCompleto = Boolean(fotoId && legendaId);
  const legendaEscolhida = pacote.legendas.find((l) => l.id === legendaId);

  if (confirmando && fotoId && legendaEscolhida) {
    // O PICO (E3-ALU-02): estritamente 3 elementos — preview, legenda, botão.
    return (
      <div className="fc-tela fc-tela-clone fc-pico">
        <img className="fc-pico-preview" src={urlDaFoto(fotoId)} alt="" />
        <p className="fc-pico-legenda">{legendaEscolhida.texto}</p>
        <ButtonInsta
          variant="primary"
          className="fc-botao-compartilhar"
          disabled={publicando}
          onClick={() => {
            if (enviouRef.current) return; // anti-duplo envio
            enviouRef.current = true;
            setPublicando(true);
            tocar(SFX.shutter);
          }}
        >
          {publicando ? (
            <MicroSpinnerOverlay
              aoTerminar={() =>
                aoPublicar({
                  fotoId,
                  legendaId: legendaEscolhida.id,
                  latenciaMs: Date.now() - entradaRef.current,
                })
              }
            />
          ) : (
            TEXTO.e3.compartilhar
          )}
        </ButtonInsta>
      </div>
    );
  }

  return (
    <div className={`fc-tela fc-tela-clone${scaffold ? " fc-scaffold-pulso" : ""}`}>
      <TopBar title={TEXTO.e3.headerCriar} />
      <p className="fc-instrucao-clone">
        {TEXTO.e3.selecionarFoto}
        <AudioReplayButtonClone audioId={AUDIO.e3SelFoto} rotulo={`OUVIR: ${TEXTO.e3.selecionarFoto}`} />
      </p>
      <PhotoComparisonSelector
        fotoAId={pacote.par.fotoAId}
        fotoBId={pacote.par.fotoBId}
        selecionada={fotoId}
        aoEscolher={setFotoId}
      />
      <p className="fc-instrucao-clone">
        {TEXTO.e3.selecionarLegenda}
        <AudioReplayButtonClone
          audioId={AUDIO.e3SelLegenda}
          rotulo={`OUVIR: ${TEXTO.e3.selecionarLegenda}`}
        />
      </p>
      {pacote.legendas.map((legenda) => (
        <CaptionPictogramCard
          key={legenda.id}
          legenda={legenda}
          audioId={legenda.id === "legenda_1" ? AUDIO.e3Leg1 : AUDIO.e3Leg2}
          selecionada={legendaId === legenda.id}
          aoEscolher={setLegendaId}
        />
      ))}
      <ButtonInsta
        variant="primary"
        className="fc-botao-largo"
        disabled={!parCompleto}
        onClick={() => setConfirmando(true)}
      >
        {TEXTO.e3.compartilhar}
      </ButtonInsta>
    </div>
  );
}

/* ------------------------------ E4: o eco --------------------------------- */

export function TelaAha({
  fotoId,
  legendaTexto,
  comentarios,
  aoConcluirEco,
}: {
  fotoId: string;
  legendaTexto: string;
  comentarios: ComentariosDoPar;
  aoConcluirEco: () => void;
}): JSX.Element {
  const [mostraLeo, setMostraLeo] = useState(false);
  const [mostraSofia, setMostraSofia] = useState(false);

  // A cadência rígida (não-negociável 2): Leo a 1,5s, Sofia a 3,0s, transição
  // 2s depois. Nunca os dois ao mesmo tempo.
  useEffect(() => {
    const t1 = setTimeout(() => {
      setMostraLeo(true);
      if (comentarios.audioLeo) tocar(comentarios.audioLeo);
    }, CADENCIA_AHA.leoMs);
    const t2 = setTimeout(() => {
      setMostraSofia(true);
      if (comentarios.audioSofia) tocar(comentarios.audioSofia);
    }, CADENCIA_AHA.sofiaMs);
    const t3 = setTimeout(aoConcluirEco, CADENCIA_AHA.sofiaMs + CADENCIA_AHA.transicaoMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [comentarios, aoConcluirEco]);

  return (
    <div className="fc-tela fc-tela-clone">
      <TopBar title={TEXTO.e2.feedHeader} />
      <div className="fc-aha">
        <PostCard>
          <PostCard.Header username={TEXTO.e2.feedHeader} initials="TM" />
          <PostCard.Media src={urlDaFoto(fotoId)} alt="" />
          <PostCard.Caption username={TEXTO.e2.feedHeader}>{legendaTexto}</PostCard.Caption>
        </PostCard>
        <BadgeInsta className="fc-badge-publicado">{TEXTO.e4.publicadoAgora}</BadgeInsta>

        <div className="fc-comentarios" aria-live="polite">
          {mostraLeo ? (
            <div className="fc-comentario">
              <AvatarInsta initials="L" />
              <p>
                <strong>leo</strong> {comentarios.leo}
              </p>
            </div>
          ) : null}
          {mostraSofia ? (
            <div className="fc-comentario">
              <AvatarInsta initials="S" />
              <p>
                <strong>sofia</strong> {comentarios.sofia}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------ galeria passiva (dentro da conclusão) ------------------ */

export function GaleriaDaTurma({ posts }: { posts: PostDaGaleria[] }): JSX.Element {
  return (
    <div className="fc-galeria">
      {posts.map((p, i) => (
        <figure key={`${p.criadoEm}-${i}`} className="fc-galeria-item">
          <img src={urlDaFoto(p.fotoId)} alt="" />
          <figcaption>{p.legendaTexto}</figcaption>
        </figure>
      ))}
    </div>
  );
}
