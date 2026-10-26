import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BadgeUnv, ButtonUnv, Chip, InlineHint } from "@edu/ui/ds-unoovista";
import { Janela } from "../componentes/Janela";
import { MolduraFixa } from "../componentes/MolduraFixa";
import { Personagem } from "../componentes/Personagem";
import type { Contexto } from "../contexto";
import { useInatividade, useTamanho } from "../hooks/tela";
import { api } from "../lib/api";
import { proporcaoDaJanela } from "../lib/geometria";
import { telemetria } from "../lib/telemetria";
import { preencher, ROTULOS, textoDe } from "../lib/textos";
import type { Deslocamento, FotoId, SeloId } from "../lib/tipos";

const VAO = 12;
/** O dedo precisa andar isto para o toque virar arraste (abaixo, é um toque — a alternativa ao arraste). */
const LIMIAR_DO_ARRASTE = 8;
const CENTRO: Deslocamento = { x: 0.5, y: 0.5 };

/**
 * E3 — DECIDIR, a aposta comprometida em dois gestos.
 *
 * 1. ESCOLHA 1 FOTO: seleção mutuamente exclusiva — a escolhida ganha a
 *    moldura azul, a outra esmaece; o último toque vence (one-pager §7).
 * 2. A foto entra na MOLDURA DE TAMANHO FIXO (80% × 80% da foto): "Arraste a
 *    foto" só a desloca, sem zoom, sem alça, sem vazio (`MolduraFixa`).
 * 3. Os dois selos aparecem; a criança ARRASTA um até a foto — ou toca nele,
 *    a alternativa a quem não arrasta (teclado, motricidade). Um selo só.
 * 4. PUBLICAR CAPA acende com foto e selo. LATCH 1: o toque grava no servidor
 *    com o crachá, e não há volta (a rota responde 409 a outra escolha).
 *
 * O que a régua lê (o selo é coerente com a foto? o núcleo ficou na capa?) é
 * decidido na api — a tela não sabe qual selo "combina", e não deve saber.
 */
