import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { RespostaDossie } from '../../lib/dossie-tipos';

interface Tela {
  texto: string;
  destaque?: string;
  complemento?: string;
}

/**
 * FASE 5 do doc 02 (~2min, no ritmo do aluno): uma ideia por tela, fundo escuro,
 * tipografia grande, transições lentas — sinaliza "saímos do jogo".
 * O tom nunca humilha: o sujeito da frase é o sistema, não o aluno.
 */
const TELAS_FIXAS: Tela[] = [
  {
    texto: 'O Instanooria não é uma rede social de verdade. É uma simulação.',
    complemento: 'Nenhum dado seu saiu daqui.',
  },
  { texto: 'Mas uma coisa aqui era 100% real:', destaque: 'o algoritmo.' },
  {
    texto: 'Enquanto você rolava, ele media',
    destaque: 'cada segundo',
    complemento: 'que você parava em cada post. Cada curtida. Cada comentário aberto.',
  },
  { texto: 'E com isso, ele escolheu', destaque: 'o que você viu — e o que você nunca viu.' },
];

/** A última tela fecha sempre igual: o problema é do sistema, não do aluno. */
const TELA_FINAL: Tela = {
  texto: 'Isso acontece com todo mundo — inclusive com adultos.',
  complemento: 'É assim que as redes que você usa funcionam.',
};

/**
 * Tela 5 (doc 02 fase 5) — o lado semeado. A frase MUDA com a origem do lado:
 * dizer "foi escolhido a partir de como você jogou" para quem caiu no sorteio
 * seria mentir na única tela do exercício que existe para não mentir.
 */
function telaDoLadoSemeado(origem: string): Tela {
  if (origem === 'perfil') {
    return {
      texto: 'Tem mais: seu feed',
      destaque: 'já começou puxado para um dos dois lados.',
      complemento:
        'E não foi sorteio — foi escolhido a partir de como você jogou, antes de você abrir o Instanooria.',
    };
  }

  if (origem === 'redistribuido') {
    return {
      texto: 'Tem mais: seu feed',
      destaque: 'já começou puxado para um dos dois lados.',
      complemento:
        'O seu foi ajustado para a turma não ficar toda do mesmo lado — mas ninguém te avisou disso.',
    };
  }

  return {
    texto: 'Tem mais: seu feed',
    destaque: 'já começou puxado para um dos dois lados.',
    complemento: 'No seu caso o lado foi sorteado. Você não escolheu, e ninguém te avisou.',
  };
}

/**
 * Tela 6 (doc 02 fase 5) — a linguagem. É **obrigatória** (doc 10 §6.5): usar o
 * perfil de valores para escolher como falar com o aluno e depois esconder que
 * isso aconteceu seria repetir exatamente o que o exercício critica.
 */
const TELA_DA_LINGUAGEM: Tela = {
  texto: 'E ele também escolheu',
  destaque: 'como falar com você.',
  complemento:
    'O mesmo argumento foi escrito de quatro jeitos diferentes; você recebeu mais o jeito que combina com o que te move.',
};

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

  const telas: Tela[] = [
    ...TELAS_FIXAS,
    telaDoLadoSemeado(origemDoLado ?? 'sorteio'),
    TELA_DA_LINGUAGEM,
    TELA_FINAL,
  ];

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
