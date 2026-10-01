import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo do JORNAL DA ESCOLA: A EDIÇÃO DE BENTO (4º ano · Unidade 1).
 *
 * **Existe porque a ausência dele é MUDA.** Sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do INSTANOORIA, com "Nova atividade"
 * gravando em `exp08ef1b_activities`, que esta missão nunca lê, e sem o
 * caminho para o painel em que se prepara o pacote e se liberam as etapas.
 *
 * A ficha abre com o fato que muda a condução, e ele não pode estar no fim de
 * uma lista: **são dois portões, num botão só, e ele não volta**. Sem o
 * primeiro clique, quem publicou fica esperando; apertado cedo demais, não se
 * desfaz.
 *
 * `FeedbackAlert` e não `AlertBox`: o segundo é diálogo de 436px, e aqui a
 * faixa é de contexto (o prop é `type`, não `variant`).
 */
export function MissaoJornalEscola({
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
          <span className="text-[13px] font-semibold text-unooria-neutral-500">{rotuloDaMissao(ano, missao)}</span>
        </div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">{missao.titulo}</h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-unooria-neutral-700">{missao.resumo}</p>
        <div className="flex flex-wrap gap-2">
          <Tag variant="neutral" size="sm" pill>
            {ficha.duracao}
          </Tag>
          <Tag variant="neutral" size="sm" pill>
            {ficha.formato}
          </Tag>
        </div>
        <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-500">{ficha.competencia}</p>
      </header>

      <FeedbackAlert
        type="warning"
        title="A aula tem dois portões, num botão só, e ele não volta"
        description="Na página da atividade, o mesmo botão mostra sempre a próxima etapa: primeiro Liberar resultado, depois Liberar revisão. Sem o primeiro clique, quem publicou fica esperando. A missão só abre para a turma com uma atividade sua em andamento: crie o pacote de notícias (pode partir do banco da Unooria, “Feira de Ciências e Notícias da Cidade”), gere as imagens e use a atividade quando a turma for fazer."
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
            <strong className="text-unooria-neutral-950">Nenhuma notícia chega marcada</strong> como
            confiável ou duvidosa, e antes do resultado a tela não diz que a aula é sobre checagem. As
            pistas — de onde veio, quando aconteceu, quem assina — estão disponíveis desde o começo, mas
            ninguém é obrigado a abri-las: é essa escolha espontânea que o resultado mostra.
          </p>
          <p className="max-w-3xl">
            O Bento aparece <strong>só na abertura e na Chave do Editor</strong>. Na mesa ele fica
            calado: um “cuidado com a data” faria todo mundo abrir a data para cumprir a regra, e a
            descoberta do resultado morreria. Pela mesma razão, a pergunta de por que escolheram só vem
            depois da publicação.
          </p>
          <p className="max-w-3xl">
            A 1ª edição é <strong>definitiva</strong>. Depois de publicar não dá para trocar notícia —
            é o que faz os leitores reagirem à escolha que a turma fez, e não à que ela faria depois de
            ouvir a conversa.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            Não há nota, ranking nem “você errou”: o “X de 3 notícias verificadas” descreve a SELEÇÃO,
            não a criança, e é calculado pelo gabarito revisado antes da aula — nunca por um julgamento
            da inteligência artificial durante ela. Nenhuma notícia é chamada de falsa: uma notícia
            antiga pode ser verdadeira, e uma mensagem sem autor pode só não ter evidência para ir à
            capa.
          </p>
        </div>
      </Card>

      <AtividadesDaMissao missao={missao} expId="exp04ef1b" turma={turma} />
    </div>
  );
}
