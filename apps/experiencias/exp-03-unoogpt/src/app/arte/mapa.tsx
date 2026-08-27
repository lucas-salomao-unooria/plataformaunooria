import { Button, Tag } from '@edu/ui/ds-chatgpt';
import { useEffect, useRef, useState } from 'react';
import type { BairroPublico } from '../../lib/tipos';
import { VISOES, dadoDaVisao, type NivelDeRisco, type Visao } from '../../lib/visao';
import { MapaBase } from './mapa-base';
import { Navegavel, useCamera } from './mapa-navegavel';

export interface EquipeNoMapa {
  id: string;
  nome: string;
  sigla: string;
  left: string;
  top: string;
  destinoSlug: string | null;
  minutos: number | null;
  cor: 'alfa' | 'bravo';
}

/**
 * Chegar não é tudo: quem chega em cima da hora tira menos gente de casa. O
 * mapa avisa antes da decisão, não depois dela.
 *
 * O `aperto` vem RESOLVIDO do servidor (`BairroPublico.alcance`). No projeto de
 * origem isto era `folga < JANELA_CONFORTAVEL` no cliente — e `JANELA_CONFORTAVEL`
 * é parâmetro de calibragem do modelo, que não tem por que viajar no bundle.
 */

const COR_EQUIPE = {
  alfa: {
    borda: 'border-gpt-azul',
    chip: 'bg-gpt-azul',
    traco: 'var(--gpt-color-blue-500)',
    texto: 'text-gpt-azul',
  },
  bravo: {
    borda: 'border-gpt-roxo',
    chip: 'bg-gpt-roxo',
    traco: 'var(--gpt-color-purple-600)',
    texto: 'text-gpt-roxo',
  },
} as const;

/** Par fundo/texto de cada nível, medido para AA em texto pequeno. */
const COR_NIVEL: Record<NivelDeRisco, string> = {
  baixo: 'bg-gpt-superficie text-gpt-ok',
  medio: 'bg-gpt-superficie text-gpt-alerta',
  alto: 'bg-gpt-superficie text-gpt-erro',
};

const PONTO_NIVEL: Record<NivelDeRisco, string> = {
  baixo: 'bg-gpt-ok',
  medio: 'bg-gpt-alerta',
  alto: 'bg-gpt-erro',
};

const numero = (v: string) => Number.parseFloat(v);
/** Centro de um retângulo em %, no sistema 600x800 do SVG do terreno. */
const centro = (r: { left: string; top: string; w?: string; h?: string }) => ({
  x: (numero(r.left) + numero(r.w ?? '0') / 2) * 6,
  y: (numero(r.top) + numero(r.h ?? '0') / 2) * 8,
});

/**
 * O mapa de Serra do Sauá: a mesma cidade do Passo 2 ao 7, navegável.
 *
 * Arrastar move, roda aproxima, e o cartão clicado centraliza. A cidade é maior
 * que a janela de propósito: procurar um bairro é parte de investigar, e um
 * mapa que cabe inteiro na tela não se explora.
 *
 * As abas de visão só ligam depois que a Pergunta revelou a Camada. Aba não
 * revelada fica DESABILITADA com o motivo — nunca escondida.
 */
