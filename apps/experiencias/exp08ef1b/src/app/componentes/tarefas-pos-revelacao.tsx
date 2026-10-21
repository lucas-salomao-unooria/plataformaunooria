/**
 * As folhas da PLATAFORMA, no chunk das tarefas: ele chega por `React.lazy`
 * (`instanooria-app.tsx`), então o CSS do DS só desce depois da revelação e não
 * acompanha o feed — o mesmo cuidado de `dossie/graficos.tsx`.
 */
import '@unooria/design-system/unooria.css';
import '@unooria/design-system/fonts/unooria.css';

import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, RadioGroup, TextArea } from '@edu/ui/ds';

import { api, experiencia } from '../../lib/api';
import { altDaImagem } from '../../lib/alt-da-imagem';
import { pede, type EnvioDaApi, type SituacaoDasTarefas, type TermosDaApi } from '../../lib/canal-a';

/**
 * AS TAREFAS DEPOIS DA REVELAÇÃO (ADR-167): o 6b, os termos (EF08CO09), e o
 * 6c, o envio (EF08CO07), uma depois da outra, no ritmo de cada um.
 *
 * Fora do disfarce: quem fala é a escola, então os controles são da
 * PLATAFORMA (`Checkbox`, `RadioGroup`, `TextArea`, `Button`), no tema escuro
 * da reflexão. Os termos são fictícios. Nenhuma tela mostra acerto: o envio
 * responde só "enviado", e os gabaritos ficam na api (regra 3).
 */
export function TarefasPosRevelacao({
  runId,
  fase,
  situacao,
  aoTerminar,
}: {
  runId: string;
  /** A fase da turma, para o `exp:estado` do hub. */
  fase: string;
  situacao: SituacaoDasTarefas;
  /** Depois de cada envio: quem chama relê a situação. */
  aoTerminar: () => void;
}) {
  /* O hub tira a moldura do cinza enquanto as tarefas estão na tela. */
  useEffect(() => {
    const exp = experiencia();
    exp.enviarEstado({ fase, passo: 'tarefas' });
    return () => exp.enviarEstado({ fase });
  }, [fase]);
  if (pede(situacao.termos)) return <Moldura><Termos runId={runId} aoEnviar={aoTerminar} /></Moldura>;
  if (pede(situacao.envio)) return <Moldura><Envio runId={runId} aoEnviar={aoTerminar} /></Moldura>;
  return null;
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[85] flex flex-col overflow-y-auto overscroll-contain bg-night px-5 py-8 text-white">
      <div className="mx-auto flex w-full max-w-[340px] flex-col gap-5">{children}</div>
    </div>
  );
}

// ── 6b Os termos ─────────────────────────────────────────────────────────

