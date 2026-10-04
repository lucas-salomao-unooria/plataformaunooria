import { notFound } from "next/navigation";
import { PainelDaTurma } from "@/components/evidencias/painel-da-turma";
import { RotuloDaTrilha } from "@/components/trilha";
import { turmaConsolidada } from "@/lib/evidencias-servidor";
import { rotuloDaSerieDoPainel } from "@/lib/painel-de-habilidades";

export const metadata = { title: "Painel de habilidades da turma — Plataforma Unooria" };

/**
 * A TURMA vista pela coordenação (drill-down do painel da escola): a MESMA
 * tela do professor (H14.7.1), só de leitura. `?escolaId=` vem do painel da
 * rede — a regional e o contrato dizem de qual escola é a turma.
 */
export default async function HabilidadesDaTurmaPage({
  params,
  searchParams,
}: {
  params: Promise<{ turmaId: string }>;
  searchParams: Promise<{ escolaId?: string }>;
}) {
  const [{ turmaId }, { escolaId }] = await Promise.all([params, searchParams]);
  const painel = await turmaConsolidada(turmaId, escolaId);
  if (!painel) notFound();
  const sufixo = escolaId ? `?escolaId=${encodeURIComponent(escolaId)}` : "";

  return (
    <div className="flex flex-col gap-6">
      <RotuloDaTrilha valor={`Turma ${painel.turma.nome}`} />
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">Turma {painel.turma.nome}</h1>
        <p className="text-[14px] text-unooria-neutral-500">
          {rotuloDaSerieDoPainel(painel.turma.serie)} · painel de habilidades
        </p>
      </div>
      <PainelDaTurma painel={painel} linkDoEstudante={{ prefixo: "/admin/habilidades/estudantes/", sufixo }} />
    </div>
  );
}
