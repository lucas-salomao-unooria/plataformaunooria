import { notFound, redirect } from "next/navigation";

import { atividadesDaMissao } from "@/lib/atividades-servidor";
import { baseDoBundleDaExperiencia } from "@/lib/bundle-da-experiencia";
import { rotaDaNovaAtividade, serieDaMissao, temAtividades } from "@/lib/entre-redes/atividades";
import { buscarMissao, rotaDaMissao } from "@/lib/entre-redes/catalogo";
import { normalizarSerie } from "@/lib/series";
import { minhasTurmas } from "@/lib/turmas";
import type { TurmaDoAssistente } from "@/components/atividades/assistente-de-atividade";

import { CriarASelecao } from "./criar-a-selecao";
import { CriarAssistenteInvisivel } from "./criar-assistente-invisivel";
import { CriarEfeitoAmplificador } from "./criar-efeito-amplificador";
import { CriarEnigmaCapa } from "./criar-enigma-capa";
import { CriarJornalEscola } from "./criar-jornal-escola";
import { CriarJuriEstadual } from "./criar-juri-estadual";
import { CriarPortaVoz } from "./criar-porta-voz";
import { CriarQuemMandou } from "./criar-quem-mandou";

/**
 * NOVA ATIVIDADE de uma missão (ADR-130) — DESPACHANTE por `missao.expId`,
 * como a ficha e os resultados.
 *
 * A criação é um esqueleto só (`AssistenteDeAtividade`: turma, conteúdo,
 * equipes, revisar e criar), e o passo do conteúdo é de cada missão. O
 * Instanooria tem a criação dele desde antes — a geração dos posts leva
 * minutos e passa por revisão —, e esta rota o manda para lá.
 *
 * As turmas são as do professor DA SÉRIE da missão, cada uma com o título da
 * atividade em andamento: é o que decide o padrão do "Pôr no ar agora".
 */
export default async function NovaAtividadePage({
  params,
  searchParams,
}: {
  params: Promise<{ ano: string; unidade: string }>;
  searchParams: Promise<{ turmaId?: string }>;
}) {
  const { ano: anoSlug, unidade: unidadeSlug } = await params;
  const { turmaId } = await searchParams;
  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  const expId = encontrado?.missao.expId;
  if (!encontrado || !temAtividades(expId)) notFound();
  const { missao } = encontrado;
  const rotaBase = rotaDaMissao(missao);

  if (expId === "exp08ef1b") redirect(rotaDaNovaAtividade(rotaBase, expId, turmaId?.trim() ?? ""));

  const serie = serieDaMissao(expId);
  const daSerie = (await minhasTurmas()).filter((t) => normalizarSerie(t.serie) === serie);
  const turmas: TurmaDoAssistente[] = await Promise.all(
    daSerie.map(async (t) => {
      const atividades = await atividadesDaMissao(expId, t.id);
      return {
        id: t.id,
        nome: t.nome,
        estudantes: t.estudantes,
        emAndamento: atividades?.find((a) => a.estado === "em-andamento")?.titulo ?? null,
      };
    }),
  );

  const props = { turmas, turmaInicial: turmaId?.trim() ?? "", rotaDaMissao: rotaBase };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">{missao.titulo}</p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">Nova atividade</h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          A missão é o roteiro; a atividade é a missão que a sua turma vai fazer, com o conteúdo que você escolher e
          as equipes do jeito que a sala se senta.
        </p>
      </header>
      {expId === "exp07ef1b" ? (
        <CriarASelecao {...props} />
      ) : expId === "exp04ef1b" ? (
        <CriarJornalEscola {...props} />
      ) : expId === "exp06ef1b" ? (
        <CriarJuriEstadual {...props} />
      ) : expId === "exp02em1b" ? (
        <CriarEfeitoAmplificador {...props} />
      ) : expId === "exp02ef1b" ? (
        /* As cenas prontas são arquivos do bundle da experiência: a base sai do servidor (env de runtime). */
        <CriarEnigmaCapa {...props} baseDoBundle={await baseDoBundleDaExperiencia(expId)} />
      ) : expId === "exp01em1b" ? (
        <CriarAssistenteInvisivel {...props} />
      ) : expId === "exp03em1b" ? (
        <CriarPortaVoz {...props} />
      ) : (
        <CriarQuemMandou {...props} />
      )}
    </div>
  );
}
