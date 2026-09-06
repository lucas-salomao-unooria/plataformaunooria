import { Card } from "@edu/ui/ds";
import {
  REVELACAO_FIXA,
  TELA_DA_LINGUAGEM,
  TELA_FINAL,
  telaDoLadoSemeado,
} from "@edu/conteudo-exp-01";

/**
 * As telas da revelação do Instanooria — BLOCO VIVO do guia.
 *
 * Renderizadas direto de `@edu/conteudo-exp-01`, a fonte única que a
 * experiência do estudante também lê. Se fosse texto solto no guia, divergiria
 * na primeira revisão de copy e o professor leria antes da aula um argumento
 * que a turma não vai ver.
 */

/** Como o guia nomeia cada origem de lado ao mostrar a tela do lado semeado. */
const ORIGEM_EM_PALAVRAS: Record<"perfil" | "redistribuido" | "sorteio", string> = {
  perfil: "Quem jogou o Ato 1",
  redistribuido: "Quem você redistribuiu",
  sorteio: "Quem entrou sem perfil",
};

export function TelasDaRevelacao() {
  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="outlined" title="O que a turma lê na revelação">
        <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
          São <strong>{REVELACAO_FIXA.length + 3} telas</strong> de fundo preto, uma frase por
          vez, no ritmo de cada estudante — não um cartão. Leia antes da aula: é o argumento
          inteiro da atividade, e a conversa que vem depois parte daqui. O tom nunca culpa a
          criança: o sujeito da frase é sempre o sistema.
        </p>

        <ol className="mt-4 flex flex-col gap-3">
          {[...REVELACAO_FIXA, null, TELA_DA_LINGUAGEM, TELA_FINAL].map((tela, indice) =>
            tela === null ? (
              <li
                key="lado-semeado"
                className="rounded-lg border border-unooria-neutral-200 bg-unooria-neutral-50 p-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  tela {indice + 1} · muda conforme o estudante
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-unooria-neutral-700">
                  Esta é a única que não é igual para todo mundo. Dizer “foi escolhido a partir
                  de como você jogou” para quem caiu no sorteio seria mentir na única tela que
                  existe para não mentir — então cada estudante lê a versão verdadeira do caso
                  dele:
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {(["perfil", "redistribuido", "sorteio"] as const).map((origem) => (
                    <li key={origem} className="text-[13px] leading-relaxed">
                      <span className="font-semibold text-unooria-neutral-950">
                        {ORIGEM_EM_PALAVRAS[origem]}:
                      </span>{" "}
                      <span className="text-unooria-neutral-800">
                        {telaDoLadoSemeado(origem).texto}{" "}
                        <strong>{telaDoLadoSemeado(origem).destaque}</strong>{" "}
                        {telaDoLadoSemeado(origem).complemento}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li
                key={tela.texto}
                className="rounded-lg border border-unooria-neutral-200 p-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  tela {indice + 1}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-unooria-neutral-950">
                  {tela.texto}
                  {tela.destaque ? (
                    <>
                      {" "}
                      <strong>{tela.destaque}</strong>
                    </>
                  ) : null}
                  {tela.complemento ? (
                    <span className="text-unooria-neutral-700"> {tela.complemento}</span>
                  ) : null}
                </p>
              </li>
            ),
          )}
        </ol>

        <p className="mt-3 text-[12px] leading-relaxed text-unooria-neutral-500">
          Na última tela o botão vira <strong>“Ver meu relatório”</strong>, e o relatório abre em
          tela cheia, fora do aparelho — dá para projetar.
        </p>
      </Card>
    </div>
  );
}
