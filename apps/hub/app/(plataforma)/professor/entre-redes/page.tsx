import { Tag } from "@edu/ui/ds";
import { CartaoMissao } from "@/components/cartao-missao";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import { ANOS, MISSAO_ATUAL } from "@/lib/entre-redes/catalogo";

/**
 * Trilha do Entre Redes: os anos, as 4 unidades de cada um e o estado de cada
 * missão. Hoje uma única unidade está publicada — 8º ano · Unidade 1 — e as
 * demais aparecem como "Em breve".
 */
export default async function EntreRedesPage() {
  // MISSÃO ÚNICA: enquanto só a Unidade 1 do 8º ano existe, toda atividade do
  // professor pertence a ela (ver nota de modelagem em lib/entre-redes/catalogo).
  // No origem era `prisma.activity.count(...)`; aqui a contagem vem da lista
  // que a api já devolve escopada ao professor do token.
  const resposta = await apiDoServidor<{ atividades: Array<{ id: string }> }>(
    "/atividades",
  );
  const atividadesDaMissaoAtual = resposta?.atividades.length ?? 0;

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
          depois discute o que aconteceu. Cada ano tem <strong>4 unidades</strong>,
          uma missão por unidade. Você configura a missão para a sua disciplina e
          roda com a turma quantas vezes quiser.
        </p>
      </div>

      {ANOS.map((ano) => (
        <section key={ano.slug} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-unooria-neutral-200 pb-2">
            <h2 className="text-[18px] font-bold text-unooria-neutral-950">
              {ano.rotulo}
            </h2>
            <span className="text-[12px] text-unooria-neutral-500">
              {ano.etapa}
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
        </section>
      ))}
    </div>
  );
}
