"use client";

import { Suspense, lazy, useCallback, useState } from "react";
import { signOut } from "next-auth/react";
import { DispositivoFrame } from "./DispositivoFrame";
import { ExpFrame } from "./ExpFrame";

/** Lazy pelo mesmo motivo do origem: a copy da moldura fala do MECANISMO e não
 *  pode viajar no chunk da casca, legível no DevTools antes da hora. */
const MolduraPerdidos = lazy(() =>
  import("./moldura-perdidos").then((m) => ({ default: m.MolduraPerdidos })),
);

/**
 * Composição client da experiência: DispositivoFrame (quando o manifesto
 * declara viewport) + ExpFrame, com a persistência do exp:concluir.
 *
 * Ocupa o espaço que o pai der (`flex: 1`) — quem desenha o header padrão do
 * hub acima é a página (`/exp/:expId`, `/dev-embed`). O caminho de volta também
 * é do header agora; aqui não há mais chrome solto sobre o aparelho.
 *
 * A conclusão registrada aqui é PROGRESSO (a experiência terminou), não nota:
 * pontuação que vale nota é recalculada server-side quando o módulo de
 * avaliação da experiência existir (regra inviolável nº 3).
 */
export function ExpHost(props: {
  expId: string;
  src: string;
  expOrigin: string;
  token: string;
  aluno: { id: string; nome: string; serie: string; turmaId: string; escolaId: string };
  apiUrl: string;
  config?: Record<string, unknown>;
  /**
   * Presente ⇒ a experiência foi desenhada para um APARELHO: roda num iframe de
   * exatamente `largura`×`altura` px, centralizado. Ausente ⇒ foi desenhada
   * para desktop (exp-02) e ocupa a área inteira.
   */
  viewport?: { largura: number; altura: number } | null;
}) {
  const { expId, viewport, ...frame } = props;

  /**
   * "Chrome" opcional por estado da experiência (`exp:estado`): o hub não
   * interpreta domínio — só reage ao que a experiência publicar. Hoje o único
   * chrome é a moldura dos posts perdidos do Instanooria.
   */
  const [estado, setEstadoBruto] = useState<Record<string, unknown>>({});
  const setEstado = useCallback((novo: Record<string, unknown>) => {
    // "Sair da conta" do menu do aparelho: a sessão é do HUB (cookie httpOnly,
    // fora do alcance do iframe), então a experiência pede e o hub executa.
    if (novo.acao === "sair") {
      void signOut({ callbackUrl: "/login" });
      return;
    }
    setEstadoBruto(novo);
  }, []);
  const mostrarMolduraPerdidos = estado.fase === "perdidos";

  const onConcluir = useCallback(
    (payload: { score?: number; dados?: Record<string, unknown> }) => {
      void fetch(`/api/plataforma/progresso/${encodeURIComponent(expId)}/concluir`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => console.error("[hub] falha ao registrar conclusão"));
    },
    [expId],
  );

  const conteudo = (
    <ExpFrame
      {...frame}
      config={{ ...frame.config, expId }}
      onConcluir={onConcluir}
      onEstado={setEstado}
    />
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {mostrarMolduraPerdidos ? (
        <Suspense fallback={null}>
          <MolduraPerdidos />
        </Suspense>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {viewport ? (
          <DispositivoFrame largura={viewport.largura} altura={viewport.altura}>
            {conteudo}
          </DispositivoFrame>
        ) : (
          conteudo
        )}
      </div>
    </div>
  );
}
