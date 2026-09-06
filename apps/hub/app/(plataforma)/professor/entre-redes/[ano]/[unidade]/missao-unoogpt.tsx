import { Badge, Card, FeedbackAlert, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { Trilha } from "@/components/trilha";
import {
  rotaDaMissao,
  rotuloDaMissao,
  type Ano,
  type Missao,
} from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";

/**
 * Corpo da MISSÃO TEMPESTADE (2ª série do EM · Unidade 1).
 *
 * Diferente das outras duas: aqui o professor tem uma ação AO VIVO e sem ela a
 * aula não começa — a largada do relógio. Por isso a ficha abre com o aviso,
 * em vez de deixar a informação no fim de uma lista de preparo.
 *
 * Molde: `missao-unootube.tsx`. `FeedbackAlert` e não `AlertBox`: o segundo é
 * diálogo de 436px, e aqui a faixa é de contexto (o prop é `type`, não
 * `variant`).
 */
export function MissaoUnooGPT({
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
      <Trilha
        itens={[
          { label: "Início", href: "/professor" },
          { label: "Entre Redes", href: "/professor/entre-redes" },
          { label: rotuloDaMissao(ano, missao) },
        ]}
      />

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

      {/* A informação que decide se a aula acontece. Ela não pode estar no fim
          de uma lista: sem a largada o estudante vê o cronômetro parado, e "não
          abre" é o suporte que esta faixa existe para evitar. */}
      <FeedbackAlert
        type="warning"
        title="Esta missão só começa quando você der a largada"
        description="O relógio é da TURMA, não de cada estudante. Enquanto você não largar, todos veem o cronômetro parado e ninguém fala com o assistente. A largada, o +2 min e o encerrar ficam em Resultados da turma."
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
            Cada uma das 8 fontes distorce a cidade de um jeito: o satélite vê telhado e não vê
            morador, e infla o bairro industrial; o cadastro de moradores está velho onde a cidade
            cresceu. <strong className="text-unooria-neutral-950">A missão nunca revela isso.</strong>
          </p>
          <p className="max-w-3xl">
            Não é omissão — é o desenho. Um estudante que descobre pela tela qual fonte engana em quê
            aprende a decorar uma tabela; um estudante que descobre no debate, comparando o que ele viu
            com o que o colega viu, aprende a desconfiar de fonte única. O material da conversa é
            seu, e o relatório de cada estudante mostra em que ordem ele olhou as coisas.
          </p>
          <p className="max-w-3xl text-[13px] text-unooria-neutral-500">
            O relatório também distingue duas coisas que parecem iguais: “teve a chance e não foi” é
            diferente de “a oportunidade não chegou”. Bairro sem fonte carregada aparece em branco
            para o estudante, nunca como “zero em risco”.
          </p>
        </div>
      </Card>

      <Card variant="elevated" title="Resultados da turma">
        <div className="flex flex-col gap-3">
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            O relógio da aula e o retrato da turma: quantos começaram, quantos viram fontes em
            conflito, quantos decidiram sem consultar nada e quantos justificaram por intuição.{" "}
            <strong className="text-unooria-neutral-950">
              A lista não tem coluna de resgatados
            </strong>{" "}
            — listagem é ordenável, e ordenar crianças por acerto viraria ranking. O número fica na
            tela individual, uma por vez.
          </p>
          <div>
            <LinkButton href={rotaResultados}>Abrir a aula e os resultados</LinkButton>
          </div>
        </div>
      </Card>
    </div>
  );
}
