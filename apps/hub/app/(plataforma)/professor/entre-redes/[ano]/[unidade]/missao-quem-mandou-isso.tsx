import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { rotaDaMissao, rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

/**
 * Corpo de QUEM MANDOU ISSO? (5º ano · Unidade 1).
 *
 * **Existe porque a ausência dele é MUDA.** Sem entrada no despachante de
 * `page.tsx`, uma missão publicada cai no corpo do INSTANOORIA — que tem "Nova
 * atividade" e não tem "Abrir a aula e os resultados". A professora criaria uma
 * configuração em `exp08ef1b_activities` que esta missão nunca lê, e não acharia o
 * painel em que se prepara o lote e se acende o telão. Aconteceu duas vezes
 * (exp06ef2b e exp08ef4b), e o `despachante-da-ficha.test.ts` é a rede.
 *
 * A ficha abre com o fato que muda a condução, e ele não pode estar no fim de
 * uma lista de preparo: **sem o lote aprovado a missão não abre para ninguém**.
 * Descobrir isso com trinta crianças de 10 anos olhando uma tela de espera é o
 * pior jeito, e é o suporte que esta faixa existe para evitar.
 *
 * `FeedbackAlert` e não `AlertBox`: o segundo é diálogo de 436px, e aqui a
 * faixa é de contexto (o prop é `type`, não `variant`).
 */
export function MissaoQuemMandouIsso({
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

      {/* As duas coisas que mudam a condução, e nenhuma delas pode esperar o
          fim de uma lista: a missão não abre sem o lote aprovado, e a revelação
          é a professora quem dispara. As duas chegam como "não funciona". */}
      <FeedbackAlert
        type="warning"
        title="A missão só abre depois que você aprova o lote — e a revelação é você quem dispara"
        description="Sem o seu clique em Aprovar e publicar, o estudante entra e vê uma tela de espera: esta missão nasce vazia de propósito, porque as mensagens falam da SUA escola. Durante a aula são dois botões seus, em Resultados da turma: Iniciar revelação coletiva, que fecha o Mural de todo mundo e acende o telão, e Liberar reflexão final."
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
              Nenhuma mensagem chega marcada como falsa
            </strong>
            , e a tela não diz em momento nenhum que a aula é sobre mentira na internet. O grupo é
            só um grupo: oito mensagens sobre a escola, em ordem de chegada, com o mesmo aspecto
            de qualquer manhã. A criança decide o que encaminhar sem nenhum aviso — é esse
            comportamento espontâneo que a missão mede, e anunciar o tema antes o substitui pelo
            comportamento que ela acha que você espera.
          </p>
          <p className="max-w-3xl">
            Para fechar o Mural são <strong>3 encaminhamentos e ter rolado até a última
            mensagem</strong>. A trava da rolagem não é capricho: o esclarecimento do professor e o
            comentário de quem admite não ter certeza estão no FIM do grupo, e decidir sem chegar
            lá é exatamente o atalho que a aula quer tornar visível.
          </p>
          <p className="max-w-3xl">
            O envio é <strong>definitivo</strong>. Depois de confirmar não dá para tirar nem
            acrescentar nada, e quem ainda não tinha confirmado quando você acende o telão para de
            poder encaminhar — continuar escolhendo com o gabarito projetado na parede mediria
            outra coisa. A escolha dele fica registrada do mesmo jeito; o que ele perde é entrar na
            conta da sala.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            O telão é <strong className="text-unooria-neutral-700">anônimo por construção</strong>:
            a conta da turma é por mensagem, e nome de estudante não chega a ela. Não há nota, não
            há pontuação e a folha da turma não tem coluna de acerto — listagem é ordenável, e uma
            coluna de “quantas falsas encaminhou” seria o ranking de quem caiu no boato.
          </p>
        </div>
      </Card>

      <Card variant="elevated" title="A aula e os resultados">
        <div className="flex flex-col gap-3">
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            É de lá que você prepara o lote da sua escola antes da aula, acompanha a barra de
            prontidão, acende o telão da revelação e libera a reflexão final. E é lá que está o
            retrato: o histograma anonimizado que você projeta, quem leu o grupo inteiro antes de
            decidir, quanto tempo cada um levou até o primeiro encaminhamento e o que cada
            estudante escreveu sobre o áudio do tio.{" "}
            <strong className="text-unooria-neutral-950">
              Nada gerado por inteligência artificial chega aos estudantes sem a sua aprovação
            </strong>{" "}
            — gerar produz rascunho, e o que publica é o seu clique.
          </p>
          <div>
            <LinkButton href={rotaResultados}>Abrir a aula e os resultados</LinkButton>
          </div>
        </div>
      </Card>
    </div>
  );
}