export function Termos({ runId, aoEnviar }: { runId: string; aoEnviar: () => void }) {
  const [dados, setDados] = useState<TermosDaApi | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .get<TermosDaApi>(`/runs/${runId}/termos`)
      .then((corpo) => ativo && setDados(corpo))
      .catch(() => ativo && setErro('Não deu pra abrir agora. Tenta de novo daqui a pouco.'));
    return () => {
      ativo = false;
    };
  }, [runId]);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/runs/${runId}/termos`, { marcadas });
      aoEnviar();
    } catch {
      setErro('Não deu pra enviar agora. Tenta de novo — suas escolhas estão aqui.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-label="Os termos de uso" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-widest text-white/60">os termos</p>
        {/* O título é o do PO (2026-10-21, ADR-179): os termos são os que ele
            aceitou na entrada, e agora ele os lê de verdade. */}
        <h1 className="text-[19px] font-bold leading-snug">
          Esses são os termos de uso que você recebeu no início da experiência.
        </h1>
        <p className="text-[15px] leading-snug text-white/80">
          Marque as regras que explicam o que aconteceu no seu feed.
        </p>
      </header>

      {dados ? (
        <>
          <ol className="flex flex-col gap-3">
            {dados.clausulas.map((c, indice) => {
              const marcada = marcadas.includes(c.id);
              return (
                <li key={c.id} className="rounded-xl bg-white/5 px-4 py-3">
                  <Checkbox
                    theme="dark"
                    checked={marcada}
                    disabled={enviando}
                    label={
                      <span className="text-[14px] leading-snug text-white">
                        {indice + 1}. {c.texto}
                      </span>
                    }
                    onChange={(valor) =>
                      setMarcadas((atual) => (valor ? [...atual, c.id] : atual.filter((id) => id !== c.id)))
                    }
                  />
                </li>
              );
            })}
          </ol>

          <Button
            theme="dark"
            variant="light"
            fullWidth
            isLoading={enviando}
            loadingText="Enviando…"
            disabled={enviando}
            onClick={() => void enviar()}
          >
            Enviar
          </Button>
        </>
      ) : !erro ? (
        <p className="text-[14px] text-white/60">abrindo…</p>
      ) : null}

      {erro ? <p className="text-[13px] text-brand-coral">{erro}</p> : null}
    </section>
  );
}

// ── 6c Mandar pra quem não viu ───────────────────────────────────────────

const MAXIMO_DE_POSTS = 3;
const MAXIMO_DA_FRASE = 140;

export function Envio({ runId, aoEnviar }: { runId: string; aoEnviar: () => void }) {
  const [dados, setDados] = useState<EnvioDaApi | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [frase, setFrase] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .get<EnvioDaApi>(`/runs/${runId}/envio`)
      .then((corpo) => ativo && setDados(corpo))
      .catch(() => ativo && setErro('Não deu pra abrir agora. Tenta de novo daqui a pouco.'));
    return () => {
      ativo = false;
    };
  }, [runId]);

  const cheio = escolhidos.length >= MAXIMO_DE_POSTS;
  const podeEnviar = escolhidos.length > 0 && mensagem !== '' && !enviando;
  const restam = useMemo(() => MAXIMO_DA_FRASE - frase.length, [frase]);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/runs/${runId}/envio`, {
        posts: escolhidos,
        mensagem,
        frase: frase.trim() ? frase.trim() : null,
      });
      aoEnviar();
    } catch {
      setErro('Não deu pra enviar agora. Tenta de novo — suas escolhas estão aqui.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-label="Mandar pra quem não viu" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-widest text-white/60">mandar pra quem não viu</p>
        <h1 className="text-[18px] font-bold leading-snug">
          Um colega de outra turma não viu nada e perguntou: “o que estão discutindo aí?”.
        </h1>
        <p className="text-[15px] leading-snug text-white/80">Escolha até 3 posts e uma mensagem para mandar.</p>
        <p className="text-[13px] leading-snug text-white/60">Isto é uma simulação: ninguém vai receber a mensagem.</p>
      </header>

      {dados ? (
        <>
          <ul className="flex flex-col gap-3" aria-label="Os posts">
            {dados.posts.map((post) => {
              const marcado = escolhidos.includes(post.id);
              const expandido = aberto === post.id;
              return (
                <li key={post.id} className="flex flex-col gap-2 rounded-xl bg-white/5 p-3">
                  <div className="flex gap-3">
                    <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/10">
                      {post.imageUrl ? (
                        <img
                          src={post.imageUrl}
                          alt={altDaImagem(post.imageAlt, post.author.handle)}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span
                          className="flex h-full w-full items-center justify-center text-[22px]"
                          style={{ background: post.fallbackArt?.corFundo }}
                        >
                          {post.fallbackArt?.emojis}
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[14px] font-semibold leading-tight text-white">{post.author.displayName}</span>
                      <span className="text-[12px] text-white/60">{post.author.handle}</span>
                      {post.bio ? <span className="text-[12px] leading-snug text-white/70">{post.bio}</span> : null}
                    </span>
                  </div>
                  {/* O texto inteiro abre com um toque: a miniatura não pode esconder o que o post diz. */}
                  <button
                    type="button"
                    className={`text-left text-[14px] leading-snug text-white/90 ${expandido ? '' : 'line-clamp-2'}`}
                    aria-expanded={expandido}
                    onClick={() => setAberto(expandido ? null : post.id)}
                  >
                    {post.caption}
                  </button>
                  <Checkbox
                    theme="dark"
                    checked={marcado}
                    disabled={enviando || (!marcado && cheio)}
                    label={<span className="text-[13px] text-white">mandar este</span>}
                    onChange={(valor) =>
                      setEscolhidos((atual) => (valor ? [...atual, post.id] : atual.filter((id) => id !== post.id)))
                    }
                  />
                </li>
              );
            })}
          </ul>

          <div className="rounded-xl bg-white/5 px-4 py-4">
            <RadioGroup
              theme="dark"
              name="mensagem"
              label={<span className="text-[15px] font-semibold leading-snug text-white">A mensagem</span>}
              options={dados.mensagens.map((m) => ({ value: m.id, label: m.texto }))}
              value={mensagem}
              disabled={enviando}
              onChange={(valor) => setMensagem(String(valor))}
            />
          </div>

          <TextArea
            theme="dark"
            label="Quer acrescentar uma frase sua?"
            helperText={`opcional · ${restam} caracteres`}
            maxLength={MAXIMO_DA_FRASE}
            value={frase}
            disabled={enviando}
            onChange={(evento) => setFrase(evento.target.value)}
          />

          <Button
            theme="dark"
            variant="light"
            fullWidth
            isLoading={enviando}
            loadingText="Enviando…"
            disabled={!podeEnviar}
            onClick={() => void enviar()}
          >
            Enviar
          </Button>
        </>
      ) : !erro ? (
        <p className="text-[14px] text-white/60">abrindo…</p>
      ) : null}

      {erro ? <p className="text-[13px] text-brand-coral">{erro}</p> : null}
    </section>
  );
}
