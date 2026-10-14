import { useEffect, useRef, useState } from 'react';

import { ButtonUnv, NotificationItem, ProfileHeader, SearchField, TopBar } from '@edu/ui/ds-unoovista';

import type { FeedPostCliente, PerfilCliente } from '../../lib/tipos';
import { formatarContagem } from '../../lib/avatar';

import { retratoDe } from './avatar-perfil';
import { Sheet } from './sheet';
import { altDaImagem } from '../../lib/alt-da-imagem';

const semArroba = (handle: string) => handle.replace(/^@/, '');

/**
 * A grade de miniaturas da busca e dos perfis, nas medidas do `MediaGrid` do
 * Unoovista (4px entre blocos, `radius-s`, dentro de um cartão).
 *
 * É a COMPENSAÇÃO marcada no `AGENTS.md` da experiência, e não o `MediaGrid`,
 * por duas lacunas do componente: ele só desenha bloco com `src` (metade dos
 * posts é um cartão de emoji, sem foto) e não entrega o elemento de cada bloco —
 * e a busca registra CADA miniatura no medidor de dwell.
 */
function Miniatura({ post, tamanhoDoEmoji }: { post: FeedPostCliente; tamanhoDoEmoji: string }) {
  return post.imageUrl ? (
    <img src={post.imageUrl} alt={altDaImagem(post.imageAlt, post.author.handle)} className="h-full w-full object-cover" loading="lazy" />
  ) : (
    <span
      className={`flex h-full w-full items-center justify-center ${tamanhoDoEmoji}`}
      style={{ background: post.fallbackArt?.corFundo ?? 'var(--unv-color-background-tertiary)' }}
    >
      {post.fallbackArt?.emojis ?? '✨'}
    </span>
  );
}

const CARTAO_DA_GRADE = 'rounded-cartao bg-surface p-[var(--unv-spacing-xs)]';
const GRADE = 'grid grid-cols-3 gap-[var(--unv-spacing-3xs)]';
const BLOCO = 'relative aspect-square w-full overflow-hidden rounded-bloco bg-canvasAlt';

