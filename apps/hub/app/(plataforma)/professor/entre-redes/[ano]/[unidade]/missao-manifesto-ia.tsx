import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { rotaDaMissao, rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

/**
 * Corpo de O MANIFESTO DA IA (8º ano · Unidade 4).
 *
 * **Existe porque a ausência dele é MUDA.** Sem entrada no despachante de
 * `page.tsx`, uma missão publicada cai no corpo do INSTANOORIA — que tem
 * "Nova atividade" e não tem "Abrir a aula e os resultados". A professora
 * criaria uma configuração em `exp08ef1b_activities` que esta missão nunca lê, e
 * não acharia o painel do debate. O aviso já estava escrito em
 * `missao-rastro-boato.tsx`, no arquivo ao lado, e mesmo assim aconteceu de
 * novo: quem publica missão nova mexe no despachante no mesmo trabalho.
 *
 * A ficha abre com o que a professora precisa saber ANTES de entrar na sala, e
 * não no fim de uma lista: **não existe cláusula certa**. Descobrir isso no
 * meio do debate, com a turma esperando um veredito, é o pior jeito.
 *
 * `FeedbackAlert` e não `AlertBox`: o segundo é diálogo de 436px, e aqui a
 * faixa é de contexto (o prop é `type`, não `variant`).
 */
export function MissaoManifestoIa({
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

      {/* O fato que muda como você conduz o debate, e ele não pode estar no fim
          de uma lista de preparo: a pergunta "qual era a certa?" vai ser feita
          em voz alta, e a resposta é que não há uma. */}
      <FeedbackAlert
        type="warning"
        title="Não existe cláusula certa — e é você que congela a turma para o debate"
        description="As quatro salvaguardas são válidas, e o painel mostra quantos escolheram cada uma, nunca acerto. O botão que congela as telas no fim do Ato 4 fica em Resultados da turma: sem ele a sala assina em ritmos diferentes e o debate não reúne ninguém."
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
            A máquina <strong className="text-unooria-neutral-950">não admite o viés de graça</strong>.
            Ela abre dizendo que algoritmos são neutros e só reconhece que herda as punições antigas
            como probabilidade válida quando o estudante a contradiz. Por isso fixar a cláusula sem
            ter auditado duas vezes é recusado pelo servidor: a criança precisa ter ouvido a
            contradição antes de decidir o que fazer com ela.
          </p>
          <p className="max-w-3xl">
            As quatro salvaguardas competem de verdade — transparência dos dados, auditoria de viés,
            veto humano e anonimização. Cada uma protege um direito e cobra um preço: o veto humano
            devolve a decisão a uma pessoa e torna o processo lento; a anonimização protege a
            identidade e apaga o contexto de quem precisa de apoio.{" "}
            <strong className="text-unooria-neutral-950">
              Se a turma inteira escolher a mesma, o seu papel é mostrar o custo dela
            </strong>{" "}
            — não corrigir a escolha.
          </p>
          <p className="max-w-3xl">
            A escolha é <strong>irreversível</strong>, e o manifesto que aparece depois é montado no
            servidor com a cláusula dela em destaque. Não há nota, não há pontuação e a folha da
            turma não tem coluna de acerto: listagem é ordenável, e ordenar crianças por cláusula
            escolhida transformaria uma posição ética em ranking.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            Na justificativa do Meu Percurso, dado pessoal — telefone, CPF, e-mail, endereço — é
            recusado na hora, com a dica do que tirar, e{" "}
            <strong className="text-unooria-neutral-700">o texto não chega a ser gravado</strong>. O
            estudante reescreve e envia de novo; você nunca vê o dado.
          </p>
        </div>
      </Card>

      <Card variant="elevated" title="Resultados da turma">
        <div className="flex flex-col gap-3">
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            É de lá que você prepara o caso da sua escola antes da aula, congela as telas para o
            debate e devolve a turma à missão. E é lá que está o retrato: como as quatro cláusulas
            se distribuíram, que palavras-chave a turma marcou e a justificativa de cada estudante,
            uma por vez.{" "}
            <strong className="text-unooria-neutral-950">Nada gerado por inteligência artificial
            chega aos estudantes sem a sua aprovação</strong> — gerar produz rascunho, e o que
            publica é o seu clique. Sem aprovar nada, a missão roda com o pacote curado da Unooria.
          </p>
          <div>
            <LinkButton href={rotaResultados}>Abrir a aula e os resultados</LinkButton>
          </div>
        </div>
      </Card>
    </div>
  );
}
