import { useState } from 'react';

import type { FeedPostCliente } from '../../lib/tipos';

import { AvatarPerfil } from './avatar-perfil';
import { Sheet } from './sheet';

const CONTATOS = [
  '@bia.sq', '@dudu.alves', '@vitoria__m', '@leo.pires', '@sofi.rodrigues',
  '@caio.mtz', '@helo.dias', '@nina.rocha', '@theo.lm', '@ju.barros',
];

/** Sheet "Compartilhar" (doc 03 §3.3): enviar só faz toast — e conta sinal. */
export function CompartilharSheet({
  post,
  aoFechar,
  aoEnviar,
}: {
  post: FeedPostCliente | null;
  aoFechar: () => void;
  aoEnviar: (post: FeedPostCliente) => void;
}) {
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  if (!post) return null;

  return (
    <Sheet aberto aoFechar={aoFechar} altura="60%" titulo="Compartilhar">
      <ul className="px-3 py-2">
        {CONTATOS.map((contato) => (
          <li key={contato} className="flex items-center gap-3 py-2.5">
            <AvatarPerfil seed={contato} tamanho={40} />
            <span className="flex-1 text-[14px] text-ink">{contato.replace(/^@/, '')}</span>
            <button
              type="button"
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold ${
                enviados.has(contato) ? 'bg-canvas text-muted' : 'bg-action text-white'
              }`}
              onClick={() => {
                if (enviados.has(contato)) return;
                setEnviados((atual) => new Set(atual).add(contato));
                aoEnviar(post);
              }}
            >
              {enviados.has(contato) ? 'Enviado' : 'Enviar'}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Sheet do ⋯ — "Não tenho interesse" e "Denunciar" são sinais negativos reais. */
export function OpcoesSheet({
  post,
  aoFechar,
  aoNaoInteressa,
  aoDenunciar,
}: {
  post: FeedPostCliente | null;
  aoFechar: () => void;
  aoNaoInteressa: (post: FeedPostCliente) => void;
  aoDenunciar: (post: FeedPostCliente) => void;
}) {
  if (!post) return null;

  return (
    <Sheet aberto aoFechar={aoFechar} altura="auto">
      <ul className="flex flex-col px-1 pb-4">
        {[
          { rotulo: 'Não tenho interesse', acao: () => aoNaoInteressa(post), perigo: false },
          { rotulo: 'Denunciar', acao: () => aoDenunciar(post), perigo: true },
          { rotulo: 'Copiar link', acao: aoFechar, perigo: false },
          { rotulo: 'Cancelar', acao: aoFechar, perigo: false },
        ].map((item) => (
          <li key={item.rotulo}>
            <button
              type="button"
              className={`w-full px-4 py-3.5 text-left text-[15px] ${item.perigo ? 'text-like-texto' : 'text-ink'}`}
              onClick={() => {
                item.acao();
                aoFechar();
              }}
            >
              {item.rotulo}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Toast curto, na gramática do app (nada de vocabulário de exercício). */
export function Toast({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-8">
      <span className="rounded-lg bg-black/85 px-4 py-2.5 text-[13px] text-white">{mensagem}</span>
    </div>
  );
}
