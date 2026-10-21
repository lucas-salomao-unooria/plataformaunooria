import { Card } from "@edu/ui/ds";
import {
  PONTE_DO_RAIO_X,
  REVELACAO_FIXA,
  TELA_DA_LINGUAGEM,
  TELA_DO_REGISTRO,
  TELA_DOS_TERMOS,
  TELA_FINAL,
  telaDoLadoSemeado,
  type TelaDaRevelacao,
} from "@/lib/insta/copy-da-revelacao";

/**
 * As telas da revelação do Instanooria — BLOCO VIVO do guia.
 *
 * Renderizadas de `lib/insta/copy-da-revelacao.ts` — que é uma CÓPIA do
 * arquivo homônimo da exp08ef1b, não a mesma fonte. As duas têm de ser
 * idênticas, e nada no build cobra isso: o cabeçalho dos dois arquivos é o
 * único aviso. Mexeu na copy, mexa nas duas.
 */

/** Como o guia nomeia cada origem de lado ao mostrar a tela do lado semeado. */
const ORIGEM_EM_PALAVRAS: Record<"perfil" | "redistribuido" | "sorteio", string> = {
  perfil: "Quem jogou o Ato 1",
  redistribuido: "Quem você redistribuiu",
  sorteio: "Quem entrou sem perfil",
};

/** A ordem do roteiro; `null` é a tela do lado de partida, que muda por estudante. */
const ROTEIRO: (TelaDaRevelacao | null)[] = [
  ...REVELACAO_FIXA,
  PONTE_DO_RAIO_X,
  TELA_DOS_TERMOS,
  TELA_DO_REGISTRO,
  null,
  TELA_DA_LINGUAGEM,
  TELA_FINAL,
];

export function TelasDaRevelacao() {
  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="outlined" title="O que a turma lê na revelação">
        <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
          São <strong>{ROTEIRO.length} telas</strong> de fundo preto ({ROTEIRO.length - 1} para quem
          não fez o Raio-x), uma frase por vez, no ritmo de cada estudante — não um cartão. Leia antes da aula: é o argumento
          inteiro da atividade, e a conversa que vem depois parte daqui. O tom nunca culpa a
          criança: o sujeito da frase é sempre o sistema.
        </p>

        <ol className="mt-4 flex flex-col gap-3">
          {ROTEIRO.map((tela, indice) =>
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
                  {tela.ponte ? " · só para quem enviou o Raio-x" : ""}
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
                {tela.ponte ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-unooria-neutral-700">
                    Embaixo, os 6 posts que o estudante classificou, cada um com “escrito para defender
                    [o lado]” ou “escrito para informar, sem defender lado”. Sem certo ou errado e sem
                    contagem: é a devolutiva do Raio-x, que o envio não deu.
                  </p>
                ) : null}
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
