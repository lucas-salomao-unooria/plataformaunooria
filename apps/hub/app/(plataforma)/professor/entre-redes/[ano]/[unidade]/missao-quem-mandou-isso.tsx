import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de QUEM MANDOU ISSO? v2.2 (5º ano · Unidade 1).
 *
 * **Existe porque a ausência dele é MUDA.** Sem ramo no despachante de
 * `page.tsx`, uma missão publicada cai no corpo do INSTANOORIA — com "Nova
 * atividade", que grava em `exp08ef1b_activities`, e sem "Abrir a aula e os
 * resultados", o único caminho para o preparo e os três botões desta missão.
 * Aconteceu duas vezes (exp06ef2b e exp08ef4b), e o
 * `despachante-da-ficha.test.ts` é a rede.
 *
 * As EQUIPES (E13) não são deste corpo: são de cada ATIVIDADE (ADR-130), e
 * moram na página dela — a criação da atividade já pergunta o modo.
 *
 * A ficha abre com o fato que muda a condução, e ele não pode estar no fim de
 * uma lista: **sem o pacote aprovado a missão não abre para ninguém**, porque o
 * tema dele entra na fala da Nina. Descobrir isso com trinta crianças olhando
 * uma tela de espera é o pior jeito.
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
        title="A missão só abre com uma atividade sua em andamento — e a revelação é você quem libera"
        description="O tema do pacote entra na fala da Nina, então sem uma atividade em andamento o estudante entra e vê uma tela de espera. Durante a aula são três botões seus, na página da atividade, sempre para a frente: Liberar Revelação, Apresentar Síntese e Liberar Reflexão."
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
            <strong className="text-unooria-neutral-950">Nenhuma mensagem chega marcada</strong>, e a
            tela não diz em momento nenhum que a aula é sobre mentira na internet. O grupo é só um
            grupo: oito mensagens de colegas, com o mesmo aspecto de qualquer manhã. O gabarito não
            chega ao aparelho antes da hora — ele só desce depois do voto na enquete E da revelação
            que você libera, e só o das três mensagens que aquela criança encaminhou.
          </p>
          <p className="max-w-3xl">
            A matriz é <strong>equilibrada de propósito</strong>: duas mensagens em cada quadrante
            (verdadeira ou falsa × emocional ou neutra), e a imagem e o link com uma verdadeira e uma
            falsa cada. Nenhuma pista de formato separa o que é verdade — se o link fosse sempre
            falso, a turma aprenderia “link é mentira”, a heurística que a missão existe para
            desmontar.
          </p>
          <p className="max-w-3xl">
            O envio ao Mural e o voto são <strong>definitivos</strong>, e os três botões da aula só
            andam para a frente. Quem ainda não tinha confirmado quando você libera a revelação não é
            empurrado: continua no grupo, confirma, vota e vê a própria revelação depois.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            O Termômetro da Turma é <strong className="text-unooria-neutral-700">anônimo por
            construção</strong>: a conta é da sala, e nome de estudante não chega a ela. A regra
            Se/Então que cada um escreve é lida por você e mais ninguém.
          </p>
        </div>
      </Card>

      <AtividadesDaMissao missao={missao} expId="exp05ef1b" turma={turma} />
    </div>
  );
}
