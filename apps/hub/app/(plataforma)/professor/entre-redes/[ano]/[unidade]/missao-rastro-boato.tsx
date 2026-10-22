import { Card } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotaDaMissao, rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

/**
 * Corpo de O RASTRO DO BOATO (6º ano · Unidade 2).
 *
 * Precisa existir mesmo parecendo o da exp07ef1b: sem entrada no despachante, uma
 * missão publicada cai no corpo do INSTANOORIA, que oferece "Nova atividade" —
 * e a professora criaria uma configuração em `exp08ef1b_activities` que esta
 * missão nunca lê. O bloco de atividades é do Instanooria, não da trilha.
 *
 * A ficha abre com o aviso das duas aulas em vez de deixá-lo no fim de uma
 * lista: sem a professora abrir a Aula 2, a turma inteira fica num card de
 * pausa. "Não avança" é o suporte que esta faixa existe para evitar.
 *
 * `FeedbackAlert` e não `AlertBox`: o segundo é diálogo de 436px, e aqui a
 * faixa é de contexto (o prop é `type`).
 */
export function MissaoRastroBoato({
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
        titulo: "Esta missão tem duas aulas, e é você que abre a segunda",
        texto:
          "No fim da Aula 1 a turma trava numa tela de pausa com o progresso salvo. O botão que abre a Aula 2 fica em Resultados da turma — e é ele que faz todos chegarem juntos ao mapa da rede.",
      }}
      conducao={
        <Card variant="elevated" title="Resultados da turma">
          <div className="flex flex-col gap-3">
            <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
              É de lá que você abre a Aula 2, e é lá que está o retrato da turma: quantas fontes cada
              um auditou antes de responder, como as respostas se distribuíram e quem travou nos 90
              segundos da decisão.{" "}
              <strong className="text-unooria-neutral-950">A lista não tem coluna de pontos</strong> —
              listagem é ordenável, e ordenar crianças por acerto viraria ranking.
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
            Nenhuma mensagem é marcada como falsa.{" "}
            <strong className="text-unooria-neutral-950">
              O que a tela mostra são os dados de envio
            </strong>{" "}
            — seis encaminhamentos anônimos e nenhum autor, num caso; assinatura da direção e data
            de hoje, no outro. Ler esses números e concluir é a tarefa.
          </p>
          <p>
            Na tela da decisão <strong>não há dica, aviso nem personagem</strong>. Não é
            esquecimento: com uma muleta ali, a escolha deixaria de ser do estudante. Se ele travar
            por 90 segundos, e só então, uma frase lembra que o silêncio também deixa o boato
            correr — sem dizer qual opção tomar.
          </p>
          <p>
            A resposta é <strong>definitiva</strong>, e o mapa da Etapa 4 desenha exatamente o que
            ela produziu. Quem encaminhou vê 1.200 conexões; quem apagou para si vê 850. Essa
            diferença é a descoberta da missão, e ela não aparece antes da decisão.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            Em nenhum momento a tela diz que alguém errou, e não há nota. A consequência é a curva
            no mapa — que é matemática, não julgamento.
          </p>
        </>
      }
    />
  );
}
