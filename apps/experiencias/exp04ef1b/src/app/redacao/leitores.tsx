import { SpeechBubble } from "@edu/ui/ds";
import type { Reacao } from "../../lib/tipos";

/**
 * O mural dos leitores: um `SpeechBubble` por vaga, na ordem das vagas, com o
 * leitor e a fala que a api devolveu (a consequência 1:1 de cada notícia) e o
 * humor — que nunca é só cor: o balão troca o ícone e o nome acessível.
 *
 * **O balão não diz de qual notícia é.** A primeira devolutiva "apresenta o
 * resultado e o impacto, mas não entrega imediatamente uma lista de quais
 * notícias trocar" (PDF §7): a fala da família no portão já aponta a gincana, e
 * ligar o balão à manchete seria a tela fazendo a checagem pela criança.
 * Alternar os lados é só para o mural ler como conversa.
 */
export function MuralDosLeitores({ reacoes }: { reacoes: readonly Reacao[] }) {
  return (
    <ul className="leitores">
      {reacoes.map((r, i) => (
        <li key={`${r.noticiaId}-${i}`}>
          <SpeechBubble speaker={r.leitor} tone="reader" mood={r.humor} side={i % 2 === 0 ? "start" : "end"}>
            {r.fala}
          </SpeechBubble>
        </li>
      ))}
    </ul>
  );
}
