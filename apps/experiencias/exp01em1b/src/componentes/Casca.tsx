import type { ReactNode } from "react";
import { ScrollBar, SpeechBubble, Tag } from "@edu/ui/ds";
import { TEXTOS } from "../lib/textos";

/**
 * A CASCA da escola — o módulo de homologação da comissão (seção `unooria`).
 * Quem fala é a escola: a Zara, as fichas, a bancada, o reteste e o
 * certificado. O UnooriaAI (o assistente testado) entra só como PEÇA
 * (`PreviaDoAssistente`, `EfeitoNoChat`) ou como a tela inteira da simulação.
 *
 * O cabeçalho do Figma é texto + `Tag`; com equipe (E13, um computador por
 * estação) ele vira "Unooria · Bancada" + "Bancada da Comissão: {estação}",
 * em QUALQUER tela — a mesma tela do individual, sem cortar conteúdo.
 *
 * NÃO há barra de etapas (1.0.5): o PO (Vinicius) pediu para tirá-la ao
 * validar a 1.0.4 em dev, e o pedido dele vale mais que o Figma. Não a
 * recoloque — o teste `telas.test.tsx` cobra que nenhuma tela a desenha.
 *
 * A rolagem é o `ScrollBar` do DS: aqui a seção É a `unooria`.
 */
export interface CascaProps {
  /** O cabeçalho do módulo; ausente nas telas que não o têm no Figma. */
  cabecalho?: { titulo: string; tag?: string };
  /** Uma faixa ACIMA do cabeçalho (a de contingência da E3-SIS-01). */
  faixa?: ReactNode;
  equipe: { nome: string } | null;
  children: ReactNode;
}

export function Casca({ cabecalho, faixa, equipe, children }: CascaProps) {
  const topo = equipe ? { titulo: TEXTOS.geral.bancada, tag: TEXTOS.geral.tagDaEquipe(equipe.nome) } : cabecalho;
  return (
    <ScrollBar className="escola" height="100%" autoHide theme="light">
      <div className="escola__pilha">
        {faixa}
        {topo && (
          <header className="escola__topo">
            <span className="escola__marca">{topo.titulo}</span>
            {topo.tag && (
              <Tag variant="outline" size="sm">
                {topo.tag}
              </Tag>
            )}
          </header>
        )}
        {children}
      </div>
    </ScrollBar>
  );
}

/** A Zara, colega da comissão: o `SpeechBubble` de guia do DS (sem ilustração própria no repo). */
export function Zara({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <SpeechBubble speaker={rotulo} tone="guide" avatarInitials="Z">
      {children}
    </SpeechBubble>
  );
}

/** "Zara:" na tela comum; "Zara (Equipe de Bancada)" com a equipe. */
export function rotuloDaZara(equipe: { nome: string } | null, padrao: string = TEXTOS.geral.zara): string {
  return equipe ? TEXTOS.geral.zaraDaEquipe : padrao;
}
