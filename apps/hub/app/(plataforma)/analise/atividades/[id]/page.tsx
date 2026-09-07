import { notFound } from 'next/navigation';

import { Card, ScrollBar } from '@edu/ui/ds';
import { LinkButton } from '@/components/link-button';
import type { AnaliseDeProduto } from '@/lib/analise-tipos';
import { apiDoServidor } from '@/lib/api-servidor';

/**
 * Detalhe de uma atividade para o time da Unooria, com a **eficácia da escrita
 * por perfil** (doc 11 §5.2) em primeiro lugar — é a única métrica do sistema
 * capaz de refutar a premissa do produto, e por isso a mais valiosa que temos.
 */
export default async function AnaliseDaAtividadePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ escolaId?: string }>;
}) {
  const { id } = await params;
  const { escolaId } = await searchParams;
  const escola = escolaId?.trim() ?? '';

  /**
   * A escola vem na URL porque `admin-contrato` viaja com `escolaId` vazio no
   * token (ver `../../seletor-de-escola.tsx`). Uma chamada só: a api valida o
   * id e devolve a análise; `null` cobre id inválido, atividade de outra escola
   * e atividade inexistente — os três casos que o origem tratava separado.
   */
  const analise = escola
    ? await apiDoServidor<AnaliseDeProduto>(
        `/analise/atividades/${id}?escolaId=${encodeURIComponent(escola)}`,
      )
    : null;
  if (!analise) notFound();
  const { resumo, eficaciaDaEscrita: eficacia } = analise;

  const pct = (valor: number | null) => (valor === null ? '—' : `${Math.round(valor * 100)}%`);
  const seg = (valor: number | null) => (valor === null ? '—' : `${valor.toFixed(2).replace('.', ',')}s`);

  /**
   * O agregado por componente vem indexado pela chave (é um Record, para o CSV e
   * o JSON ficarem estáveis); o rótulo humano mora aqui.
   */
  const ROTULO: Record<string, string> = {
    continuidade: 'Continuidade',
    atencao: 'Atenção',
    gestos: 'Gestos',
    voluntariedade: 'Voluntariedade',
    exploracao: 'Exploração',
  };

  /** Quantos perfis têm amostra suficiente dos dois lados da comparação. */
  const comDelta = eficacia.filter((linha) => linha.delta !== null);
  const positivos = comDelta.filter((linha) => (linha.delta ?? 0) > 0).length;

  return (
    // Fontes, superfície e header vêm da casca da área (`../../layout.tsx`).
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
            análise de produto
          </p>
          <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
            {analise.atividade.titulo}
          </h1>
          <p className="text-[13px] text-unooria-neutral-600">
            {resumo.runs} sessão(ões) · {resumo.concluidas} com conclusão escrita ·{' '}
            {analise.atividade.status}
          </p>
        </div>
        <LinkButton
          href={`/analise?escolaId=${encodeURIComponent(escola)}`}
          variant="secondary"
          size="sm"
        >
          Voltar
        </LinkButton>
      </header>

      {/* A métrica que pode derrubar a premissa */}
      <Card variant="elevated">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-unooria-neutral-950">
              Eficácia da escrita por perfil
            </h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-600">
              Segundos por post de cada linguagem, entre estudantes daquele perfil e entre os demais. O
              denominador é a <strong>exposição</strong> — sem isso a métrica mediria o próprio viés
              do feed e confirmaria a premissa por construção.
            </p>
          </div>

          <ScrollBar orientation="both" autoHide className="tabela-rolavel">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead className="bg-unooria-neutral-100">
                <tr className="text-[12px] text-unooria-neutral-700">
                  <th className="px-3 py-2 font-semibold">Linguagem</th>
                  <th className="px-3 py-2 font-semibold">Entre estudantes do perfil</th>
                  <th className="px-3 py-2 font-semibold">Entre os outros</th>
                  <th className="px-3 py-2 font-semibold">Delta</th>
                  <th className="px-3 py-2 font-semibold">Amostra</th>
                </tr>
              </thead>
              <tbody>
                {eficacia.map((linha) => (
                  <tr key={linha.perfil} className="border-t border-unooria-neutral-200 text-[13px]">
                    <td className="px-3 py-2 font-semibold text-unooria-neutral-950">
                      {linha.rotulo}
                    </td>
                    <td className="px-3 py-2 text-unooria-neutral-800">
                      {seg(linha.dwellDosDoPerfil)}
                    </td>
                    <td className="px-3 py-2 text-unooria-neutral-800">{seg(linha.dwellDosOutros)}</td>
                    <td
                      className={`px-3 py-2 font-bold ${
                        linha.delta === null
                          ? 'text-unooria-neutral-400'
                          : linha.delta > 0
                            ? 'text-unooria-navy-800'
                            : 'text-unooria-coral-600'
                      }`}
                    >
                      {linha.delta === null
                        ? 'sem amostra'
                        : `${linha.delta > 0 ? '+' : ''}${linha.delta.toFixed(2).replace('.', ',')}s`}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-unooria-neutral-500">
                      {linha.amostra.estudantesDoPerfil} × {linha.amostra.estudantesDeOutros}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBar>

          <div className="rounded-lg border border-unooria-neutral-200 bg-unooria-neutral-50 p-3">
            <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
              {comDelta.length === 0 ? (
                <>
                  Nenhum perfil tem amostra suficiente nos dois lados da comparação ainda. Esta
                  métrica pede turmas com os quatro perfis representados.
                </>
              ) : (
                <>
                  Delta médio <strong>{analise.eficaciaMedia?.toFixed(2).replace('.', ',')}s</strong> ·{' '}
                  {positivos} de {comDelta.length} linguagens com delta positivo.{' '}
                  {positivos === comDelta.length
                    ? 'As fichas de linguagem estão funcionando nesta turma.'
                    : positivos === 0
                      ? 'Nesta turma as fichas de linguagem não produziram diferença — o achado que refuta a premissa.'
                      : 'Resultado misto: vale olhar quais fichas prenderam e quais não.'}
                </>
              )}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-unooria-neutral-500">
              Uma turma não decide nada: o valor está na consistência entre turmas. Delta zero
              repetido significa que as fichas do doc 10 §3 precisam ser reescritas — e é melhor
              descobrir com número do que com achismo.
            </p>
          </div>
        </div>
      </Card>

      {/* Os agregados da atividade */}
      <Card variant="elevated">
        <div className="flex flex-col gap-4">
          <h2 className="text-[16px] font-semibold text-unooria-neutral-950">Imersão e sessão</h2>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ['Imersão média', resumo.imersao.media === null ? '—' : `${resumo.imersao.media}/100`],
              ['Poder do viés semeado', pct(resumo.poderDoViesSemeado)],
              ['Taxa de inversão', pct(resumo.taxaDeInversao)],
              ['Achou a busca', pct(resumo.descobertaDaBusca)],
              [
                'Conteúdo morto',
                `${pct(resumo.conteudoMorto.fracao)} (${resumo.conteudoMorto.posts}/${resumo.conteudoMorto.total})`,
              ],
              ['Imagens ok', pct(resumo.taxaDeImagensOk)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg border border-unooria-neutral-200 p-3">
                <dt className="text-[12px] leading-tight text-unooria-neutral-500">{rotulo}</dt>
                <dd className="text-[20px] font-bold text-unooria-neutral-950">{valor}</dd>
              </div>
            ))}
          </dl>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-unooria-neutral-800">
              Os cinco componentes da imersão
            </p>
            <ul className="flex flex-col gap-1.5">
              {Object.entries(resumo.imersao.porComponente).map(([chave, valor]) => (
                <li key={chave} className="flex flex-col gap-0.5">
                  <span className="flex justify-between text-[12px] text-unooria-neutral-700">
                    <span>{ROTULO[chave] ?? chave}</span>
                    <span className="font-semibold">{valor}/20</span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-unooria-neutral-200">
                    <span
                      className="block h-full rounded-full bg-unooria-navy-800"
                      style={{ width: `${Math.round((valor / 20) * 100)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
