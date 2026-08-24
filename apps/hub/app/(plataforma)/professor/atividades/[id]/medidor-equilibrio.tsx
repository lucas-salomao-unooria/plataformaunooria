"use client";

/** Medidor de equilíbrio da pergunta-chave (passo 2 do doc 05). */
export function MedidorEquilibrio({ nota, ok }: { nota: number; ok: boolean }) {
  const porcentagem = Math.round(Math.min(1, Math.max(0, nota)) * 100);
  const cor = ok
    ? "var(--unooria-color-success-600, #00A369)"
    : "var(--unooria-color-warning-600, #DD5202)";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-unooria-neutral-800">
          Equilíbrio da pergunta
        </span>
        <span className="text-[13px] font-bold" style={{ color: cor }}>
          {porcentagem}%
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-unooria-neutral-200"
        role="meter"
        aria-valuenow={porcentagem}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Equilíbrio da pergunta-chave"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${porcentagem}%`, background: cor }}
        />
      </div>

      <p className="text-[12px] text-unooria-neutral-500">
        {ok
          ? "Dois lados defensáveis: a bolha se forma nos dois sentidos."
          : "Abaixo de 60% a disputa não sustenta duas bolhas."}
      </p>
    </div>
  );
}
