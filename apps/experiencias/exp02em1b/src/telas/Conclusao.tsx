import { useCallback, useEffect, useState } from "react";
import { ButtonUnv, IconUnv, InlineHint, ListItem, TopBar } from "@edu/ui/ds-unoovista";
import { api, reportarErro } from "../lib/api";
import { TEXTOS } from "../lib/textos";
import { HABILIDADES_DA_DEVOLUTIVA, type RespostaDaDevolutiva } from "../lib/tipos";

/**
 * E6-ALU-02 — o fim, em somente leitura (seção `unoovista`, claro). O selo, a
 * devolutiva e o cartão do podcast.
 *
 * O podcast é do professor: tocado em aula depois do debate (ele conta a
 * virada) — daí a linha que diz isso, e nenhum player. A transcrição também é
 * só dele, na página da atividade (2.3.1): o estudante ouve, não lê.
 *
 * A DEVOLUTIVA (ADR-192): um parágrafo por habilidade, que o servidor gera
 * UMA vez a partir do que o estudante fez (a IA redige; sem ela, o modelo
 * curado). A tela só pede e desenha — o mesmo texto que o professor lê na aba
 * Habilidades. Sem nível nem nota: a régua é do professor.
 *
 * Sem diário de bordo e sem reflexão: a transferência saiu desta versão (ADR-191).
 */
export function Conclusao({ semRede }: { semRede: boolean }) {
  return (
    <main className="unv-tela unv-tela--conclusao" data-unv-theme="light">
      <TopBar variant="plain" title={TEXTOS.conclusao.app} />
      {semRede && (
        <InlineHint tone="friction" role="alert">
          {TEXTOS.feed.conexao}
        </InlineHint>
      )}
      <div className="unv-rolagem unv-explicar">
        <section className="unv-cartao unv-selo" role="status">
          <IconUnv name="check" size="lg" tone="link" />
          <h1 className="unv-cartao__titulo">{TEXTOS.conclusao.selo}</h1>
          <p className="unv-explicar__texto">{TEXTOS.conclusao.arquivada}</p>
        </section>
        <CartaoDaDevolutiva />
        <section className="unv-cartao" aria-label={TEXTOS.conclusao.podcast}>
          <ListItem
            className="unv-item-longo"
            leading={<IconUnv name="comment" />}
            title={TEXTOS.conclusao.podcast}
            subtitle={TEXTOS.conclusao.apresentacao}
          />
          <p className="unv-explicar__texto unv-explicar__texto--secundario">{TEXTOS.conclusao.emAula}</p>
        </section>
      </div>
    </main>
  );
}

type EstadoDaDevolutiva = { tipo: "carregando" } | { tipo: "pronta"; resposta: RespostaDaDevolutiva } | { tipo: "falhou" };

function CartaoDaDevolutiva() {
  const [estado, setEstado] = useState<EstadoDaDevolutiva>({ tipo: "carregando" });

  const carregar = useCallback(async () => {
    setEstado({ tipo: "carregando" });
    try {
      setEstado({ tipo: "pronta", resposta: await api.devolutiva() });
    } catch (erro) {
      reportarErro(erro);
      setEstado({ tipo: "falhou" });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <section className="unv-cartao" aria-labelledby="unv-devolutiva-titulo" data-devolutiva={estado.tipo}>
      <h2 id="unv-devolutiva-titulo" className="unv-cartao__titulo">
        {TEXTOS.conclusao.devolutiva}
      </h2>
      {estado.tipo === "carregando" && (
        <p className="unv-explicar__texto unv-explicar__texto--secundario" role="status">
          {TEXTOS.conclusao.devolutivaCarregando}
        </p>
      )}
      {estado.tipo === "falhou" && (
        <>
          <p className="unv-explicar__texto" role="alert">
            {TEXTOS.conclusao.devolutivaFalhou}
          </p>
          <ButtonUnv variant="secondary" onClick={() => void carregar()}>
            {TEXTOS.conclusao.devolutivaDeNovo}
          </ButtonUnv>
        </>
      )}
      {estado.tipo === "pronta" && (
        <>
          <p className="unv-explicar__texto unv-explicar__texto--secundario">{TEXTOS.conclusao.devolutivaApoio}</p>
          {HABILIDADES_DA_DEVOLUTIVA.map((h) => (
            <div key={h} data-habilidade={h}>
              <h3 className="unv-folha__bloco">{estado.resposta.titulos[h]}</h3>
              <p className="unv-explicar__texto">{estado.resposta.devolutiva.habilidades[h]}</p>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
