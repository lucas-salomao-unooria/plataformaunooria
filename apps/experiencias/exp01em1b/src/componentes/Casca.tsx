import type { ReactNode } from "react";
import { ScrollBar, SpeechBubble, Stepper, Tag } from "@edu/ui/ds";
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
 * A barra de etapas é o `Stepper` do DS e só INDICA (não navega): uma janela
 * de etapas como no Figma ("Etapa 1 · Etapa 2: Funções · Etapa 3 · Etapa 4").
 *
 * A rolagem é o `ScrollBar` do DS: aqui a seção É a `unooria`.
 */
export interface CascaProps {
  /** O cabeçalho do módulo; ausente nas telas que só têm a barra de etapas. */
  cabecalho?: { titulo: string; tag?: string };
  /** A barra de etapas: a etapa atual e a janela de etapas que aparece. */
  etapas?: { atual: number; janela: number[] };
  equipe: { nome: string } | null;
  children: ReactNode;
}

export function Casca({ cabecalho, etapas, equipe, children }: CascaProps) {
  const topo = equipe ? { titulo: TEXTOS.geral.bancada, tag: TEXTOS.geral.tagDaEquipe(equipe.nome) } : cabecalho;
  return (
    <ScrollBar className="escola" height="100%" autoHide theme="light">
      <div className="escola__pilha">
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
        {etapas && <BarraDeEtapas atual={etapas.atual} janela={etapas.janela} />}
        {children}
      </div>
    </ScrollBar>
  );
}

function BarraDeEtapas({ atual, janela }: { atual: number; janela: number[] }) {
  const steps = janela.map((n) => ({
    id: n,
    label: n === atual ? `Etapa ${n}: ${TEXTOS.etapas[n]}` : `Etapa ${n}`,
    status: n < atual ? ("completed" as const) : n === atual ? ("selected" as const) : ("default" as const),
  }));
  return (
    <nav aria-label="Etapas da missão" className="escola__etapas">
      <Stepper steps={steps} currentStep={janela.indexOf(atual)} size="sm" clickable={false} />
    </nav>
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
