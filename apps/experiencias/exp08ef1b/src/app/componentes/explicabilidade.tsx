import { Suspense, lazy, useState } from 'react';

import { api, experiencia } from '../../lib/api';

import { Revelacao } from './revelacao';

/**
 * A EXPLICABILIDADE: a revelação e, em seguida, o relatório.
 *
 * Por que as duas moram num componente só, e não em duas fases:
 *
 * O cliente marcava `fase = "dossie"` ao terminar a revelação, mas o servidor
 * continuava em `explicabilidade` — e o polling do relógio da turma, vendo a
 * divergência, empurrava o estudante de volta para a revelação. A cada 5 segundos.
 * Reassistir a revelação em loop é o pior desfecho possível para esta tela.
 *
 * A troca de passo é estado LOCAL. O que o servidor precisa saber desde o Canal
 * A (ADR-167) é que o estudante CHEGOU à última tela: o toque em "Ver meu
 * relatório" grava o fim da revelação (`POST /runs/:id/revelacao/concluida`),
 * que abre o 6b e o 6c e fecha o Raio-x. Falhou a rede, o relatório abre do
 * mesmo jeito, e o próximo toque (ou o próximo "Continuar") tenta de novo.
 *
 * O HUB também precisa saber: é o passo que tira o relatório do aparelho de
 * 375px e o abre em tela cheia (`ExpHost`). Por isso o `enviarEstado` daqui, e
 * por isso ele carrega a FASE junto — o hub SUBSTITUI o estado inteiro a cada
 * mensagem, e publicar só o passo apagaria a fase que a moldura dos perdidos lê.
 *
 * `aoContinuar` existe para quem foi puxado ADIANTE pela turma (a fase já é o
 * cinza ou a reflexão): o relatório ganha "Continuar", e só então vêm o feed em
 * cinza e as tarefas.
 */
const Relatorio = lazy(() =>
  import('./dossie/dossie').then((modulo) => ({ default: modulo.Dossie })),
);
const RelatorioComSaida = lazy(() =>
  import('./relatorio-a-pedido').then((modulo) => ({ default: modulo.RelatorioComSaida })),
);

export function concluirRevelacao(runId: string): Promise<boolean> {
  return api
    .post(`/runs/${runId}/revelacao/concluida`)
    .then(() => true)
    .catch(() => false);
}

export function Explicabilidade({
  runId,
  fase = 'explicabilidade',
  aoContinuar,
  aoConcluirRevelacao,
}: {
  runId: string;
  fase?: string;
  aoContinuar?: () => void;
  /** A casca recarrega as tarefas: sem isso, a fase seguinte lia o retrato de
      ANTES do fim da revelação e o desvio remontava o relatório (1.4.1). */
  aoConcluirRevelacao?: () => void;
}) {
  const [passo, setPasso] = useState<'revelacao' | 'relatorio'>('revelacao');

  if (passo === 'revelacao') {
    return (
      <Revelacao
        runId={runId}
        aoTerminar={() => {
          void concluirRevelacao(runId).then((ok) => ok && aoConcluirRevelacao?.());
          experiencia().enviarEstado({ fase, passo: 'relatorio' });
          setPasso('relatorio');
        }}
      />
    );
  }

  return (
    <Suspense fallback={null}>
      {aoContinuar ? (
        <RelatorioComSaida
          runId={runId}
          fase={fase}
          rotulo="Continuar"
          aoSair={() => {
            void concluirRevelacao(runId).then(() => aoContinuar());
          }}
        />
      ) : (
        <Relatorio runId={runId} />
      )}
    </Suspense>
  );
}
