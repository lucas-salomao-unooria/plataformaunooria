"use client";

import { Card, ScrollBar, Table, Tag, type TableColumn } from "@edu/ui/ds";

/**
 * Os 21 vídeos do UnooTube COM o gabarito — BLOCO VIVO do guia.
 *
 * Vem de `GET /unootube/professor/videos` (professor only), nunca de cópia
 * aqui. O guia guardava isto em prosa — "metade cita fonte verificável, a outra
 * metade é sensacionalista" — e a prosa já tinha derivado do catálogo: são 11 e
 * 10, porque 21 é ímpar. O professor também não tinha como saber QUAL vídeo é
 * qual, e a criança de 9 anos que levanta a mão cita o vídeo pelo apelido.
 *
 * Client component de propósito, pelo mesmo motivo de `tabela-resultados.tsx`:
 * `columns[].render` do `Table` do DS é função e não atravessa a fronteira RSC.
 */
export interface VideoDoProfessor {
  id: string;
  titulo: string;
  handle: string;
  inscritosRotulo: string;
  factual: boolean;
}

export interface VideosDoProfessor {
  videos: VideoDoProfessor[];
  resumo: { total: number; factuais: number; sensacionalistas: number };
  pontuacao: { limiteSalvos: number; inscritosPorFake: number; inscritosPorConfiavel: number };
}

interface Linha extends Record<string, unknown>, VideoDoProfessor {}

const numero = new Intl.NumberFormat("pt-BR");

const colunas: TableColumn<Linha>[] = [
  {
    key: "titulo",
    title: "Vídeo",
    minWidth: 320,
    render: (_, v) => (
      <span className="flex flex-col">
        <span className="font-semibold text-unooria-neutral-950">{v.titulo}</span>
        <span className="text-[11px] text-unooria-neutral-500">{v.handle}</span>
      </span>
    ),
  },
  { key: "inscritosRotulo", title: "Inscritos", width: 140 },
  {
    key: "factual",
    title: "O que é",
    width: 170,
    render: (_, v) =>
      v.factual ? (
        <Tag variant="success" size="sm" pill>
          cita fonte
        </Tag>
      ) : (
        <Tag variant="danger" size="sm" pill>
          sensacionalista
        </Tag>
      ),
  },
];

export function VideosDoUnootube({ dados }: { dados: VideosDoProfessor | null }) {
  if (!dados) {
    return (
      <div className="guia-bloco">
        <Card variant="outlined" title="A lista dos vídeos não carregou">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Atualize esta página antes da aula. Sem ela você conduz o debate sem saber qual
            vídeo a criança está citando — e é pelo apelido do canal que ela vai citar.
          </p>
        </Card>
      </div>
    );
  }

  const { videos, resumo, pontuacao } = dados;

  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="elevated" title="Os vídeos e o gabarito — só para você">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          <strong>Não projete esta tabela e não avise que há vídeos falsos.</strong> Dito
          antes, a criança para de avaliar e começa a caçar a pegadinha, que é outra tarefa.
          A tabela é para VOCÊ reconhecer o vídeo que ela citar no debate.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-unooria-neutral-800">
          São <strong>{numero.format(resumo.total)} vídeos</strong>:{" "}
          {numero.format(resumo.factuais)} citam fonte verificável e têm poucos inscritos,{" "}
          {numero.format(resumo.sensacionalistas)} são sensacionalistas e têm “1 mil”. Salvar
          um sensacionalista dá{" "}
          <strong>+{numero.format(pontuacao.inscritosPorFake)} inscritos</strong>; salvar um
          confiável dá <strong>+{numero.format(pontuacao.inscritosPorConfiavel)}</strong> e
          conta 1 fonte confiável. No ranking que abre ao{" "}
          {numero.format(pontuacao.limiteSalvos)}º salvo, quem escolheu bem aparece perdendo —
          e a criança precisa sentir isso antes de você explicar.
        </p>
        <ScrollBar orientation="both" autoHide className="tabela-rolavel mt-4">
          <Table<Linha>
            columns={colunas}
            data={videos.map((v) => ({ ...v }))}
            keyExtractor={(v) => v.id}
            emptyText="O catálogo voltou vazio."
            size="sm"
            theme="light"
          />
        </ScrollBar>
      </Card>
    </div>
  );
}
