import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de A SELEÇÃO (7º ano · Unidade 1).
 *
 * **Existe porque a ausência dele é MUDA.** Sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo da do 8º ano (`missao-instanooria.tsx`)
 * — o mesmo clone, o Unoovista, o que
 * torna o engano ainda mais fácil de não ver —, com "Nova atividade" gravando
 * em `exp08ef1b_activities`, que esta missão nunca lê, e sem o caminho para o
 * painel em que se prepara a cobertura e se abre o Mural.
 *
 * A ficha abre com o fato que muda a condução, e ele não pode estar no fim de
 * uma lista: **a aula é conduzida por UM botão, que só avança**. Descobrir no
 * meio da aula que ele não volta é o pior jeito — e é a pergunta que chega
 * como "apertei sem querer".
 *
 * A disposição é do template (`components/ficha/ficha-de-conducao.tsx`,
 * ADR-182): aqui ficam só o aviso, o que a missão esconde e a condução.
 */
export function MissaoASelecao({
  ano,
  missao,
  turma,
}: {
  ano: Ano;
  missao: Missao & { ficha: NonNullable<Missao["ficha"]> };
  /** A turma que a sala mandou conduzir (ADR-100); `null` pela trilha. */
  turma: TurmaDoProfessor | null;
}) {
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  return (
    <FichaDeConducao
      contexto={rotuloDaMissao(ano, missao)}
      titulo={missao.titulo}
      resumo={missao.resumo}
      ficha={missao.ficha}
      guia={guia}
      aviso={{
        tipo: "warning",
        titulo: "A aula é conduzida por um botão só, e ele não volta",
        texto:
          "Na página da atividade, o mesmo botão mostra sempre a próxima etapa: Liberar Mural da Turma, Revelar Fichas Técnicas e Liberar Conclusão Individual. Sem o primeiro clique, quem publicou fica esperando. A missão só abre para a turma com uma atividade sua em andamento: crie a cobertura (pode partir da praça central, curada pela Unooria), gere as imagens e use a atividade quando a turma for fazer.",
      }}
      conducao={
        <AtividadesDaMissao missao={missao} expId="exp07ef1b" turma={turma} />
      }
      segredo={
        <>
          <p>
            <strong className="text-unooria-neutral-950">
              Nenhum post chega marcado como oficial, comunitário ou estatístico
            </strong>
            , e antes do Mural a tela não diz que a aula é sobre recorte ou viés. O feed é só um
            feed: doze publicações verdadeiras sobre o mesmo acontecimento. A criança escolhe
            achando que pegou as mais completas — é essa escolha espontânea que o Mural compara, e
            anunciar o tema antes a substituiria pela escolha que ela acha que você espera.
          </p>
          <p>
            A Amara aparece <strong>só no pedido e no fechamento</strong>. No feed não há dica de
            fonte: um “cuidado para ouvir os dois lados” faria todo mundo escolher um de cada
            veículo para cumprir a regra, e a surpresa do Mural morreria.
          </p>
          <p>
            A publicação é <strong>definitiva</strong>. Depois de confirmar não dá para trocar
            post nem legenda — é o peso de um compromisso editorial de verdade, e é ele que faz o
            Mural falar da escolha que a criança fez, não da que ela faria depois de ver a do
            colega.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            Não há nota, ranking nem “acertou”: a plataforma rotula a publicação (a lente de cada
            post), nunca a criança. A inteligência artificial lê a legenda e sugere um nível de
            habilidade no painel de habilidades — o estudante não vê, e quem confere e corrige é
            você.
          </p>
        </>
      }
    />
  );
}
