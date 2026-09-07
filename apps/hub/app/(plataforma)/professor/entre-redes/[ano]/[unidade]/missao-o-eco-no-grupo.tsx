import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import {
  rotaDaMissao,
  rotuloDaMissao,
  type Ano,
  type Missao,
} from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";

/**
 * Corpo de O ECO NO GRUPO (7º ano · Unidade 1).
 *
 * A única missão da trilha em DUAS aulas, e por isso a ficha abre com o aviso
 * em vez de deixá-lo no fim de uma lista de preparo: sem a professora abrir a
 * Aula 2, a turma inteira fica num card de pausa. "Não avança" é o suporte que
 * esta faixa existe para evitar.
 *
 * Molde: `missao-unoogpt.tsx`. `FeedbackAlert` e não `AlertBox`: o segundo é
 * diálogo de 436px, e aqui a faixa é de contexto (o prop é `type`).
 */
export function MissaoOEcoNoGrupo({
  ano,
  missao,
}: {
  ano: Ano;
  missao: Missao & { ficha: NonNullable<Missao["ficha"]> };
}) {
  const { ficha } = missao;
  const rotaResultados = `${rotaDaMissao(missao)}/resultados`;
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

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
        description="No fim da Aula 1 a turma trava num card de pausa com o progresso salvo. Os três momentos — abrir a Aula 2, congelar para o debate e liberar o Meu percurso — ficam em Resultados da turma."
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
          {guia ? (
            <div className="pt-4">
              <LinkButton href={guia} variant="secondary">
                Abrir guia da aula
              </LinkButton>
            </div>
          ) : null}
        </Card>
      </section>

      <Card variant="outlined" title="O que o software NÃO conta ao estudante">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          <p className="max-w-3xl">
            O print que circula no grupo é <strong>um recorte da foto da própria reportagem</strong>:
            a mesma cena, cortada para mostrar só a viatura e esconder a feira que acontecia em paz
            ao lado. <strong className="text-unooria-neutral-950">A missão nunca aponta isso.</strong>
          </p>
          <p className="max-w-3xl">
            Amara, a personagem que chama o estudante, fica em <strong>silêncio absoluto</strong>{" "}
            durante a investigação. Não é esquecimento: se ela dissesse qual mensagem é falsa, o
            reconhecimento de padrão que a missão mede deixaria de acontecer. Ela só volta a falar
            depois da decisão.
          </p>
          <p className="max-w-3xl">
            E o selo &quot;Encaminhada com frequência&quot; diz o que o aplicativo real diz — volume
            de repasse, não veracidade. A plataforma não rotula a mensagem de falsa: quem audita a
            causa é a criança.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            Quem responde no impulso vê o bairro entrar em pânico e ganha um botão para apagar para
            todos e tentar de novo. O erro tem consequência dentro da ficção, e reparo imediato — em
            nenhum momento a tela diz que alguém errou.
          </p>
        </div>
      </Card>

      <Card variant="elevated" title="Resultados da turma">
        <div className="flex flex-col gap-3">
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            É de lá que você conduz a aula, e é lá que está o retrato da turma: quantos abriram a
            matéria completa antes de responder, como as respostas se distribuíram e quem apagou e
            tentou de novo.{" "}
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
