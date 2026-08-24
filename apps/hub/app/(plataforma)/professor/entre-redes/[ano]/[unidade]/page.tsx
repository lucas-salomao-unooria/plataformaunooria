import { notFound } from "next/navigation";

import { Badge, Card, EmptyState, Tag } from "@edu/ui/ds";
import { CartaoAtividade } from "@/components/cartao-atividade";
import { LinkButton } from "@/components/link-button";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  buscarMissao,
  rotaDoGuia,
  rotuloDaMissao,
} from "@/lib/entre-redes/catalogo";
import { statusDaAtividade } from "@/lib/status-atividade";

/** O que a api devolve em GET /atividades (escopado ao professor do token). */
type RespostaAtividades = {
  atividades: Array<{
    id: string;
    titulo: string;
    disciplina: string;
    recorte: string;
    perguntaChave: string;
    status: string;
    etapa: string;
    criadoEm: string;
    alunos: number;
    posts: number;
    sessoes: number;
  }>;
};

export default async function MissaoPage({
  params,
}: {
  params: Promise<{ ano: string; unidade: string }>;
}) {
  const { ano: anoSlug, unidade: unidadeSlug } = await params;

  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  if (!encontrado) notFound();
  const { ano, missao } = encontrado;

  const trilha = [
    { label: "Início", href: "/professor" },
    { label: "Entre Redes", href: "/professor/entre-redes" },
    { label: rotuloDaMissao(ano, missao) },
  ];

  // Unidade sem conteúdo acessada pela URL: a trilha não linka para cá, mas o
  // endereço é adivinhável. Melhor dizer o que é do que devolver um 404 seco.
  if (missao.status === "em-breve" || !missao.ficha) {
    return (
      <div className="flex flex-col gap-6">
        <Trilha itens={trilha} />
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title={`${rotuloDaMissao(ano, missao)} ainda está em produção`}
          description="Assim que esta missão for publicada ela aparece na trilha do Entre Redes, pronta para configurar."
        />
        <div>
          <LinkButton href="/professor/entre-redes" variant="secondary">
            Voltar para a trilha
          </LinkButton>
        </div>
      </div>
    );
  }

  const { ficha } = missao;

  // MISSÃO ÚNICA: com uma só missão publicada, toda atividade do professor é
  // desta missão (nota de modelagem em lib/entre-redes/catalogo.ts).
  // No origem era `prisma.activity.findMany(...)`; a api devolve a lista já
  // ordenada por criação (desc) e escopada ao professor do token.
  const resposta = await apiDoServidor<RespostaAtividades>("/atividades");
  const atividades = resposta?.atividades ?? [];

  return (
    <div className="flex flex-col gap-8">
      <Trilha itens={trilha} />

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
          <div className="pt-4">
            <LinkButton href={rotaDoGuia(missao)} variant="secondary">
              Abrir guia da aula
            </LinkButton>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-unooria-neutral-950">
              Suas atividades nesta missão
            </h2>
            <p className="text-[13px] text-unooria-neutral-500">
              Cada atividade é uma configuração da missão para um tema seu. Você
              pode ter quantas quiser — uma por turma, uma por conteúdo.
            </p>
          </div>
          <LinkButton href="/professor/atividades/nova">
            Nova atividade
          </LinkButton>
        </div>

        {atividades.length === 0 ? (
          <EmptyState
            variant="no-data"
            size="lg"
            bordered
            fullWidth
            title="Nenhuma atividade por aqui ainda"
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
