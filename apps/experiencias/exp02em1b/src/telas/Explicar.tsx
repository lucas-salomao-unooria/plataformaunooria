import { useState } from "react";
import { BadgeUnv, ButtonUnv, IconUnv, InlineHint, ListItem, TopBar } from "@edu/ui/ds-unoovista";
import type { Executar } from "../App";
import { api, concluirNaPlataforma } from "../lib/api";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { Estado, Sessao } from "../lib/tipos";
import { GraficoDeEntrega } from "./GraficoDeEntrega";

/**
 * A ETAPA 5 — os bastidores da distribuição (seção `unoovista`, claro), depois
 * do debate. E5-ALU-01: os dois cartões da api (os dois revelam o critério da
 * rede, sem distrator), a citação de Nico assim que um é apontado, e os
 * conceitos. O "Avançar" nunca trava (PRD RF-007): o clique não é habilidade.
 * E5-ALU-02: a espera ativa com o gráfico exploratório e o "Concluir missão".
 *
 * O `POST /explicar` que abre esta etapa é do App: é ele que FECHA o feed.
 */
export function Explicar({
  estado,
  textos,
  semRede,
  executar,
}: {
  estado: Estado;
  textos: Sessao["textos"]["explicar"];
  semRede: boolean;
  executar: Executar;
}) {
  const [espera, setEspera] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const exp = estado.explicar;
  const algumApontado = Boolean(exp?.indicadores.some((i) => i.apontado));

  async function concluir() {
    if (concluindo) return;
    setConcluindo(true);
    const novo = await executar(api.concluir);
    setConcluindo(false);
    if (novo?.concluido) {
      telemetria.concluiu();
      concluirNaPlataforma();
    }
  }

  const faixaDeRede = semRede && (
    <InlineHint tone="friction" role="alert">
      {TEXTOS.feed.conexao}
    </InlineHint>
  );

  if (espera) {
    return (
      <main className="unv-tela" data-unv-theme="light">
        <TopBar variant="plain" title={textos.titulo} />
        {faixaDeRede}
        <div className="unv-rolagem unv-explicar">
          <section className="unv-cartao" aria-labelledby="espera-titulo">
            <h2 id="espera-titulo" className="unv-cartao__titulo">
              {TEXTOS.explicar.esperaTitulo}
            </h2>
            <p className="unv-explicar__texto">{textos.esperaAtiva}</p>
            {exp && <GraficoDeEntrega entrega={exp.entrega} titulo={TEXTOS.explicar.grafico} />}
          </section>
          <ButtonUnv size="lg" block disabled={concluindo} onClick={() => void concluir()}>
            {TEXTOS.explicar.concluir}
          </ButtonUnv>
        </div>
      </main>
    );
  }

  return (
    <main className="unv-tela" data-unv-theme="light">
      <TopBar variant="plain" title={textos.titulo} />
      {faixaDeRede}
      <div className="unv-rolagem unv-explicar">
        <p id="explicar-instrucao" className="unv-explicar__instrucao">
          {textos.instrucao}
        </p>
        <div className="unv-explicar__indicadores" role="group" aria-labelledby="explicar-instrucao">
          {exp?.indicadores.map((i) => (
            <ListItem
              key={i.id}
              className="unv-item-longo unv-indicador"
              aria-pressed={i.apontado}
              leading={<IconUnv name={i.id === "retencao" ? "activity" : "info"} />}
              title={<BadgeUnv variant="neutral">{i.rotulo}</BadgeUnv>}
              subtitle={i.texto}
              trailing={i.apontado ? <IconUnv name="check" tone="link" /> : undefined}
              onClick={() => {
                if (i.apontado) return;
                telemetria.evidencia(i.id);
                void executar(() => api.evidencia(i.id));
              }}
            />
          ))}
        </div>
        {algumApontado && (
          <figure className="unv-explicar__citacao" aria-live="polite">
            <blockquote>“{textos.citacao}”</blockquote>
            <figcaption>{TEXTOS.explicar.autoria}</figcaption>
          </figure>
        )}
        <section className="unv-explicar__conceitos">
          {textos.conceitos.map((c) => (
            <p key={c.id} className="unv-explicar__conceito">
              <strong>{c.titulo}:</strong> {c.texto}
            </p>
          ))}
        </section>
        <ButtonUnv size="lg" block onClick={() => setEspera(true)}>
          {TEXTOS.explicar.avancar}
        </ButtonUnv>
      </div>
    </main>
  );
}
