import { notFound } from "next/navigation";
import { EmptyState } from "@edu/ui/ds";
import { HabilidadesDoPerfil } from "@/components/evidencias/habilidades-do-perfil";
import { RotuloDaTrilha } from "@/components/trilha";
import { perfilDoEstudante } from "@/lib/evidencias-servidor";
import { turmaDaConducao } from "@/lib/turmas";

export const metadata = { title: "Estudante — Plataforma Unooria" };

/**
 * O PERFIL do estudante (E14), aberto pelo nome na aba Estudantes da sala.
 *
 * Mora dentro da turma porque é de lá que o professor vem, e a trilha devolve
 * para a aba de onde ele clicou. O perfil em si não é da turma: a api junta as
 * missões de onde a criança estiver.
 *
 * 404 nos dois casos em que um "sem permissão" contaria o que não deve: turma
 * que não é do professor (`turmaDaConducao` resolve pela lista DELE) e
 * estudante que ele não ensina (a api responde 404).
 *
 * O estudante nunca vê esta tela, e não há nela ranking nem comparação com a
 * turma: é o que ESTA criança demonstrou.
 */
export default async function PerfilDoEstudantePage({
  params,
}: {
  params: Promise<{ id: string; estudanteId: string }>;
}) {
  const { id, estudanteId } = await params;
  const [turma, perfil] = await Promise.all([turmaDaConducao(id), perfilDoEstudante(estudanteId)]);
  if (!turma || !perfil) notFound();

  return (
    <div className="flex flex-col gap-6">
      {/* A trilha é do layout; o que só esta página sabe são os dois nomes
          próprios — o da turma (um antepassado) e o do estudante. */}
      <RotuloDaTrilha para={`/professor/turmas/${id}`} valor={`Turma ${turma.nome}`} />
      <RotuloDaTrilha valor={perfil.estudante.nome} />

      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">{perfil.estudante.nome}</h1>
        <p className="text-[14px] text-unooria-neutral-500">
          Turma {turma.nome} · habilidades da BNCC demonstradas nas missões
        </p>
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
