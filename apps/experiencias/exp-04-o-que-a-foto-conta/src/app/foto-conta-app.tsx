/**
 * A máquina da missão — quem decide a etapa é o SERVIDOR; esta camada segue.
 *
 * Boot: `GET /foto-conta/sessao` (reentrada determinística: F5 devolve o
 * estado gravado, inclusive o latch). Cada transição é um POST; o cliente só
 * anda quando a api confirma. No latch (`roda`), o polling de 3s pergunta se
 * o professor liberou (ADR-94) — nenhum WebSocket.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import type { ExperienciaHandle } from "@edu/sdk";
import { pararAudio, tocar, AUDIO } from "../lib/audio";
import {
  POLLING,
  type ComentariosDoPar,
  type Etapa,
  type Galeria,
  type Latch,
  type MarcaId,
  type PostDaGaleria,
  type Publicacao,
  type RespostaDaReflexao,
  type Sessao,
} from "../lib/tipos";
import { TelaConclusao, TelaDesafiar, TelaErro, TelaRefletir } from "./telas-casca";
import { FreezeOverlayFrame } from "./componentes/casca";
import { TelaAha, TelaDecidir, TelaFeed } from "./telas-clone";

/** Rascunho por aparelho (conveniência de F5 no meio do Aha; a VERDADE é a
 *  api). Toda leitura/escrita em try/catch: localStorage pode não existir. */
function chaveLocal(estudanteId: string): string {
  return `exp_04_state_${estudanteId}`;
}

function lerLocal(estudanteId: string): { comentarios?: ComentariosDoPar } {
  try {
    const cru = localStorage.getItem(chaveLocal(estudanteId));
    return cru ? (JSON.parse(cru) as { comentarios?: ComentariosDoPar }) : {};
  } catch {
    return {};
  }
}

function gravarLocal(estudanteId: string, dados: { comentarios?: ComentariosDoPar }): void {
  try {
    localStorage.setItem(chaveLocal(estudanteId), JSON.stringify(dados));
  } catch {
    /* sem storage: o F5 volta pela api do mesmo jeito. */
  }
}

