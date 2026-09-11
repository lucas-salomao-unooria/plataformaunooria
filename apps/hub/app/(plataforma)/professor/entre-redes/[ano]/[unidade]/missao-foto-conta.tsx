import { Badge, Card, Tag } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import {
  rotaDaMissao,
  rotuloDaMissao,
  type Ano,
  type Missao,
} from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";

/**
 * Corpo da missão O QUE A FOTO CONTA (1º ano · Unidade 1).
 *
 * A ficha apresenta; quem TRABALHA é a tela de resultados — preparação do
 * pacote (IA + aprovação), dashboard ao vivo, projeção da Roda e o botão de
 * liberar a reflexão moram lá, porque é a tela que o professor projeta e
 * opera DURANTE a aula.
 */
export function MissaoFotoConta({
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
            Missão síncrona: a Roda congela os tablets
          </Tag>
          <Tag variant="neutral" size="sm" pill>
            100% formativa, sem nota
          </Tag>
        </div>
        <div className="flex flex-wrap gap-3">
          {guia ? <LinkButton href={guia}>Guia da aula</LinkButton> : null}
          <LinkButton href={rotaResultados} variant="secondary">
            Preparação e aula ao vivo
          </LinkButton>
        </div>
      </header>

      <Card variant="elevated">
        <div className="flex flex-col gap-2 p-1">
          <h2 className="text-[16px] font-bold text-unooria-neutral-950">Competência</h2>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
            {ficha.competencia}
          </p>
          <p className="text-[13px] text-unooria-neutral-500">Formato: {ficha.formato}</p>
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-[18px] font-bold text-unooria-neutral-950">O roteiro da missão</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {ficha.atos.map((ato) => (
            <Card key={ato.rotulo}>
              <div className="flex flex-col gap-1 p-1">
                <h3 className="text-[14px] font-bold text-unooria-neutral-900">{ato.rotulo}</h3>
                <p className="text-[13px] leading-relaxed text-unooria-neutral-700">{ato.texto}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[18px] font-bold text-unooria-neutral-950">Antes da aula</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {ficha.preparo.map((passo) => (
            <li key={passo} className="text-[14px] leading-relaxed text-unooria-neutral-700">
              {passo}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
