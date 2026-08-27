import { Card, Tag } from "@edu/ui/ds";
import { CartaoMissao } from "@/components/cartao-missao";
import { CartaoTransversal } from "@/components/cartao-transversal";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  ETAPAS,
  MISSAO_ATUAL,
  MISSOES_TRANSVERSAIS,
  UNIDADES_POR_ANO,
  type Ano,
} from "@/lib/entre-redes/catalogo";

/**
 * Trilha do Entre Redes: a grade da Educação Básica inteira (1º ao 9º ano e as
 * 3 séries do Médio), agrupada por etapa.
 *
 * Ano COM missão publicada abre a grade das 4 unidades; ano sem nenhuma
 * publicada vira uma linha só. Com 12 anos × 4 unidades, desenhar 48 cartões
 * "Em breve" afogaria as duas missões que existem — a linha compacta mantém a
 * promessa (o ano está na trilha) sem virar ruído.
 */
export default async function EntreRedesPage() {
  // MISSÃO ÚNICA: enquanto só a Unidade 1 do 8º ano tem atividades, toda
  // atividade do professor pertence a ela (ver nota em lib/entre-redes/catalogo).
  // No origem era `prisma.activity.count(...)`; aqui a contagem vem da lista
  // que a api já devolve escopada ao professor do token.
  const resposta = await apiDoServidor<{ atividades: Array<{ id: string }> }>(
    "/atividades",
  );
  const atividadesDaMissaoAtual = resposta?.atividades.length ?? 0;

  const temMissao = (ano: Ano) =>
    ano.missoes.some((missao) => missao.status === "disponivel");

  return (
    <div className="flex flex-col gap-8">
      <Trilha
        itens={[{ label: "Início", href: "/professor" }, { label: "Entre Redes" }]}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-bold text-unooria-neutral-950">
            Entre Redes
          </h1>
          <Tag variant="brand" size="sm" pill>
            Letramento digital
          </Tag>
        </div>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          Missões em que a turma vive por dentro como as redes funcionam — e só
          depois discute o que aconteceu. Do 1º ano do Fundamental à 3ª série do
          Médio, cada ano tem <strong>4 unidades</strong>, uma missão por
          unidade — e há missões <strong>transversais</strong>, que valem para
          qualquer ano. Você configura a missão para a sua disciplina e roda com
          a turma quantas vezes quiser.
        </p>
      </div>

      {/*
        As TRANSVERSAIS vêm antes da grade, e fora dela.
        Não é hierarquia: é que a grade é lida como "onde a minha missão mora",
        por ano e unidade. Uma missão sem ano dentro dela viraria um card órfão
        que o professor tenta encaixar num ano e não consegue. Acima, com o
        próprio título, ela se apresenta pelo que é — vale para qualquer turma.
      */}
      {MISSOES_TRANSVERSAIS.length > 0 ? (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[12px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
              Para qualquer ano
            </h2>
            <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-600">
              Missões que não pertencem a uma unidade. Rode com a sua turma seja
              qual for o ano dela.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MISSOES_TRANSVERSAIS.map((missao) => (
              <li key={missao.slug} className="h-full">
                <CartaoTransversal missao={missao} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ETAPAS.map((etapa) => (
        <section key={etapa.id} className="flex flex-col gap-5">
          <h2 className="text-[12px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
            {etapa.rotulo}
          </h2>

          {etapa.anos.map((ano) =>
            temMissao(ano) ? (
              <div key={ano.slug} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-unooria-neutral-200 pb-2">
                  <h3 className="text-[18px] font-bold text-unooria-neutral-950">
                    {ano.rotulo}
                  </h3>
                  <span className="text-[12px] text-unooria-neutral-500">
                    {ano.missoes.filter((m) => m.status === "disponivel").length}{" "}
                    de {UNIDADES_POR_ANO} unidades publicadas
                  </span>
                </div>

                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {ano.missoes.map((missao) => (
                    <li key={missao.unidadeSlug} className="h-full">
                      <CartaoMissao
                        ano={ano}
                        missao={missao}
                        atividades={
                          missao.anoSlug === MISSAO_ATUAL.anoSlug &&
                          missao.unidadeSlug === MISSAO_ATUAL.unidadeSlug
                            ? atividadesDaMissaoAtual
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Card key={ano.slug} variant="outlined">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold text-unooria-neutral-700">
                    {ano.rotulo}
                  </span>
                  <span className="text-[13px] text-unooria-neutral-500">
                    {UNIDADES_POR_ANO} unidades em produção
                  </span>
                </div>
              </Card>
            ),
          )}
        </section>
      ))}
    </div>
  );
}
