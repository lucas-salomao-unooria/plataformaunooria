import { Card } from "@edu/ui/ds";
import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { LinkButton } from "@/components/link-button";
import {
  rotaDaMissao,
  rotuloDaMissao,
  type Ano,
  type Missao,
} from "@/lib/entre-redes/catalogo";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

/**
 * Corpo da missão O QUE A FOTO CONTA (1º ano · Unidade 1).
 *
 * A ficha apresenta; quem TRABALHA é a tela de resultados — preparação do
 * pacote (IA + aprovação), dashboard ao vivo, projeção da Roda e o botão de
 * liberar a reflexão moram lá, porque é a tela que o professor projeta e
 * opera DURANTE a aula. A ficha usa o template
 * (`components/ficha/ficha-de-conducao.tsx`, ADR-182).
 */
export function MissaoFotoConta({
  ano,
  missao,
  turma,
}: {
  ano: Ano;
  missao: Missao & { ficha: NonNullable<Missao["ficha"]> };
  /** A turma que a sala mandou conduzir (ADR-100); `null` pela trilha. */
  turma: TurmaDoProfessor | null;
}) {
  const rotaResultados = comTurma(`${rotaDaMissao(missao)}/resultados`, turma?.id);
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  return (
    <FichaDeConducao
      contexto={rotuloDaMissao(ano, missao)}
      titulo={missao.titulo}
      resumo={missao.resumo}
      ficha={missao.ficha}
      etiquetas={["Missão síncrona: a Roda congela os tablets", "100% formativa, sem nota"]}
      guia={guia}
      conducao={
        <Card variant="elevated" title="A aula com a turma">
          <div className="flex flex-col gap-3">
            <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
              A preparação do pacote, o painel ao vivo, a projeção da Roda e o botão que libera a reflexão ficam
              na tela da aula — é ela que você projeta e opera durante a missão.
            </p>
            <div>
              <LinkButton href={rotaResultados}>Preparação e aula ao vivo</LinkButton>
            </div>
          </div>
        </Card>
      }
    />
  );
}
