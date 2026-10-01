import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de A SELEÇÃO (7º ano · Unidade 1).
 *
 * **Existe porque a ausência dele é MUDA.** Sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do INSTANOORIA — o mesmo clone, o que
 * torna o engano ainda mais fácil de não ver —, com "Nova atividade" gravando
 * em `exp08ef1b_activities`, que esta missão nunca lê, e sem o caminho para o
 * painel em que se prepara a cobertura e se abre o Mural.
 *
 * A ficha abre com o fato que muda a condução, e ele não pode estar no fim de
 * uma lista: **a aula é conduzida por UM botão, que só avança**. Descobrir no
 * meio da aula que ele não volta é o pior jeito — e é a pergunta que chega
 * como "apertei sem querer".
 *
 * `FeedbackAlert` e não `AlertBox`: o segundo é diálogo de 436px, e aqui a
 * faixa é de contexto (o prop é `type`, não `variant`).
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
  const { ficha } = missao;
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
        title="A aula é conduzida por um botão só, e ele não volta"
        description="Na página da atividade, o mesmo botão mostra sempre a próxima etapa: Liberar Mural da Turma, Revelar Fichas Técnicas e Liberar Conclusão Individual. Sem o primeiro clique, quem publicou fica esperando. A missão só abre para a turma com uma atividade sua em andamento: crie a cobertura (pode partir da praça central, curada pela Unooria), gere as imagens e use a atividade quando a turma for fazer."
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
            <strong className="text-unooria-neutral-950">
              Nenhum post chega marcado como oficial, comunitário ou estatístico
            </strong>
            , e antes do Mural a tela não diz que a aula é sobre recorte ou viés. O feed é só um
            feed: doze publicações verdadeiras sobre o mesmo acontecimento. A criança escolhe
            achando que pegou as mais completas — é essa escolha espontânea que o Mural compara, e
            anunciar o tema antes a substituiria pela escolha que ela acha que você espera.
          </p>
          <p className="max-w-3xl">
            A Amara aparece <strong>só no pedido e no fechamento</strong>. No feed não há dica de
            fonte: um “cuidado para ouvir os dois lados” faria todo mundo escolher um de cada
            veículo para cumprir a regra, e a surpresa do Mural morreria.
          </p>
          <p className="max-w-3xl">
            A publicação é <strong>definitiva</strong>. Depois de confirmar não dá para trocar
            post nem legenda — é o peso de um compromisso editorial de verdade, e é ele que faz o
            Mural falar da escolha que a criança fez, não da que ela faria depois de ver a do
            colega.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            Não há nota, ranking nem “acertou”: a plataforma rotula a publicação (a lente de cada
            post), nunca a criança. A inteligência artificial lê a legenda e sugere um nível de
            habilidade no painel de habilidades — o estudante não vê, e quem confere e corrige é
            você.
          </p>
        </div>
      </Card>

      <AtividadesDaMissao missao={missao} expId="exp07ef1b" turma={turma} />
    </div>
  );
}
