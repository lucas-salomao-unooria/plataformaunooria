import { useRef, useState, type MouseEvent } from "react";
import { BadgeUnv, ButtonUnv, InlineHint } from "@edu/ui/ds-unoovista";
import { Janela } from "../componentes/Janela";
import { Personagem } from "../componentes/Personagem";
import type { Contexto } from "../contexto";
import { useTamanho } from "../hooks/tela";
import { api } from "../lib/api";
import { fraseDoFora, pontoNaImagem, revelacao } from "../lib/geometria";
import { telemetria } from "../lib/telemetria";
import { ROTULOS, textoDe } from "../lib/textos";
import type { Achado, FotoId, InvarianteId, Ponto, Retangulo } from "../lib/tipos";

const ONDA_MS = 700;
const INVARIANTES: InvarianteId[] = ["inv-1", "inv-2"];
const FOTOS: FotoId[] = ["foto-1", "foto-2"];

/**
 * E4, Momentos 3 a 5 — a VIRADA, a busca e a revelação. Uma tela só, para a
 * panorâmica não piscar entre os momentos.
 *
 * - A TELA DIVIDIDA é GEOGRÁFICA: a foto 1 sempre à esquerda, a foto 2 à
 *   direita, na mesma escala — é o que deixa a revelação acontecer sem
 *   emenda. O rótulo SUA FOTO / OUTRA FOTO acompanha a escolha; a outra é do
 *   acervo da missão (one-pager §4: "sem depender de ações de outras pessoas").
 * - TOQUE EM 2 COISAS IGUAIS: cada toque vai à api com o ponto da PANORÂMICA
 *   (`POST /invariantes`); o gabarito é dela. Toque fora: a ondulação cinza
 *   neutra, sem penalidade visível. Achado: o círculo dourado, e a linha
 *   dourada une o par quando o mesmo objeto foi achado nas duas metades.
 *   Três erros: a AJUDA acende e o servidor manda os alvos — pulso amarelo.
 * - O SLIDER dissolve a divisória: a foto da direita desliza até a posição
 *   dela na panorâmica, SEM mudar de escala (`revelacao`). No fim do curso,
 *   `POST /slider`, e o Bento: "ERA O MESMO LUGAR!".
 * - A CENA INTEIRA: "Marque na biblioteca o que ficou fora da sua foto." —
 *   até 10 marcas (tocar numa marca a tira) e "Pronto" (`POST /fora`).
 *
 * (b) COMPENSAÇÃO local — pedido aberto no storybook-unooria: a tela dividida
 * com revelação por slider, as marcas sobre a imagem e as linhas douradas não
 * existem na seção `unoovista`. O slider é o `<input type="range">` nativo
 * (teclado e leitor de tela de graça), com medida e cor por token.
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

  const [t, setT] = useState(0);
  const revelado = passo === "fora";
  const deslizou = useRef(false);
  const [pontos, setPontos] = useState<Partial<Record<Achado, Ponto>>>({});
  const [ondas, setOndas] = useState<{ id: number; foto: FotoId; ponto: Ponto }[]>([]);
  const ocupado = useRef(false);
  const [marcas, setMarcas] = useState<Ponto[]>(estado.fora?.toques ?? []);
  const [enviandoFora, setEnviandoFora] = useState(false);

  if (!capa) return null;

  /* ── a geometria da tela dividida ── */
  const esq = geo.recortes["foto-1"];
  const dir = geo.recortes["foto-2"];
  const W = tamanho.w;
  const escala = W > 0 ? W / (esq.w + dir.w) : 0; /* px por unidade da panorâmica */
  const alturaDaPanoramica = (100 * escala) / geo.proporcaoDaPanoramica;
  const rev = revelacao(esq, dir, passo === "slider" ? t : passo === "invariantes" ? 0 : 1);
  const inicio = (W - rev.largura * escala) / 2;
  const caixa = (f: FotoId) => {
    const r = f === "foto-1" ? esq : dir;
    const x = f === "foto-1" ? inicio : inicio + rev.inicioDaDireita * escala;
    return { x, y: 0, w: r.w * escala, h: (r.h / 100) * alturaDaPanoramica, r };
  };
  const naCaixa = (f: FotoId, p: Ponto) => {
    const c = caixa(f);
    return { x: c.x + (p.x - c.r.x) * escala, y: ((p.y - c.r.y) / c.r.h) * c.h };
  };
  const pontoDoAchado = (a: Achado): Ponto | null => {
    if (pontos[a]) return pontos[a]!;
    /* Depois de um F5 o toque se perdeu: o servidor devolve o alvo do que já foi achado. */
    const alvo = (busca?.achados ?? []).concat(alvos ?? []).find((x) => a.startsWith(`${x.id}:`));
    return alvo ? { x: alvo.x, y: alvo.y } : null;
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
      window.setTimeout(() => setOndas((o) => o.filter((x) => x.id !== id)), ONDA_MS);
    }
  }

  function deslizar(valor: number) {
    const novo = valor / 100;
    setT(novo);
    if (novo >= 1 && !deslizou.current) {
      deslizou.current = true;
      telemetria.revelou();
      void executar(() => api.slider(), "slider");
    }
  }

  async function pronto() {
    if (enviandoFora) return;
    setEnviandoFora(true);
    telemetria.marcouFora(marcas.length);
    const r = await executar(() => api.fora(marcas), "fora");
    if (r === null && !ctx.naFila("fora")) setEnviandoFora(false);
  }

  const completo = busca?.completo === true || passo === "slider";
  const sua = capa.fotoId;
  const raio = (r: number, f: FotoId) => (r / caixa(f).r.w) * caixa(f).w;
  const nomeDo = (id: InvarianteId) => cena.invariantes.find((i) => i.id === id)?.nome ?? "";

  /* ── a cena inteira (Momento 5, "o que ficou fora") ── */
  if (revelado) {
    const alturaCheia = W / geo.proporcaoDaPanoramica;
    const cheia: Retangulo = { x: 0, y: 0, w: 100, h: 100 };
    const max = geo.toquesForaMax || 10;
    return (
      <section className="virada">
        <Personagem quem="bento" fala={textoDe(sessao.textos, "e4", "bentoMesmoLugar")} animado anunciar />
        <p className="instrucao">{fraseDoFora(cena.espacoCurto)}</p>
        <div ref={ref} className="virada__medida">
          <div
            className="cena-inteira"
            style={{ height: alturaCheia }}
            onClick={(e) => {
              if (enviandoFora || marcas.length >= max) return;
              const r = e.currentTarget.getBoundingClientRect();
              setMarcas((m) => [...m, pontoNaImagem(cheia, e.clientX - r.left, e.clientY - r.top, { w: r.width, h: r.height })]);
            }}
          >
            <Janela src={src} alt={cena.alt} janela={cheia} className="cena-inteira__imagem">
              <span
                className="contorno-da-capa"
                aria-hidden="true"
                style={{ left: `${capa.visivel.x}%`, top: `${capa.visivel.y}%`, width: `${capa.visivel.w}%`, height: `${capa.visivel.h}%` }}
              >
                <span className="contorno-da-capa__rotulo">{textoDe(sessao.textos, "e4", "suaFoto")}</span>
              </span>
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
                  <span className="pino__ponto" aria-hidden="true" />
                </button>
              ))}
            </Janela>
          </div>
        </div>
        <p className="so-leitor" aria-live="polite">
          {ROTULOS.marcas(marcas.length, max)}
        </p>
        <div className="virada__acoes">
          <ButtonUnv size="lg" block disabled={enviandoFora} onClick={() => void pronto()}>
            {textoDe(sessao.textos, "e4", "pronto")}
          </ButtonUnv>
        </div>
      </section>
    );
  }

  /* ── a tela dividida, a busca e o slider ── */
  const altura = caixa("foto-1").h;
  const linhas = INVARIANTES.flatMap((inv) => {
    const a = pontoDoAchado(`${inv}:foto-1`);
    const b = pontoDoAchado(`${inv}:foto-2`);
    if (!a || !b || !encontrados.includes(`${inv}:foto-1`) || !encontrados.includes(`${inv}:foto-2`)) return [];
    return [{ inv, de: naCaixa("foto-1", a), ate: naCaixa("foto-2", b) }];
  });
  const paresAchados = INVARIANTES.filter((inv) => encontrados.includes(`${inv}:foto-1`) && encontrados.includes(`${inv}:foto-2`));
  const sumir = passo === "slider" ? 1 - t : 1;

  return (
    <section className="virada">
      {completo ? (
        <Personagem quem="bento" fala={textoDe(sessao.textos, "e4", "bentoEntendeu")} animado anunciar />
      ) : (
        <InlineHint>{textoDe(sessao.textos, "e4", "invariantes")}</InlineHint>
      )}

      <div className="virada__rotulos" style={{ opacity: sumir }} aria-hidden={sumir === 0}>
        {FOTOS.map((f) => (
          <p key={f} className="virada__rotulo">
            {f === sua ? (
              <>
                {textoDe(sessao.textos, "e4", "suaFoto")}
                {ctx.cracha ? <span aria-hidden="true"> {ctx.cracha.emoji}</span> : null}
              </>
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
                    className={`dividida__foto${passo === "invariantes" ? " dividida__foto--tocavel" : ""}`}
                    style={{ left: c.x, width: c.w, height: c.h, zIndex: f === "foto-2" ? 2 : 1 }}
                    onClick={(e) => void tocar(f, e)}
                  >
                    <Janela src={src} alt={`${f === sua ? textoDe(sessao.textos, "e4", "suaFoto") : textoDe(sessao.textos, "e4", "outraFoto")}. ${cena.fotos.find((x) => x.id === f)?.acao ?? ""}`} janela={c.r}>
                      {f === sua && passo === "invariantes" ? (
                        <span
                          className="contorno-da-capa"
                          aria-hidden="true"
                          style={{
                            left: `${((capa.visivel.x - c.r.x) / c.r.w) * 100}%`,
                            top: `${((capa.visivel.y - c.r.y) / c.r.h) * 100}%`,
                            width: `${(capa.visivel.w / c.r.w) * 100}%`,
                            height: `${(capa.visivel.h / c.r.h) * 100}%`,
                          }}
                        />
                      ) : null}
                    </Janela>
                  </div>
                );
              })
            : null}

          {/* A divisória: some à medida que a foto da direita encontra o seu lugar. */}
          {W > 0 ? <span className="dividida__linha" aria-hidden="true" style={{ left: caixa("foto-2").x, opacity: sumir }} /> : null}

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
              {passo === "invariantes" && alvos
                ? alvos.flatMap((alvo) =>
                    FOTOS.filter((f) => !encontrados.includes(`${alvo.id}:${f}`)).map((f) => {
                      const q = naCaixa(f, alvo);
                      return <circle key={`${alvo.id}-${f}`} className="pulso-amarelo" cx={q.x} cy={q.y} r={Math.max(20, raio(alvo.r, f))} />;
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

      {passo === "slider" ? (
        <div className="revelar">
          <input
            className="revelar__controle"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(t * 100)}
            aria-label={ROTULOS.revelar}
            onChange={(e) => deslizar(Number(e.currentTarget.value))}
          />
        </div>
      ) : null}
    </section>
  );
}
