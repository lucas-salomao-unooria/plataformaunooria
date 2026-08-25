import { Glifo } from '@edu/ui/ds-insta';
import { useEffect, useRef, useState } from 'react';

import type { FeedPostCliente, PerfilCliente } from '../../lib/tipos';
import { formatarContagem } from '../../lib/avatar';

import { AvatarPerfil } from './avatar-perfil';

/**
 * Aba de busca (doc 03 §5): grade de 3 colunas com thumbnails. Dwell conta —
 * cada miniatura é registrada quando fica visível.
 */
export function AbaBusca({
  postsIniciais,
  aoBuscar,
  registrarElemento,
  aoAbrir,
}: {
  /** Acervo já carregado pela casca — os dois lados, sem curadoria da bolha. */
  postsIniciais: FeedPostCliente[];
  /** Dispara a consulta ao servidor; devolve o novo acervo. */
  aoBuscar: (termo: string) => Promise<FeedPostCliente[]>;
  registrarElemento: (elemento: HTMLElement | null, postId: string) => void;
  aoAbrir: (post: FeedPostCliente) => void;
}) {
  const [termo, setTermo] = useState("");
  const [posts, setPosts] = useState(postsIniciais);
  const [buscando, setBuscando] = useState(false);

  // O acervo inicial pode chegar depois da primeira renderização.
  useEffect(() => {
    if (termo.trim().length === 0) setPosts(postsIniciais);
  }, [postsIniciais, termo]);

  async function buscar() {
    const consulta = termo.trim();
    if (consulta.length === 0) {
      setPosts(postsIniciais);
      return;
    }
    setBuscando(true);
    try {
      setPosts(await aoBuscar(consulta));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2.5">
        <label className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2">
          <Glifo name="searchSmall" size={16} tone="secondary" />
          <input
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
            placeholder="Pesquisar"
            value={termo}
            onChange={(evento) => setTermo(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key !== "Enter") return;
              evento.preventDefault();
              void buscar();
            }}
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-0.5">
        {/*
          A grade mostra o ACERVO, não o que o feed serviu: os dois lados, sem
          mixagem e sem ponderação por perfil (doc 04 §5.9). O cliente continua
          sem saber o lado de nada — o sanitizador é o mesmo do feed.
        */}
        {posts.map((post) => (
          <MiniaturaBusca key={post.id} post={post} registrarElemento={registrarElemento} aoAbrir={aoAbrir} />
        ))}
      </div>

      {buscando ? (
        <p className="px-3 py-4 text-center text-[13px] text-muted">Procurando…</p>
      ) : posts.length === 0 ? (
        <p className="px-3 py-6 text-center text-[13px] text-muted">
          Nada por aqui com esse termo.
        </p>
      ) : null}
    </div>
  );
}

