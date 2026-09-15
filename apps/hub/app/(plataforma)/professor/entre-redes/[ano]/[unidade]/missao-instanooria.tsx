import Link from "next/link";

import { Badge, Card, EmptyState, Tag } from "@edu/ui/ds";
import { CartaoAtividade } from "@/components/cartao-atividade";
import { LinkButton } from "@/components/link-button";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  rotuloDaMissao,
  type Ano,
  type Missao,
} from "@/lib/entre-redes/catalogo";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";
import { statusDaAtividade } from "@/lib/status-atividade";

/** O que a api devolve em GET /atividades (escopado ao professor do token). */
type RespostaAtividades = {
  atividades: Array<{
    id: string;
    /** A turma da atividade (a api passou a devolver junto com o filtro). */
    turmaId: string | null;
    titulo: string;
    disciplina: string;
    recorte: string;
    perguntaChave: string;
    status: string;
    etapa: string;
    criadoEm: string;
    estudantes?: number;
    posts: number;
    sessoes: number;
  }>;
};

/**
 * Corpo da missão do INSTANOORIA (8º ano · Unidade 1): ficha, guia e a lista
 * de atividades que o professor configurou. Recebe a missão já resolvida pelo
 * despachante em `page.tsx`.
 */
export async function MissaoInstanooria({
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
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  // MISSÃO ÚNICA: com uma só missão publicada, toda atividade do professor é
  // desta missão (nota de modelagem em lib/entre-redes/catalogo.ts).
  // No origem era `prisma.activity.findMany(...)`; a api devolve a lista já
  // ordenada por criação (desc) e escopada ao professor do token.
  //
  // Com turma (ADR-100), a lista é DAQUELA TURMA: quem chegou aqui pela sala
  // está conduzindo uma turma específica, e as atividades das outras turmas
  // dele são ruído — pior, são o convite a abrir o painel da turma errada. O
  // filtro é da api (`?turmaId=`), não um `filter` aqui: a resposta já não
  // traria as outras.
  const resposta = await apiDoServidor<RespostaAtividades>(
    turma ? `/atividades?turmaId=${encodeURIComponent(turma.id)}` : "/atividades",
  );
  const atividades = resposta?.atividades ?? [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Disponível</Badge>
          <span className="text-[13px] font-semibold text-unooria-neutral-500">
            {rotuloDaMissao(ano, missao)}
          </span>
        </div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">
          {missao.titulo}
        </h1>
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

      <section className="grid gap-4 lg:grid-cols-2">
        <Card variant="outlined" title="Como a missão funciona">
          <ol className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
            {ficha.atos.map((ato) => (
              <li key={ato.rotulo}>
                <strong className="block text-unooria-neutral-950">
                  {ato.rotulo}
                </strong>
                {ato.texto}
                {/* O caminho para FAZER o que o ato descreve. O Ato 1 manda a
                    turma jogar a Vila do Lume e, sem isto, o professor tinha de
                    achá-la sozinho na trilha. */}
                {ato.link ? (
                  <Link
                    href={ato.link.href}
                    className="mt-1 block font-semibold text-unooria-navy-900 underline"
                  >
                    {ato.link.rotulo}
                  </Link>
                ) : null}
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

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-unooria-neutral-950">
              {turma ? `Suas atividades com a turma ${turma.nome}` : "Suas atividades nesta missão"}
            </h2>
            <p className="text-[13px] text-unooria-neutral-500">
              {turma
                ? "Cada atividade é uma configuração da missão para um tema seu. Aqui estão as desta turma — as das outras ficam na trilha do Entre Redes."
                : "Cada atividade é uma configuração da missão para um tema seu. Você pode ter quantas quiser — uma por turma, uma por conteúdo."}
            </p>
          </div>
          <LinkButton href={comTurma("/professor/atividades/nova", turma?.id)}>
            Nova atividade
          </LinkButton>
        </div>

        {atividades.length === 0 ? (
          <EmptyState
            variant="no-data"
            size="lg"
            bordered
            fullWidth
            title={
              turma
                ? `Nenhuma atividade com a turma ${turma.nome} ainda`
                : "Nenhuma atividade por aqui ainda"
            }
            description="Comece pelo tema da sua disciplina — a IA propõe a pergunta-chave e você escolhe."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {atividades.map((atividade) => (
              <li key={atividade.id}>
                <CartaoAtividade
                  atividade={{
                    id: atividade.id,
                    titulo: atividade.titulo,
                    disciplina: atividade.disciplina,
                    recorte: atividade.recorte,
                    perguntaChave: atividade.perguntaChave,
                    status: statusDaAtividade(atividade.status),
                    posts: atividade.posts,
                    sessoes: atividade.sessoes,
                    estudantes: atividade.estudantes ?? 0,
                    criadoEm: atividade.criadoEm,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