export function Mapa({
  bairros,
  camadas,
  visao,
  onVisao,
  selecionado,
  onSelecionar,
  onMandarEquipe,
  equipes = [],
  emOperacao = false,
  alerta,
  ferramentas,
}: {
  bairros: BairroPublico[];
  camadas: string[];
  visao: Visao | null;
  onVisao: (v: Visao) => void;
  selecionado?: string | null;
  onSelecionar?: (slug: string | null) => void;
  /**
   * Mandar uma equipe para o bairro selecionado, direto no mapa (board: "toque
   * em 2 bairros para enviar as equipes, sem arrastar"). Existe só na
   * Investigação: quem clica é o aluno (regra de ouro 5), e o Cientista
   * continua sem escolher nada.
   */
  onMandarEquipe?: (equipe: 'alfa' | 'bravo', slug: string) => void;
  equipes?: EquipeNoMapa[];
  /** Operação em curso: as equipes percorrem a rota na tela. */
  emOperacao?: boolean;
  alerta?: string | null;
  ferramentas?: React.ReactNode;
}) {
  const nada = camadas.length === 0;

  /**
   * Bairros que ACABARAM de ganhar dado. O mapa acendia em silêncio: o aluno
   * pedia uma fonte, lia a resposta no chat, e o mapa mudava no canto sem que
   * ele ligasse uma coisa à outra. A causa precisa ser sentida.
   */
  const [acendendo, setAcendendo] = useState<string[]>([]);
  const cobertosAntes = useRef<string[]>([]);

  useEffect(() => {
    const agora = bairros.filter((b) => (b.estimativa?.cobertura ?? 0) > 0).map((b) => b.slug);
    const novos = agora.filter((s) => !cobertosAntes.current.includes(s));
    cobertosAntes.current = agora;
    if (novos.length === 0) return;

    setAcendendo(novos);
    const fim = setTimeout(() => setAcendendo([]), 1800);
    return () => clearTimeout(fim);
  }, [bairros]);
  const { camera, mover, aproximar, enquadrar, focar, medir } = useCamera();
  const [expandido, setExpandido] = useState(false);

  const controles = [
    { rotulo: '+', titulo: 'Aproximar', acao: () => aproximar(1.25) },
    { rotulo: '−', titulo: 'Afastar', acao: () => aproximar(0.8) },
    { rotulo: '⊙', titulo: 'Ver o máximo possível', acao: enquadrar },
    {
      rotulo: expandido ? '↙' : '↗',
      titulo: expandido ? 'Voltar ao painel' : 'Abrir em tela cheia',
      acao: () => setExpandido((v) => !v),
    },
  ];

  return (
    <section
      className={
        expandido
          ? 'fixed inset-0 z-50 flex flex-col bg-gpt-superficie p-4'
          : 'flex h-full min-h-0 w-full flex-col border-l border-gpt-borda bg-gpt-superficie p-3'
      }
    >
      {/* Título e visões na MESMA linha: a barra de abas ocupando a largura
          toda parecia navegação principal e competia com a trilha da Missão. */}
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-gpt-tinta">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-gpt-suave-40">
            Mapa operacional
          </span>
          Serra do Sauá
        </p>
        <div className="flex gap-1 rounded-gpt-md bg-gpt-fundo p-1">
          {VISOES.map((v) => (
            // Aba nunca bloqueia: desabilitada, parece defeito. Sem dados ela
            // abre e mostra o vazio, que é a informação verdadeira.
            <Tag key={v.id} selected={visao === v.id} glyph={null} onClick={() => onVisao(v.id)}>
              {v.rotulo}
            </Tag>
          ))}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <Navegavel camera={camera} mover={mover} medir={medir}>
          <MapaBase />

          {/* Mancha de calor: só onde o risco alto já foi revelado. */}
          {visao === 'risco' &&
            bairros.map((b) => {
              const dado = dadoDaVisao(b.estimativa ?? undefined, 'risco');
              if (!dado?.selo || dado.selo.nivel !== 'alto') return null;
              const c = centro(b);
              return (
                <div
                  key={`calor-${b.slug}`}
                  aria-hidden
                  className="pointer-events-none absolute rounded-gpt-full"
                  style={{
                    left: `${c.x / 6}%`,
                    top: `${c.y / 8}%`,
                    width: '58%',
                    height: '34%',
                    transform: 'translate(-50%, -50%)',
                    background:
                      'radial-gradient(circle, color-mix(in srgb, var(--gpt-status-error) 22%, transparent) 0%, transparent 70%)',
                  }}
                />
              );
            })}

          <svg
            viewBox="0 0 600 800"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            {equipes.map((e) => {
              const destino = bairros.find((b) => b.slug === e.destinoSlug);
              if (!destino) return null;
              const de = centro({ left: e.left, top: e.top, w: '0%', h: '0%' });
              const para = centro(destino);
              const rota = `M${de.x} ${de.y} C ${de.x} ${(de.y + para.y) / 2}, ${para.x} ${(de.y + para.y) / 2}, ${para.x} ${para.y}`;
              return (
                <g key={e.id}>
                  <path
                    d={rota}
                    stroke={COR_EQUIPE[e.cor].traco}
                    strokeWidth="3"
                    strokeDasharray="8 7"
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* A equipe percorrendo a rota. animateMotion segue a MESMA
                      curva do traçado — interpolar left/top faria o comboio
                      cortar caminho por fora da estrada desenhada. */}
                  {emOperacao && (
                    <>
                      <circle r="14" fill={COR_EQUIPE[e.cor].traco} opacity="0.25">
                        <animateMotion dur="4.5s" fill="freeze" path={rota} />
                      </circle>
                      <circle
                        r="7"
                        fill={COR_EQUIPE[e.cor].traco}
                        stroke="var(--gpt-bg-primary)"
                        strokeWidth="2"
                      >
                        <animateMotion dur="4.5s" fill="freeze" path={rota} />
                      </circle>
                    </>
                  )}
                  <circle cx={para.x} cy={para.y} r="5" fill={COR_EQUIPE[e.cor].traco} />
                </g>
              );
            })}
          </svg>

          {bairros.map((b) => {
            const dado = visao ? dadoDaVisao(b.estimativa ?? undefined, visao) : null;

            /**
             * Alcance: o tempo de viagem conta A PARTIR DE AGORA. Um bairro que
             * era alcançável às 17h00 pode não ser mais às 17h24 — e o aluno
             * precisa ver a porta fechando, não descobrir no Resultado.
             */
            const alcance = visao === 'alcance' ? b.alcance : null;
            const equipe = equipes.find((e) => e.destinoSlug === b.slug);
            const ativo = selecionado === b.slug;
            return (
              <article
                key={b.slug}
                /* Contrato com o smoke visual (README da exp): é por ele que o
                   teste conta os bairros desenhados e confere que o mapa começa
                   VAZIO. Sem um marcador estável a asserção viraria texto, e
                   texto muda com a copy. */
                data-bairro={b.slug}
                data-com-dado={b.estimativa !== null}
                data-nao-arrasta
                style={{ left: b.left, top: b.top, width: b.w }}
                onClick={() => {
                  onSelecionar?.(ativo ? null : b.slug);
                  if (!ativo) focar(numero(b.left) + numero(b.w) / 2, numero(b.top) + 6);
                }}
                className={`absolute cursor-pointer rounded-gpt-xl border-2 bg-gpt-fundo px-3.5 py-3 shadow-md transition ${
                  acendendo.includes(b.slug) ? 'animate-acender ' : ''
                }${
                  ativo
                    ? 'border-gpt-borda-forte'
                    : equipe
                      ? COR_EQUIPE[equipe.cor].borda
                      : 'border-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold leading-tight text-gpt-tinta">{b.nome}</p>
                  {dado?.selo && (
                    <span
                      className={`shrink-0 rounded-gpt-md px-2 py-1 text-xs font-bold ${COR_NIVEL[dado.selo.nivel]}`}
                    >
                      {dado.selo.texto}
                    </span>
                  )}
                </div>
                {visao === 'alcance' && !b.tempos && (
                  <p className="mt-1.5 text-sm leading-snug text-gpt-suave-40">
                    Sem o mapa de estradas, não dá para saber se a equipe chega
                  </p>
                )}

                {alcance && (
                  <div className="mt-1.5 grid gap-0.5 text-sm">
                    <p
                      className={
                        !alcance.alfa.passa
                          ? 'text-gpt-erro'
                          : alcance.alfa.aperto
                            ? 'text-gpt-alerta'
                            : 'text-gpt-ok'
                      }
                    >
                      Alfa:{' '}
                      {alcance.alfa.passa
                        ? `chega em ${b.tempos!.alfa} min${alcance.alfa.aperto ? ' — em cima da hora' : ''}`
                        : '—'}
                    </p>
                    <p
                      className={
                        !alcance.bravo.passa
                          ? 'text-gpt-erro'
                          : alcance.bravo.aperto
                            ? 'text-gpt-alerta'
                            : 'text-gpt-ok'
                      }
                    >
                      Bravo:{' '}
                      {alcance.bravo.passa
                        ? `chega em ${b.tempos!.bravo} min${alcance.bravo.aperto ? ' — em cima da hora' : ''}`
                        : '—'}
                    </p>
                    {!alcance.alfa.passa && !alcance.bravo.passa && (
                      <p className="text-xs leading-snug text-gpt-suave-60">
                        {alcance.bravo.motivo ?? alcance.alfa.motivo}
                      </p>
                    )}
                  </div>
                )}

                {dado ? (
                  <>
                    <p className="mt-1.5 text-sm leading-snug text-gpt-tinta">{dado.linha}</p>
                    {dado.faixa && (
                      <p className="text-xs leading-snug text-gpt-suave-60">{dado.faixa}</p>
                    )}
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gpt-suave-40">
                      confiança {dado.confianca}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-sm leading-snug text-gpt-suave-40">
                    O Cientista ainda não tem dados daqui
                  </p>
                )}
                {equipe && (
                  <p className={`mt-2 text-sm font-semibold ${COR_EQUIPE[equipe.cor].texto}`}>
                    {equipe.nome} ✓
                  </p>
                )}
                {/* Decidir sem passar pelo chat. O aluno que não sabe escrever a
                    frase — ou que ficou sem tempo — ainda tem para onde clicar. */}
                {ativo && onMandarEquipe && (
                  <div className="mt-2.5 flex gap-2 border-t border-gpt-borda pt-2.5">
                    {(['alfa', 'bravo'] as const).map((eq) => {
                      const jaEsta = equipes.find((x) => x.id === eq)?.destinoSlug === b.slug;
                      return (
                        // `Button` do pacote, com a superfície trocada pela cor
                        // da Equipe: é a cor que identifica quem vai, e ela
                        // precisa ser a mesma do pino no mapa. Nenhuma variante
                        // do kit carrega essa informação.
                        <Button
                          key={eq}
                          size="sm"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (!jaEsta) onMandarEquipe(eq, b.slug);
                          }}
                          disabled={jaEsta}
                          className={`flex-1 !text-gpt-tinta-inv ${COR_EQUIPE[eq].chip}`}
                        >
                          {jaEsta
                            ? `${eq === 'alfa' ? 'Alfa' : 'Bravo'} já vai`
                            : `Mandar ${eq === 'alfa' ? 'Alfa' : 'Bravo'}`}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}

          {equipes.map((e) => (
            <article
              key={e.id}
              data-nao-arrasta
              style={{ left: e.left, top: e.top, transform: 'translate(-50%, -50%)' }}
              className={`absolute flex items-center gap-3 rounded-gpt-xl border-2 bg-gpt-fundo px-3.5 py-3 shadow-md ${COR_EQUIPE[e.cor].borda}`}
            >
              <div>
                <p className="text-base font-semibold leading-tight text-gpt-tinta">{e.nome}</p>
                {e.minutos !== null && (
                  <p className="mt-1 text-sm leading-snug text-gpt-suave-60">
                    {e.minutos} min até o destino
                  </p>
                )}
              </div>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-gpt-md text-xs font-bold text-gpt-tinta-inv ${COR_EQUIPE[e.cor].chip}`}
              >
                {e.sigla}
              </span>
            </article>
          ))}
        </Navegavel>

        {/* Controles ficam FORA da área arrastável: senão disputam o ponteiro. */}
        <div className="absolute right-3 top-3 flex flex-col gap-1">
          {controles.map((c) => (
            <button
              key={c.titulo}
              onClick={c.acao}
              title={c.titulo}
              aria-label={c.titulo}
              className="grid h-8 w-8 place-items-center rounded-gpt-md border border-gpt-borda bg-gpt-fundo text-sm font-semibold text-gpt-tinta shadow-sm hover:bg-gpt-superficie"
            >
              {c.rotulo}
            </button>
          ))}
        </div>

        {ferramentas && (
          <div className="absolute left-3 right-14 top-3 flex flex-wrap items-center gap-2 rounded-gpt-xl border border-gpt-borda bg-gpt-fundo/95 p-2 text-xs shadow-sm">
            {ferramentas}
          </div>
        )}

        {alerta && (
          <p className="absolute bottom-3 left-3 right-3 rounded-gpt-md border border-gpt-alerta bg-gpt-superficie/95 px-3 py-2 text-[11px] font-medium text-gpt-alerta shadow-sm">
            ⚠ {alerta}
          </p>
        )}
      </div>

      <footer className="mt-2 flex items-center justify-between gap-2 text-[10px] text-gpt-suave-60">
        {visao === 'risco' ? (
          <span className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider">Risco de alagamento</span>
            {(['baixo', 'medio', 'alto'] as const).map((n) => (
              <span key={n} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-gpt-full ${PONTO_NIVEL[n]}`} aria-hidden />
                {n === 'medio' ? 'Médio' : n === 'alto' ? 'Alto' : 'Baixo'}
              </span>
            ))}
          </span>
        ) : (
          <span>
            {nada ? 'O Cientista ainda não consultou nada.' : 'O que os dados em uso mostram.'}
          </span>
        )}
        <span>
          Arraste para mover · roda para aproximar ·{' '}
          {camadas.length === 1 ? '1 fonte em uso' : `${camadas.length} fontes em uso`}
        </span>
      </footer>

      {nada && !expandido && (
        <p className="mt-2 rounded-gpt-xl border border-gpt-borda bg-gpt-fundo p-3 text-[11px] leading-snug text-gpt-suave-60">
          <strong className="block text-xs text-gpt-tinta">O mapa está no escuro.</strong>
          Ele mostra os bairros e nada mais. Peça ao Cientista para consultar alguma coisa — e o
          mapa passa a mostrar o que aquilo enxerga, só isso.
        </p>
      )}
    </section>
  );
}
