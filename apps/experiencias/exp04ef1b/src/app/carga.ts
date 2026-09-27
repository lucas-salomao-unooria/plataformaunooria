import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A leitura de uma tela que depende de uma rota própria (`GET resultado`,
 * `GET revisao`, `GET comparativo`): feita UMA vez por `chave` — a sessão e o
 * passo —, e descartada quando a chave muda. Uma resposta que volta depois de
 * a tela mudar não é aplicada (o `vivo`).
 *
 * `chamada` e `aoFalhar` vão por ref: eles mudam a cada render e não são o que
 * decide reler — quem decide é a chave.
 */
export function useCarga<T>(chave: string | null, chamada: () => Promise<T>, aoFalhar: (erro: unknown) => void): T | null {
  const [lida, setLida] = useState<{ chave: string; valor: T } | null>(null);
  const chamadaRef = useRef(chamada);
  const falhaRef = useRef(aoFalhar);
  useLayoutEffect(() => {
    chamadaRef.current = chamada;
    falhaRef.current = aoFalhar;
  });

  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    void (async () => {
      try {
        const valor = await chamadaRef.current();
        if (vivo) setLida({ chave, valor });
      } catch (erro) {
        if (vivo) falhaRef.current(erro);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [chave]);

  return chave !== null && lida?.chave === chave ? lida.valor : null;
}
