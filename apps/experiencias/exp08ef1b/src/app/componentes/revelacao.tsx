import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import { telasDaRevelacao, type TelaDaRevelacao } from '../../lib/copy-da-revelacao';

import type { RespostaDossie } from '../../lib/dossie-tipos';

/**
 * A revelação: sete telas, uma frase por vez, no ritmo do estudante.
 *
 * A COPY não mora aqui — ela é a peça que carrega o argumento do produto, e o
 * professor precisa lê-la no guia antes de conduzir a aula. Fonte única em
 * `lib/copy-da-revelacao.ts`; aqui fica só o comportamento (ritmo, progresso, fade).
 */
export function Revelacao({ runId, aoTerminar }: { runId: string; aoTerminar: () => void }) {
  const [indice, setIndice] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const [origemDoLado, setOrigemDoLado] = useState<string | null>(null);

  /**
   * A revelação só precisa de um campo do dossiê (a origem do lado), mas precisa
   * dele antes da tela 5. O dossiê já é legível nesta fase — o disfarce caiu na
   * tela 1 — então buscar aqui não vaza nada.
   */
  useEffect(() => {
    let ativo = true;
    api
      .get<RespostaDossie>(`/runs/${runId}/dossie`)
      .then((corpo) => ativo && setOrigemDoLado(corpo.dossie.bolha?.ladoOrigem ?? 'sorteio'))
      // Sem a origem, o roteiro segue com a frase do sorteio: é a única que nunca
      // afirma mais do que se sabe.
      .catch(() => ativo && setOrigemDoLado('sorteio'));
    return () => {
      ativo = false;
    };
  }, [runId]);

  const telas: TelaDaRevelacao[] = telasDaRevelacao(origemDoLado ?? 'sorteio');

  useEffect(() => {
    setVisivel(false);
    const timer = window.setTimeout(() => setVisivel(true), 120);
    return () => window.clearTimeout(timer);
  }, [indice]);

  const tela = telas[indice]!;
  const ultima = indice === telas.length - 1;

  return (
    <div className="fixed inset-0 z-[85] flex flex-col justify-between bg-night px-7 py-14 text-white">
      <div className="flex flex-1 items-center">
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
