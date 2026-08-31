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
  estudante?: { id: string; nome: string; serie: string; turmaId: string; escolaId: string };
  apiUrl: string;
  config?: Record<string, unknown>;
  /**
   * Presente ⇒ a experiência foi desenhada para um APARELHO: roda num iframe de
   * exatamente `largura`×`altura` px, centralizado. Ausente ⇒ foi desenhada
   * para desktop (exp-02) e ocupa a área inteira.
   */
  viewport?: { largura: number; altura: number } | null;
  /** Do manifesto da experiência; segue no spread para o `ExpFrame`. */
  permissoes?: readonly string[];
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

  /**
   * O relatório do estudante sai do aparelho (ADR-41). É a única tela que expande, e
   * a condição é POSITIVA de propósito: qualquer outro estado — inclusive uma
   * mensagem que se perdeu — cai no aparelho de 375px, que é o comportamento de
   * sempre. O contrário (expandir por default e contrair em casos conhecidos)
   * deixaria o FEED numa área larga, e o `IntersectionObserver` do dwell mede
   * contra o iframe: o sinal central do motor inflaria em silêncio.
   *
   * A volta é o mesmo caminho da moldura: o professor avança, o polling da
   * experiência vê a fase nova e publica `{ fase: "perdidos" }` — sem `passo`,
   * porque o estado é substituído inteiro — e o aparelho volta ao lugar.
   */
  const expandido = estado.fase === "explicabilidade" && estado.passo === "relatorio";

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
          <DispositivoFrame
            largura={viewport.largura}
            altura={viewport.altura}
            expandido={expandido}
          >
            {conteudo}
          </DispositivoFrame>
        ) : (
          conteudo
        )}
      </div>
    </div>
  );
}
