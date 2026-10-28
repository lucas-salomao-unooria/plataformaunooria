import { Component, useMemo, type ReactNode } from "react";
import { hora } from "@edu/sdk";
import { Button, Icon, MessageBubble, MessageTag, StatusBar } from "@edu/ui/ds-unoochat";
import { descricaoDoGrafico, eixoDaEscala, linhasDoPost, type TextosDasCamadas } from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { PontoDaSerie, Publicar } from "../lib/tipos";
import { GraficoDoBoletim } from "./GraficoDoBoletim";

/**
 * As peças do CLONE (`@edu/ui/ds-unoochat`) que mais de uma conversa usa: a
 * barra do aparelho, o chip da cota, o post do boletim e a guarda do gráfico.
 */

/** A hora do aparelho e das mensagens desta aba: a de agora, pelo helper da plataforma (ADR-98/99). */
export function useHoraDeAgora(): string {
  return useMemo(() => hora(new Date()), []);
}

export function BarraDoAparelho() {
  const agora = useHoraDeAgora();
  return <StatusBar time={agora} batteryLabel={TEXTOS.aparelho.bateria} batteryLevel={0.85} showAlert={false} />;
}

/**
 * A cota no `trailing` do `ChatHeader` (decisão 3): com ele, os botões de chamada somem.
 * O chip mostra a forma curta do protótipo ("Publicações: 3/3") — a longa
 * cortava o nome da conversa em 375px ("Assiste…") — e a longa (TC-03/TC-09)
 * fica no nome acessível.
 */
export function ChipDaCota({ restantes }: { restantes: number }) {
  return (
    <span aria-label={TEXTOS.cota(restantes)}>
      <MessageTag icon={<Icon name="document" size={14} tone="inherit" />}>
        <span aria-hidden="true">{TEXTOS.cotaCurta(restantes)}</span>
      </MessageTag>
    </span>
  );
}

/**
 * O post do boletim — o MESMO na prévia ao vivo do compositor e no grupo: a
 * autoria, o gráfico na escala escolhida (`alt` com os quatro valores) e as
 * camadas ligadas, na ordem do compositor (`regras.ts#linhasDoPost`).
 */
export function PostDoBoletim({
  publicacao,
  serie,
  indicador,
  camadas,
  errata = false,
  time,
  delivery,
}: {
  publicacao: Publicar;
  serie: readonly PontoDaSerie[];
  indicador: string;
  camadas: TextosDasCamadas;
  errata?: boolean;
  time?: string;
  delivery?: "none" | "sent" | "read";
}) {
  const barras = serie.map((p) => ({ rotulo: p.periodo, valor: p.valor }));
  const { origem, teto } = eixoDaEscala(publicacao.escala);
  const linhas = linhasDoPost(publicacao, camadas);
  return (
    <MessageBubble direction="out" time={time} delivery={delivery} maxWidth={300} data-post={errata ? "errata" : "inicial"} data-escala={publicacao.escala}>
      <div className="post__tags">
        <MessageTag>{TEXTOS.grupo.autoria}</MessageTag>
        {errata && <MessageTag>{TEXTOS.compositor.tagErrata}</MessageTag>}
      </div>
      <p className="post__titulo">{TEXTOS.grupo.boletim}</p>
      <p className="post__indicador">{indicador}</p>
      <MessageBubble.Media alt={descricaoDoGrafico(barras, origem, teto, "%")} ratio="auto">
        <GuardaDoGrafico>
          <GraficoDoBoletim barras={barras} origem={origem} teto={teto} />
        </GuardaDoGrafico>
      </MessageBubble.Media>
      {linhas.map((l) => (
        <p className="post__camada" key={l}>
          {l}
        </p>
      ))}
    </MessageBubble>
  );
}

/**
 * E2-SIS-01 — a falha de renderização do gráfico, na voz da ficção ("Boletim
 * visual indisponível…"), com "Recarregar" que remonta o desenho. Os números
 * continuam na tabela e no `alt`.
 */
export class GuardaDoGrafico extends Component<{ children: ReactNode; aoFalhar?: () => void }, { falhou: boolean; tentativa: number }> {
  state = { falhou: false, tentativa: 0 };

  static getDerivedStateFromError() {
    return { falhou: true };
  }

  componentDidCatch() {
    this.props.aoFalhar?.();
  }

  render() {
    if (!this.state.falhou) return <div key={this.state.tentativa}>{this.props.children}</div>;
    return (
      <div className="falha-do-grafico" role="alert">
        <Icon name="sbAlert" size="md" tone="inherit" />
        <p className="falha-do-grafico__texto">{TEXTOS.assistente.erroDoGrafico}</p>
        <Button variant="outline" onClick={() => this.setState((s) => ({ falhou: false, tentativa: s.tentativa + 1 }))}>
          {TEXTOS.assistente.recarregarGrafico}
        </Button>
      </div>
    );
  }
}
