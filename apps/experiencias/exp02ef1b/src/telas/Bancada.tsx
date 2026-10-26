import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ButtonUnv, GestureHint, InlineHint } from "@edu/ui/ds-unoovista";
import { Janela } from "../componentes/Janela";
import { Personagem } from "../componentes/Personagem";
import type { Contexto } from "../contexto";
import { prefereMenosMovimento, useInatividade, useTamanho } from "../hooks/tela";
import { api } from "../lib/api";
import { contemPonto, encaixar, lente, limitar, pontoNaImagem, proporcaoDaJanela } from "../lib/geometria";
import { fotoQueFalta, juntarRelatos, LUPA_VAZIA, pisoLocal, registrarAmostra, relatoMudou } from "../lib/lupa";
import { telemetria } from "../lib/telemetria";
import { preencher, ROTULOS, textoDe } from "../lib/textos";
import type { FotoId, Ponto, RelatoDaLupa, Retangulo } from "../lib/tipos";

/** O raio da lente, em px: 112 px de diâmetro, maior que um dedo de 7 anos (o alvo ≥ 56 px). */
const RAIO = 56;
/** A ampliação é FIXA (one-pager §4): a criança move a lente, nunca o zoom. */
const AMPLIACAO = 2;
const AMOSTRA_MS = 200;
const RELATO_MS = 4000;
const ROTULO_H = 28;
const VAO = 12;
const PASSO_DA_TECLA = 16;

interface FotoNaTela {
  id: FotoId;
  recorte: Retangulo;
  /** A caixa da foto, em px, relativa à bancada. */
  caixa: { x: number; y: number; w: number; h: number };
  rotulo: string;
}

/**
 * E2 — NAVEGAR. As duas fotos brutas, imóveis, e a LUPA circular de ampliação
 * fixa 2× que a criança arrasta sobre elas. Quando o centro da lente passa
 * pela parede do fundo (`cena.fundo` — a dica, não o gabarito), o fundo daquela
 * foto pulsa em azul, discreto.
 *
 * O piso (3 s sobre CADA foto E o fundo das DUAS) é medido aqui e decidido na
 * api: o relato vai de tempos em tempos e no toque de AVANÇAR. Antes do piso o
 * botão fica esmaecido mas tocável — o toque precoce é a evidência que a régua
 * lê (`lupa_alertas`): a tela vibra, a mãozinha aponta a parede e aparece
 * "OLHE O FUNDO" (one-pager §7). 45 s sem gesto: o Bento, "VAMOS INVESTIGAR?".
 *
 * As fotos ficam lado a lado quando cabem (≥ 600 px); no celular de 375 px,
 * uma sobre a outra — lado a lado, cada uma teria 170 px e a lente cobriria
 * meia foto.
 *
 * (b) COMPENSAÇÃO local — pedido aberto no storybook-unooria: a lupa não existe
 * na seção `unoovista` (nem em seção alguma). Composição de posicionamento
 * sobre a `Janela`; a conta está em `lib/geometria.ts#lente` e o cronômetro em
 * `lib/lupa.ts`.
 */
