import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { BadgeUnv, ButtonUnv } from "@edu/ui/ds-unoovista";
import { Janela } from "../componentes/Janela";
import { Personagem } from "../componentes/Personagem";
import type { Contexto } from "../contexto";
import { useTamanho } from "../hooks/tela";
import { api } from "../lib/api";
import { fraseDoFora, ladoEscondido, limitar, pontoNaImagem, revelouTudo } from "../lib/geometria";
import { telemetria } from "../lib/telemetria";
import { preencher, ROTULOS, textoDe } from "../lib/textos";
import type { Achado, FotoId, InvarianteId, Ponto, Retangulo } from "../lib/tipos";

const ONDA_MS = 700;
const VAO = 8;
const INVARIANTES: InvarianteId[] = ["inv-1", "inv-2"];
const FOTOS: FotoId[] = ["foto-1", "foto-2"];
const CHEIA: Retangulo = { x: 0, y: 0, w: 100, h: 100 };
const PASSO_DA_TECLA = 5;

/**
 * E4, Momentos 3 a 5 — a VIRADA, seguindo o protótipo validado pelo time
 * (ADR-186). Uma tela só, para a imagem não piscar entre os momentos; cada
 * momento diz, no alto, o que a criança faz AGORA.
 *
 * - **TOQUE EM 2 COISAS IGUAIS** (`E4-ALU-03`): a tela dividida, a foto 1
 *   sempre à esquerda e a 2 à direita, SUA FOTO / OUTRA FOTO. Cada toque vai
 *   à api com o ponto da PANORÂMICA (`POST /invariantes`); o gabarito é dela.
 *   Toque fora: a ondulação cinza, sem penalidade visível. Achado: o círculo
 *   dourado, e a linha dourada une o par. Três erros: a AJUDA acende e o
 *   servidor manda os alvos — pulso amarelo. O contador: "1 DE 2 ENCONTRADOS".
 * - **DESLIZE PARA REVELAR** (`E4-ALU-04`): o SLIDER DE COMPARAÇÃO, como a
 *   prévia de quem remove o fundo de uma imagem. Sobre a mesma área, de um
 *   lado da alça o LUGAR INTEIRO, do outro só a SUA FOTO (o resto apagado em
 *   xadrez). A alça parte do CENTRO; arrastada até o fim do lado escondido,
 *   `POST /slider`.
 * - **A CENA COMPLETA** (`E4-ALU-04`, panorâmica aberta): o lugar inteiro, o
 *   contorno da sua foto, "MESMO LUGAR · MESMO MINUTO (14:15)" e o Bento:
 *   "ERA O MESMO LUGAR!". AVANÇAR. (Estado local: um F5 a pula — ela já viu.)
 * - **O QUE FICOU FORA** (`E4-ALU-05`): o ALFINETE grande, que se arrasta da
 *   bandeja até a cena (ou um toque na cena, com o cursor de alfinete); até 10
 *   alfinetes, tocar num o tira; "Pronto" com um alfinete ao menos
 *   (`POST /fora`).
 *
 * (b) COMPENSAÇÃO local — pedido aberto no storybook-unooria: a tela dividida,
 * o slider de comparação, as marcas sobre a imagem, as linhas douradas e o
 * alfinete arrastável não existem na seção `unoovista`. A alça do slider é um
 * `role="slider"` com as setas do teclado.
 */
