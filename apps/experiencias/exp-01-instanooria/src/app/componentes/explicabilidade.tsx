import { Suspense, lazy, useState } from 'react';

import { experiencia } from '../../lib/api';

import { Revelacao } from './revelacao';

/**
 * A EXPLICABILIDADE: a revelação e, em seguida, o relatório.
 *
 * Por que as duas moram num componente só, e não em duas fases:
 *
 * O cliente marcava `fase = "dossie"` ao terminar a revelação, mas o servidor
 * continuava em `explicabilidade` — e o polling do relógio da turma, vendo a
 * divergência, empurrava o aluno de volta para a revelação. A cada 5 segundos.
 * Reassistir a revelação em loop é o pior desfecho possível para esta tela.
 *
 * A troca de passo é estado LOCAL. O servidor não precisa saber se o aluno já
 * passou dos 7 slides; ele precisa saber que o aluno está na explicabilidade.
 *
 * O HUB, esse sim, precisa saber: é o passo que tira o relatório do aparelho de
 * 375px e o abre em tela cheia (`ExpHost`). Por isso o `enviarEstado` daqui, e
 * por isso ele carrega a FASE junto — o hub SUBSTITUI o estado inteiro a cada
 * mensagem, e publicar só o passo apagaria a fase que a moldura dos perdidos lê.
 */
const Relatorio = lazy(() =>
  import('./dossie/dossie').then((modulo) => ({ default: modulo.Dossie })),
);

export function Explicabilidade({ runId }: { runId: string }) {
  const [passo, setPasso] = useState<'revelacao' | 'relatorio'>('revelacao');

  if (passo === 'revelacao') {
    return (
      <Revelacao
        runId={runId}
        aoTerminar={() => {
          experiencia().enviarEstado({ fase: 'explicabilidade', passo: 'relatorio' });
          setPasso('relatorio');
        }}
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <Relatorio runId={runId} />
    </Suspense>
  );
}
