import { useEffect, useState } from 'react';

import { BadgeUnv, TopBar } from '@edu/ui/ds-unoovista';

import { api } from '../../lib/api';
import type { FeedPostCliente } from '../../lib/tipos';

import { PostCard, type AcoesDoPost } from './post-card';

/**
 * FASE do DEBATE (fluxo v2). A tela trava aqui, e é de propósito.
 *
 * O momento é de conversa entre pares sobre o que cada um coletou. Se o feed
 * continuasse disponível, metade da sala estaria rolando post novo em vez de
 * defender o que salvou — e o valor do momento é justamente ter que defender.
 *
 * Só duas ações existem: abrir um post salvo e fechar. Nada de feed, busca,
 * stories, notificações ou perfil.
 *
 * Ainda é ANTES da explicabilidade: nenhum texto aqui pode mencionar o mecanismo
 * (regra de ouro 1), e nada de vocabulário de escola — o aparelho continua sendo
 * um app.
 */
const SEM_ACOES: AcoesDoPost = {
  aoCurtir: () => undefined,
  aoSalvar: () => undefined,
  aoSeguir: () => undefined,
  aoAbrirComentarios: () => undefined,
  aoCompartilhar: () => undefined,
  aoAbrirOpcoes: () => undefined,
  aoAbrirPerfil: () => undefined,
  registrarElemento: () => undefined,
  aoGesto: () => undefined,
};

interface Resposta {
  posts: FeedPostCliente[];
  comentarios: Record<string, string[]>;
}

export function Debate({ runId }: { runId: string }) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState<FeedPostCliente | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .get<Resposta>(`/runs/${runId}/salvos`)
      .then((corpo) => ativo && setDados(corpo))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [runId]);

  if (erro) {
    return (
      <Moldura>
        <p className="text-[15px] text-muted">Algo deu errado. Fala com quem está com você.</p>
      </Moldura>
    );
  }

  if (!dados) {
    return (
      <Moldura>
        <p className="text-[15px] text-muted">abrindo o que você salvou…</p>
      </Moldura>
    );
  }

  /** Post aberto: o card inteiro, mais o que ELE escreveu embaixo. */
  if (aberto) {
    const meus = dados.comentarios[aberto.id] ?? [];
    return (
      <div className="fixed inset-0 z-[85] flex flex-col bg-canvas">
        <TopBar
          withStatusBarInset={false}
          leading={<TopBar.Action icon="back" label="Voltar" onClick={() => setAberto(null)} />}
          title="Um post que você salvou"
        />

        <div className="flex flex-1 flex-col gap-[var(--unv-spacing-m)] overflow-y-auto overscroll-contain px-gutter pb-gutter">
          <PostCard
            post={aberto}
            acoes={SEM_ACOES}
            curtido={false}
            salvo
            seguindo={false}
            comentariosDoEstudante={meus.length}
          />

          {meus.length > 0 ? (
            <section className="rounded-cartao bg-surface px-4 py-3">
              <p className="text-[12px] uppercase tracking-wide text-muted">o que você comentou</p>
              <ul className="mt-2 flex flex-col gap-2">
                {meus.map((texto, indice) => (
                  <li key={indice} className="text-[14px] leading-snug text-ink">
                    “{texto}”
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-canvas">
      <header className="shrink-0 px-gutter pb-3 pt-5">
        <h1 className="text-[19px] font-bold leading-tight text-ink">Hora de conversar</h1>
        <p className="mt-1 text-[13px] leading-snug text-ink/70">
          {dados.posts.length > 0
            ? 'Estes são os posts que você salvou. Abra um e conte por que ele te convenceu.'
            : 'Você não salvou nenhum post. Escuta o que os outros salvaram — e por quê.'}
        </p>
      </header>

      {dados.posts.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter">
          <ul className="m-0 grid list-none grid-cols-3 gap-[var(--unv-spacing-3xs)] rounded-cartao bg-surface p-[var(--unv-spacing-xs)]">
            {dados.posts.map((post) => {
              const arte = post.fallbackArt;
              return (
                <li key={post.id}>
                  <button
                    type="button"
                    className="relative block aspect-square w-full overflow-hidden rounded-bloco bg-canvasAlt active:opacity-70"
                    onClick={() => setAberto(post)}
                  >
                    {post.imageUrl ? (
                       
                      <img src={post.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-[26px]"
                        style={{ background: arte?.corFundo }}
                      >
                        {arte?.emojis}
                      </span>
                    )}
                    {(dados.comentarios[post.id]?.length ?? 0) > 0 ? (
                      <BadgeUnv variant="neutral" className="absolute bottom-1 right-1">
                        você comentou
                      </BadgeUnv>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-8">
          <p className="text-center text-[14px] leading-relaxed text-muted">
            Nada salvo por aqui.
          </p>
        </div>
      )}

      {/*
        O rodapé existe para o estudante não ficar procurando o que fazer. Ele diz que
        a espera é esperada — sem prometer tempo, porque quem decide o fim do
        momento não é o aparelho.
      */}
      <footer className="shrink-0 px-gutter py-3">
        <p className="text-[12px] leading-snug text-muted">
          O feed volta depois desta conversa.
        </p>
      </footer>
    </div>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[85] flex items-center justify-center bg-canvas px-8">{children}</div>;
}
