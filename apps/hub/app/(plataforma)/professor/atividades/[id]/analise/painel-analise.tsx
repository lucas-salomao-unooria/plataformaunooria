'use client';

import { Fragment, useState } from 'react';

import { AlertBox, Badge, Card } from '@edu/ui/ds';
import type { AnaliseDaTurma } from '@/lib/analise-tipos';

/**
 * A tela de análise pedagógica (doc 11 §4.2).
 *
 * A ordem das seções não é decorativa: a **tabela conclusão × lado semeado** vem
 * primeiro porque é o resultado experimental da turma e o insumo direto do
 * momento-espelho (doc 09). Tudo abaixo dela existe para explicá-la.
 */
export function PainelAnalise({ analise }: { analise: AnaliseDaTurma }) {
  const [aberto, setAberto] = useState<string | null>(null);

  const { atividade, conclusaoPorLadoSemeado: tabela, poderDoViesSemeado: poder } = analise;
  const rotulo = (lado: 'A' | 'B') => (lado === 'A' ? atividade.ladoALabel : atividade.ladoBLabel);
  const duracao = (ms: number) => {
    const total = Math.round(ms / 1000);
    return total >= 60 ? `${Math.floor(total / 60)}min${String(total % 60).padStart(2, '0')}s` : `${total}s`;
  };

  return (
    <div className="flex flex-col gap-6">
      {analise.turma.naMissao > 0 ? (
        <AlertBox
          theme="light"
          variant="info"
          device="auto"
          title={`${analise.turma.naMissao} estudante(s) ainda na missão`}
          description="Os números abaixo mudam enquanto eles terminam. Vale esperar antes de projetar a tabela para a sala."
        />
      ) : null}

      {/* 1. A tabela que vale a aula */}
      <Card variant="elevated">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-unooria-neutral-950">
              Conclusão × lado em que o feed nasceu
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-unooria-neutral-600">
              As linhas são o lado que o perfil do Ato 1 escolheu para cada estudante. As colunas são o que
              cada um escreveu no fim, antes de saber que existia um lado. Se a diagonal for forte, o
              viés semeado previu a conclusão da turma.
            </p>
          </div>

          <div className="tabela-rolavel">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="text-[12px] text-unooria-neutral-600">
                  <th className="px-3 py-2 font-semibold">feed nasceu em</th>
                  <th className="px-3 py-2 text-center font-semibold">
                    concluiu “{atividade.ladoALabel}”
                  </th>
                  <th className="px-3 py-2 text-center font-semibold">ficou em dúvida</th>
                  <th className="px-3 py-2 text-center font-semibold">
                    concluiu “{atividade.ladoBLabel}”
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['A', tabela.semeadoEmA],
                    ['B', tabela.semeadoEmB],
                  ] as const
                ).map(([lado, celula]) => (
                  <tr key={lado} className="border-t border-unooria-neutral-200">
                    <td className="px-3 py-2.5 text-[13px] font-semibold text-unooria-neutral-900">
                      {rotulo(lado)}
                    </td>
                    {(['A', 'duvida', 'B'] as const).map((coluna) => {
                      const naDiagonal = coluna === lado;
                      return (
                        <td key={coluna} className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-[15px] font-bold ${
                              naDiagonal
                                ? 'bg-unooria-navy-800 text-white'
                                : 'bg-unooria-neutral-100 text-unooria-neutral-800'
                            }`}
                          >
                            {celula[coluna]}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [
                'Seguiram o lado que receberam',
                poder.taxa === null ? '—' : `${Math.round(poder.taxa * 100)}%`,
                `${poder.seguiram} de ${poder.seguiram + poder.viraram} que tomaram lado`,
              ],
              ['Concluíram no lado oposto', String(poder.viraram), 'os que viraram o jogo na escrita'],
              ['Ficaram em dúvida', String(poder.emDuvida), 'não contam a favor nem contra'],
            ].map(([titulo, valor, apoio]) => (
              <div key={titulo} className="rounded-lg border border-unooria-neutral-200 p-3">
                <p className="text-[12px] leading-tight text-unooria-neutral-500">{titulo}</p>
                <p className="text-[22px] font-bold text-unooria-neutral-950">{valor}</p>
                <p className="text-[11px] leading-tight text-unooria-neutral-500">{apoio}</p>
              </div>
            ))}
          </div>

          <p className="text-[12px] leading-relaxed text-unooria-neutral-500">
            Cuidado ao ler: a taxa mede correlação numa turma, não prova de causa. O contraexemplo está
            na própria sala — os {poder.viraram} que concluíram no lado oposto.
          </p>

          {/*
            QUAL resposta a tabela está lendo. A tela do estudante convida a mudar de
            ideia ("vale a última") enquanto a turma termina, e a tabela usa a
            última — mas se boa parte da sala trocou depois de sair do feed, a
            correlação está falando de um momento diferente do que parece. Antes
            a primeira escolha nem era guardada, e a pergunta não tinha resposta.
          */}
          {poder.trocaramDeIdeia > 0 ? (
            <p className="text-[12px] leading-relaxed text-unooria-neutral-500">
              A tabela usa a <strong>última</strong> resposta de cada um.{' '}
              {poder.trocaramDeIdeia === 1
                ? '1 estudante mexeu na resposta'
                : `${poder.trocaramDeIdeia} estudantes mexeram na resposta`}{' '}
              depois de escolher pela primeira vez
              {poder.terminaramNoutroLado > 0
                ? `, e ${poder.terminaramNoutroLado} terminaram num lado diferente do que marcaram de cara`
                : ', sem mudar de lado'}
              .
            </p>
          ) : null}
        </div>
      </Card>

      {/* 2. A largada e as viradas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="elevated">
          <div className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold text-unooria-neutral-950">A largada</h2>
            <dl className="flex flex-col gap-1.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-unooria-neutral-600">{atividade.ladoALabel}</dt>
                <dd className="font-semibold text-unooria-neutral-950">{analise.largada.porLado.A}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-unooria-neutral-600">{atividade.ladoBLabel}</dt>
                <dd className="font-semibold text-unooria-neutral-950">{analise.largada.porLado.B}</dd>
              </div>
            </dl>
            <p className="text-[12px] text-unooria-neutral-500">
              de onde veio o lado:{' '}
              {Object.entries(analise.largada.porOrigem)
                .map(([origem, quantos]) => `${origem} ${quantos}`)
                .join(' · ') || '—'}
            </p>
          </div>
        </Card>

        <Card variant="elevated">
          <div className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold text-unooria-neutral-950">
              Quem virou o jogo no feed
            </h2>
            {analise.turma.inverteram.length === 0 ? (
              <p className="text-[13px] text-unooria-neutral-600">
                Ninguém inverteu o lado dominante nesta turma.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {analise.turma.inverteram.map((estudante) => (
                  <li key={estudante.username} className="flex flex-wrap items-baseline gap-1.5">
                    <span className="font-semibold text-unooria-neutral-950">{estudante.displayName}</span>
                    <span className="text-unooria-neutral-600">
                      {estudante.de} → {estudante.para}
                    </span>
                    {estudante.bloco ? (
                      <Badge variant="info" size="sm">
                        bloco {estudante.bloco}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[12px] leading-relaxed text-unooria-neutral-500">
              Pergunte a eles o que fizeram diferente. É a prova, dentro da sala, de que o viés não é
              destino.
            </p>
          </div>
        </Card>
      </div>

      {/* 3. Busca, imersão e quem não concluiu */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="elevated">
          <div className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold text-unooria-neutral-950">A saída que existia</h2>
            <p className="text-[13px] text-unooria-neutral-700">
              <strong>{analise.busca.usaram}</strong> abriram a busca ·{' '}
              <strong>{analise.busca.naoUsaram}</strong> não abriram nenhuma vez.
            </p>
            {analise.busca.termos.length > 0 ? (
              <p className="text-[12px] leading-relaxed text-unooria-neutral-600">
                o que a turma procurou: {analise.busca.termos.slice(0, 20).join(' · ')}
              </p>
            ) : (
              <p className="text-[12px] text-unooria-neutral-500">Ninguém digitou nada na busca.</p>
            )}
          </div>
        </Card>

        <Card variant="elevated">
          <div className="flex flex-col gap-3">
            <h2 className="text-[16px] font-semibold text-unooria-neutral-950">
              Envolvimento médio da turma
            </h2>
            <p className="text-[26px] font-bold leading-none text-unooria-neutral-950">
              {analise.imersao.media ?? '—'}
              <span className="text-[14px] font-normal text-unooria-neutral-500"> / 100</span>
            </p>
            <ul className="flex flex-col gap-1.5">
              {analise.imersao.porComponente.map((componente) => (
                <li key={componente.chave} className="flex flex-col gap-0.5">
                  <span className="flex justify-between text-[12px] text-unooria-neutral-700">
                    <span>{componente.rotulo}</span>
                    <span className="font-semibold">{componente.media}/20</span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-unooria-neutral-200">
                    <span
                      className="block h-full rounded-full bg-unooria-navy-800"
                      style={{ width: `${Math.round((componente.media / 20) * 100)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] leading-relaxed text-unooria-neutral-500">
              Só entra na média quem consumiu 8 posts ou mais — senão o atraso no login vira
              “desengajamento”.
            </p>
          </div>
        </Card>
      </div>

      {analise.turma.semConcluir.length > 0 ? (
        <Card variant="elevated">
          <div className="flex flex-col gap-2">
            <h2 className="text-[16px] font-semibold text-unooria-neutral-950">
              Não entregaram a conclusão ({analise.turma.semConcluir.length})
            </h2>
            <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
              {analise.turma.semConcluir
                .map((estudante) => `${estudante.displayName} (${estudante.fase})`)
                .join(' · ')}
            </p>
          </div>
        </Card>
      ) : null}

      {/* 4. Drill-down por estudante */}
      <Card variant="elevated">
        <div className="flex flex-col gap-3">
          <h2 className="text-[16px] font-semibold text-unooria-neutral-950">Estudante por estudante</h2>
          <div className="tabela-rolavel">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead className="bg-unooria-neutral-100">
                <tr className="text-[12px] text-unooria-neutral-700">
                  <th className="px-3 py-2 font-semibold">Estudante</th>
                  <th className="px-3 py-2 font-semibold">Perfil (jogo)</th>
                  <th className="px-3 py-2 font-semibold">Nasceu em</th>
                  <th className="px-3 py-2 font-semibold">Terminou em</th>
                  <th className="px-3 py-2 font-semibold">Concluiu</th>
                  <th className="px-3 py-2 font-semibold">Tempo no lado</th>
                  <th className="px-3 py-2 font-semibold">Busca</th>
                  <th className="px-3 py-2 font-semibold">Envolvimento</th>
                </tr>
              </thead>
              <tbody>
                {(analise.estudantes ?? []).map((estudante) => {
                  const outro = estudante.bolha.ladoInicial === 'A' ? 'B' : 'A';
                  const expandido = aberto === estudante.runId;
                  const perfilEstudante = estudante.estudante!;
                  return (
                    <Fragment key={estudante.runId}>
                      <tr
                        className="cursor-pointer border-t border-unooria-neutral-200 text-[13px] hover:bg-unooria-neutral-50"
                        onClick={() => setAberto(expandido ? null : estudante.runId)}
                      >
                        <td className="px-3 py-2">
                          <span className="font-semibold text-unooria-neutral-950">
                            {perfilEstudante.displayName}
                          </span>
                          <span className="block text-[11px] text-unooria-neutral-500">
                            {perfilEstudante.username}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[12px] text-unooria-neutral-700">
                          {estudante.perfilJogo?.dominante ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-unooria-neutral-700">
                          {rotulo(estudante.bolha.ladoInicial)}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-unooria-neutral-700">
                          {estudante.ladoDominante === 'indefinido'
                            ? 'sem lado'
                            : rotulo(estudante.ladoDominante)}
                          {estudante.bolha.inverteu ? ' ↺' : ''}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-unooria-neutral-700">
                          {estudante.conclusao
                            ? estudante.conclusao.inclinacao === 'duvida'
                              ? 'em dúvida'
                              : rotulo(estudante.conclusao.inclinacao)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-unooria-neutral-700">
                          {duracao(estudante.tempo.porLadoMs[estudante.bolha.ladoInicial])} ·{' '}
                          {duracao(estudante.tempo.porLadoMs[outro])}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-unooria-neutral-700">
                          {estudante.investigacao.usosDaBusca}
                        </td>
                        {/*
                          As cinco barras, sem o total (ADR-44). O número existe e
                          continua na linha expandida — mas numa COLUNA de tabela
                          ele vira nota: ordenável, comparável, e lida como
                          ranking de crianças. E ele é somável justamente onde
                          menos se sustenta: Gestos e Exploração ficam em 0/20 na
                          maioria das sessões, então o teto real não é 100 e dois
                          estudantes com o mesmo número chegaram lá por caminhos
                          diferentes — que é exatamente o que a própria tela
                          avisa, três parágrafos abaixo, e mostrava assim mesmo.
                        */}
                        <td className="px-3 py-2">
                          <span className="flex gap-0.5" aria-hidden>
                            {estudante.imersao.componentes.map((componente) => (
                              <span
                                key={componente.chave}
                                title={`${componente.rotulo}: ${componente.pontos}/20 — ${componente.detalhe}`}
                                className="h-3.5 w-1.5 overflow-hidden rounded-sm bg-unooria-neutral-200"
                              >
                                <span
                                  className="block w-full bg-unooria-navy-800"
                                  style={{
                                    height: `${Math.round((componente.pontos / 20) * 100)}%`,
                                    marginTop: `${100 - Math.round((componente.pontos / 20) * 100)}%`,
                                  }}
                                />
                              </span>
                            ))}
                          </span>
                          <span className="sr-only">
                            {estudante.imersao.componentes
                              .map((componente) => `${componente.rotulo} ${componente.pontos} de 20`)
                              .join(', ')}
                          </span>
                        </td>
                      </tr>

                      {expandido ? (
                        <tr className="bg-unooria-neutral-50">
                          <td colSpan={8} className="px-3 py-3">
                            <div className="flex flex-col gap-3 text-[12px] leading-relaxed text-unooria-neutral-700">
                              {estudante.conclusao ? (
                                <blockquote className="rounded-lg border border-unooria-neutral-200 bg-white p-3 text-[13px]">
                                  “{estudante.conclusao.texto}”
                                  <span className="mt-1 block text-[11px] text-unooria-neutral-500">
                                    {estudante.conclusao.caracteres} caracteres
                                  </span>
                                </blockquote>
                              ) : (
                                <p>Sem conclusão escrita.</p>
                              )}

                              <ul className="grid gap-1.5 sm:grid-cols-2">
                                {estudante.imersao.componentes.map((componente) => (
                                  <li key={componente.chave}>
                                    <strong>{componente.rotulo}</strong> {componente.pontos}/20 —{' '}
                                    {componente.detalhe}
                                  </li>
                                ))}
                              </ul>

                              <p>
                                {estudante.postsConsumidos} posts em {duracao(estudante.tempo.feedMs)} (ativo{' '}
                                {duracao(estudante.tempo.ativoMs)}, {estudante.tempo.vaosOciosos} pausa(s) longa(s))
                                · {estudante.ritmo.postsPorMinuto} posts/min · variação do ritmo{' '}
                                {estudante.ritmo.variacaoDoRitmo}
                              </p>
                              <p>
                                curtidas {estudante.interacoes.curtidas} · comentários{' '}
                                {estudante.interacoes.comentarios} · salvos {estudante.interacoes.salvos} ·
                                seguiu {estudante.interacoes.seguidos} · parou de verdade em{' '}
                                {estudante.investigacao.consideracaoDoOposto} post(s) do outro lado
                                {estudante.investigacao.termosBuscados.length > 0
                                  ? ` · buscou: ${estudante.investigacao.termosBuscados.join(', ')}`
                                  : ''}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-unooria-neutral-500">
            Clique numa linha para ver a conclusão escrita e os cinco componentes de imersão.
          </p>
        </div>
      </Card>
    </div>
  );
}
