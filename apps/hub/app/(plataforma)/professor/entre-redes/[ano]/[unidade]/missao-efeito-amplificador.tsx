import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de O EFEITO AMPLIFICADOR (2ª série · Unidade 1, ADR-181).
 *
 * **Existe porque a ausência dele é MUDA**: sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do Instanooria. O
 * `despachante-da-ficha.test.ts` é a rede.
 *
 * Abre com o fato que muda a condução: **sem uma atividade em andamento a
 * missão não abre** (o tema dela entra na fala de abertura do UnooriaAI), e os
 * dois botões da aula são seus. As equipes (E13) são de cada atividade.
 */
export function MissaoEfeitoAmplificador({
  ano,
  missao,
  turma,
}: {
  ano: Ano;
  missao: Missao & { ficha: NonNullable<Missao["ficha"]> };
  turma: TurmaDoProfessor | null;
}) {
  const { ficha } = missao;
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Disponível</Badge>
          <span className="text-[13px] font-semibold text-unooria-neutral-500">{rotuloDaMissao(ano, missao)}</span>
        </div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">{missao.titulo}</h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-unooria-neutral-700">{missao.resumo}</p>
        <div className="flex flex-wrap gap-2">
          <Tag variant="neutral" size="sm" pill>
            {ficha.duracao}
          </Tag>
          <Tag variant="neutral" size="sm" pill>
            EM13CO24
          </Tag>
        </div>
        <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-500">Formato: {ficha.formato}</p>
        <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-500">{ficha.competencia}</p>
      </header>

      <FeedbackAlert
        type="warning"
        title="A missão só abre com uma atividade sua em andamento — e a revelação é você quem conduz"
        description="O tema do pacote entra na fala de abertura do UnooriaAI, então sem uma atividade em andamento o estudante vê uma tela de espera. Durante a aula são dois botões seus, na página da atividade, sempre para a frente: Pausar Telas para Debate e Liberar Etapa 5."
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

      <Card variant="outlined" title="O que a missão NÃO conta ao estudante">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          <p className="max-w-3xl">
            <strong className="text-unooria-neutral-950">Nenhum problema do rascunho chega marcado.</strong> O
            UnooriaAI escreve com segurança e cortesia; a estatística inventada, o trecho copiado e o colega exposto
            só aparecem para quem pergunta. Não há mascote nem aviso dizendo “cuidado, isso viola a LGPD”.
          </p>
          <p className="max-w-3xl">
            <strong className="text-unooria-neutral-950">O feed não muda com o texto.</strong> Qualquer manchete,
            qualquer cuidado: a rede pinça uma frase e entrega o post de madrugada para todo mundo. É essa
            uniformidade que desmonta a culpa individual no debate — por isso o painel mostra a curva da turma.
          </p>
          <p className="max-w-3xl">
            As ferramentas de proteção ficam nos três pontos, <strong>sem ninguém pedir</strong>: usar ou não é o que
            a EM13CO08 mede. O Publicar e os seus dois botões não voltam.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            O que o estudante escreve ao UnooriaAI fica só no aparelho dele: nem você nem a coordenação o leem. As
            quatro habilidades são registradas pelo que ele FAZ, no painel de habilidades da atividade.
          </p>
        </div>
      </Card>

      <AtividadesDaMissao missao={missao} expId="exp02em1b" turma={turma} />
    </div>
  );
}
