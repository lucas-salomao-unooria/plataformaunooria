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
 *
 * **`impressao`** existe para a outra folha que reusa este botão — o
 * "Exportar Relatório de Homologação Ética" da exp01em1b (ADR-185): o nome vai
 * em `data-impressao` no `<html>` só durante a impressão, e a folha daquele
 * relatório (`@media print`) só vale com ele. Sem a marca, o `Ctrl+P` da página
 * imprime a página inteira, como sempre.
 */
export function BotaoImprimir({
  rotulo = "Imprimir",
  variante = "secondary",
  impressao,
}: {
  rotulo?: string;
  variante?: "primary" | "secondary";
  /** A folha de impressão que vale neste clique (`html[data-impressao=…]`). */
  impressao?: string;
} = {}) {
  function imprimir() {
    const raiz = document.documentElement;
    if (!impressao) {
      window.print();
      return;
    }
    raiz.dataset.impressao = impressao;
    const limpar = () => {
      delete raiz.dataset.impressao;
      window.removeEventListener("afterprint", limpar);
    };
    window.addEventListener("afterprint", limpar);
    window.print();
  }

  return (
    <Button variant={variante} size="sm" className="guia-fora-do-papel" onClick={imprimir} data-acao={impressao ? `imprimir-${impressao}` : undefined}>
      {rotulo}
    </Button>
  );
}
