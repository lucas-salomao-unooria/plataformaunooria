import { useEffect, useState } from "react";

/**
 * O ponto em que o feed troca de apresentação.
 *
 * O `ShortsPlayer` do DS publica as duas do arquivo de origem: `card` põe a
 * trilha de ações AO LADO do quadro (área de trabalho) e `immersive` a põe
 * SOBRE o vídeo (celular). É exatamente a diferença que o CSS antigo desta
 * experiência fabricava à mão em `@media (max-width: 760px)`, então o valor é
 * o mesmo — o que mudou é que agora quem desenha as duas é o DS.
 */
const ESTREITO = "(max-width: 760px)";

export function useTelaEstreita(): boolean {
  const [estreita, setEstreita] = useState(
    () => typeof window !== "undefined" && window.matchMedia(ESTREITO).matches,
  );

  useEffect(() => {
    const consulta = window.matchMedia(ESTREITO);
    const aoMudar = (evento: MediaQueryListEvent) => setEstreita(evento.matches);
    consulta.addEventListener("change", aoMudar);
    setEstreita(consulta.matches);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  return estreita;
}
