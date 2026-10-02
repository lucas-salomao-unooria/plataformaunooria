import { useEffect, useState } from 'react';

import { ButtonUnv, IconUnv, TextFieldUnv } from '@edu/ui/ds-unoovista';

import { api } from '../../lib/api';
import type { ComentarioCliente, FeedPostCliente } from '../../lib/tipos';
import { formatarContagem } from '../../lib/avatar';

import { AvatarPerfil } from './avatar-perfil';
import { Sheet } from './sheet';

/**
 * Sheet de comentários (doc 03 §3.6): 75% da tela, lista completa (lazy),
 * curtida por comentário e campo fixo embaixo. O comentário do estudante entra no
 * topo e ganha 2–5 curtidas fake nos 30s seguintes.
 *
 * O campo é o `TextField` do Unoovista com "Publicar" à direita. A linha do
 * comentário é texto corrido nos tokens do DS: a `ListItem` corta o título numa
 * linha só, e comentário quebra linha. O coração de cada comentário é um botão
 * só de glifo — o DS não publica botão de ícone sem contêiner (o `TopBar.Action`
 * é um círculo de 44px), e esta é a COMPENSAÇÃO marcada no `AGENTS.md` da
 * experiência.
 */
export function ComentariosSheet({
  post,
  avatarDoEstudante,
  handleDoEstudante,
  aoFechar,
  aoComentar,
  aoCurtirComentario,
}: {
  post: FeedPostCliente | null;
  avatarDoEstudante?: string;
  handleDoEstudante?: string;
  aoFechar: () => void;
  aoComentar: (post: FeedPostCliente, texto: string) => void;
  aoCurtirComentario: (post: FeedPostCliente) => void;
}) {
  const avatar = avatarDoEstudante ?? '';
  const handle = handleDoEstudante ?? '';
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
      handle: handle,
      texto: conteudo,
      likesCount: 0,
      timestampLabel: 'agora',
      doEstudante: true,
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
        <ul className="m-0 flex-1 list-none overflow-y-auto p-0">
          {carregando ? <li className="py-6 text-center text-[13px] text-muted">carregando…</li> : null}

          {comentarios.map((comentario) => {
            const curtido = curtidos.has(comentario.id);
            const ehDoEstudante = comentario.doEstudante;
            const curtidas = comentario.likesCount + (curtido ? 1 : 0);
            return (
              <li key={comentario.id} className="flex items-start gap-3 py-2.5">
                <AvatarPerfil seed={ehDoEstudante ? avatar : comentario.handle} tamanho={32} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[14px] leading-snug text-ink">
                    <span className="font-semibold">{comentario.handle.replace(/^@/, '')}</span>{' '}
                    {comentario.texto}
                  </p>
                  <p className="m-0 mt-0.5 flex gap-3 text-[12px] text-muted">
                    <span>{comentario.timestampLabel}</span>
                    <span>
                      {formatarContagem(curtidas)} {curtidas === 1 ? 'curtida' : 'curtidas'}
                    </span>
                    <span className="font-semibold">Responder</span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Curtir comentário"
                  aria-pressed={curtido}
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
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                >
                  <IconUnv name={curtido ? 'heartFilled' : 'heart'} size="sm" tone={curtido ? 'like' : 'secondary'} />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2 pt-2">
          <AvatarPerfil seed={avatar} tamanho={32} />
          <TextFieldUnv
            block
            className="min-w-0 flex-1"
            label="Comentário"
            hideLabel
            placeholder="Adicione um comentário…"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault();
                publicar();
              }
            }}
            trailing={
              <ButtonUnv variant="link" size="sm" disabled={!texto.trim()} onClick={publicar}>
                Publicar
              </ButtonUnv>
            }
          />
        </div>
      </div>
    </Sheet>
  );
}
