import { useState } from 'react';

import { ButtonUnv } from '@edu/ui/ds-unoovista';

/**
 * FASE 3 do doc 02 (~15s): tela sobre o feed, que congela desfocado ao fundo.
 *
 * "Fim da missão", não "fim do beta": a narrativa mudou (doc 02 fase 1). O que
 * vem depois não é a revelação — é a **conclusão** do estudante (fase 4). O disfarce
 * do mecanismo cai só depois dela.
 */
export function Encerramento({
  postosVistos,
  aoVer,
}: {
  /** Quantas publicações ele atravessou — o número devolve peso à missão. */
  postosVistos: number;
  aoVer: () => Promise<void>;
}) {
  const [carregando, setCarregando] = useState(false);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-6 backdrop-blur-md">
      <div className="absolute inset-0 bg-surface/60" />

      <div className="relative flex w-full max-w-[340px] flex-col items-center gap-4 rounded-cartao bg-elevated p-6 text-center shadow-[var(--unv-elevation-overlay)]">
        <h1 className="text-[20px] font-semibold text-ink">Fim da missão ⏰</h1>
        <p className="text-[15px] leading-relaxed text-ink/80">
          {postosVistos > 0 ? (
            <>
              Você passou por <strong>{postosVistos}</strong> publicações sobre isso.
              <br />
            </>
          ) : null}
          Agora é a sua vez.
        </p>

        <ButtonUnv
          block
          size="lg"
          className="mt-1"
          disabled={carregando}
          onClick={async () => {
            setCarregando(true);
            await aoVer();
          }}
        >
          {carregando ? '…' : 'Continuar'}
        </ButtonUnv>
      </div>
    </div>
  );
}
