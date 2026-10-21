import { useEffect, useState } from 'react';

import { ButtonUnv, StoryComposer, TopBar } from '@edu/ui/ds-unoovista';

import { retratoDe } from './avatar-perfil';

/**
 * 8 fundos estilo "post de texto" (doc 03 §7, passo 1). São CONTEÚDO — o fundo
 * do post que o estudante publica —, não interface: ficam como estão.
 */
export const TEMPLATES = [
  { id: 'coral', fundo: 'linear-gradient(135deg,#FF5C6E,#FF9A6E)' },
  { id: 'violeta', fundo: 'linear-gradient(135deg,#7B4DFF,#C86DD7)' },
  { id: 'oceano', fundo: 'linear-gradient(135deg,#2E9BF5,#26D0CE)' },
  { id: 'limao', fundo: 'linear-gradient(135deg,#A8E063,#56AB2F)' },
  { id: 'noite', fundo: 'linear-gradient(135deg,#232526,#414345)' },
  { id: 'doce', fundo: 'linear-gradient(135deg,#FBD3E9,#BB377D)' },
  { id: 'areia', fundo: 'linear-gradient(135deg,#F6D365,#FDA085)' },
  { id: 'menta', fundo: 'linear-gradient(135deg,#B2FEFA,#0ED2F7)' },
];

const LIMITE = 280;

/**
 * Compositor em 2 passos (doc 03 §7). Nada na interface convida o estudante até
 * aqui — é descoberta espontânea, como no app real.
 *
 * Passo 1, o fundo; passo 2, o texto, pelo `StoryComposer` do Unoovista: a prévia
 * do post em cima (o texto aparece no fundo escolhido enquanto é digitado), o
 * campo com o contador e o "Compartilhar" embaixo.
 */
export function Compositor({
  avatarDoEstudante,
  aoFechar,
  aoPublicar,
}: {
  avatarDoEstudante?: string;
  aoFechar: () => void;
  aoPublicar: (texto: string, template: string) => void;
}) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [template, setTemplate] = useState(TEMPLATES[0]!);
  const [texto, setTexto] = useState('');

  // Cobre a tela inteira: trava o feed atrás.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[65] mx-auto flex w-full max-w-phone flex-col bg-canvas">
      <TopBar
        withStatusBarInset={false}
        leading={
          <TopBar.Action icon="back" label="Voltar" onClick={() => (passo === 1 ? aoFechar() : setPasso(1))} />
        }
        title={passo === 1 ? 'Novo post' : 'Escreva algo'}
        trailing={
          passo === 1 ? (
            <ButtonUnv variant="link" size="md" onClick={() => setPasso(2)}>
              Avançar
            </ButtonUnv>
          ) : undefined
        }
      />

      {passo === 1 ? (
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-[var(--unv-spacing-xs)] overflow-y-auto px-gutter pb-gutter">
          {TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`aspect-square rounded-midia ${
                template.id === item.id ? 'ring-[3px] ring-action ring-offset-2 ring-offset-canvas' : ''
              }`}
              style={{ background: item.fundo }}
              onClick={() => setTemplate(item)}
              aria-label={`Fundo ${item.id}`}
              aria-pressed={template.id === item.id}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-gutter pb-gutter">
          <StoryComposer
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            maxLength={LIMITE}
            minLength={1}
            label="Texto do post"
            placeholder="escreva aqui…"
            submitLabel="Compartilhar"
            avatarSrc={retratoDe(avatarDoEstudante ?? '').src}
            onSubmit={(valor) => {
              if (!valor.trim()) return;
              aoPublicar(valor.trim(), template.id);
            }}
          >
            <div
              className="flex h-full min-h-[240px] w-full items-center justify-center rounded-midia px-6 text-center text-[24px] font-semibold leading-tight text-white"
              style={{ background: template.fundo }}
              aria-hidden
            >
              {texto || ' '}
            </div>
          </StoryComposer>
        </div>
      )}
    </div>
  );
}
