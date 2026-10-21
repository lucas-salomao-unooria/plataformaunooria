import { useEffect, useRef, useState } from 'react';

import { api } from '../../lib/api';
import type { DevolutivaDaApi } from '../../lib/canal-a';
import { REVELACAO_FIXA, origemDoPostNaPonte, telasDaRevelacao, type TelaDaRevelacao } from '../../lib/copy-da-revelacao';

import type { RespostaDossie } from '../../lib/dossie-tipos';

/**
 * A revelação: dez telas (nove sem o Raio-x), uma frase por vez, no ritmo do
 * estudante. A PONTE DO RAIO-X (ADR-167) é a única que lê dado: a devolutiva
 * do 6a, os 6 posts com de onde cada um veio, sem certo nem errado.
 *
 * A COPY não mora aqui — ela é a peça que carrega o argumento do produto, e o
 * professor precisa lê-la no guia antes de conduzir a aula. Fonte única em
 * `lib/copy-da-revelacao.ts`; aqui fica só o comportamento (ritmo, progresso, fade).
 */
export function Revelacao({ runId, aoTerminar }: { runId: string; aoTerminar: () => void }) {
  const [indice, setIndice] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const [origemDoLado, setOrigemDoLado] = useState<string | null>(null);
  const [rotulos, setRotulos] = useState<{ A: string; B: string } | null>(null);
  const [devolutiva, setDevolutiva] = useState<DevolutivaDaApi['posts']>([]);
  /* A ponte entra só se a devolutiva chegou antes de o estudante passar das
     quatro telas fixas: a lista de telas não pode mudar debaixo do dedo dele. */
  const indiceRef = useRef(indice);
  indiceRef.current = indice;

  /**
   * A revelação só precisa de um campo do dossiê (a origem do lado), mas precisa
   * dele antes da tela 5. O dossiê já é legível nesta fase — o disfarce caiu na
   * tela 1 — então buscar aqui não vaza nada.
   */
  useEffect(() => {
    let ativo = true;
    api
      .get<RespostaDossie>(`/runs/${runId}/dossie`)
      .then((corpo) => {
        if (!ativo) return;
        setOrigemDoLado(corpo.dossie.bolha?.ladoOrigem ?? 'sorteio');
        setRotulos({ A: corpo.dossie.atividade.ladoALabel, B: corpo.dossie.atividade.ladoBLabel });
      })
      // Sem a origem, o roteiro segue com a frase do sorteio: é a única que nunca
      // afirma mais do que se sabe.
      .catch(() => ativo && setOrigemDoLado('sorteio'));
    /* A ponte do Raio-x só entra para quem o enviou — a api devolve a lista vazia
       para os outros, e falha de rede também tira a ponte (nunca trava o roteiro). */
    api
      .get<DevolutivaDaApi>(`/runs/${runId}/raio-x/devolutiva`)
      .then((corpo) => ativo && indiceRef.current < REVELACAO_FIXA.length && setDevolutiva(corpo.posts))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [runId]);

  const comPonte = devolutiva.length > 0 && rotulos !== null;
  const telas: TelaDaRevelacao[] = telasDaRevelacao(origemDoLado ?? 'sorteio', { comPonte });

  useEffect(() => {
    setVisivel(false);
    const timer = window.setTimeout(() => setVisivel(true), 120);
    return () => window.clearTimeout(timer);
  }, [indice]);

  const tela = telas[indice]!;
  const ultima = indice === telas.length - 1;

  return (
    <div className="fixed inset-0 z-[85] flex flex-col justify-between bg-night px-7 py-14 text-white">
      <div className="flex min-h-0 flex-1 items-center overflow-y-auto overscroll-contain">
        <div
          className={`flex flex-col gap-4 transition-all duration-700 ${
            visivel ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
          }`}
        >
          <p className="text-[26px] font-semibold leading-tight">{tela.texto}</p>
          {tela.destaque ? (
            <p className="text-[30px] font-bold leading-tight text-white">{tela.destaque}</p>
          ) : null}
          {tela.complemento ? (
            <p className="text-[17px] leading-relaxed text-white/70">{tela.complemento}</p>
          ) : null}
          {tela.ponte && rotulos ? (
            <ul className="flex flex-col gap-2.5" aria-label="De onde veio cada post">
              {devolutiva.map((post) => (
                <li key={post.id} className="flex flex-col gap-0.5 border-l-2 border-white/30 pl-3">
                  <span className="text-[14px] leading-snug text-white/90">
                    <strong>{post.author.handle}</strong> {resumo(post.caption)}
                  </span>
                  <span className="text-[13px] text-white/70">{origemDoPostNaPonte(post.origem, rotulos)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex gap-1.5">
          {telas.map((_, item) => (
            <span
              key={item}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                item <= indice ? 'bg-white' : 'bg-white/25'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          className="h-12 w-full rounded-xl bg-white text-[15px] font-semibold text-night active:opacity-80"
          onClick={() => (ultima ? aoTerminar() : setIndice(indice + 1))}
        >
          {ultima ? 'Ver meu relatório' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}

/** O começo da legenda: a ponte é uma lista para reconhecer, não para reler. */
function resumo(legenda: string): string {
  return legenda.length > 90 ? `${legenda.slice(0, 87).trimEnd()}…` : legenda;
}
