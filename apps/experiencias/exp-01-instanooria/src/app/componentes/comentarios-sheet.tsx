import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { ComentarioCliente, FeedPostCliente } from '../../lib/tipos';
import { formatarContagem } from '../../lib/avatar';

import { AvatarPerfil } from './avatar-perfil';
import { Glifo } from '@edu/ui/ds-insta';
import { Sheet } from './sheet';

/**
 * Sheet de comentários (doc 03 §3.6): 75% da tela, lista completa (lazy),
 * curtida por comentário e campo fixo embaixo. O comentário do aluno entra no
 * topo e ganha 2–5 curtidas fake nos 30s seguintes.
 */
export function ComentariosSheet({
  post,
  avatarDoAluno,
  handleDoAluno,
  aoFechar,
  aoComentar,
  aoCurtirComentario,
}: {
  post: FeedPostCliente | null;
  avatarDoAluno: string;
  handleDoAluno: string;
  aoFechar: () => void;
  aoComentar: (post: FeedPostCliente, texto: string) => void;
  aoCurtirComentario: (post: FeedPostCliente) => void;
}) {
  const [comentarios, setComentarios] = useState<ComentarioCliente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [texto, setTexto] = useState('');
  const [curtidos, setCurtidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!post) return;
    let ativo = true;
    setCarregando(true);
    setComentarios([]);

    api
      .get<{ comments: ComentarioCliente[] }>(`/posts/${post.id}/comentarios`)
      .then((dados) => {
        if (ativo) setComentarios(dados.comments ?? []);
      })
      .catch(() => undefined)
      .finally(() => ativo && setCarregando(false));

    return () => {
      ativo = false;
    };
  }, [post]);

  if (!post) return null;

  const publicar = () => {
    const conteudo = texto.trim();
    if (!conteudo) return;

    const meu: ComentarioCliente = {
      id: `meu-${Date.now()}`,
      handle: handleDoAluno,
      texto: conteudo,
      likesCount: 0,
      timestampLabel: 'agora',
      doAluno: true,
    };

    setComentarios((atual) => [meu, ...atual]);
    setTexto('');
    aoComentar(post, conteudo);

    // Recompensa social: curtidas chegando nos 30s seguintes.
    const alvo = 2 + Math.floor(Math.random() * 4);
    for (let i = 1; i <= alvo; i += 1) {
      window.setTimeout(
        () =>
          setComentarios((atual) =>
            atual.map((item) => (item.id === meu.id ? { ...item, likesCount: item.likesCount + 1 } : item)),
          ),
        i * (3000 + Math.random() * 5000),
      );
    }
  };

  return (
    <Sheet aberto aoFechar={aoFechar} titulo="Comentários">
      <div className="flex h-full flex-col">
        <ul className="flex-1 overflow-y-auto px-3 py-3">
          {carregando ? <li className="py-6 text-center text-[13px] text-muted">carregando…</li> : null}

          {comentarios.map((comentario) => {
            const curtido = curtidos.has(comentario.id);
            return (
              <li key={comentario.id} className="flex items-start gap-2.5 py-2.5">
                <AvatarPerfil seed={comentario.doAluno ? avatarDoAluno : comentario.handle} tamanho={24} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-ink">
                    <span className="font-semibold">{comentario.handle.replace(/^@/, '')}</span>{' '}
                    {comentario.texto}
                  </p>
                  <p className="mt-0.5 flex gap-3 text-[11px] text-muted">
                    <span>{comentario.timestampLabel}</span>
                    <span>
                      {formatarContagem(comentario.likesCount + (curtido ? 1 : 0))}{' '}
                      {comentario.likesCount + (curtido ? 1 : 0) === 1 ? 'curtida' : 'curtidas'}
                    </span>
                    <span className="font-semibold">Responder</span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Curtir comentário"
                  onClick={() => {
                    setCurtidos((atual) => {
                      const proximo = new Set(atual);
                      if (proximo.has(comentario.id)) proximo.delete(comentario.id);
                      else {
                        proximo.add(comentario.id);
                        aoCurtirComentario(post);
                      }
                      return proximo;
                    });
                  }}
                  className="pt-1"
                >
                  <Glifo name={curtido ? 'heartFilled' : 'heart'} size={13} tone={curtido ? 'like' : 'secondary'} />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2 border-t border-hairline px-3 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
          <AvatarPerfil seed={avatarDoAluno} tamanho={28} />
          <input
            className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
            placeholder="Adicione um comentário…"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault();
                publicar();
              }
            }}
          />
          <button
            type="button"
            className={`text-[14px] font-semibold ${texto.trim() ? 'text-action' : 'text-action/40'}`}
            onClick={publicar}
          >
            Publicar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