export function Bancada({ ctx }: { ctx: Contexto }) {
  const { sessao, estado, executar, url } = ctx;
  const cena = sessao.cena!;
  const geo = sessao.geometria;
  const piso = geo.pisoDaLupaMs || 3000;
  const src = url(cena.imagem);
  const [areaRef, area] = useTamanho<HTMLDivElement>();

  /* ── a disposição das duas fotos ── */
  const ladoALado = area.w >= 600;
  const fotos: FotoNaTela[] = [];
  if (area.w > 0) {
    const ordenadas = [...cena.fotos].sort((a, b) => a.id.localeCompare(b.id));
    const proporcao = proporcaoDaJanela(ordenadas[0]!.recorte, geo.proporcaoDaPanoramica);
    const vaga = ladoALado
      ? { w: (area.w - VAO) / 2, h: area.h - ROTULO_H }
      : { w: area.w, h: (area.h - VAO) / 2 - ROTULO_H };
    const caixa = encaixar(vaga, proporcao);
    const rotulos = [textoDe(sessao.textos, "e2", "rotuloDaFoto1"), textoDe(sessao.textos, "e2", "rotuloDaFoto2")];
    ordenadas.forEach((f, i) => {
      const x = ladoALado ? (area.w - (caixa.w * 2 + VAO)) / 2 + i * (caixa.w + VAO) : (area.w - caixa.w) / 2;
      const topo = ladoALado ? (area.h - (ROTULO_H + caixa.h)) / 2 : (area.h - 2 * (ROTULO_H + caixa.h) - VAO) / 2;
      const y = ladoALado ? topo + ROTULO_H : topo + ROTULO_H + i * (caixa.h + VAO + ROTULO_H);
      fotos.push({
        id: f.id,
        recorte: f.recorte,
        caixa: { x, y, w: caixa.w, h: caixa.h },
        rotulo: preencher(rotulos[i] ?? "", { espaco: cena.espaco, hora: cena.hora }),
      });
    });
  }

  /* ── a lente ── */
  const [centroEscolhido, setCentro] = useState<Ponto | null>(null);
  const centro = centroEscolhido ?? { x: area.w / 2, y: area.h / 2 };
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  const centroRef = useRef(centro);
  centroRef.current = centro;

  function sob(c: Ponto) {
    for (const f of fotosRef.current) {
      const { x, y, w, h } = f.caixa;
      if (c.x >= x && c.x <= x + w && c.y >= y && c.y <= y + h) {
        const ponto = pontoNaImagem(f.recorte, c.x - x, c.y - y, { w, h });
        return { foto: f, ponto, noFundo: contemPonto(cena.fundo, ponto) };
      }
    }
    return null;
  }

  /* ── o cronômetro: a cada amostra, o tempo vai para a foto sob o centro da lente ── */
  const inicial: RelatoDaLupa = estado.lupa
    ? { foto1Ms: estado.lupa.foto1Ms, foto2Ms: estado.lupa.foto2Ms, fundo1: estado.lupa.fundo1, fundo2: estado.lupa.fundo2 }
    : LUPA_VAZIA;
  const lupaRef = useRef<RelatoDaLupa>(inicial);
  const enviadoRef = useRef<RelatoDaLupa>(inicial);
  const [fundoAceso, setFundoAceso] = useState<FotoId | null>(null);
  const [cumpriu, setCumpriu] = useState(() => pisoLocal(inicial, piso));
  const [sobre, setSobre] = useState<FotoId | null>(null);

  useEffect(() => {
    let ultimo = performance.now();
    const id = window.setInterval(() => {
      const agora = performance.now();
      const dt = agora - ultimo;
      ultimo = agora;
      if (document.visibilityState !== "visible") return;
      const s = sob(centroRef.current);
      lupaRef.current = registrarAmostra(lupaRef.current, s?.foto.id ?? null, s?.noFundo ?? false, dt);
      setFundoAceso(s?.noFundo ? s.foto.id : null);
      setSobre(s?.foto.id ?? null);
      setCumpriu(pisoLocal(lupaRef.current, piso));
    }, AMOSTRA_MS);
    return () => window.clearInterval(id);
    // `sob` lê só refs e a cena (fixa nesta tela).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piso]);

  /* O relato periódico: o servidor guarda o máximo — um relato atrasado não apaga o novo. */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!relatoMudou(enviadoRef.current, lupaRef.current)) return;
      const relato = { ...lupaRef.current };
      enviadoRef.current = juntarRelatos(enviadoRef.current, relato);
      void executar(() => api.lupa(relato, false));
    }, RELATO_MS);
    return () => window.clearInterval(id);
  }, [executar]);

  /* ── o avanço ── */
  const [alertas, setAlertas] = useState(0);
  const [enviando, setEnviando] = useState(false);
  async function avancar() {
    if (enviando) return;
    setEnviando(true);
    const relato = { ...lupaRef.current };
    enviadoRef.current = juntarRelatos(enviadoRef.current, relato);
    const r = await executar(() => api.lupa(relato, true));
    setEnviando(false);
    if (r && !r.liberado) {
      setAlertas((n) => n + 1);
      telemetria.alertaDaLupa();
      if (!prefereMenosMovimento()) navigator.vibrate?.(80);
    }
  }

  /* ── o gesto ── */
  const arraste = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const limitarCentro = (c: Ponto) => ({ x: limitar(c.x, 0, area.w), y: limitar(c.y, 0, area.h) });
  function noArea(e: PointerEvent<HTMLDivElement>): Ponto {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function aoBaixar(e: PointerEvent<HTMLDivElement>) {
    if (arraste.current) return;
    const p = noArea(e);
    const naLente = Math.hypot(p.x - centro.x, p.y - centro.y) <= RAIO;
    /* Pegou a lente: ela segue o dedo sem pular. Tocou fora: ela vem até o dedo. */
    const dx = naLente ? centro.x - p.x : 0;
    const dy = naLente ? centro.y - p.y : 0;
    arraste.current = { id: e.pointerId, dx, dy };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setCentro(limitarCentro({ x: p.x + dx, y: p.y + dy }));
  }
  function aoMover(e: PointerEvent<HTMLDivElement>) {
    const a = arraste.current;
    if (!a || a.id !== e.pointerId) return;
    const p = noArea(e);
    setCentro(limitarCentro({ x: p.x + a.dx, y: p.y + a.dy }));
  }
  function aoTecla(e: KeyboardEvent<HTMLDivElement>) {
    const passo = e.shiftKey ? PASSO_DA_TECLA * 3 : PASSO_DA_TECLA;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-passo, 0],
      ArrowRight: [passo, 0],
      ArrowUp: [0, -passo],
      ArrowDown: [0, passo],
    };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    setCentro(limitarCentro({ x: centro.x + v[0], y: centro.y + v[1] }));
  }

  const inativo = useInatividade(sessao.tempos.inatividadeMs || 45_000, true);
  useEffect(() => {
    if (inativo) telemetria.inatividade("lupa");
  }, [inativo]);

  const s = area.w > 0 ? sob(centro) : null;
  const vista = s
    ? lente(s.foto.recorte, { w: s.foto.caixa.w, h: s.foto.caixa.h }, { x: centro.x - s.foto.caixa.x, y: centro.y - s.foto.caixa.y }, RAIO, AMPLIACAO)
    : null;
  const falta = fotos.find((f) => f.id === fotoQueFalta(lupaRef.current, piso));

  return (
    <section className="bancada">
      <InlineHint className="bancada__objetivo">{textoDe(sessao.textos, "e1", "card")}</InlineHint>
      {alertas > 0 ? (
        <InlineHint key={alertas} tone="friction" announce className="bancada__alerta">
          {textoDe(sessao.textos, "e2", "alerta")}
        </InlineHint>
      ) : null}

      <div
        ref={areaRef}
        className="bancada__area"
        onPointerDown={aoBaixar}
        onPointerMove={aoMover}
        onPointerUp={(e) => {
          if (arraste.current?.id === e.pointerId) arraste.current = null;
        }}
        onPointerCancel={() => {
          arraste.current = null;
        }}
      >
        {fotos.map((f) => (
          <div key={f.id}>
            <p className="bancada__rotulo" style={{ left: f.caixa.x, top: f.caixa.y - ROTULO_H, width: f.caixa.w }}>
              {f.rotulo}
            </p>
            <Janela
              src={src}
              alt={`${f.rotulo}. ${cena.fotos.find((x) => x.id === f.id)?.acao ?? ""}`}
              janela={f.recorte}
              className="bancada__foto"
              style={{ left: f.caixa.x, top: f.caixa.y, width: f.caixa.w, height: f.caixa.h }}
            >
              {fundoAceso === f.id ? (
                <span
                  className="pulso-do-fundo"
                  aria-hidden="true"
                  style={{
                    left: `${((cena.fundo.x - f.recorte.x) / f.recorte.w) * 100}%`,
                    top: `${((cena.fundo.y - f.recorte.y) / f.recorte.h) * 100}%`,
                    width: `${(cena.fundo.w / f.recorte.w) * 100}%`,
                    height: `${(cena.fundo.h / f.recorte.h) * 100}%`,
                  }}
                />
              ) : null}
            </Janela>
          </div>
        ))}

        {alertas > 0 && falta ? (
          <span
            key={`mao-${alertas}`}
            className="bancada__mao"
            style={{
              left: falta.caixa.x + ((cena.fundo.x + cena.fundo.w / 2 - falta.recorte.x) / falta.recorte.w) * falta.caixa.w,
              top: falta.caixa.y + ((cena.fundo.y + cena.fundo.h / 2 - falta.recorte.y) / falta.recorte.h) * falta.caixa.h,
            }}
          >
            <GestureHint gesture="tap" iterations={3} />
          </span>
        ) : null}

        {area.w > 0 ? (
          <div
            className="lupa"
            role="img"
            aria-roledescription={ROTULOS.lupa}
            aria-label={ROTULOS.lupaAria}
            tabIndex={0}
            onKeyDown={aoTecla}
            style={{ left: centro.x - RAIO, top: centro.y - RAIO, width: RAIO * 2, height: RAIO * 2 }}
          >
            {vista ? (
              <img
                className="lupa__imagem"
                src={src}
                alt=""
                draggable={false}
                style={{ width: vista.img.w, height: vista.img.h, left: vista.img.left, top: vista.img.top }}
              />
            ) : null}
          </div>
        ) : null}
        <span className="so-leitor" aria-live="polite">
          {fotos.find((f) => f.id === sobre)?.rotulo ?? ""}
        </span>
      </div>

      <div className="bancada__acoes">
        {inativo ? <Personagem quem="bento" fala={textoDe(sessao.textos, "e2", "inatividade")} animado anunciar /> : null}
        <ButtonUnv
          size="lg"
          block
          aria-disabled={!cumpriu}
          className={cumpriu ? undefined : "botao-esmaecido"}
          onClick={() => void avancar()}
        >
          {ROTULOS.avancar}
        </ButtonUnv>
      </div>
    </section>
  );
}
