import { Badge, Card, Tag } from "@edu/ui/ds";
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
 * Corpo da missão do UNOOTUBE (4º ano · Unidade 1). Não há atividade a
 * configurar nem guia separado: o conteúdo é fixo, o professor entra com a
 * turma e acompanha em "Resultados da turma".
 */
export function MissaoUnooTube({
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
          <p className="pt-4 text-[13px] text-unooria-neutral-500">
            O estudante do 4º ano entra no UnooTube ao fazer login — não há nada para ativar.
          </p>
          {guia ? (
            <div className="pt-4">
              <LinkButton href={guia} variant="secondary">
                Abrir guia da aula
              </LinkButton>
            </div>
          ) : null}
        </Card>
      </section>

      <Card variant="elevated" title="Resultados da turma">
        <div className="flex flex-col gap-3">
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            Por estudante: quantos vídeos salvou, quantas fontes confiáveis escolheu, quantos inscritos
            "ganhou" e se já chegou à virada do ranking. Os números são recalculados a cada visita.
          </p>
          <div>
            <LinkButton href={rotaResultados}>Ver resultados da turma</LinkButton>
          </div>
        </div>
      </Card>
    </div>
  );
}
