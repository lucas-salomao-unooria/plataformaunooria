import { NewspaperPage, ScrollBar } from "@edu/ui/ds";
import { E4, EREV, REDACAO } from "../../lib/textos";
import type { IdDeNoticia, NoticiaPublica, Resultado } from "../../lib/tipos";
import { Cabecalho } from "./cabecalho";
import { MuralDosLeitores } from "./leitores";
import { vagasDaPagina } from "./pagina";

/**
 * E4-ALU-01 — o resultado da 1ª edição, DEPOIS do primeiro portão do professor
 * ("Liberar resultado"): a edição que circulou, o mural dos leitores (o que
 * cada notícia CAUSOU) e o indicador factual — "X de 3 notícias verificadas
 * nesta edição (Y%)".
 *
 * **Sem carimbo nem nota.** O percentual descreve a SELEÇÃO, não a criança
 * (PDF §6), e vem da api (`GET resultado`), que o calcula com o gabarito
 * validado antes da aula. O indicador fica DEPOIS dos balões e com menos peso:
 * quem salta primeiro é a consequência sentida pelos leitores, não o número.
 * Nenhuma marca de qual notícia trocar — isso é da revisão, depois da Chave.
 *
 * E a tela continua esperando: a revisão abre no segundo portão ("Liberar
 * revisão"), depois da conversa da sala. O polling da casca segue de pé.
 */
export function TelaDeResultado({
  resultado,
  porId,
}: {
  resultado: Resultado | null;
  porId: ReadonlyMap<IdDeNoticia, NoticiaPublica>;
}) {
  return (
    <div className="tela">
      <Cabecalho titulo={E4.muralTitulo} />
      <ScrollBar className="rolagem" autoHide>
        {resultado ? (
          <div className="tela__corpo">
            <NewspaperPage
              nameplate={REDACAO.nome}
              edition={EREV.edicao(1)}
              slots={vagasDaPagina(resultado.edicao1.slots, porId)}
              layout={resultado.edicao1.layout}
              size="thumbnail"
              readOnly
              headingLevel={3}
            />
            <MuralDosLeitores reacoes={resultado.edicao1.reacoes} />
            <p className="tela__indicador">{E4.indicador(resultado.edicao1.verificadas, resultado.edicao1.percentual)}</p>
            <p className="tela__mensagem" role="status">
              {E4.esperaRevisao}
            </p>
          </div>
        ) : (
          <div className="tela__corpo" aria-busy="true" />
        )}
      </ScrollBar>
    </div>
  );
}