/**
 * Aba de busca (doc 03 §5): o `SearchField` do Unoovista e a grade de 3 colunas.
 * Dwell conta — cada miniatura é registrada quando fica visível.
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
  const [termo, setTermo] = useState('');
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
    <div className="flex flex-col gap-[var(--unv-spacing-m)]">
      <SearchField
        block
        placeholder="Pesquisar"
        ariaLabel="Pesquisar"
        clearable
        clearLabel="Limpar a pesquisa"
        value={termo}
        onChange={(evento) => setTermo(evento.target.value)}
        onClear={() => setTermo('')}
        onKeyDown={(evento) => {
          if (evento.key !== 'Enter') return;
          evento.preventDefault();
          void buscar();
        }}
      />

      <div className={CARTAO_DA_GRADE}>
        <div className={GRADE}>
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
          <p className="m-0 px-3 py-4 text-center text-[13px] text-muted">Procurando…</p>
        ) : posts.length === 0 ? (
          <p className="m-0 px-3 py-6 text-center text-[13px] text-muted">Nada por aqui com esse termo.</p>
        ) : null}
      </div>
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
      aria-label={`Abrir a publicação de ${semArroba(post.author.handle)}`}
      className={BLOCO}
      onClick={() => aoAbrir(post)}
    >
      <Miniatura post={post} tamanhoDoEmoji="text-[28px]" />
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

/** Aba de notificações (doc 03 §6): `NotificationItem` do Unoovista, alimentado pela própria sessão. */
export function AbaNotificacoes({
  itens,
  aoSeguirDeVolta,
}: {
  itens: ItemNotificacao[];
  aoSeguirDeVolta: (perfil: PerfilCliente, seguindo: boolean) => void;
}) {
  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-cartao bg-surface px-8 py-16 text-center">
        <p className="m-0 text-[15px] font-semibold text-ink">Nada de novo por aqui</p>
        <p className="m-0 text-[13px] text-muted">Quando alguém interagir com você, aparece aqui.</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-[var(--unv-spacing-xs)]">
      <h2 className="m-0 px-1 text-[15px] font-semibold text-ink">Esta semana</h2>
      <ul className="m-0 flex list-none flex-col gap-[var(--unv-spacing-xs)] p-0">
        {itens.map((item) => {
          const retrato = retratoDe(item.perfil.avatarSeed);
          return (
            <li key={item.id}>
              <NotificationItem
                avatarSrc={retrato.src}
                initials={retrato.initials}
                username={semArroba(item.perfil.handle)}
                action={item.texto}
                timestamp={item.quando}
                trailing={
                  <ButtonUnv
                    variant={item.seguindo ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => aoSeguirDeVolta(item.perfil, !item.seguindo)}
                  >
                    {item.seguindo ? 'Seguindo' : 'Seguir'}
                  </ButtonUnv>
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Perfil próprio do estudante (doc 03 §5): `ProfileHeader` com contadores fake + grade de salvos. */
export function AbaPerfil({
  handle,
  displayName,
  avatarDoEstudante,
  salvos,
  meusPosts,
  aoAbrirMenu,
}: {
  handle: string;
  displayName: string;
  avatarDoEstudante?: string;
  salvos: FeedPostCliente[];
  meusPosts: { texto: string; template: string; criadoEm: number }[];
  aoAbrirMenu: () => void;
}) {
  const publicacoes = meusPosts.length;
  const retrato = retratoDe(avatarDoEstudante ?? '');

  return (
    <div className="flex flex-col gap-[var(--unv-spacing-m)]">
      {/* O nome da conta e o menu, como no app real. É por aqui que o estudante
          sai da conta (aparelho compartilhado em aula). */}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="m-0 truncate text-[18px] font-semibold text-ink">{semArroba(handle)}</p>
        <TopBar.Action icon="menu" label="Opções da conta" onClick={aoAbrirMenu} />
      </div>

      <ProfileHeader
        avatarSrc={retrato.src}
        initials={retrato.initials}
        name={displayName}
        stats={[
          { id: 'publicacoes', value: formatarContagem(publicacoes), label: 'Publicações' },
          { id: 'seguidores', value: formatarContagem(128), label: 'Seguidores' },
          { id: 'seguindo', value: formatarContagem(214), label: 'Seguindo' },
        ]}
      />

      <div className={CARTAO_DA_GRADE}>
        <div className={GRADE}>
          {meusPosts.map((post) => (
            <div
              key={post.criadoEm}
              className={`${BLOCO} flex items-center justify-center p-2 text-center text-[11px] font-semibold text-on-action`}
              style={{ background: 'var(--unv-gradient-story)' }}
            >
              {post.texto.slice(0, 60)}
            </div>
          ))}

          {salvos.map((post) => (
            <div key={post.id} className={BLOCO}>
              <Miniatura post={post} tamanhoDoEmoji="text-[26px]" />
            </div>
          ))}

          {publicacoes === 0 && salvos.length === 0 ? (
            <p className="col-span-3 m-0 px-8 py-14 text-center text-[13px] text-muted">
              O que você salvar aparece aqui.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Perfil de terceiro (doc 02: "abrir perfil"), numa folha com o `ProfileHeader` do Unoovista. */
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
  const retrato = retratoDe(perfil.avatarSeed);

  return (
    <Sheet aberto aoFechar={aoFechar} altura="auto" rotulo={`Perfil de ${semArroba(perfil.handle)}`}>
      <div className="flex flex-col gap-[var(--unv-spacing-m)]">
        <ProfileHeader
          avatarSrc={retrato.src}
          initials={retrato.initials}
          avatarSize={72}
          name={semArroba(perfil.handle)}
          verified={perfil.verificado}
          bio={perfil.displayName}
          actions={
            <ButtonUnv
              block
              variant={seguindo ? 'secondary' : 'primary'}
              onClick={() => aoSeguir(perfil, !seguindo)}
            >
              {seguindo ? 'Seguindo' : 'Seguir'}
            </ButtonUnv>
          }
        />

        {posts.length > 0 ? (
          <div className={GRADE}>
            {posts.slice(0, 6).map((post) => (
              <div key={post.id} className={BLOCO}>
                <Miniatura post={post} tamanhoDoEmoji="text-[22px]" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
