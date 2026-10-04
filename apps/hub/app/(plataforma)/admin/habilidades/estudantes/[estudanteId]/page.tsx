import { notFound } from "next/navigation";
import { EmptyState } from "@edu/ui/ds";
import { HabilidadesDoPerfil } from "@/components/evidencias/habilidades-do-perfil";
import { RotuloDaTrilha } from "@/components/trilha";
import { perfilDoEstudante } from "@/lib/evidencias-servidor";

export const metadata = { title: "Estudante — Plataforma Unooria" };

/**
 * O DESEMPENHO DE UM ESTUDANTE (H14.7.4) aberto pela coordenação, a partir do
 * painel da turma. É o mesmo perfil que o professor abre na sala: cada missão,
 * da mais recente para a mais antiga, com o melhor nível entre as atividades.
 *
 * Nenhum dado de outro estudante aparece aqui. O estudante nunca vê esta tela.
 */
export default async function HabilidadesDoEstudantePage({
  params,
  searchParams,
}: {
  params: Promise<{ estudanteId: string }>;
  searchParams: Promise<{ escolaId?: string }>;
}) {
  const [{ estudanteId }, { escolaId }] = await Promise.all([params, searchParams]);
  const perfil = await perfilDoEstudante(estudanteId, escolaId);
  if (!perfil) notFound();

  return (
    <div className="flex flex-col gap-6">
      <RotuloDaTrilha valor={perfil.estudante.nome} />
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">{perfil.estudante.nome}</h1>
        <p className="text-[14px] text-unooria-neutral-500">Habilidades da BNCC demonstradas nas missões</p>
      </div>
      {perfil.missoes.length === 0 ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Nenhuma habilidade registrada ainda."
          description="O nível de cada habilidade aparece aqui depois das atividades das missões que registram a BNCC."
        />
      ) : (
        <HabilidadesDoPerfil missoes={perfil.missoes} />
      )}
    </div>
  );
}
