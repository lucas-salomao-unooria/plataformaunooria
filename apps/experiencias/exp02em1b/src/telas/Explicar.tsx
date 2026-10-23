import { ButtonUnv, Chip, InlineHint, TopBar } from "@edu/ui/ds-unoovista";
import type { Executar } from "../App";
import { api, concluirNaPlataforma } from "../lib/api";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { Estado, Sessao } from "../lib/tipos";
import { GraficoDeEntrega } from "./GraficoDeEntrega";

/**
 * A ETAPA 5 — os bastidores da entrega (seção `unoovista`), depois do debate.
 *
 * Quatro indicadores; dois comprovam que a rede buscou retenção, e o GABARITO
 * é do servidor: a tela manda o clique e recebe se ele ficou confirmado (ou a
 * dica, quando não comprova). Com os dois, a citação de Nico e os conceitos
 * (economia da atenção, metadados, bolhas de filtro) e o "Concluir missão" —
 * que substitui o "Ir para Reflexão": a transferência saiu (PO, 2026-10-22).
 */
export function Explicar({ estado, textos, executar }: { estado: Estado; textos: Sessao["textos"]["explicar"]; executar: Executar }) {
  const exp = estado.explicar;
  async function concluir() {
    const novo = await executar(api.concluir);
    if (novo?.concluido) {
      telemetria.concluiu();
      concluirNaPlataforma();
    }
  }

  return (
    <main className="unv-tela" data-unv-theme="light">
      <TopBar variant="plain" title={textos.titulo} />
      <div className="unv-rolagem unv-explicar">
        <p className="unv-explicar__instrucao">{textos.instrucao}</p>
        <div className="unv-explicar__indicadores" role="group" aria-label={textos.titulo}>
          {exp?.indicadores.map((i) => (
            <Chip
              key={i.id}
              selected={i.confirmado}
              aria-pressed={i.confirmado}
              onClick={() => {
                if (i.confirmado) return;
                telemetria.indicador(i.id);
                void executar(() => api.indicador(i.id));
              }}
            >
              {i.rotulo}
            </Chip>
          ))}
        </div>
        {exp?.ultimoNaoComprova && !exp.completo && (
          <InlineHint tone="friction" announce>
            {textos.naoComprova}
          </InlineHint>
        )}
        {estado.feed && <GraficoDeEntrega entrega={estado.feed.entrega} titulo={TEXTOS.explicar.grafico} />}
        {exp?.completo && (
          <section className="unv-explicar__conceitos" aria-live="polite">
            <blockquote className="unv-explicar__citacao">{textos.citacao}</blockquote>
            {textos.conceitos.map((c) => (
              <p key={c.id} className="unv-explicar__conceito">
                {c.texto}
              </p>
            ))}
            <ButtonUnv block onClick={() => void concluir()}>
              {TEXTOS.explicar.concluir}
            </ButtonUnv>
          </section>
        )}
        {!exp?.completo && <p className="unv-explicar__espera">{textos.esperaAtiva}</p>}
      </div>
    </main>
  );
}
