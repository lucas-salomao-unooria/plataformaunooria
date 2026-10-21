import { EmptyState } from "@edu/ui/ds";
import { PainelDaTurma } from "@/components/evidencias/painel-da-turma";
import { SeletorDaConsulta } from "@/components/evidencias/seletor-da-consulta";
import { turmaConsolidada } from "@/lib/evidencias-servidor";
import { rotuloDaSerieDoPainel } from "@/lib/painel-de-habilidades";
import { minhasTurmas } from "@/lib/turmas";

export const metadata = { title: "Painel de habilidades — Plataforma Unooria" };

/**
 * O PAINEL DE HABILIDADES DO PROFESSOR (H14.7.1): as turmas em que ele dá
 * aula, uma por vez. A turma escolhida vai na URL (`?turmaId=`); sem ela, a
 * primeira da lista.
 *
 * Turma que não é dele não abre: a api responde 404 (o desenho de `salas`), e
 * aqui isso vira o mesmo "turma não encontrada" de qualquer turma inexistente.
 * O nome do estudante leva ao perfil dentro da sala, de onde a trilha volta.
 */
export default async function HabilidadesDoProfessorPage({
  searchParams,
}: {
  searchParams: Promise<{ turmaId?: string }>;
}) {
  const { turmaId: pedida } = await searchParams;
  const turmas = await minhasTurmas();

  if (turmas.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Cabecalho />
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Você ainda não está em nenhuma turma."
          description="O painel mostra as turmas em que você dá aula. Peça à coordenação para incluir você numa turma."
        />
      </div>
    );
  }

  const turmaId = turmas.some((t) => t.id === pedida) ? pedida! : turmas[0]!.id;
  const painel = await turmaConsolidada(turmaId);

  return (
    <div className="flex flex-col gap-6">
      <Cabecalho />
      <SeletorDaConsulta
        id="turma-do-painel"
        rotulo="Turma"
        parametro="turmaId"
        valor={turmaId}
        opcoes={turmas.map((t) => ({ value: t.id, label: `${t.nome} · ${rotuloDaSerieDoPainel(t.serie)}` }))}
      />
      {painel ? (
        <PainelDaTurma
          painel={painel}
          linkDoEstudante={{ prefixo: `/professor/turmas/${turmaId}/estudantes/` }}
          semMissao={{ rotulo: "Aplicar a primeira missão", href: "/professor/entre-redes" }}
        />
      ) : (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não foi possível abrir o painel desta turma agora."
          description="Tente de novo em instantes."
        />
      )}
    </div>
  );
}

function Cabecalho() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[24px] font-bold text-unooria-neutral-950">Painel de habilidades</h1>
      <p className="max-w-3xl text-[14px] text-unooria-neutral-500">
        Habilidades da BNCC de Computação demonstradas nas missões, por unidade do ano. Em cada missão vale o melhor
        resultado do estudante entre as atividades; quem não tem registro aparece como &quot;não avaliado&quot;, nunca
        como &quot;não atingiu&quot;.
      </p>
    </div>
  );
}
