"use client";

import { Button } from "@edu/ui/ds";

/**
 * Manda o guia para a impressora.
 *
 * É client component pelo mínimo possível: `window.print()` não existe no
 * servidor. O que decide a aparência da folha é `guia.css`, não este botão — e
 * é por isso que ele não passa opção nenhuma: o `Ctrl+P` do professor tem de
 * produzir exatamente a mesma folha que este clique.
 *
 * Ele próprio carrega `guia-fora-do-papel`: um botão "Imprimir" impresso na
 * folha é a piada que denuncia que ninguém testou a impressão.
 */
export function BotaoImprimir() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      Imprimir
    </Button>
  );
}