function MiniaturaBusca({
  post,
  registrarElemento,
  aoAbrir,
}: {
  post: FeedPostCliente;
  registrarElemento: (elemento: HTMLElement | null, postId: string) => void;
  aoAbrir: (post: FeedPostCliente) => void;
}) {
  const referencia = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    registrarElemento(referencia.current, post.id);
    return () => registrarElemento(null, post.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  return (
    <button
      ref={referencia}
      type="button"
      className="relative aspect-square w-full overflow-hidden bg-canvas"
      onClick={() => aoAbrir(post)}
    >
      {post.imageUrl ? (
         
        <img src={post.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-[28px]"
          style={{ background: post.fallbackArt?.corFundo ?? '#EFEFEF' }}
        >
          {post.fallbackArt?.emojis ?? '✨'}
        </span>
      )}
    </button>
  );
}

export interface ItemNotificacao {
  id: string;
  perfil: PerfilCliente;
  texto: string;
  quando: string;
  seguindo?: boolean;
}

/** Aba de notificações (doc 03 §6): alimentada pela própria sessão. */
export function AbaNotificacoes({
  itens,
  aoSeguirDeVolta,
}: {
  itens: ItemNotificacao[];
  aoSeguirDeVolta: (perfil: PerfilCliente, seguindo: boolean) => void;
}) {
  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
        <p className="text-[15px] font-semibold text-ink">Nada de novo por aqui</p>
        <p className="text-[13px] text-muted">Quando alguém interagir com você, aparece aqui.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      <li className="px-3 pb-1 pt-3 text-[15px] font-semibold text-ink">Esta semana</li>
      {itens.map((item) => (
        <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
          <AvatarPerfil seed={item.perfil.avatarSeed} tamanho={44} />
          <p className="flex-1 text-[13px] leading-snug text-ink">
            <span className="font-semibold">{item.perfil.handle.replace(/^@/, '')}</span> {item.texto}{' '}
            <span className="text-muted">{item.quando}</span>
          </p>
          <button
            type="button"
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold ${
              item.seguindo ? 'border border-hairline text-ink' : 'bg-action text-white'
            }`}
            onClick={() => aoSeguirDeVolta(item.perfil, !item.seguindo)}
          >
            {item.seguindo ? 'Seguindo' : 'Seguir'}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Perfil próprio do aluno (doc 03 §5): contadores fake + grade de salvos. */
export function AbaPerfil({
  handle,
  displayName,
  avatarDoAluno,
  salvos,
  meusPosts,
  aoAbrirMenu,
}: {
  handle: string;
  displayName: string;
  avatarDoAluno: string;
  salvos: FeedPostCliente[];
  meusPosts: { texto: string; template: string; criadoEm: number }[];
  aoAbrirMenu: () => void;
}) {
  const publicacoes = meusPosts.length;

  return (
    <div className="flex flex-col">
      {/* Cabeçalho do perfil: handle à esquerda e ☰ à direita, como no app real.
          É por aqui que o aluno sai da conta (aparelho compartilhado em aula). */}
      <div className="flex h-topbar items-center justify-between px-4">
        <p className="text-[16px] font-semibold text-ink">{handle.replace(/^@/, '')}</p>
        <button
          type="button"
          aria-label="Opções da conta"
          onClick={aoAbrirMenu}
          className="flex h-10 w-10 items-center justify-center active:opacity-50"
        >
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="block h-[1.5px] w-[18px] rounded-full bg-ink" />
            <span className="block h-[1.5px] w-[18px] rounded-full bg-ink" />
            <span className="block h-[1.5px] w-[18px] rounded-full bg-ink" />
          </span>
        </button>
      </div>

      <div className="flex items-center gap-6 px-4 py-4">
        <AvatarPerfil seed={avatarDoAluno} tamanho={82} />
        <dl className="flex flex-1 justify-around text-center">
          {[
            ['publicações', publicacoes],
            ['seguidores', 128],
            ['seguindo', 214],
          ].map(([rotulo, valor]) => (
            <div key={String(rotulo)}>
              <dd className="text-[17px] font-semibold text-ink">{formatarContagem(Number(valor))}</dd>
              <dt className="text-[13px] text-ink">{rotulo}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="px-4 pb-3">
        <p className="text-[14px] font-semibold text-ink">{displayName}</p>
      </div>

      <div className="grid grid-cols-3 gap-0.5 pt-0.5 shadow-[0px_-0.33px_0px_0px_theme(colors.hairline)]">
        {meusPosts.map((post) => (
          <div
            key={post.criadoEm}
            className="flex aspect-square items-center justify-center p-2 text-center text-[11px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#FF5C6E,#7B4DFF)' }}
          >
            {post.texto.slice(0, 60)}
          </div>
        ))}

        {salvos.map((post) => (
          <div key={post.id} className="aspect-square overflow-hidden bg-canvas">
            {post.imageUrl ? (
               
              <img src={post.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center text-[26px]"
                style={{ background: post.fallbackArt?.corFundo ?? '#EFEFEF' }}
              >
                {post.fallbackArt?.emojis ?? '✨'}
              </span>
            )}
          </div>
        ))}

        {publicacoes === 0 && salvos.length === 0 ? (
          <p className="col-span-3 px-8 py-14 text-center text-[13px] text-muted">
            O que você salvar aparece aqui.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Modal simples de perfil de terceiro (doc 02: "abrir perfil"). */
export function ModalPerfil({
  perfil,
  seguindo,
  aoFechar,
  aoSeguir,
  posts,
}: {
  perfil: PerfilCliente | null;
  seguindo: boolean;
  aoFechar: () => void;
  aoSeguir: (perfil: PerfilCliente, seguindo: boolean) => void;
  posts: FeedPostCliente[];
}) {
  if (!perfil) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={aoFechar} />
      <div className="relative w-full max-w-[340px] rounded-2xl bg-surface p-4">
        <div className="flex flex-col items-center gap-2">
          <AvatarPerfil seed={perfil.avatarSeed} tamanho={72} />
          <p className="text-[15px] font-semibold text-ink">{perfil.handle.replace(/^@/, '')}</p>
          <p className="text-[13px] text-muted">{perfil.displayName}</p>
          <button
            type="button"
            className={`mt-1 w-full rounded-lg py-2 text-[14px] font-semibold ${
              seguindo ? 'border border-hairline text-ink' : 'bg-action text-white'
            }`}
            onClick={() => aoSeguir(perfil, !seguindo)}
          >
            {seguindo ? 'Seguindo' : 'Seguir'}
          </button>
        </div>

        {posts.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-0.5">
            {posts.slice(0, 6).map((post) => (
              <div key={post.id} className="aspect-square overflow-hidden bg-canvas">
                {post.imageUrl ? (
                   
                  <img src={post.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-[22px]"
                    style={{ background: post.fallbackArt?.corFundo ?? '#EFEFEF' }}
                  >
                    {post.fallbackArt?.emojis ?? '✨'}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
