import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo do JÚRI ESTADUAL DE PROJETOS (6º ano · Unidade 1).
 *
 * **Existe porque a ausência dele é MUDA.** Sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do INSTANOORIA, com "Nova atividade"
 * gravando em `exp08ef1b_activities`, que esta missão nunca lê, e sem o
 * caminho para a página da atividade, onde se liberam a galeria e a lousa.
 *
 * A ficha abre com os dois fatos que mudam a condução, e eles não podem estar
 * no fim de uma lista: **a mostra se prepara antes** (o banco padrão em um
 * toque, ou a personalizada com IA) e **é um botão só, que não volta**.
 *
 * `FeedbackAlert` e não `AlertBox`: o segundo é diálogo de 436px, e aqui a
 * faixa é de contexto (o prop é `type`, não `variant`).
 */
export function MissaoJuriEstadual({
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
        </div>
        <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-500">Formato: {ficha.formato}</p>
        <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-500">{ficha.competencia}</p>
      </header>

      <FeedbackAlert
        type="info"
        title="Prepare antes: banco padrão ou mostra personalizada"
        description="Em Nova atividade, use o Banco Padrão Oficial (a Feira de Ciências e Sustentabilidade, sem IA, em um toque) ou gere os dezesseis estandes com IA sobre o tema da sua aula. Sem saldo de IA, o banco padrão entra no lugar. Durante a aula é um botão só — Liberar Auditoria —, e ele não volta. A missão só abre para a turma com uma atividade sua em andamento."
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
            <strong className="text-unooria-neutral-950">Nada na tela diz que o feed se adapta.</strong> Nenhum aviso,
            nenhum contador de afinidade: cada curtida e cada parada longa num post mudam o que vem a seguir em
            silêncio, e a cédula só oferece os estandes que o feed de cada um mostrou. É essa certeza construída sem
            saber que a Galeria Oculta confronta.
          </p>
          <p className="max-w-3xl">
            A taxa de invisibilidade que cada computador vê é <strong>real e diferente</strong> para cada um: é a parte
            dos dezesseis estandes que não chegou àquele feed. Quem curtiu duas vezes a mesma área vê a taxa mais
            alta; quem não curtiu nada viu um feed mais misturado. Não há número certo, e nenhum é anunciado.
          </p>
          <p className="max-w-3xl">
            O voto é <strong>lacrado</strong>: depois de confirmar, não volta. É o que faz a turma chegar ao pico com
            uma escolha comprometida — e a revisão, depois da galeria, mostrar o que mudou com a evidência.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            Não há nota, ranking nem “você errou”: na lousa vão só os votos por área e a média da turma, sem nomes, e
            a folha com nomes não tem voto nem taxa. Durante a aula o feed segue uma regra fixa, sem inteligência
            artificial — a IA só escreve os estandes no preparo.
          </p>
        </div>
      </Card>

      <AtividadesDaMissao missao={missao} expId="exp06ef1b" turma={turma} />
    </div>
  );
}
