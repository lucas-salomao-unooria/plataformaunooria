import type { ReactNode } from "react";
import { DmPoll, type UnvDmPollOption } from "@edu/ui/ds-unoovista";

/**
 * A FIGURINHA DE ENQUETE sobre a mídia da história — (b) COMPENSAÇÃO TEMPORÁRIA.
 *
 * O componente certo é o `StoryPoll` do Unoovista: a enquete de HISTÓRIA, que
 * vai na camada `children` do `StoryViewer` e se centraliza sozinha no palco
 * (`.unv-story-viewer__overlay > .unv-story-poll`). Ele foi pedido por esta
 * missão e está em PR no `storybook-unooria`; chega na **0.2.12**. Até lá,
 * aqui vai a `DmPoll` — a enquete de CONVERSA, com o MESMO contrato (voto
 * único, `value` controlado para reabrir travada num F5, sem contagem, sem
 * porcentagem e sem gabarito: devolve só o `id`).
 *
 * O que esta casca faz, e é só medida e posição: centraliza a `DmPoll` no palco
 * da história e limita a largura (`.figurinha-de-enquete` no CSS). Nenhuma cor,
 * nenhum controle.
 *
 * **Quando a 0.2.12 sair**: subir o DS (`^0.2.12`, nos três lugares da versão),
 * exportar `StoryPoll` em `packages/ui/src/ds-unoovista.ts`, trocar a `DmPoll`
 * daqui pelo `StoryPoll` com as mesmas props, e apagar este arquivo e a regra
 * `.figurinha-de-enquete` — o `StoryPoll` se centraliza sozinho. A compensação
 * está registrada no `AGENTS.md` desta pasta.
 */
export function FigurinhaDeEnquete({
  pergunta,
  opcoes,
  valor,
  desabilitada,
  confirmacao,
  aoVotar,
}: {
  pergunta: ReactNode;
  opcoes: UnvDmPollOption[];
  valor: string | null;
  desabilitada: boolean;
  confirmacao: string;
  aoVotar: (alternativaId: string) => void;
}) {
  return (
    <div className="figurinha-de-enquete">
      <DmPoll
        question={pergunta}
        options={opcoes}
        value={valor}
        disabled={desabilitada}
        sentLabel={confirmacao}
        onVote={aoVotar}
      />
    </div>
  );
}
