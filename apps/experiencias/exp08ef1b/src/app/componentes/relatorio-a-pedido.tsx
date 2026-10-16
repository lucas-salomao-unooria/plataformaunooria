/**
 * As folhas da PLATAFORMA, no chunk do relatório: ele já chega por `React.lazy`,
 * e depois da revelação quem fala é a escola (o mesmo cuidado de
 * `dossie/graficos.tsx`).
 */
import '@unooria/design-system/unooria.css';
import '@unooria/design-system/fonts/unooria.css';

import { useEffect } from 'react';
import { Button } from '@edu/ui/ds';

import { experiencia } from '../../lib/api';

import { Dossie } from './dossie/dossie';

/**
 * O RELATÓRIO com uma SAÍDA (ADR-167): "Continuar", para quem foi puxado
 * adiante pela turma e vê o relatório antes do feed em cinza e das tarefas, ou
 * "Voltar", para o "Rever meu relatório" do cinza e da reflexão.
 *
 * Enquanto ele está aberto, o hub o expande para fora do aparelho (o `passo`
 * `relatorio` do `exp:estado`); ao sair, o estado volta sem `passo`, e o
 * aparelho volta ao lugar.
 */
export function RelatorioComSaida({
  runId,
  fase,
  rotulo,
  aoSair,
}: {
  runId: string;
  fase: string;
  rotulo: 'Continuar' | 'Voltar';
  aoSair: () => void;
}) {
  useEffect(() => {
    experiencia().enviarEstado({ fase, passo: 'relatorio' });
  }, [fase]);

  return (
    <div className="relative">
      <Dossie runId={runId} />
      <div className="fixed inset-x-0 bottom-0 z-[90] flex justify-center px-6 pb-5">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="max-w-phone"
          onClick={() => {
            experiencia().enviarEstado({ fase });
            aoSair();
          }}
        >
          {rotulo}
        </Button>
      </div>
    </div>
  );
}
