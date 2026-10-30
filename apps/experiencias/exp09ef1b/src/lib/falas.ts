import { useEffect, useState } from "react";
import type { Mensagem } from "./tipos";

/**
 * As falas do assistente entram UMA DE CADA VEZ, com o "digitando" antes de
 * cada uma (ajuste do PO de 30/10). O servidor devolve a conversa inteira, e
 * às vezes duas falas novas no mesmo pacote (a leitura dos cadernos e o
 * parecer que se inverte): sem isso, elas apareciam juntas.
 *
 * O que o estudante JÁ VIU não anima de novo — nem no F5 (o histórico chega
 * inteiro) nem quando a tela da conversa monta outra vez ao trocar de passo.
 * Por isso a memória é do MÓDULO, semeada pelo `App` com a sessão inicial, e
 * não do componente.
 */

const vistas = new Set<string>();

/** O `App` chama uma vez, com a sessão que chegou no handshake: o histórico não anima. */
export function semearFalasVistas(mensagens: readonly Mensagem[]): void {
  for (const m of mensagens) vistas.add(m.id);
}

/** Quanto o "digitando" fica antes da fala: proporcional ao texto, entre 0,6 s e 1,5 s. */
export function tempoDigitando(texto: string): number {
  return Math.min(1500, Math.max(600, 400 + texto.length * 6));
}

/**
 * As mensagens que já podem aparecer, e se o assistente está "digitando" a
 * próxima. A fala do estudante entra na hora; a do assistente e a nota do
 * sistema esperam a vez, na ordem.
 */
export function useFalasEmSequencia(mensagens: readonly Mensagem[]): { visiveis: Mensagem[]; digitando: boolean } {
  const [, setTique] = useState(0);
  const proxima = mensagens.find((m) => !vistas.has(m.id));
  const id = proxima?.id;
  const espera = proxima && proxima.autor !== "estudante" ? tempoDigitando(proxima.texto) : 0;

  /* Depende do ID, não do objeto: cada resposta do servidor traz objetos novos,
     e o relógio da fala que já está "digitando" não pode recomeçar. */
  useEffect(() => {
    if (!id) return;
    const relogio = window.setTimeout(() => {
      vistas.add(id);
      setTique((t) => t + 1);
    }, espera);
    return () => window.clearTimeout(relogio);
  }, [id, espera]);

  const corte = proxima ? mensagens.indexOf(proxima) : mensagens.length;
  return { visiveis: mensagens.slice(0, corte), digitando: proxima !== undefined && proxima.autor !== "estudante" };
}
