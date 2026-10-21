import { useState } from "react";
import { data } from "@edu/sdk";
import { NewspaperPage, ScrollBar, Tabs } from "@edu/ui/ds";
import { E6, EREV, REDACAO } from "../../lib/textos";
import type { EdicaoDoEstudante, IdDeNoticia, NoticiaPublica } from "../../lib/tipos";
import { Cabecalho } from "./cabecalho";
import { vagasDaPagina } from "./pagina";

/**
 * E6-ALU-04 — o modo leitura, depois de "Concluir Missão": a redação congelada,
 * as duas edições publicadas e nada mais para tocar além do alternador. Volta a
 * ser a redação (quem fala é o jornal, não a escola), e é o que a criança vê se
 * abrir a missão de novo — `fim` é o passo final, e o F5 cai aqui.
 *
 * A data da linha do cabeçalho é a da publicação, pelo formatador do SDK
 * (ADR-98/99: nunca data formatada à mão, nunca fuso cravado).
 */
export function ModoLeitura({
  edicao1,
  edicao2,
  porId,
}: {
  edicao1: EdicaoDoEstudante | null;
  edicao2: EdicaoDoEstudante | null;
  porId: ReadonlyMap<IdDeNoticia, NoticiaPublica>;
}) {
  const [qual, setQual] = useState<"ed1" | "ed2">(edicao2 ? "ed2" : "ed1");
  const edicao = qual === "ed2" ? edicao2 : edicao1;
  return (
    <div className="tela">
      <Cabecalho titulo={E6.modoLeitura} />
      <Tabs value={qual} onChange={(v) => setQual(v === "ed1" ? "ed1" : "ed2")} size="lg" fullWidth>
        <Tabs.List fullWidth>
          <Tabs.Tab value="ed1" label={E6.verEd1} disabled={!edicao1} />
          <Tabs.Tab value="ed2" label={E6.verEd2} disabled={!edicao2} />
        </Tabs.List>
      </Tabs>
      <ScrollBar className="rolagem" autoHide>
        <div className="tela__corpo" role="tabpanel" id={`tabpanel-${qual}`} aria-labelledby={`tab-${qual}`}>
          {edicao && (
            <NewspaperPage
              nameplate={REDACAO.nome}
              edition={EREV.edicao(qual === "ed2" ? 2 : 1)}
              dateLine={data(edicao.publicadaEm)}
              slots={vagasDaPagina(edicao.slots, porId)}
              layout={edicao.layout}
              readOnly
              headingLevel={3}
            />
          )}
        </div>
      </ScrollBar>
    </div>
  );
}
