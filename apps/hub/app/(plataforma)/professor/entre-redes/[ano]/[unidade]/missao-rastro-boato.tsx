import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { rotaDaMissao, rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { comTurma } from "@/lib/rotas-da-missao";
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
  const { ficha } = missao;
  const rotaResultados = comTurma(`${rotaDaMissao(missao)}/resultados`, turma?.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Disponível</Badge>
          <span className="text-[13px] font-semibold text-unooria-neutral-500">
            {rotuloDaMissao(ano, missao)}
          </span>
        </div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">{missao.titulo}</h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-unooria-neutral-700">
          {missao.resumo}
        </p>
        <div className="flex flex-wrap gap-2">
          <Tag variant="neutral" size="sm" pill>
            {ficha.duracao}
          </Tag>
          <Tag variant="neutral" size="sm" pill>
            {ficha.formato}
          </Tag>
        </div>
        <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-500">
          {ficha.competencia}
        </p>
      </header>

      <FeedbackAlert
        type="warning"
        title="Esta missão tem duas aulas, e é você que abre a segunda"
        description="No fim da Aula 1 a turma trava numa tela de pausa com o progresso salvo. O botão que abre a Aula 2 fica em Resultados da turma — e é ele que faz todos chegarem juntos ao mapa da rede."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card variant="outlined" title="Como a missão funciona">
          <ol className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
            {ficha.atos.map((ato) => (
              <li key={ato.rotulo}>
                <strong className="block text-unooria-neutral-950">{ato.rotulo}</strong>
                {ato.texto}
              </li>
            ))}
          </ol>
        </Card>

        <Card variant="outlined" title="Antes de rodar com a turma">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
            {ficha.preparo.map((passo) => (
              <li key={passo}>{passo}</li>
            ))}
          </ol>
        </Card>
      </section>

      <Card variant="outlined" title="O que o software NÃO conta ao estudante">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          <p className="max-w-3xl">
            Nenhuma mensagem é marcada como falsa.{" "}
            <strong className="text-unooria-neutral-950">
              O que a tela mostra são os dados de envio
            </strong>{" "}
            — seis encaminhamentos anônimos e nenhum autor, num caso; assinatura da direção e data
            de hoje, no outro. Ler esses números e concluir é a tarefa.
          </p>
          <p className="max-w-3xl">
            Na tela da decisão <strong>não há dica, aviso nem personagem</strong>. Não é
            esquecimento: com uma muleta ali, a escolha deixaria de ser do estudante. Se ele travar
            por 90 segundos, e só então, uma frase lembra que o silêncio também deixa o boato
            correr — sem dizer qual opção tomar.
          </p>
          <p className="max-w-3xl">
            A resposta é <strong>definitiva</strong>, e o mapa da Etapa 4 desenha exatamente o que
            ela produziu. Quem encaminhou vê 1.200 conexões; quem apagou para si vê 850. Essa
            diferença é a descoberta da missão, e ela não aparece antes da decisão.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            Em nenhum momento a tela diz que alguém errou, e não há nota. A consequência é a curva
            no mapa — que é matemática, não julgamento.
          </p>
        </div>
      </Card>

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
    </div>
  );
}
