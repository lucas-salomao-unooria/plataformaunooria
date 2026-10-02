import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { comRepeticao } from "../lib/api";
import { telemetria } from "../lib/telemetria";

/** O aviso global aceso — ou nenhum. */
export type AvisoDeConexao = "rede" | "sessao" | null;

export interface Conexao {
  aviso: AvisoDeConexao;
  /** Executa uma chamada à api repetindo-a enquanto a falha for de rede ou de sessão. */
  executar: <T>(chamada: () => Promise<T>) => Promise<T>;
  /** O "Revalidar acesso" / "Tentar novamente": encurta a espera e tenta JÁ. */
  revalidar: () => void;
  /** O polling do gate acende e apaga o aviso por conta própria (ele não repete). */
  sinalizar: (aviso: AvisoDeConexao) => void;
}

/**
 * A conexão da missão com a api — os dois estados diegéticos globais
 * (`global.erro.offline` e `global.erro.sessao_expirada`) e a repetição que
 * os acompanha.
 *
 * **Uma instância para a missão inteira**, criada no `Bootstrap` e passada
 * para baixo: o aviso é da CASCA, não de uma tela, e duas instâncias
 * acenderiam dois avisos para a mesma queda.
 *
 * Sobre a sessão: o SDK pede token novo ao hub a cada 10 minutos
 * (`exp:token-expirando`), e o token vive 15. Um 401 aqui é o hub que não
 * respondeu a tempo (a aba em segundo plano, a sessão do próprio hub caindo) —
 * a tela não tem como pedir o token ela mesma, então mostra o aviso na voz do
 * clone e continua tentando: quando o `hub:token` chega, a próxima tentativa
 * passa e o aviso some sozinho. "Revalidar acesso" só encurta a espera.
 */
export function useConexao(): Conexao {
  const [aviso, setAviso] = useState<AvisoDeConexao>(null);
  const vivo = useRef(true);
  /** As esperas em curso — "Revalidar" resolve todas de uma vez. */
  const esperas = useRef(new Set<() => void>());
  const ultimo = useRef<AvisoDeConexao>(null);

  useEffect(() => {
    vivo.current = true;
    const pendentes = esperas.current;
    return () => {
      vivo.current = false;
      for (const soltar of pendentes) soltar();
    };
  }, []);

  const sinalizar = useCallback((novo: AvisoDeConexao) => {
    if (novo && novo !== ultimo.current) telemetria.caiu(novo);
    ultimo.current = novo;
    setAviso(novo);
  }, []);

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