export function Decidir({ ctx, aoPublicar }: { ctx: Contexto; aoPublicar: () => void }) {
  const { sessao, executar, url } = ctx;
  const cena = sessao.cena!;
  const geo = sessao.geometria;
  const src = url(cena.imagem);
  const [ref, tamanho] = useTamanho<HTMLElement>();
  const [fotoId, setFotoId] = useState<FotoId | null>(null);
  const [seloId, setSeloId] = useState<SeloId | null>(null);
  const [deslocamento, setDeslocamento] = useState<Deslocamento>(CENTRO);
  const [enviando, setEnviando] = useState(false);
  const molduraRef = useRef<HTMLDivElement | null>(null);

  const fotos = [...cena.fotos].sort((a, b) => a.id.localeCompare(b.id));
  const foto = fotos.find((f) => f.id === fotoId) ?? null;
  const selo = cena.selos.find((s) => s.id === seloId) ?? null;
  const largura = Math.max(0, Math.min(tamanho.w, 420));
  const miniatura = (largura - VAO) / 2;
  const proporcao = fotos[0] ? proporcaoDaJanela(fotos[0].recorte, geo.proporcaoDaPanoramica) : 1;

  /* O selo arrastado acompanha o dedo; solto sobre a foto, fica nela. */
  const [arraste, setArraste] = useState<{ id: SeloId; ponteiro: number; x0: number; y0: number; dx: number; dy: number; andou: boolean } | null>(
    null,
  );
  const engoliuClique = useRef(false);
  function seloBaixou(id: SeloId, e: PointerEvent<HTMLButtonElement>) {
    if (arraste) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setArraste({ id, ponteiro: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, andou: false });
  }
  function seloMoveu(e: PointerEvent<HTMLButtonElement>) {
    if (!arraste || arraste.ponteiro !== e.pointerId) return;
    const dx = e.clientX - arraste.x0;
    const dy = e.clientY - arraste.y0;
    setArraste({ ...arraste, dx, dy, andou: arraste.andou || Math.hypot(dx, dy) > LIMIAR_DO_ARRASTE });
  }
  function seloSoltou(e: PointerEvent<HTMLButtonElement>) {
    if (!arraste || arraste.ponteiro !== e.pointerId) return;
    if (arraste.andou) {
      engoliuClique.current = true;
      const r = molduraRef.current?.getBoundingClientRect();
      if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) setSeloId(arraste.id);
    }
    setArraste(null);
  }

  async function publicar() {
    if (!fotoId || !seloId || enviando) return;
    setEnviando(true);
    aoPublicar();
    telemetria.publicou(fotoId);
    const r = await executar(() => api.publicar(fotoId, seloId, deslocamento), "publicar");
    /* Sem resposta agora por REDE: a jogada está na fila e o botão continua travado — é o latch.
       Outra falha (já reportada): o botão volta, para a criança tentar de novo. */
    if (r === null && !ctx.naFila("publicar")) setEnviando(false);
  }

  const inativo = useInatividade(sessao.tempos.inatividadeMs || 45_000, !enviando);
  useEffect(() => {
    if (inativo) telemetria.inatividade("decidir");
  }, [inativo]);

  return (
    <section ref={ref} className="decidir">
      <p className="assinatura">{preencher(textoDe(sessao.textos, "e3", "assinatura"), { cracha: ctx.cracha?.rotulo ?? "" })}</p>
      <h1 className="titulo-da-tela">{textoDe(sessao.textos, "e3", "titulo")}</h1>

      <div className="decidir__fotos" role="group" aria-label={textoDe(sessao.textos, "e3", "titulo")}>
        {fotos.map((f, i) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={fotoId === f.id}
            disabled={enviando}
            className={[
              "decidir__miniatura",
              fotoId === f.id ? "decidir__miniatura--escolhida" : "",
              fotoId && fotoId !== f.id ? "decidir__miniatura--esmaecida" : "",
            ].join(" ")}
            style={{ width: miniatura }}
            onClick={() => {
              if (fotoId !== f.id) setDeslocamento(CENTRO);
              setFotoId(f.id);
            }}
          >
            <Janela
              src={src}
              alt={`${preencher(textoDe(sessao.textos, "e2", i === 0 ? "rotuloDaFoto1" : "rotuloDaFoto2"), { espaco: cena.espaco, hora: cena.hora })}. ${f.acao}`}
              janela={f.recorte}
              style={{ width: miniatura, height: miniatura / proporcao }}
            />
          </button>
        ))}
      </div>

      {foto ? (
        <>
          <InlineHint>{textoDe(sessao.textos, "e3", "arraste")}</InlineHint>
          <div ref={molduraRef} className={`decidir__moldura${arraste?.andou ? " decidir__moldura--alvo" : ""}`}>
            <MolduraFixa
              src={src}
              alt={foto.acao}
              recorte={foto.recorte}
              moldura={geo.molduraDaCapa}
              proporcaoDaImagem={geo.proporcaoDaPanoramica}
              deslocamento={deslocamento}
              aoMudar={enviando ? () => {} : setDeslocamento}
              largura={largura}
              rotulo={ROTULOS.moldura}
            >
              <div className="moldura__selo" aria-live="polite">
                {selo ? (
                  <BadgeUnv variant="neutral" wrap className="carimbo">
                    <span aria-hidden="true">{selo.emoji}</span> {selo.texto}
                  </BadgeUnv>
                ) : arraste?.andou ? (
                  <span className="moldura__soltar">{ROTULOS.soltarSelo}</span>
                ) : null}
              </div>
            </MolduraFixa>
          </div>

          <div className="decidir__selos" role="group" aria-label={ROTULOS.selo}>
            {cena.selos.map((s) => {
              const meu = arraste?.id === s.id;
              return (
                <Chip
                  key={s.id}
                  selected={seloId === s.id}
                  aria-pressed={seloId === s.id}
                  disabled={enviando}
                  leadingIcon={<span aria-hidden="true">{s.emoji}</span>}
                  className={`selo${meu && arraste?.andou ? " selo--arrastando" : ""}`}
                  style={meu ? { transform: `translate(${arraste!.dx}px, ${arraste!.dy}px)` } : undefined}
                  onPointerDown={(e) => seloBaixou(s.id, e)}
                  onPointerMove={seloMoveu}
                  onPointerUp={seloSoltou}
                  onPointerCancel={() => setArraste(null)}
                  onClick={() => {
                    if (engoliuClique.current) {
                      engoliuClique.current = false;
                      return;
                    }
                    setSeloId(s.id);
                  }}
                >
                  {s.texto}
                </Chip>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="decidir__acoes">
        {inativo ? <Personagem quem="bento" fala={textoDe(sessao.textos, "e2", "inatividade")} animado anunciar /> : null}
        <ButtonUnv size="lg" block disabled={!fotoId || !seloId || enviando} onClick={() => void publicar()}>
          {textoDe(sessao.textos, "e3", "publicar")}
        </ButtonUnv>
      </div>
    </section>
  );
}
