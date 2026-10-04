import { notFound } from "next/navigation";
import { PainelDaEscola } from "@/components/evidencias/painel-da-escola";
import { RotuloDaTrilha } from "@/components/trilha";
import { escolaConsolidada } from "@/lib/evidencias-servidor";

export const metadata = { title: "Painel de habilidades da escola — Plataforma Unooria" };

/**
 * O PAINEL DE UMA ESCOLA aberto do painel da rede (drill-down da coordenação
 * regional e do contrato). Escola fora do alcance responde 403 na api, e aqui
 * isso é "não encontrada" — a tela não conta que a escola existe.
 *
 * O `escolaId` segue para a turma na URL: é ele que a api usa para armar a
 * tranca naquela escola (a regional não tem a escola no token).
 */
export default async function HabilidadesDaEscolaPage({ params }: { params: Promise<{ escolaId: string }> }) {
  const { escolaId } = await params;
  const painel = await escolaConsolidada(escolaId);
  if (!painel) notFound();

  return (
    <div className="flex flex-col gap-6">
      <RotuloDaTrilha valor={painel.escola.nome} />
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">{painel.escola.nome}</h1>
        <p className="text-[14px] text-unooria-neutral-500">
          Painel de habilidades{painel.periodo ? ` · ${painel.periodo.titulo}` : ""}
        </p>
      </div>
      <PainelDaEscola
        painel={painel}
        linkDaTurma={{ prefixo: "/admin/habilidades/turmas/", sufixo: `?escolaId=${encodeURIComponent(escolaId)}` }}
      />
    </div>
  );
}
