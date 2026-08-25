import { Suspense, lazy, useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type { RespostaDossie } from '../../../lib/dossie-tipos';

import { dossieEmPng, dossieEmTexto } from './exportar';

/**
 * O RELATÓRIO do aluno — a explicabilidade.
 *
 * Passou de 13 seções (≈5.900px de rolagem) para **6 blocos**. O corte foi de
 * design, não de preguiça: é uma criança de 13 anos no fim de 40 minutos de
 * atividade, e informação demais não informa — cansa. A regra que usei foi **um
 * número e uma ideia por bloco**.
 *
 * O que ficou, e por quê:
 *
 * 1. **Seu mundo** — de que era feito o feed dele. Um gráfico só (o donut).
 * 2. **Por que começou desse lado** — o coração da explicabilidade. Intacto.
 * 3. **Você virou o jogo?** — fundido com o tempo de tela: são a mesma pergunta
 *    ("para onde você foi, e quanto tempo ficou lá").
 * 4. **O que te prendeu** — top 3, e os sinais viraram três números em vez de
 *    tabela com pontuação.
 * 5. **O jeito de falar com você** — só aparece quando há dado para dizer algo.
 * 6. **A pergunta e sua resposta** — o fechamento.
 *
 * O que saiu, e por quê:
 *
 * - **"O que você nunca viu"** ganhou um estágio próprio no fluxo v2 (a tela em
 *   cinza dos posts perdidos). Repetir aqui enfraqueceria as duas.
 * - **O gráfico da escalada** era abstrato demais para a idade; virou uma frase.
 * - **A tabela de sinais com pontuação** parecia boletim. Os números que importam
 *   ("você não precisou curtir nada") entraram como texto.
 * - **Uso da busca** é dado valioso — mas para o PROFESSOR. Virou uma linha.
 *
 * O export em texto continua completo: quem quiser tudo tem tudo, só não na cara
 * do aluno.
 */
const Graficos = lazy(() =>
  import('./graficos').then((modulo) => ({ default: modulo.PainelDeGraficos })),
);

export function Dossie({ runId }: { runId: string }) {
  const [dados, setDados] = useState<RespostaDossie | null>(null);
  const [erro, setErro] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    /**
     * Não marca fase nenhuma. No fluxo v2 o relatório é um PASSO INTERNO da
     * explicabilidade (`explicabilidade.tsx`), e a rota que existia aqui movia a
     * run para `dossie` — fase que o relógio da turma não conhece, o que fazia o
     * polling devolver "onboarding" e expulsar o aluno para o seletor de avatar.
     */
    api
      .get<RespostaDossie>(`/runs/${runId}/dossie`)
      .then((corpo) => ativo && setDados(corpo))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [runId]);

  const mostrar = (mensagem: string) => {
    setAviso(mensagem);
    window.setTimeout(() => setAviso(null), 2200);
  };

  if (erro) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-night px-8 text-center text-white">
        <p className="text-[17px] font-semibold">Algo deu errado ao montar seu relatório</p>
        <button
          type="button"
          className="rounded-lg bg-white px-5 py-2 text-[14px] font-semibold text-night"
          onClick={() => window.location.reload()}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-night">
        <p className="text-[15px] text-white/70">montando seu relatório…</p>
      </div>
    );
  }

  const { dossie, posts } = dados;
  const pct = (valor: number) => `${Math.round(valor * 100)}%`;
  const semBolha = dossie.ladoDominante === 'indefinido';

  const rotuloDoLado = (lado: 'A' | 'B') =>
    lado === 'A' ? dossie.atividade.ladoALabel : dossie.atividade.ladoBLabel;
  const rotuloDominante = semBolha ? null : rotuloDoLado(dossie.ladoDominante as 'A' | 'B');
  const ladoSemeado = dossie.bolha.ladoInicial;
  const outroLado = ladoSemeado === 'A' ? 'B' : 'A';

  /** "3min20s" / "48s" — minuto só aparece quando existe. */
  const duracao = (ms: number) => {
    const total = Math.round(ms / 1000);
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return minutos > 0 ? `${minutos}min${String(segundos).padStart(2, '0')}s` : `${segundos}s`;
  };

  /** A escalada, que era um gráfico, virou uma frase — quando houve escalada. */
  const escalada = (() => {
    const blocos = dossie.porBloco.filter((bloco) => bloco.intensidadeMediaDominante > 0);
    if (blocos.length < 3) return null;
    const inicio = blocos[0]!.intensidadeMediaDominante;
    const fim = blocos[blocos.length - 1]!.intensidadeMediaDominante;
    return fim - inicio >= 0.4 ? { inicio, fim } : null;
  })();

  const tempoSemeado = dossie.tempo.porLadoMs[ladoSemeado];
  const tempoOutro = dossie.tempo.porLadoMs[outroLado];

  return (
    <div className="min-h-dvh bg-night pb-28 text-white">
      <div className="mx-auto flex w-full max-w-phone flex-col gap-9 px-6 pt-12">
        <header className="flex flex-col gap-2">
          <p className="text-[12px] uppercase tracking-widest text-white/60">seu relatório</p>
          <h1 className="text-[26px] font-bold leading-tight">
            {semBolha ? (
              <>
                Seu feed ficou <span className="text-brand-coral">equilibrado</span>
              </>
            ) : (
              <>
                Seu feed virou um feed de:
                <br />
                <span className="text-brand-coral">{rotuloDominante}</span>
              </>
            )}
          </h1>
        </header>

        {/* 1. de que era feito o feed dele */}
        <Bloco numero="1" titulo="Seu mundo">
          <Suspense
            fallback={<p className="py-6 text-center text-[13px] text-white/50">montando o gráfico…</p>}
          >
            <Graficos dossie={dossie} apenas="donut" />
          </Suspense>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              [dossie.atividade.ladoALabel, pct(dossie.proporcaoFinal.A)],
              [dossie.atividade.ladoBLabel, pct(dossie.proporcaoFinal.B)],
              ['Outros assuntos', pct(dossie.proporcaoFinal.neutro)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-xl bg-white/5 p-3">
                <dd className="text-[20px] font-bold">{valor}</dd>
                <dt className="text-[11px] leading-tight text-white/60">{rotulo}</dt>
              </div>
            ))}
          </dl>
          {escalada ? (
            <p className="mt-3 text-[13px] leading-relaxed text-white/70">
              E o tom foi ficando mais forte: os primeiros posts eram mais calmos que os últimos. Você
              não pediu isso.
            </p>
          ) : null}
        </Bloco>

        {/* 2. o coração da explicabilidade */}
        <Bloco numero="2" titulo="Por que seu feed começou desse lado">
          <div className="flex flex-col gap-3 rounded-xl bg-white/5 p-4 text-[15px] leading-relaxed">
            {dossie.explicacaoDoLado.origem === 'perfil' ? (
              <>
                <p>
                  No jogo, o que mais te move é{' '}
                  <strong className="text-brand-coral">{dossie.explicacaoDoLado.perfilRotulo}</strong>.
                </p>
                <p>
                  Neste debate, o lado que fala essa língua é{' '}
                  <strong>{dossie.explicacaoDoLado.ladoRotulo}</strong>
                  {dossie.explicacaoDoLado.porQue ? ` — ${dossie.explicacaoDoLado.porQue}` : ''}.
                </p>
              </>
            ) : dossie.explicacaoDoLado.origem === 'redistribuido' ? (
              <p>
                Seu feed começou em <strong>{dossie.explicacaoDoLado.ladoRotulo}</strong>, e esse lado foi
                ajustado para a turma não ficar toda igual.
              </p>
            ) : (
              <p>
                Seu feed começou em <strong>{dossie.explicacaoDoLado.ladoRotulo}</strong>. Não tínhamos seu
                resultado do jogo, então o lado foi sorteado.
              </p>
            )}
            <p className="text-white/70">Você não escolheu, e ninguém te avisou.</p>
          </div>
        </Bloco>

        {/* 3. para onde ele foi, e quanto tempo ficou lá */}
        <Bloco numero="3" titulo="Você virou o jogo?">
          <div className="flex items-center gap-3">
            <Pastilha rotulo="começou em" valor={rotuloDoLado(ladoSemeado)} />
            <span className="text-[18px] text-white/40">→</span>
            <Pastilha
              rotulo="terminou em"
              valor={semBolha ? 'nenhum lado' : (rotuloDominante as string)}
              destaque={dossie.bolha.inverteu}
            />
          </div>

          <p className="mt-3 text-[15px] leading-relaxed">
            {dossie.bolha.inverteu ? (
              <>
                <strong>Você virou o jogo no meio do caminho</strong> — e isso é mais raro do que parece.
              </>
            ) : semBolha ? (
              <>Você distribuiu sua atenção entre os dois lados.</>
            ) : (
              <>Seu feed começou e terminou do mesmo lado.</>
            )}
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-2">
            {[
              [`tempo em ${rotuloDoLado(ladoSemeado)}`, duracao(tempoSemeado)],
              ['tempo no outro lado', duracao(tempoOutro)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-xl bg-white/5 p-3">
                <dd className="text-[19px] font-bold">{valor}</dd>
                <dt className="text-[11px] leading-tight text-white/60">{rotulo}</dt>
              </div>
            ))}
          </dl>
          {tempoOutro > 0 && tempoSemeado > tempoOutro * 2 ? (
            <p className="mt-2 text-[13px] leading-relaxed text-white/60">
              {Math.round(tempoSemeado / Math.max(1, tempoOutro))}× mais tempo num lado que no outro. Ninguém
              tem noção disso enquanto rola.
            </p>
          ) : null}
        </Bloco>

        {/* 4. o que prendeu, e o que bastou para o sistema ler */}
        <Bloco numero="4" titulo="O que te prendeu">
          <ul className="flex flex-col gap-3">
            {posts.topDwell.slice(0, 3).map((post, indice) => (
              <li key={post.id} className="flex items-center gap-3">
                <span className="w-4 text-[13px] font-bold text-white/60">{indice + 1}</span>
                <Miniatura post={post} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{post.handle}</p>
                  <p className="line-clamp-2 text-[12px] leading-snug text-white/60">{post.caption}</p>
                </div>
                <span className="shrink-0 text-[15px] font-bold text-brand-coral">
                  {post.segundos.toString().replace('.', ',')}s
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[14px] leading-relaxed text-white/80">
            Você não precisou curtir nada para isso acontecer: parar mais tempo num tipo de post já é
            resposta suficiente.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
            No total: {dossie.interacoes.curtidas} curtida(s) · {dossie.interacoes.comentarios} comentário(s)
            · {dossie.interacoes.salvos} post(s) salvo(s)
            {dossie.investigacao.usosDaBusca > 0
              ? ` · e você abriu a busca ${dossie.investigacao.usosDaBusca}× (ela nunca foi filtrada por lado)`
              : ' · e existia uma busca ali, sem filtro de lado, que você não abriu'}
            .
          </p>

          {dossie.studentPost ? (
            <blockquote className="mt-3 rounded-xl bg-white/5 p-3 text-[14px] leading-snug">
              você publicou: “{dossie.studentPost.texto}”
            </blockquote>
          ) : null}
        </Bloco>

        {/* 5. só aparece quando há o que dizer */}
        {dossie.perfilObservado.veredito !== 'sem_referencia' ? (
          <Bloco
            numero="5"
            titulo="O jeito de falar com você"
            subtitulo="O mesmo argumento foi escrito de quatro jeitos. Estes te seguraram mais."
          >
            <ul className="flex flex-col gap-2">
              {dossie.rotulosDePerfil.map((perfil) => {
                const fatia = dossie.perfilObservado.normalizado[perfil.chave] ?? 0;
                const doJogo = dossie.perfilJogo?.dominante === perfil.chave;
                return (
                  <li key={perfil.chave} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-semibold">
                        {perfil.rotulo}
                        {doJogo ? <span className="ml-1.5 text-[11px] text-white/50">(o do jogo)</span> : null}
                      </span>
                      <span className="text-[13px] font-bold text-white/80">{pct(fatia)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${doJogo ? 'bg-brand-coral' : 'bg-white/50'}`}
                        style={{ width: `${Math.round(fatia * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[14px] leading-relaxed">
              {dossie.perfilObservado.veredito === 'reforcou' ? (
                <>
                  O jeito que mais te segurou foi <strong>o mesmo</strong> que o jogo apontou. É uma pista de
                  que a mira acertou — não uma definição de quem você é.
                </>
              ) : (
                <>
                  O jeito que mais te segurou foi <strong>outro</strong>, e isso é interessante — não errado.
                  Ninguém muda de valores em 15 minutos: o que muda é o que prende a atenção em cada
                  situação.
                </>
              )}
            </p>
          </Bloco>
        ) : null}

        {/* 6. o fechamento */}
        <section className="-mx-6 flex flex-col gap-4 bg-white/5 px-6 py-10">
          <p className="text-[12px] uppercase tracking-widest text-white/60">a pergunta</p>
          <p className="text-[22px] font-bold leading-tight">{dossie.atividade.perguntaChave}</p>

          {dossie.conclusao ? (
            <div className="flex flex-wrap items-center gap-2">
              <Pastilha rotulo="seu feed começou em" valor={rotuloDoLado(ladoSemeado)} />
              <Pastilha
                rotulo="você respondeu"
                valor={
                  dossie.conclusao.inclinacao === 'duvida'
                    ? 'ainda em dúvida'
                    : rotuloDoLado(dossie.conclusao.inclinacao)
                }
                destaque={dossie.conclusao.inclinacao === ladoSemeado}
              />
            </div>
          ) : null}

          <p className="text-[16px] font-semibold leading-relaxed text-brand-coral">
            Sua resposta seria a mesma se o feed tivesse começado do outro lado?
          </p>
        </section>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="h-12 rounded-xl bg-white text-[15px] font-semibold text-night active:opacity-80"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(dossieEmTexto(dados));
                mostrar('Relatório copiado');
              } catch {
                mostrar('Não deu para copiar aqui');
              }
            }}
          >
            Copiar relatório (texto)
          </button>

          <button
            type="button"
            className="h-12 rounded-xl border border-white/25 text-[15px] font-semibold text-white active:opacity-80"
            onClick={async () => {
              const blob = await dossieEmPng(dados);
              if (!blob) {
                mostrar('Não deu para gerar a imagem');
                return;
              }
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `relatorio-${dossie.aluno.displayName.replace(/\s+/g, '-').toLowerCase()}.png`;
              link.click();
              URL.revokeObjectURL(url);
              mostrar('Imagem baixada');
            }}
          >
            Baixar imagem (PNG)
          </button>
        </div>

        <footer className="sticky bottom-0 -mx-6 border-t border-white/10 bg-night/95 px-6 py-4 text-[11px] leading-relaxed text-white/60 backdrop-blur">
          Simulação educacional. Perfis e posts gerados por IA. O perfil do jogo é uma pista sobre aquele
          dia, não uma definição de quem você é.
        </footer>
      </div>

      {aviso ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-10 flex justify-center px-8">
          <span className="rounded-lg bg-white px-4 py-2.5 text-[13px] font-semibold text-night">{aviso}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Um bloco do relatório. `numero` existe para dar noção de progresso — seis
 * blocos numerados dizem "isto acaba", que num relatório longo importa mais do
 * que parece.
 */
function Bloco({
  numero,
  titulo,
  subtitulo,
  children,
}: {
  numero: string;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className="text-[12px] uppercase tracking-widest text-white/60">{numero}</p>
        <h2 className="text-[20px] font-bold leading-tight">{titulo}</h2>
        {subtitulo ? <p className="mt-1 text-[13px] leading-snug text-white/60">{subtitulo}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Par rótulo/valor usado no "começou em → terminou em". */
function Pastilha({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <span
      className={`flex flex-col rounded-xl px-3 py-2 ${
        destaque ? 'bg-brand-coral/20 text-brand-coral' : 'bg-white/5 text-white'
      }`}
    >
      <span className="text-[10px] uppercase tracking-wide opacity-60">{rotulo}</span>
      <span className="text-[14px] font-bold leading-tight">{valor}</span>
    </span>
  );
}

function Miniatura({ post }: { post: { imageUrl: string | null; fallbackArt: { corFundo: string; emojis: string } } }) {
  return (
    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md">
      {post.imageUrl ? (
         
        <img src={post.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-[18px]"
          style={{ background: post.fallbackArt.corFundo }}
        >
          {post.fallbackArt.emojis}
        </span>
      )}
    </span>
  );
}
