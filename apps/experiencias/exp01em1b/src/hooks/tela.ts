import { useEffect, useState } from "react";

/**
 * Inatividade: `true` depois de `ms` sem toque nem tecla. Qualquer gesto zera.
 * Não há avanço involuntário nem perda de estado — só o sinal de produto
 * (`aviso:inatividade`), como nas irmãs.
 */
export function useInatividade(ms: number, ativo: boolean): boolean {
  const [inativo, setInativo] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    let id = window.setTimeout(() => setInativo(true), ms);
    const zerar = () => {
      setInativo(false);
      window.clearTimeout(id);
      id = window.setTimeout(() => setInativo(true), ms);
    };
    window.addEventListener("pointerdown", zerar);
    window.addEventListener("keydown", zerar);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", zerar);
      window.removeEventListener("keydown", zerar);
    };
  }, [ms, ativo]);
  return ativo && inativo;
}