export function Virada({ ctx }: { ctx: Contexto }) {
  const { sessao, estado, executar, url } = ctx;
  const cena = sessao.cena!;
  const geo = sessao.geometria;
  const capa = estado.capa;
  const src = url(cena.imagem);
  const [ref, tamanho] = useTamanho<HTMLDivElement>();
  const passo = estado.passo;
  const busca = estado.invariantes;
  const encontrados = busca?.encontrados ?? [];
  const alvos = busca?.alvos ?? null;

  const [posicao, setPosicao] = useState(50);
  const deslizou = useRef(false);
  const [mostrarCena, setMostrarCena] = useState(false);
  const [pontos, setPontos] = useState<Partial<Record<Achado, Ponto>>>({});
  const [ondas, setOndas] = useState<{ id: number; foto: FotoId; ponto: Ponto }[]>([]);
  const ocupado = useRef(false);
  /* Os timers das ondas morrem com a tela: um que dispara depois de desmontar acharia o mundo sem `window`. */
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const [marcas, setMarcas] = useState<Ponto[]>(estado.fora?.toques ?? []);
  const [enviandoFora, setEnviandoFora] = useState(false);
  const [alfinete, setAlfinete] = useState<{ ponteiro: number; x: number; y: number } | null>(null);
  const cenaRef = useRef<HTMLDivElement | null>(null);

  if (!capa) return null;
  const W = tamanho.w;
  const alturaCheia = W / geo.proporcaoDaPanoramica;
  const contorno = (
    <span
      className="contorno-da-capa"
      aria-hidden="true"
      style={{ left: `${capa.visivel.x}%`, top: `${capa.visivel.y}%`, width: `${capa.visivel.w}%`, height: `${capa.visivel.h}%` }}
    >
      <span className="contorno-da-capa__rotulo">{textoDe(sessao.textos, "e4", "suaFoto")}</span>
    </span>
  );

  /* ── A CENA COMPLETA (logo depois do slider) ── */
  if (mostrarCena) {
    return (
      <section className="virada">
        <header className="cabecalho-da-tela">
          <h1 className="titulo-da-tela">{textoDe(sessao.textos, "e4", "cenaInteira")}</h1>
        </header>
        <div ref={ref} className="virada__medida">
          <div className="cena-inteira" style={{ height: alturaCheia }}>
            <Janela src={src} alt={cena.alt} janela={CHEIA} className="cena-inteira__imagem">
              {contorno}
            </Janela>
          </div>
        </div>
        <p className="mesmo-lugar">{preencher(textoDe(sessao.textos, "e4", "mesmoLugar"), { hora: cena.hora })}</p>
        <Personagem fala={textoDe(sessao.textos, "e4", "bentoMesmoLugar")} animado anunciar />
        <div className="virada__acoes">
          <ButtonUnv size="lg" block onClick={() => setMostrarCena(false)}>
            {textoDe(sessao.textos, "e4", "avancar")}
          </ButtonUnv>
        </div>
      </section>
    );
  }

  /* ── O QUE FICOU FORA, com o alfinete ── */
  if (passo === "fora") {
    const max = geo.toquesForaMax || 10;
    const cheio = marcas.length >= max;
    const pontoNaCena = (clientX: number, clientY: number): Ponto | null => {
      const r = cenaRef.current?.getBoundingClientRect();
      if (!r || clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
      return pontoNaImagem(CHEIA, clientX - r.left, clientY - r.top, { w: r.width, h: r.height });
    };
    const fincar = (p: Ponto | null) => {
      if (!p || enviandoFora || cheio) return;
      setMarcas((m) => [...m, p]);
    };
    const pronto = async () => {
      if (enviandoFora || marcas.length === 0) return;
      setEnviandoFora(true);
      telemetria.marcouFora(marcas.length);
      const r = await executar(() => api.fora(marcas), "fora");
      if (r === null && !ctx.naFila("fora")) setEnviandoFora(false);
    };
    return (
      <section className="virada">
        <header className="cabecalho-da-tela">
          <h1 className="titulo-da-tela titulo-da-tela--frase">{fraseDoFora(cena.espacoCurto)}</h1>
        </header>
        <div ref={ref} className="virada__medida">
          <div
            ref={cenaRef}
            className={`cena-inteira cena-inteira--alfinete${cheio ? " cena-inteira--cheia" : ""}`}
            style={{ height: alturaCheia }}
            onClick={(e: MouseEvent<HTMLDivElement>) => fincar(pontoNaCena(e.clientX, e.clientY))}
          >
            <Janela src={src} alt={cena.alt} janela={CHEIA} className="cena-inteira__imagem">
              {contorno}
              {marcas.map((m, i) => (
                <button
                  key={`${m.x}-${m.y}-${i}`}
                  type="button"
                  className="pino"
                  aria-label={ROTULOS.pino(i + 1)}
                  disabled={enviandoFora}
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMarcas((atual) => atual.filter((_, j) => j !== i));
                  }}
                >
                  <span aria-hidden="true">📌</span>
                </button>
              ))}
            </Janela>
          </div>
        </div>

        <div className="bandeja">
          <button
            type="button"
            className={`bandeja__alfinete${alfinete ? " bandeja__alfinete--arrastando" : ""}`}
            disabled={enviandoFora || cheio}
            aria-label={textoDe(sessao.textos, "e4", "alfinete")}
            style={alfinete ? { transform: `translate(${alfinete.x}px, ${alfinete.y}px)` } : undefined}
            onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setAlfinete({ ponteiro: e.pointerId, x: 0, y: 0 });
              (e.currentTarget as HTMLButtonElement).dataset.x0 = String(e.clientX);
              (e.currentTarget as HTMLButtonElement).dataset.y0 = String(e.clientY);
            }}
            onPointerMove={(e: PointerEvent<HTMLButtonElement>) => {
              if (!alfinete || alfinete.ponteiro !== e.pointerId) return;
              const x0 = Number(e.currentTarget.dataset.x0);
              const y0 = Number(e.currentTarget.dataset.y0);
              setAlfinete({ ponteiro: e.pointerId, x: e.clientX - x0, y: e.clientY - y0 });
            }}
            onPointerUp={(e: PointerEvent<HTMLButtonElement>) => {
              if (!alfinete || alfinete.ponteiro !== e.pointerId) return;
              const andou = Math.hypot(alfinete.x, alfinete.y) > 8;
              setAlfinete(null);
              if (andou) {
                e.currentTarget.dataset.engoliu = "1";
                fincar(pontoNaCena(e.clientX, e.clientY));
              }
            }}
            onPointerCancel={() => setAlfinete(null)}
            onClick={(e) => {
              /* Quem não arrasta (teclado, motricidade): o toque finca um alfinete no meio da cena. */
              if (e.currentTarget.dataset.engoliu === "1") {
                e.currentTarget.dataset.engoliu = "";
                return;
              }
              fincar({ x: 50, y: 50 });
            }}
          >
            <span aria-hidden="true">📌</span>
          </button>
          <p className="bandeja__rotulo">{textoDe(sessao.textos, "e4", "alfinete")}</p>
        </div>

        <p className="so-leitor" aria-live="polite">
          {ROTULOS.marcas(marcas.length, max)}
        </p>
        <div className="virada__acoes">
          <ButtonUnv size="lg" block disabled={enviandoFora || marcas.length === 0} onClick={() => void pronto()}>
            {textoDe(sessao.textos, "e4", "pronto")}
          </ButtonUnv>
        </div>
      </section>
    );
  }

  /* ── DESLIZE PARA REVELAR: o slider de comparação ── */
  if (passo === "slider") {
    const lado = ladoEscondido(capa.visivel);
    const mover = (valor: number) => {
      const novo = limitar(valor, 0, 100);
      setPosicao(novo);
      if (revelouTudo(novo, lado) && !deslizou.current) {
        deslizou.current = true;
        telemetria.revelou();
        setMostrarCena(true);
        void executar(() => api.slider(), "slider");
      }
    };
    const arrastar = (e: PointerEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      mover(((e.clientX - r.left) / r.width) * 100);
    };
    const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
      const d = e.key === "ArrowRight" ? PASSO_DA_TECLA : e.key === "ArrowLeft" ? -PASSO_DA_TECLA : 0;
      if (!d) return;
      e.preventDefault();
      mover(posicao + d);
    };
    /* O lado da SUA FOTO (o resto apagado) é o lado escondido; o lugar inteiro, o outro. */
    const recorteDaFoto = lado === "direita" ? `inset(0 0 0 ${posicao}%)` : `inset(0 ${100 - posicao}% 0 0)`;
    return (
      <section className="virada">
        <header className="cabecalho-da-tela">
          <h1 className="titulo-da-tela">{textoDe(sessao.textos, "e4", "revelar")}</h1>
          <p className="instrucao">{textoDe(sessao.textos, "e4", "revelarTexto")}</p>
        </header>
        <Personagem fala={textoDe(sessao.textos, "e4", "bentoEntendeu")} animado anunciar />
        <div ref={ref} className="virada__medida">
          <div
            className="comparar"
            style={{ height: alturaCheia }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              arrastar(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 0 && e.pointerType === "mouse") return;
              if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
              arrastar(e);
            }}
          >
            {/* Embaixo, o lugar inteiro. */}
            <Janela src={src} alt={cena.alt} janela={CHEIA} className="comparar__camada" />
            {/* Em cima, do lado escondido da alça: só a sua foto, o resto em xadrez. */}
            <div className="comparar__camada comparar__so-a-foto" style={{ clipPath: recorteDaFoto }} aria-hidden="true">
              <Janela
                src={src}
                alt=""
                janela={capa.visivel}
                className="comparar__foto"
                style={{ left: `${capa.visivel.x}%`, top: `${capa.visivel.y}%`, width: `${capa.visivel.w}%`, height: `${capa.visivel.h}%` }}
              />
            </div>
            {contorno}
            <span className={`comparar__rotulo comparar__rotulo--${lado === "direita" ? "esquerda" : "direita"}`}>{ROTULOS.salaInteira}</span>
            <span className={`comparar__rotulo comparar__rotulo--${lado}`}>{textoDe(sessao.textos, "e4", "suaFoto")}</span>
            <div className="comparar__linha" style={{ left: `${posicao}%` }} aria-hidden="true" />
            <div
              className="comparar__alca"
              role="slider"
              tabIndex={0}
              aria-label={ROTULOS.revelar}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(posicao)}
              style={{ left: `${posicao}%` }}
              onKeyDown={tecla}
            >
              <span aria-hidden="true">◀ ▶</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ── TOQUE EM 2 COISAS IGUAIS: a tela dividida ── */
  const esq = geo.recortes["foto-1"];
  const dir = geo.recortes["foto-2"];
  const escala = W > 0 ? (W - VAO) / (esq.w + dir.w) : 0; /* px por unidade da panorâmica */
  const altura = (100 * escala) / geo.proporcaoDaPanoramica;
  const caixa = (f: FotoId) => {
    const r = f === "foto-1" ? esq : dir;
    const x = f === "foto-1" ? 0 : esq.w * escala + VAO;
    return { x, w: r.w * escala, h: (r.h / 100) * altura, r };
  };
  const naCaixa = (f: FotoId, p: Ponto) => {
    const c = caixa(f);
    return { x: c.x + (p.x - c.r.x) * escala, y: ((p.y - c.r.y) / c.r.h) * c.h };
  };
  const pontoDoAchado = (a: Achado): Ponto | null => {
    if (pontos[a]) return pontos[a]!;
    /* Depois de um F5 o toque se perdeu: o servidor devolve o alvo do que já foi achado. */
    const alvo = (busca?.achados ?? []).concat(alvos ?? []).find((x) => a.startsWith(`${x.id}:`));
    return alvo ? { x: alvo.x + alvo.w / 2, y: alvo.y + alvo.h / 2 } : null;
  };

  async function tocar(f: FotoId, e: MouseEvent<HTMLDivElement>) {
    if (passo !== "invariantes" || ocupado.current) return;
    const c = caixa(f);
    const r = e.currentTarget.getBoundingClientRect();
    const p = pontoNaImagem(c.r, e.clientX - r.left, e.clientY - r.top, { w: r.width, h: r.height });
    ocupado.current = true;
    telemetria.tocouInvariante(busca?.ajuda ?? false);
    const resposta = await executar(() => api.invariante(f, p));
    ocupado.current = false;
    if (!resposta) return;
    if (resposta.toque.acerto) {
      const achado = `${resposta.toque.acerto}:${f}` as Achado;
      setPontos((atual) => (atual[achado] ? atual : { ...atual, [achado]: p }));
    } else {
      const id = Date.now();
      setOndas((o) => [...o, { id, foto: f, ponto: p }]);
      timers.current.push(window.setTimeout(() => setOndas((o) => o.filter((x) => x.id !== id)), ONDA_MS));
    }
  }

  const sua = capa.fotoId;
  const raio = (r: number, f: FotoId) => (r / caixa(f).r.w) * caixa(f).w;
  const nomeDo = (id: InvarianteId) => cena.invariantes.find((i) => i.id === id)?.nome ?? "";
  const linhas = INVARIANTES.flatMap((inv) => {
    const a = pontoDoAchado(`${inv}:foto-1`);
    const b = pontoDoAchado(`${inv}:foto-2`);
    if (!a || !b || !encontrados.includes(`${inv}:foto-1`) || !encontrados.includes(`${inv}:foto-2`)) return [];
    return [{ inv, de: naCaixa("foto-1", a), ate: naCaixa("foto-2", b) }];
  });
  const paresAchados = INVARIANTES.filter((inv) => encontrados.includes(`${inv}:foto-1`) && encontrados.includes(`${inv}:foto-2`));

  return (
    <section className="virada">
      <header className="cabecalho-da-tela">
        <h1 className="titulo-da-tela">{textoDe(sessao.textos, "e4", "invariantes")}</h1>
        <p className="instrucao">{textoDe(sessao.textos, "e4", "invariantesTexto")}</p>
        <BadgeUnv variant="neutral" className="contador" aria-live="polite">
          {preencher(textoDe(sessao.textos, "e4", "contador"), { n: String(paresAchados.length) })}
        </BadgeUnv>
      </header>

      <div className="virada__rotulos" style={{ gridTemplateColumns: W > 0 ? `${caixa("foto-1").w}px ${caixa("foto-2").w}px` : undefined }}>
        {FOTOS.map((f) => (
          <p key={f} className={`virada__rotulo${f === sua ? " virada__rotulo--sua" : ""}`}>
            {f === sua ? (
              textoDe(sessao.textos, "e4", "suaFoto")
            ) : (
              <>
                {textoDe(sessao.textos, "e4", "outraFoto")}{" "}
                <BadgeUnv variant="neutral" className="virada__acervo">
                  {ROTULOS.acervo}
                </BadgeUnv>
              </>
            )}
          </p>
        ))}
      </div>

      <div ref={ref} className="virada__medida">
        <div className="dividida" style={{ height: altura }}>
          {W > 0
            ? FOTOS.map((f) => {
                const c = caixa(f);
                return (
                  <div
                    key={f}
                    className={`dividida__foto dividida__foto--tocavel${f === sua ? " dividida__foto--sua" : ""}`}
                    style={{ left: c.x, width: c.w, height: c.h }}
                    onClick={(e) => void tocar(f, e)}
                  >
                    <Janela
                      src={src}
                      alt={`${f === sua ? textoDe(sessao.textos, "e4", "suaFoto") : textoDe(sessao.textos, "e4", "outraFoto")}. ${cena.fotos.find((x) => x.id === f)?.acao ?? ""}`}
                      janela={c.r}
                    />
                  </div>
                );
              })
            : null}

          {/* Marcas por cima das duas fotos: ondas, achados, pulsos e as linhas douradas. */}
          {W > 0 ? (
            <svg className="dividida__marcas" width={W} height={altura} aria-hidden="true">
              {linhas.map((l) => (
                <line key={l.inv} className="linha-dourada" x1={l.de.x} y1={l.de.y} x2={l.ate.x} y2={l.ate.y} />
              ))}
              {encontrados.map((a) => {
                const p = pontoDoAchado(a);
                if (!p) return null;
                const f = a.endsWith("foto-1") ? "foto-1" : "foto-2";
                const q = naCaixa(f, p);
                return <circle key={a} className="achado" cx={q.x} cy={q.y} r={Math.max(18, raio(5, f))} />;
              })}
              {alvos
                ? alvos.flatMap((alvo) =>
                    FOTOS.filter((f) => !encontrados.includes(`${alvo.id}:${f}`)).map((f) => {
                      /* A ÁREA inteira do objeto pulsa (ADR-188), com um mínimo de 40 px para o dedo. */
                      const q = naCaixa(f, alvo);
                      const w = Math.max(40, alvo.w * escala);
                      const h = Math.max(40, (alvo.h / caixa(f).r.h) * caixa(f).h);
                      const cx = q.x + (alvo.w * escala) / 2;
                      const cy = q.y + ((alvo.h / caixa(f).r.h) * caixa(f).h) / 2;
                      return <rect key={`${alvo.id}-${f}`} className="pulso-amarelo" x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={10} />;
                    }),
                  )
                : null}
              {ondas.map((o) => {
                const q = naCaixa(o.foto, o.ponto);
                return <circle key={o.id} className="onda-neutra" cx={q.x} cy={q.y} r={22} />;
              })}
            </svg>
          ) : null}
        </div>
      </div>

      {paresAchados.length > 0 ? (
        <ul className="virada__achados" aria-live="polite">
          {paresAchados.map((inv) => (
            <li key={inv}>
              <BadgeUnv variant="neutral">✓ {nomeDo(inv)}</BadgeUnv>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
