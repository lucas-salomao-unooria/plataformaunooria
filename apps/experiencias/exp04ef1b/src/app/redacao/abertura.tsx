import { Button, NewspaperPage, ScrollBar, SpeechBubble } from "@edu/ui/ds";
import { E1, E2, REDACAO } from "../../lib/textos";
import { Cabecalho } from "./cabecalho";

/**
 * E1-ALU-01 — o Bento e a restrição: oito notícias, três vagas. A página em
 * branco mostra as três vagas tracejadas antes de a mesa abrir, e é a única
 * outra tela, além da Chave, em que o Bento fala.
 *
 * O Bento não tem áudio nesta versão (decisão de 2026-09-25): sem gravação, o
 * botão de ouvir do `SpeechBubble` (`action`) não é desenhado — um alvo que não
 * faz nada ensina a criança a desconfiar da tela.
 */
export function Abertura({ indo, aoExplorar }: { indo: boolean; aoExplorar: () => void }) {
  return (
    <div className="tela">
      <Cabecalho titulo={REDACAO.nome} selo={REDACAO.emEdicao} />
      <ScrollBar className="rolagem" autoHide>
        <div className="tela__corpo">
          <SpeechBubble speaker={REDACAO.bento} tone="guide">
            {E1.bentoAbertura}
          </SpeechBubble>
          <NewspaperPage nameplate={REDACAO.nome} slots={[null, null, null]} emptyLabels={E2.vagasVazias} headingLevel={3} />
        </div>
      </ScrollBar>
      <div className="tela__acao">
        <Button size="lg" fullWidth className="acao-crianca" isLoading={indo} onClick={aoExplorar}>
          {E1.explorarMesa}
        </Button>
      </div>
    </div>
  );
}
