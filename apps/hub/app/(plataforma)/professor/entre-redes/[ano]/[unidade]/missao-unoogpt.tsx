import { Card } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import {
  rotaDaMissao,
  rotuloDaMissao,
  type Ano,
  type Missao,
} from "@/lib/entre-redes/catalogo";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

/**
 * Corpo da MISSÃO TEMPESTADE (2ª série do EM · Unidade 1).
 *
 * Diferente das outras duas: aqui o professor tem uma ação AO VIVO e sem ela a
 * aula não começa — a largada do relógio. Por isso a ficha abre com o aviso,
 * em vez de deixar a informação no fim de uma lista de preparo.
 *
 * Molde: `backup-missao-unootube.tsx` (o UnooTube, hoje arquivado). `FeedbackAlert` e não `AlertBox`: o segundo é
 * diálogo de 436px, e aqui a faixa é de contexto (o prop é `type`, não
 * `variant`).
 */
export function MissaoUnooGPT({
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
      guia={guia}
      aviso={{
        tipo: "warning",
        titulo: "Esta missão só começa quando você der a largada",
        texto:
          "O relógio é da TURMA, não de cada estudante. Enquanto você não largar, todos veem o cronômetro parado e ninguém fala com o assistente. A largada, o +2 min e o encerrar ficam em Resultados da turma.",
      }}
      conducao={
        <Card variant="elevated" title="Resultados da turma">
          <div className="flex flex-col gap-3">
            <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
              O relógio da aula e o retrato da turma: quantos começaram, quantos viram fontes em
              conflito, quantos decidiram sem consultar nada e quantos justificaram por intuição.{" "}
              <strong className="text-unooria-neutral-950">
                A lista não tem coluna de resgatados
              </strong>{" "}
              — listagem é ordenável, e ordenar crianças por acerto viraria ranking. O número fica na
              tela individual, uma por vez.
            </p>
            <div>
              <LinkButton href={rotaResultados}>Abrir a aula e os resultados</LinkButton>
            </div>
          </div>
        </Card>
      }
      segredo={
        <>
          <p>
            Cada uma das 8 fontes distorce a cidade de um jeito: o satélite vê telhado e não vê
            morador, e infla o bairro industrial; o cadastro de moradores está velho onde a cidade
            cresceu. <strong className="text-unooria-neutral-950">A missão nunca revela isso.</strong>
          </p>
          <p>
            Não é omissão — é o desenho. Um estudante que descobre pela tela qual fonte engana em quê
            aprende a decorar uma tabela; um estudante que descobre no debate, comparando o que ele viu
            com o que o colega viu, aprende a desconfiar de fonte única. O material da conversa é
            seu, e o relatório de cada estudante mostra em que ordem ele olhou as coisas.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            O relatório também distingue duas coisas que parecem iguais: “teve a chance e não foi” é
            diferente de “a oportunidade não chegou”. Bairro sem fonte carregada aparece em branco
            para o estudante, nunca como “zero em risco”.
          </p>
        </>
      }
    />
  );
}
