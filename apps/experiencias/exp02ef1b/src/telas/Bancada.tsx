import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { BadgeUnv, ButtonUnv, GestureHint } from "@edu/ui/ds-unoovista";
import { Aviso } from "../componentes/Aviso";
import { Janela } from "../componentes/Janela";
import { Personagem } from "../componentes/Personagem";
import type { Contexto } from "../contexto";
import { prefereMenosMovimento, useInatividade, useTamanho } from "../hooks/tela";
import { api } from "../lib/api";
import { encaixar, lente, limitar, pontoNaImagem, proporcaoDaJanela } from "../lib/geometria";
import { achados as achadosDe, alvoQueFalta, alvoSob, juntarRelatos, LUPA_VAZIA, msDo, pisoLocal, registrarAmostra, relatoMudou } from "../lib/lupa";
import { telemetria } from "../lib/telemetria";
import { preencher, ROTULOS, textoDe } from "../lib/textos";
import type { Alvo, FotoId, InvarianteId, Ponto, RelatoDaLupa, Retangulo } from "../lib/tipos";

/** O raio da lente, em px: 112 px de diâmetro, maior que um dedo de 7 anos (o alvo ≥ 56 px). */
const RAIO = 56;
/** A ampliação é FIXA (one-pager §4): a criança move a lente, nunca o zoom. */
const AMPLIACAO = 2;
const AMOSTRA_MS = 100;
const RELATO_MS = 4000;
const ROTULO_H = 28;
const VAO = 12;
const PASSO_DA_TECLA = 16;
/** O anel do tempo, em volta da lente. */
const ANEL = RAIO + 8;
const VOLTA = 2 * Math.PI * ANEL;

interface FotoNaTela {
  id: FotoId;
  recorte: Retangulo;
  /** A caixa da foto, em px, relativa à bancada. */
  caixa: { x: number; y: number; w: number; h: number };
  rotulo: string;
}

/**
 * E2 — NAVEGAR: "INVESTIGUE COM A LUPA" (o `E2-ALU-01` do protótipo, ADR-186).
 *
 * As duas fotos brutas, imóveis, e a LUPA circular de ampliação fixa 2× que a
 * criança arrasta. A missão (a tela de abertura disse) é achar os DOIS objetos
 * do fundo. Quando o centro da lente para sobre um deles, a lente BRILHA e o
 * anel em volta dela enche em 3 s ("SEGURE A LUPA AQUI!"); cheio, o objeto
 * ganha o círculo dourado nas duas fotos e o contador anda ("1 DE 2
 * ENCONTRADOS"). Os dois achados: "INVESTIGAÇÃO COMPLETA!" e o AVANÇAR acende.
 *
 * O lugar dos dois objetos desce SÓ neste passo (`estado.lupa.alvos`): o
 * brilho precisa dele. O que a E4 cobra é achá-los NAS DUAS fotos, por toque,
 * e isso o servidor continua corrigindo.
 *
 * O piso (3 s em CADA objeto) é medido aqui e decidido na api: o relato vai de
 * tempos em tempos e no toque de AVANÇAR. Antes do piso o botão fica
 * esmaecido mas tocável — o toque precoce é a evidência que a régua lê
 * (`lupa_alertas`): a tela vibra, o aviso "OLHE O FUNDO" abre e, ao voltar, a
 * mãozinha aponta o objeto que falta. 45 s sem gesto: o Bento, "VAMOS
 * INVESTIGAR?".
 *
 * As fotos ficam lado a lado quando cabem (≥ 600 px); no celular de 375 px,
 * uma sobre a outra — lado a lado, cada uma teria 170 px e a lente cobriria
 * meia foto.
 *
 * (b) COMPENSAÇÃO local — pedido aberto no storybook-unooria: a lupa, o brilho
 * e o anel do tempo não existem na seção `unoovista` (nem em seção alguma).
 * Composição de posicionamento sobre a `Janela`; a conta está em
 * `lib/geometria.ts#lente` e o cronômetro em `lib/lupa.ts`.
 */
