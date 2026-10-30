import { useRef, useState, type PointerEvent } from "react";
import { ButtonUnv, DmPoll, InlineHint } from "@edu/ui/ds-unoovista";
import { MolduraFixa } from "../componentes/MolduraFixa";
import type { Contexto } from "../contexto";
import { useTamanho } from "../hooks/tela";
import { api } from "../lib/api";
import { telemetria } from "../lib/telemetria";
import { ROTULOS, textoDe } from "../lib/textos";
import type { Deslocamento, Elemento, Motivo } from "../lib/tipos";

/** O dedo precisa andar isto para o toque virar arraste. */
const LIMIAR_DO_ARRASTE = 8;
const VAO = 12;
const CENTRO: Deslocamento = { x: 0.5, y: 0.5 };
const IMAGEM_INTEIRA = { x: 0, y: 0, w: 100, h: 100 };

/**
 * E5 — EXPLICAR: pares, motivo e a segunda foto. Nada daqui bloqueia nem entra
 * na régua (ADR-184): vai ao painel do professor, que nomeia ENQUADRAMENTO,
 * AUTORIA e O QUE FICOU DE FORA com os cartões, oralmente.
 *
 * - PARES: "Junte duas fotos da mesma atividade." Quatro cartas SEM rótulo,
 *   de tamanho fixo. Toque seleciona (duas no máximo; a terceira troca a
 *   última); arrastar uma carta sobre outra forma o par. O arraste só
 *   reposiciona — a carta volta ao lugar e nunca muda de tamanho. O par fica
 *   agrupado no alto, do mesmo tamanho.
 * - MOTIVO: "O que é parecido?" — A atividade / A cor da roupa, só o texto
 *   (o emoji de apoio saiu a pedido do Lucas, 2026-10-29). O voto envia o par
 *   (`POST /pares`).
 * - SEGUNDA FOTO: "Foto de leitura: o que precisa aparecer?" — Mochila /
 *   Parede / Criança lendo, e a mesma moldura fixa da capa (55% × 85% da
 *   imagem). "Colocar no álbum" (`POST /segunda-foto`).
 *
 * As cartas vêm só com id e imagem: a atividade e a cor são o gabarito (o
 * leitor de tela ouve "Foto 1…4", como quem enxerga vê a foto sem legenda).
 *
 * (b) COMPENSAÇÃO local — pedido aberto no storybook-unooria: a carta de
 * tamanho fixo arrastável não existe na seção `unoovista`. A enquete do motivo
 * é o `DmPoll` e as opções da segunda foto são `ButtonUnv`, do pacote.
 */
export function Explicar({ ctx }: { ctx: Contexto }) {
  return ctx.estado.passo === "pares" ? <Pares ctx={ctx} /> : <SegundaFoto ctx={ctx} />;
}