export function FotoContaApp({ exp }: { exp: ExperienciaHandle }): JSX.Element {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [comentarios, setComentarios] = useState<ComentariosDoPar | null>(null);
  const [galeria, setGaleria] = useState<PostDaGaleria[]>([]);
  const [mostrandoMural, setMostrandoMural] = useState(false);
  const [feedbackRetry, setFeedbackRetry] = useState(false);
  const [erro, setErro] = useState<"conexao" | "sessao" | null>(null);
  const concluiuRef = useRef(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const s = await exp.api.get<Sessao>("/foto-conta/sessao");
      setSessao(s);
      // F5 no meio do Aha: os comentários do par vêm do rascunho local; se não
      // houver, republicar com o MESMO par devolve a mesma cena (idempotente).
      if (s.etapa === "aha" && s.fotoEscolhidaId && s.legendaEscolhidaId) {
        const local = lerLocal(exp.estudante.id);
        if (local.comentarios) {
          setComentarios(local.comentarios);
        } else {
          const r = await exp.api.post<Publicacao>("/foto-conta/publicar", {
            fotoId: s.fotoEscolhidaId,
            legendaId: s.legendaEscolhidaId,
          });
          setComentarios(r.comentarios);
        }
      }
    } catch (e) {
      exp.reportarErro(e);
      setErro("conexao");
    }
  }, [exp]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const etapa: Etapa | null = sessao?.etapa ?? null;

  // O polling do latch (3s) enquanto a run está na roda. `pause`/`resume` do
  // hub não param o relógio da aula: quem manda é o professor.
  useEffect(() => {
    if (!sessao || sessao.etapa !== "roda") return;
    const t = setInterval(() => {
      exp.api
        .get<Latch>("/foto-conta/latch")
        .then((l) => {
          if (l.liberado) {
            setSessao((s) => (s ? { ...s, latchLiberado: true, etapa: "refletir" } : s));
            pararAudio();
          }
        })
        .catch(() => {
          /* uma amostra perdida não é queda: o próximo tique pergunta de novo. */
        });
    }, POLLING.latchMs);
    return () => clearInterval(t);
  }, [sessao, exp]);

  // A galeria da conclusão atualiza devagar (vitrine, não canal).
  useEffect(() => {
    if (etapa !== "concluida") return;
    const buscar = () => {
      exp.api
        .get<Galeria>("/foto-conta/galeria")
        .then((g) => setGaleria(g.posts))
        .catch(() => undefined);
    };
    buscar();
    const t = setInterval(buscar, POLLING.galeriaMs);
    return () => clearInterval(t);
  }, [etapa, exp]);

  async function mutar<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e) {
      exp.reportarErro(e);
      setErro("conexao");
      return null;
    }
  }

  async function confirmarMarca(marca: MarcaId) {
    const r = await mutar(() => exp.api.post<{ etapa: Etapa }>("/foto-conta/marca", { marcaId: marca }));
    if (!r) return;
    exp.track("interacted", "badge:selector", { resultado: { selected: marca } });
    setSessao((s) => (s ? { ...s, etapa: r.etapa, marcaId: marca } : s));
  }

  async function sairDoFeed(dados: { curtidas: number; permanenciaMs: number }) {
    const r = await mutar(() => exp.api.post<{ etapa: Etapa }>("/foto-conta/feed", dados));
    if (!r) return;
    exp.track("interacted", "feed:exploracao", {
      resultado: { curtidas: dados.curtidas, permanenciaMs: dados.permanenciaMs },
    });
    setSessao((s) => (s ? { ...s, etapa: r.etapa } : s));
  }

  async function publicar(dados: { fotoId: string; legendaId: string; latenciaMs: number }) {
    const r = await mutar(() =>
      exp.api.post<Publicacao>("/foto-conta/publicar", {
        fotoId: dados.fotoId,
        legendaId: dados.legendaId,
        latenciaMs: dados.latenciaMs,
      }),
    );
    if (!r) return;
    exp.track("completed", "creator:publish_button", {
      resultado: { photo_id: dados.fotoId, caption_id: dados.legendaId },
    });
    gravarLocal(exp.estudante.id, { comentarios: r.comentarios });
    setComentarios(r.comentarios);
    setSessao((s) =>
      s
        ? { ...s, etapa: r.etapa, fotoEscolhidaId: dados.fotoId, legendaEscolhidaId: dados.legendaId }
        : s,
    );
  }

  async function concluirEco() {
    const r = await mutar(() => exp.api.post<{ etapa: Etapa }>("/foto-conta/roda"));
    if (!r) return;
    exp.track("progressed", "session:teacher_latch", { resultado: { status: "waiting_teacher" } });
    tocar(AUDIO.e5Roda);
    setSessao((s) => (s ? { ...s, etapa: r.etapa } : s));
  }

  async function refletir(escolha: "lupa" | "globo") {
    const r = await mutar(() =>
      exp.api.post<RespostaDaReflexao>("/foto-conta/reflexao", { escolha }),
    );
    if (!r) return;
    if (!r.conclui) {
      exp.track("attempted", "reflection:card_choice", {
        resultado: { choice: escolha.toUpperCase(), attempt: r.tentativas },
      });
      setFeedbackRetry(true);
      setSessao((s) => (s ? { ...s, etapa: r.etapa, tentativasReflexao: r.tentativas } : s));
      return;
    }
    exp.track("completed", "reflection:card_choice", {
      resultado: { choice: escolha.toUpperCase(), total_retries: r.tentativas },
    });
    setFeedbackRetry(false);
    setSessao((s) => (s ? { ...s, etapa: r.etapa } : s));
    if (!concluiuRef.current) {
      concluiuRef.current = true;
      exp.concluir({
        dados: {
          fotoEscolhidaId: sessao?.fotoEscolhidaId ?? null,
          legendaEscolhidaId: sessao?.legendaEscolhidaId ?? null,
          reflexao: escolha,
          tentativasReflexao: r.tentativas,
        },
      });
    }
  }

  if (erro) return <TelaErro tipo={erro} aoTentarDeNovo={() => void carregar()} />;
  if (!sessao) return <div className="fc-tela fc-tela-casca" aria-busy="true" />;

  switch (sessao.etapa) {
    case "desafiar":
      return <TelaDesafiar aoConfirmar={(m) => void confirmarMarca(m)} />;
    case "feed":
      return <TelaFeed pacote={sessao.pacote} aoCriar={(d) => void sairDoFeed(d)} />;
    case "decidir":
      return <TelaDecidir pacote={sessao.pacote} aoPublicar={(d) => void publicar(d)} />;
    case "aha": {
      const legenda = sessao.pacote.legendas.find((l) => l.id === sessao.legendaEscolhidaId);
      if (!comentarios || !sessao.fotoEscolhidaId || !legenda) {
        return <div className="fc-tela fc-tela-clone" aria-busy="true" />;
      }
      return (
        <TelaAha
          fotoId={sessao.fotoEscolhidaId}
          legendaTexto={legenda.texto}
          comentarios={comentarios}
          aoConcluirEco={() => void concluirEco()}
        />
      );
    }
    case "roda":
      return <FreezeOverlayFrame />;
    case "refletir":
      return (
        <TelaRefletir
          latchLiberado={sessao.latchLiberado}
          feedbackRetry={feedbackRetry}
          aoEscolher={(e) => void refletir(e)}
        />
      );
    case "concluida":
      return (
        <TelaConclusao
          galeria={galeria}
          mostrandoMural={mostrandoMural}
          aoVerMural={() => setMostrandoMural(true)}
        />
      );
    default:
      return <div className="fc-tela fc-tela-casca" aria-busy="true" />;
  }
}