export function Bancada({ ctx }: { ctx: Contexto }) {
  const { sessao, estado, executar, url } = ctx;
  const cena = sessao.cena!;
  const geo = sessao.geometria;
  const piso = geo.pisoDaLupaMs || 3000;
  const src = url(cena.imagem);
  const alvos: Alvo[] = estado.lupa?.alvos ?? [];
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
  const alvosRef = useRef(alvos);
  alvosRef.current = alvos;

  function sob(c: Ponto) {
    for (const f of fotosRef.current) {
      const { x, y, w, h } = f.caixa;
      if (c.x >= x && c.x <= x + w && c.y >= y && c.y <= y + h) {
        const ponto = pontoNaImagem(f.recorte, c.x - x, c.y - y, { w, h });
        return { foto: f, ponto, alvo: alvoSob(alvosRef.current, ponto, geo.proporcaoDaPanoramica) };
      }
    }
    return null;
  }

  /* ── o cronômetro: a cada amostra, o tempo vai para o objeto sob o centro da lente ── */
  const inicial: RelatoDaLupa = estado.lupa ? { alvo1Ms: estado.lupa.alvo1Ms, alvo2Ms: estado.lupa.alvo2Ms } : LUPA_VAZIA;
  const lupaRef = useRef<RelatoDaLupa>(inicial);
  const enviadoRef = useRef<RelatoDaLupa>(inicial);
  const [lupa, setLupa] = useState<RelatoDaLupa>(inicial);
  const [sobreAlvo, setSobreAlvo] = useState<InvarianteId | null>(null);
  const [sobreFoto, setSobreFoto] = useState<FotoId | null>(null);

  useEffect(() => {
    let ultimo = performance.now();
    const id = window.setInterval(() => {
      const agora = performance.now();
      const dt = agora - ultimo;
      ultimo = agora;
      if (document.visibilityState !== "visible") return;
      const s = sob(centroRef.current);
      const alvo = s?.alvo?.id ?? null;
      const antes = lupaRef.current;
      lupaRef.current = registrarAmostra(antes, alvo, dt);
      if (alvo && msDo(antes, alvo) < piso && msDo(lupaRef.current, alvo) >= piso) {
        telemetria.achouNaLupa();
        if (!prefereMenosMovimento()) navigator.vibrate?.(40);
      }
      setLupa(lupaRef.current);
      setSobreAlvo(alvo);
      setSobreFoto(s?.foto.id ?? null);
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

  const achados = achadosDe(lupa, piso);
  const cumpriu = pisoLocal(lupa, piso);

  /* ── o avanço ── */
  const [alertaAberto, setAlertaAberto] = useState(false);
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
      setAlertaAberto(true);
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

  const inativo = useInatividade(sessao.tempos.inatividadeMs || 45_000, !cumpriu);
  useEffect(() => {
    if (inativo) telemetria.inatividade("lupa");
  }, [inativo]);

  const s = area.w > 0 ? sob(centro) : null;
  const vista = s
    ? lente(s.foto.recorte, { w: s.foto.caixa.w, h: s.foto.caixa.h }, { x: centro.x - s.foto.caixa.x, y: centro.y - s.foto.caixa.y }, RAIO, AMPLIACAO)
    : null;
  /* O objeto sob a lente ainda não achado: a lente brilha e o anel enche. */
  const procurando = sobreAlvo && !achados.includes(sobreAlvo) ? sobreAlvo : null;
  const fracao = procurando ? Math.min(1, msDo(lupa, procurando) / piso) : 0;
  const naCaixa = (f: FotoNaTela, a: Alvo) => ({
    x: f.caixa.x + ((a.x - f.recorte.x) / f.recorte.w) * f.caixa.w,
    y: f.caixa.y + ((a.y - f.recorte.y) / f.recorte.h) * f.caixa.h,
    r: Math.max(22, (a.r / f.recorte.w) * f.caixa.w),
  });
  /* A mãozinha, depois do "OLHE O FUNDO": no objeto que falta, na primeira foto. */
  const falta = alvoQueFalta(lupa, piso);
  const alvoDaMao = alertas > 0 && !alertaAberto && falta ? alvos.find((a) => a.id === falta) : undefined;
  const fotoDaMao = fotos[0];

  return (
    <section className="bancada">
      <header className="cabecalho-da-tela">
        <h1 className="titulo-da-tela">
          {cumpriu ? (
            <>
              {textoDe(sessao.textos, "e2", "completa")} <span aria-hidden="true">✅</span>
            </>
          ) : (
            textoDe(sessao.textos, "e2", "titulo")
          )}
        </h1>
        <p className={`instrucao${alvoDaMao ? " instrucao--dica" : ""}`} aria-live="polite">
          {cumpriu
            ? textoDe(sessao.textos, "e2", "completaTexto")
            : alvoDaMao
              ? textoDe(sessao.textos, "e2", "mao")
              : textoDe(sessao.textos, "e2", "instrucao")}
        </p>
        <BadgeUnv variant="neutral" className="contador" aria-live="polite">
          {preencher(textoDe(sessao.textos, "e2", "contador"), { n: String(achados.length) })}
        </BadgeUnv>
      </header>

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
              className={`bancada__foto${cumpriu ? " bancada__foto--completa" : ""}`}
              style={{ left: f.caixa.x, top: f.caixa.y, width: f.caixa.w, height: f.caixa.h }}
            />
          </div>
        ))}

        {/* O círculo dourado nos objetos já achados, nas duas fotos. */}
        {fotos.flatMap((f) =>
          alvos
            .filter((a) => achados.includes(a.id))
            .map((a) => {
              const q = naCaixa(f, a);
              return (
                <span
                  key={`${f.id}-${a.id}`}
                  className="achado-na-lupa"
                  aria-hidden="true"
                  style={{ left: q.x - q.r, top: q.y - q.r, width: q.r * 2, height: q.r * 2 }}
                />
              );
            }),
        )}

        {alvoDaMao && fotoDaMao ? (
          <span key={`mao-${alertas}`} className="bancada__mao" style={{ left: naCaixa(fotoDaMao, alvoDaMao).x, top: naCaixa(fotoDaMao, alvoDaMao).y }}>
            <GestureHint gesture="tap" iterations={3} />
          </span>
        ) : null}

        {area.w > 0 ? (
          <div
            className={`lupa${procurando ? " lupa--brilhando" : ""}${sobreAlvo && achados.includes(sobreAlvo) ? " lupa--achou" : ""}`}
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

        {/* O anel do tempo: enche em 3 s enquanto a lente fica sobre o objeto. */}
        {procurando ? (
          <svg
            className="anel-do-tempo"
            width={ANEL * 2 + 8}
            height={ANEL * 2 + 8}
            style={{ left: centro.x - ANEL - 4, top: centro.y - ANEL - 4 }}
            role="progressbar"
            aria-label={ROTULOS.anel(Math.round(fracao * 100))}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fracao * 100)}
          >
            <circle className="anel-do-tempo__trilho" cx={ANEL + 4} cy={ANEL + 4} r={ANEL} />
            <circle
              className="anel-do-tempo__progresso"
              cx={ANEL + 4}
              cy={ANEL + 4}
              r={ANEL}
              strokeDasharray={VOLTA}
              strokeDashoffset={VOLTA * (1 - fracao)}
              transform={`rotate(-90 ${ANEL + 4} ${ANEL + 4})`}
            />
          </svg>
        ) : null}
        {procurando ? (
          <p className="segure" style={{ left: centro.x, top: centro.y + ANEL + 8 }}>
            {textoDe(sessao.textos, "e2", "segure")}
          </p>
        ) : null}

        <span className="so-leitor" aria-live="polite">
          {fotos.find((f) => f.id === sobreFoto)?.rotulo ?? ""}
        </span>
      </div>

      <div className="bancada__acoes">
        {inativo ? <Personagem fala={textoDe(sessao.textos, "e2", "inatividade")} animado anunciar /> : null}
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

      <Aviso
        aberto={alertaAberto}
        icone="search"
        titulo={textoDe(sessao.textos, "e2", "alerta")}
        texto={textoDe(sessao.textos, "e2", "alertaTexto")}
        acao={textoDe(sessao.textos, "e2", "voltar")}
        aoAgir={() => setAlertaAberto(false)}
        aoFechar={() => setAlertaAberto(false)}
      />
    </section>
  );
}
