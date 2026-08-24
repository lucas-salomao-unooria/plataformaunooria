import { Glifo } from '@edu/ui/ds-insta';
import { useEffect, useState } from 'react';

import { AvatarPerfil } from './avatar-perfil';

/** 8 fundos estilo "post de texto" (doc 03 §7, passo 1). */
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

/**
 * Compositor em 2 passos (doc 03 §7). Nada na interface convida o aluno até
 * aqui — é descoberta espontânea, como no app real.
 */
export function Compositor({
  avatarDoAluno,
  aoFechar,
  aoPublicar,
}: {
  avatarDoAluno: string;
  aoFechar: () => void;
  aoPublicar: (texto: string, template: string) => void;
}) {
  const [passo, setPasso] = useState<1 | 2>(1);

  // Cobre a tela inteira: trava o feed atrás.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);
  const [template, setTemplate] = useState(TEMPLATES[0]!);
  const [texto, setTexto] = useState('');

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-surface">
      <div className="mx-auto flex w-full max-w-phone flex-1 flex-col">
        <header className="flex h-topbar items-center justify-between border-b border-hairline px-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => (passo === 1 ? aoFechar() : setPasso(1))}
            className="active:opacity-60"
          >
            <Glifo name="back" size={24} tone="primary" />
          </button>
          <span className="text-[15px] font-semibold text-ink">
            {passo === 1 ? 'Novo post' : 'Escreva algo'}
          </span>
          {passo === 1 ? (
            <button
              type="button"
              className="text-[14px] font-semibold text-action"
              onClick={() => setPasso(2)}
            >
              Avançar
            </button>
          ) : (
            <button
              type="button"
              className={`text-[14px] font-semibold ${texto.trim() ? 'text-action' : 'text-action/40'}`}
              onClick={() => {
                if (!texto.trim()) return;
                aoPublicar(texto.trim(), template.id);
              }}
            >
              Compartilhar
            </button>
          )}
        </header>

        {passo === 1 ? (
          <div className="grid flex-1 grid-cols-2 gap-2 p-3">
            {TEMPLATES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`aspect-square rounded-lg ${template.id === item.id ? 'ring-2 ring-ink' : ''}`}
                style={{ background: item.fundo }}
                onClick={() => setTemplate(item)}
                aria-label={`Fundo ${item.id}`}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div
              className="flex flex-1 items-center justify-center px-6"
              style={{ background: template.fundo }}
            >
              <textarea
                autoFocus
                maxLength={280}
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                placeholder="escreva aqui…"
                className="w-full resize-none bg-transparent text-center text-[26px] font-semibold leading-tight text-white outline-none placeholder:text-white/60"
                rows={5}
              />
            </div>
            <div className="flex items-center gap-2 border-t border-hairline px-3 py-3">
              <AvatarPerfil seed={avatarDoAluno} tamanho={28} />
              <span className="flex-1 text-[12px] text-muted">{280 - texto.length} caracteres restantes</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