function Pares({ ctx }: { ctx: Contexto }) {
  const { sessao, executar, url } = ctx;
  const cartas = sessao.material.cartas;
  const [ref, tamanho] = useTamanho<HTMLElement>();
  const [par, setPar] = useState<string[]>([]);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const lado = Math.max(0, Math.min(180, (Math.min(tamanho.w, 420) - VAO) / 2));
  const cartaRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [arraste, setArraste] = useState<{ id: string; ponteiro: number; x0: number; y0: number; dx: number; dy: number; andou: boolean } | null>(
    null,
  );
  const engoliuClique = useRef(false);

  function alternar(id: string) {
    if (enviando) return;
    setPar((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length < 2) return [...atual, id];
      return [atual[0]!, id];
    });
  }

  function baixou(id: string, e: PointerEvent<HTMLButtonElement>) {
    if (arraste || enviando) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setArraste({ id, ponteiro: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, andou: false });
  }
  function moveu(e: PointerEvent<HTMLButtonElement>) {
    if (!arraste || arraste.ponteiro !== e.pointerId) return;
    const dx = e.clientX - arraste.x0;
    const dy = e.clientY - arraste.y0;
    setArraste({ ...arraste, dx, dy, andou: arraste.andou || Math.hypot(dx, dy) > LIMIAR_DO_ARRASTE });
  }
  function soltou(e: PointerEvent<HTMLButtonElement>) {
    if (!arraste || arraste.ponteiro !== e.pointerId) return;
    if (arraste.andou) {
      engoliuClique.current = true;
      const alvo = cartas.find((c) => {
        if (c.id === arraste.id) return false;
        const r = cartaRefs.current[c.id]?.getBoundingClientRect();
        return r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (alvo) setPar([arraste.id, alvo.id]);
    }
    setArraste(null);
  }

  async function votar(escolha: string) {
    if (par.length !== 2 || enviando) return;
    setEnviando(true);
    setMotivo(escolha);
    telemetria.formouPar();
    const r = await executar(() => api.pares([par[0]!, par[1]!], escolha as Motivo), "pares");
    /* Falhou sem ir para a fila: a escolha volta a ficar aberta. */
    if (r === null && !ctx.naFila("pares")) {
      setEnviando(false);
      setMotivo(null);
    }
  }

  /* O par no alto, agrupado; as outras embaixo. Todas do mesmo tamanho, sempre. */
  const ordem = [...par, ...cartas.map((c) => c.id).filter((id) => !par.includes(id))];
  const carta = (id: string) => {
    const c = cartas.find((x) => x.id === id)!;
    const n = cartas.findIndex((x) => x.id === id) + 1;
    const meu = arraste?.id === id && arraste.andou;
    return (
      <button
        key={id}
        ref={(el) => {
          cartaRefs.current[id] = el;
        }}
        type="button"
        className={`carta${par.includes(id) ? " carta--no-par" : ""}${meu ? " carta--arrastando" : ""}`}
        aria-pressed={par.includes(id)}
        aria-label={ROTULOS.carta(n)}
        disabled={enviando}
        style={{ width: lado, height: lado, transform: meu ? `translate(${arraste!.dx}px, ${arraste!.dy}px)` : undefined }}
        onPointerDown={(e) => baixou(id, e)}
        onPointerMove={moveu}
        onPointerUp={soltou}
        onPointerCancel={() => setArraste(null)}
        onClick={() => {
          if (engoliuClique.current) {
            engoliuClique.current = false;
            return;
          }
          alternar(id);
        }}
      >
        <img src={url(c.imagem)} alt="" draggable={false} className="carta__imagem" />
      </button>
    );
  };

  return (
    <section ref={ref} className="explicar">
      <h1 className="instrucao" aria-live="polite">
        {par.length === 2 ? (
          <>
            {textoDe(sessao.textos, "e5", "parFormado")} <span aria-hidden="true">✅</span>
          </>
        ) : (
          textoDe(sessao.textos, "e5", "pares")
        )}
      </h1>
      <div className="cartas">
        <div className={`cartas__par${par.length === 2 ? " cartas__par--completo" : ""}`}>{ordem.slice(0, 2).map(carta)}</div>
        <div className="cartas__resto">{ordem.slice(2).map(carta)}</div>
      </div>

      {par.length === 2 ? (
        <DmPoll
          className="opcoes-grandes"
          question={textoDe(sessao.textos, "e5", "motivo")}
          options={sessao.material.motivos.map((m) => ({
            id: m.id,
            label: m.rotulo,
          }))}
          value={motivo}
          onVote={(id) => void votar(id)}
        />
      ) : null}
    </section>
  );
}

function SegundaFoto({ ctx }: { ctx: Contexto }) {
  const { sessao, executar, url } = ctx;
  const geo = sessao.geometria;
  const material = sessao.material.segundaFoto;
  const [ref, tamanho] = useTamanho<HTMLElement>();
  const [elemento, setElemento] = useState<Elemento | null>(null);
  const [deslocamento, setDeslocamento] = useState<Deslocamento>(CENTRO);
  const [enviando, setEnviando] = useState(false);
  const largura = Math.max(0, Math.min(tamanho.w, 420));

  async function colocar() {
    if (!elemento || enviando) return;
    setEnviando(true);
    telemetria.colocouNoAlbum();
    const r = await executar(() => api.segundaFoto(elemento, deslocamento), "segunda-foto");
    if (r === null && !ctx.naFila("segunda-foto")) setEnviando(false);
  }

  return (
    <section ref={ref} className="explicar">
      <h1 className="instrucao">{textoDe(sessao.textos, "e5", "segunda")}</h1>
      <div className="elementos" role="group" aria-label={textoDe(sessao.textos, "e5", "segunda")}>
        {material.elementos.map((el) => (
          <ButtonUnv
            key={el.id}
            variant={elemento === el.id ? "primary" : "secondary"}
            size="lg"
            aria-pressed={elemento === el.id}
            disabled={enviando}
            className="elementos__opcao"
            leadingIcon={<span aria-hidden="true">{ROTULOS.emojiElemento[el.id] ?? ""}</span>}
            onClick={() => setElemento(el.id)}
          >
            {el.rotulo}
          </ButtonUnv>
        ))}
      </div>

      <InlineHint>{textoDe(sessao.textos, "e5", "arraste")}</InlineHint>
      <div className="explicar__moldura">
        <MolduraFixa
          src={url(material.imagem)}
          alt={ROTULOS.fotoDeLeitura}
          recorte={IMAGEM_INTEIRA}
          moldura={geo.segundaFoto.moldura}
          proporcaoDaImagem={geo.segundaFoto.proporcao}
          deslocamento={deslocamento}
          aoMudar={enviando ? () => {} : setDeslocamento}
          largura={Math.min(largura, 300)}
          rotulo={ROTULOS.molduraSegunda}
        />
      </div>

      <div className="explicar__acoes">
        <ButtonUnv size="lg" block disabled={!elemento || enviando} onClick={() => void colocar()}>
          {textoDe(sessao.textos, "e5", "album")}
        </ButtonUnv>
      </div>
    </section>
  );
}
