"use client";

import { useEffect, useState } from "react";

/**
 * Realce do item do sumário correspondente à seção que está sendo lida.
 *
 * Renderiza os links (é ele quem os desenha, não a casca) porque `aria-current`
 * muda a cada rolagem e isso é estado de client. A casca continua Server
 * Component e passa só a lista de âncoras.
 *
 * A REGRA É "o último cabeçalho que já passou pela linha de leitura", e não
 * "o cabeçalho visível agora". A primeira versão usava `IntersectionObserver`
 * com a faixa recortada no terço superior, e tinha um buraco que só aparece com
 * texto de verdade: no meio de uma seção longa — e aqui há seções de várias
 * telas — nenhum cabeçalho está dentro da faixa, e o índice APAGAVA inteiro,
 * bem no momento em que a pessoa mais precisa dele para saber onde está. A
 * suíte e2e pegou isso rolando até a última seção e encontrando `null`.
 *
 * Contar quem já passou sempre tem resposta: no topo é o primeiro item; no fim,
 * o último. Não existe estado sem item aceso.
 *
 * Sem JS os links continuam funcionando como âncoras — só não acendem.
 * Navegação não pode depender do realce.
 */

/** Onde fica a "linha de leitura": 80px da nav fixa + folga. */
const LINHA = 120;

export function SumarioAtivo({ itens }: { itens: { id: string; titulo: string }[] }) {
  const [ativo, setAtivo] = useState<string | null>(null);

  useEffect(() => {
    /*
     * `primeiro` sai do índice numa constante porque `noUncheckedIndexedAccess`
     * tipa `itens[0]` como possivelmente `undefined` — o `length === 0` acima
     * não estreita o tipo para o compilador.
     */
    const primeiro = itens[0];
    if (!primeiro) return;

    let agendado = false;
    const calcular = () => {
      agendado = false;
      let atual = primeiro.id;
      for (const item of itens) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= LINHA) atual = item.id;
      }
      setAtivo(atual);
    };

    /*
     * `scroll` dispara muito mais que uma vez por quadro; sem o coalescimento
     * por `requestAnimationFrame` isto vira dezenas de `getBoundingClientRect`
     * por evento — leitura de layout, a mais cara que existe — num documento de
     * dezenas de milhares de pixels.
     */
    const aoRolar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(calcular);
    };

    calcular();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, [itens]);

  return (
    <ol className="legal-sumario__lista">
      {itens.map((item) => (
        <li key={item.id}>
          <a
            className="legal-sumario__link"
            href={`#${item.id}`}
            aria-current={ativo === item.id ? "true" : undefined}
          >
            {item.titulo}
          </a>
        </li>
      ))}
    </ol>
  );
}
