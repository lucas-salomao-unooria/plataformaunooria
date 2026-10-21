import { Button, NewspaperPage, ScrollBar, SpeechBubble } from "@edu/ui/ds";
import { EREV, REDACAO } from "../../lib/textos";
import type { Comparativo, IdDeNoticia, NoticiaPublica } from "../../lib/tipos";
import { Cabecalho } from "./cabecalho";
import { MuralDosLeitores } from "./leitores";
import { mapaDeMarcadores, vagasDaPagina } from "./pagina";

/**
 * EREV-ALU-02 — o antes e o depois (PDF §9): as duas edições lado a lado, em
 * miniatura, cada vaga com o pilar que faltava ("a devolutiva final explica
 * quais evidências sustentaram o resultado"), a linha de contraste com os
 * números da api e o que os leitores disseram da 2ª edição.
 *
 * O balão da comunidade grata (`erev.reacao.comunidade_grata`) só aparece com a
 * 2ª edição inteira verificada: ele diz "têm data certa, fonte clara", e com uma
 * vaga ainda furada seria a tela afirmando o que não aconteceu. Quem acertou
 * tudo de primeira vê as duas edições iguais — e não é obrigado a trocar nada
 * (PDF §9).
 *
 * O botão de avançar é o "Testar a minha Chave" (3.0.0): `POST passo` para a
 * `simulacao`, onde a Chave da criança roda em duas matérias novas.
 */
export function TelaDoComparativo({
  comparativo,
  porId,
  indo,
  aoAvancar,
}: {
  comparativo: Comparativo | null;
  porId: ReadonlyMap<IdDeNoticia, NoticiaPublica>;
  indo: boolean;
  aoAvancar: () => void;
}) {
  const marcadores = comparativo ? mapaDeMarcadores(comparativo.vagas) : undefined;
  return (
    <div className="tela">
      <Cabecalho titulo={EREV.tituloComparativo} />
      <ScrollBar className="rolagem" autoHide>
        {comparativo ? (
          <div className="tela__corpo">
            <p className="tela__destaque" role="status">
              {EREV.contraste(comparativo.edicao1.verificadas, comparativo.edicao2.verificadas)}
            </p>
            <div className="comparativo__paginas">
              <NewspaperPage
                nameplate={REDACAO.nome}
                edition={EREV.edicao(1)}
                slots={vagasDaPagina(comparativo.edicao1.slots, porId, marcadores)}
                layout={comparativo.edicao1.layout}
                size="thumbnail"
                readOnly
                headingLevel={3}
              />
              <NewspaperPage
                nameplate={REDACAO.nome}
                edition={EREV.edicao(2)}
                slots={vagasDaPagina(comparativo.edicao2.slots, porId, marcadores)}
                layout={comparativo.edicao2.layout}
                size="thumbnail"
                readOnly
                headingLevel={3}
              />
            </div>
            <MuralDosLeitores reacoes={comparativo.edicao2.reacoes} />
            {comparativo.edicao2.verificadas === 3 && (
              <SpeechBubble speaker={EREV.comunidade} tone="reader" mood="happy">
                {EREV.comunidadeGrata}
              </SpeechBubble>
            )}
          </div>
        ) : (
          <div className="tela__corpo" aria-busy="true" />
        )}
      </ScrollBar>
      <div className="tela__acao">
        <Button size="lg" fullWidth className="acao-crianca" disabled={!comparativo} isLoading={indo} onClick={aoAvancar}>
          {EREV.irParaSimulacao}
        </Button>
      </div>
    </div>
  );
}
