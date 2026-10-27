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
 * de etapas como no Figma ("Etapa 1 · Etapa 2: Funções · Etapa 3 · Etapa 4"),
 * só de TEXTO e sem conector, para caber em 343px sem rolar a página para o
 * lado. O rótulo da etapa atual pode mudar por tela (a Etapa 5 é
 * "Reconstruir" nos cartões e "Banco de Regras" nos critérios, como o Figma).
 *
 * A rolagem é o `ScrollBar` do DS: aqui a seção É a `unooria`.
 */
export interface CascaProps {
  /** O cabeçalho do módulo; ausente nas telas que só têm a barra de etapas. */
  cabecalho?: { titulo: string; tag?: string };
  /** A barra de etapas: a etapa atual, a janela de etapas que aparece e, se a tela pede, o rótulo da atual. */
  etapas?: { atual: number; janela: number[]; rotulo?: string };
  /** Uma faixa ACIMA do cabeçalho (a de contingência da E3-SIS-01). */
  faixa?: ReactNode;
  equipe: { nome: string } | null;
  children: ReactNode;
}

export function Casca({ cabecalho, etapas, faixa, equipe, children }: CascaProps) {
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
        {etapas && <BarraDeEtapas atual={etapas.atual} janela={etapas.janela} rotulo={etapas.rotulo} />}
        {children}
      </div>
    </ScrollBar>
  );
}

/**
 * COMPENSAÇÃO MARCADA (`estilos/globals.css`, ".escola__etapas"): o `Stepper`
 * do DS 0.2.23 não tem a barra só de texto — o `sm` desenha o glifo de cada
 * etapa e passa de 440px em 375. O DS 0.2.24 traz `size="xs"` e
 * `showIcons={false}` (storybook-unnoria #27); quando o pacote estiver no npm,
 * troque a compensação pelas duas props e apague o bloco do CSS.
 */
function BarraDeEtapas({ atual, janela, rotulo }: { atual: number; janela: number[]; rotulo?: string }) {
  const steps = janela.map((n) => ({
    id: n,
    label: n === atual ? `Etapa ${n}: ${rotulo ?? TEXTOS.etapas[n]}` : `Etapa ${n}`,
    status: n < atual ? ("completed" as const) : n === atual ? ("selected" as const) : ("default" as const),
  }));
  return (
    <nav aria-label="Etapas da missão" className="escola__etapas">
      <Stepper steps={steps} currentStep={janela.indexOf(atual)} size="sm" showConnector={false} clickable={false} />
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
