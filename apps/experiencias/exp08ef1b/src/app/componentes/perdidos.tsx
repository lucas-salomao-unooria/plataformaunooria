import { useEffect, useState } from 'react';

import { api } from '../../lib/api';

/**
 * O FEED QUE ELE NÃO RECEBEU (fluxo v2).
 *
 * Três decisões visuais, e todas carregam a mensagem:
 *
 * 1. **Cinza.** Os posts vêm dessaturados. Não é enfeite: o cinza diz "isto
 *    existiu e passou por você" sem uma linha de texto explicando.
 * 2. **A conta no topo, em número grande.** "38 posts que nunca chegaram até
 *    você" é mais forte que qualquer parágrafo — e é um número real, calculado da
 *    diferença entre o acervo e o que foi servido.
 * 3. **Sem nenhuma ação.** Não dá para curtir, salvar ou comentar. A run está
 *    congelada e, mais importante, o momento é de olhar, não de interagir.
 *
 * É pós-revelação, então lado e rótulo aparecem.
 */
interface PostPerdido {
  id: string;
  author: { handle: string; displayName: string; verificado: boolean };
  imageUrl: string | null;
  fallbackArt: { corFundo: string; emojis: string } | null;
  caption: string;
  hashtags: string[];
  likesCount: number;
  timestampLabel: string;
  comentarios: { handle: string; texto: string }[];
}

interface Resposta {
  /** `null` quando a sessão não serviu post de tese nenhum — ver o vazio abaixo. */
  rotuloDoLadoPerdido: string | null;
  rotuloDoLadoDele: string | null;
  contagem: { totalNoAcervo: number; vistos: number; perdidos: number };
  posts: PostPerdido[];
}

export function Perdidos({ runId }: { runId: string }) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    api
      .get<Resposta>(`/runs/${runId}/perdidos`)
      .then((corpo) => ativo && setDados(corpo))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [runId]);

  if (erro) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface px-8 text-center">
        <p className="text-[15px] text-muted">Algo deu errado. Fala com quem está com você.</p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-[15px] text-muted">abrindo o que passou longe…</p>
      </div>
    );
  }

  /**
   * Sessão que não chegou a servir post de tese nenhum. É raro (entrou e saiu),
   * mas a tela precisa dizer o que houve: "0 posts que nunca chegaram até você"
   * afirmaria o contrário do que aconteceu — ele não viu NADA, não viu tudo.
   */
  if (!dados.rotuloDoLadoPerdido) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface px-8 text-center">
        <p className="text-[15px] leading-relaxed text-ink/70">
          Sua sessão terminou antes de o feed abrir de verdade, então não dá para dizer o que ficou de
          fora dela.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-10 border-b border-hairline bg-surface/95 px-4 py-3 backdrop-blur">
        <p className="text-[11px] uppercase tracking-widest text-muted">o que você não viu</p>
        <p className="mt-0.5 text-[26px] font-bold leading-none text-ink">
          {dados.contagem.perdidos}
          <span className="ml-1.5 text-[13px] font-normal text-ink/75">
            posts que nunca chegaram até você
          </span>
        </p>
        <p className="mt-1.5 text-[12px] leading-snug text-ink/70">
          Todos de <strong>{dados.rotuloDoLadoPerdido}</strong> — o lado que seu feed quase não
          mostrou. Você viu {dados.contagem.vistos} de {dados.contagem.totalNoAcervo}.
        </p>
      </header>

      {/*
        `grayscale` no container inteiro: o cinza é a mensagem. Um post por vez, no
        mesmo formato do feed, para o reconhecimento ser imediato — "isso é igual
        ao que eu estava vendo, só que eu não vi".
      */}
      <div className="flex-1 grayscale">
        {dados.posts.map((post) => (
          <article key={post.id} className="border-b border-hairline pb-3">
            <header className="flex items-center gap-2.5 px-3 py-2.5">
              <span
                /* Iniciais em tinta escura: os fundos são tons pastel, e o branco
                   dava 1,3:1 (WCAG 1.4.3, ADR-162). */
                className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-ink"
                style={{ background: post.fallbackArt?.corFundo ?? '#8a8a8a' }}
              >
                {post.author.handle.replace('@', '').slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[13px] font-semibold text-ink">{post.author.handle}</span>
            </header>

            <div className="aspect-[4/5] w-full overflow-hidden bg-canvas">
              {post.imageUrl ? (
                 
                <img src={post.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-[52px]"
                  style={{ background: post.fallbackArt?.corFundo }}
                >
                  {post.fallbackArt?.emojis}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1 px-3 pt-2.5">
              <p className="text-[13px] font-semibold text-ink">
                {post.likesCount.toLocaleString('pt-BR')} curtidas
              </p>
              <p className="text-[14px] leading-snug text-ink">
                <span className="font-semibold">{post.author.handle}</span> {post.caption}
              </p>
              {post.comentarios.map((comentario, indice) => (
                <p key={indice} className="text-[13px] leading-snug text-ink/70">
                  <span className="font-semibold">{comentario.handle}</span> {comentario.texto}
                </p>
              ))}
              <p className="text-[11px] text-muted">{post.timestampLabel}</p>
            </div>
          </article>
        ))}

        {dados.posts.length === 0 ? (
          <p className="px-6 py-10 text-center text-[14px] leading-relaxed text-muted">
            Você viu praticamente tudo dos dois lados. Isso é raro.
          </p>
        ) : null}
      </div>

      <footer className="border-t border-hairline px-4 py-4">
        <p className="text-[13px] leading-relaxed text-ink/70">
          Nenhum desses posts era escondido de propósito por uma pessoa. Eles só não foram
          escolhidos para você.
        </p>
      </footer>
    </div>
  );
}
