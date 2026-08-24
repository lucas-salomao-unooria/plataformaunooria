import { notFound } from 'next/navigation';

import { LinkButton } from '@/components/link-button';
import { Trilha } from '@/components/trilha';
import type { AnaliseDaTurma } from '@/lib/analise-tipos';
import { apiDoServidor } from '@/lib/api-servidor';
import {
  MISSAO_ATUAL,
  buscarMissao,
  rotaDaMissao,
  rotuloDaMissao,
} from '@/lib/entre-redes/catalogo';

import { PainelAnalise } from './painel-analise';

/**
 * Nível pedagógico (doc 11 §4.2). Server component: a análise é uma leitura só,
 * não precisa de polling — a turma já terminou quando esta tela importa.
 */
export default async function AnalisePedagogicaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /**
   * Uma chamada só: a api valida o id, confere que a atividade é DESTE professor
   * (o token diz quem ele é) e devolve a análise. O `findFirst` que existia aqui
   * para checar posse virou a guarda de lá — e `null` cobre os três casos que o
   * origem tratava separado: id inválido, atividade de outro, atividade sumida.
   */
  const analise = await apiDoServidor<AnaliseDaTurma>(`/atividades/${id}/analise`);
  if (!analise) notFound();

  const atividade = analise.atividade;

  // MISSÃO ÚNICA: ver nota de modelagem em lib/entre-redes/catalogo.ts.
  const missao = buscarMissao(MISSAO_ATUAL.anoSlug, MISSAO_ATUAL.unidadeSlug);

  return (
    // A casca do professor (`(plataforma)/professor/layout.tsx`) já dá o
    // `<main>`, a superfície e o max-width que o origem abria aqui.
    <div className="flex flex-col gap-6">
      <Trilha
        itens={[
          { label: 'Início', href: '/professor' },
          { label: 'Entre Redes', href: '/professor/entre-redes' },
          ...(missao
            ? [
                {
                  label: rotuloDaMissao(missao.ano, missao.missao),
                  href: rotaDaMissao(missao.missao),
                },
              ]
            : []),
          { label: atividade.titulo, href: `/professor/atividades/${id}` },
          { label: 'Análise da turma' },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
            análise da turma
          </p>
          <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
            {analise.atividade.titulo}
          </h1>
          <p className="max-w-2xl text-[14px] leading-relaxed text-unooria-neutral-700">
            “{analise.atividade.perguntaChave}”
          </p>
        </div>

        <div className="flex gap-2">
          <LinkButton href={`/professor/atividades/${id}`} variant="secondary" size="sm">
            Voltar à atividade
          </LinkButton>
          <LinkButton
            href={`/api/plataforma/atividades/${id}/analise/csv`}
            variant="primary"
            size="sm"
          >
            Baixar CSV
          </LinkButton>
        </div>
      </header>

      <PainelAnalise analise={analise} />
    </div>
  );
}
