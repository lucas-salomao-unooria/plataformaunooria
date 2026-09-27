import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { comRepeticao, type FalhaTransitoria } from "../lib/api";

/** O aviso global aceso — ou nenhum. */
export type AvisoDeConexao = FalhaTransitoria | null;

export interface Conexao {
  aviso: AvisoDeConexao;
  /** Executa uma chamada à api repetindo-a enquanto a falha for de rede ou de sessão. */
  executar: <T>(chamada: () => Promise<T>) => Promise<T>;
  /** O "Tentar novamente": encurta a espera e tenta JÁ. */
  revalidar: () => void;
  /** O polling do gate acende e apaga o aviso por conta própria (ele não repete). */
  sinalizar: (aviso: AvisoDeConexao) => void;
}

/**
 * A conexão da missão com a api — os avisos globais (`erro_sem_sinal`,
 * `erro_sessao_expirada` e o do rate limit, 429 `muitas-requisicoes`) e a
 * repetição que os acompanha. Molde:
 * `apps/experiencias/exp07ef1b/src/app/conexao.ts`.
 *
 * **Uma instância para a missão inteira**, criada no `Bootstrap`: o aviso é da
 * casca, não de uma tela, e duas instâncias acenderiam dois avisos para a mesma
 * queda.
 *
 * Sobre a sessão: o SDK pede token novo ao hub a cada 10 minutos, e o token
 * vive 15. Um 401 aqui é o hub que não respondeu a tempo — a tela não tem como
 * pedir o token ela mesma, então mostra o aviso e continua tentando: quando o
 * `hub:token` chega, a próxima tentativa passa e o aviso some sozinho.
 */
export function useConexao(): Conexao {
  const [aviso, setAviso] = useState<AvisoDeConexao>(null);
  const vivo = useRef(true);
  /** As esperas em curso — "Tentar novamente" resolve todas de uma vez. */
  const esperas = useRef(new Set<() => void>());

  useEffect(() => {
    vivo.current = true;
    const pendentes = esperas.current;
    return () => {
      vivo.current = false;
      for (const soltar of pendentes) soltar();
    };
  }, []);

  const sinalizar = useCallback((novo: AvisoDeConexao) => setAviso(novo), []);

  const esperar = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const soltar = () => {
          window.clearTimeout(relogio);
          esperas.current.delete(soltar);
          resolve();
        };
        const relogio = window.setTimeout(soltar, ms);
        esperas.current.add(soltar);
      }),
    [],
  );

  const executar = useCallback(
    <T,>(chamada: () => Promise<T>) =>
      comRepeticao(chamada, {
        aoCair: (tipo) => sinalizar(tipo),
        aoVoltar: () => sinalizar(null),
        esperar,
        vivo: () => vivo.current,
      }),
    [esperar, sinalizar],
  );

  const revalidar = useCallback(() => {
    for (const soltar of [...esperas.current]) soltar();
  }, []);

  return useMemo(() => ({ aviso, executar, revalidar, sinalizar }), [aviso, executar, revalidar, sinalizar]);
}
