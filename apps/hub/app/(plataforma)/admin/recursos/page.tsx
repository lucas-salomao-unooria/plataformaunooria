import { SectionHeader } from "@edu/ui/ds";
import { notFound } from "next/navigation";
import { HistoricoDeRecursos } from "@/components/historico-de-recursos";
import { auth } from "@/lib/auth";
import { ehDoContrato } from "@/lib/papeis";

/**
 * O HISTÓRICO visto pela REDE (ADR-89) — leitura, e só.
 *
 * Ligar e desligar continua sendo do `admin` da Unooria (ADR-88). O que esta
 * tela dá ao cliente é a resposta a "por que o produto mudou de estado aqui",
 * que hoje ele descobriria ligando para perguntar.
 *
 * `gestor_escola` e `gestor_regional` NÃO entram, e a ausência é deliberada: o
 * histórico é do CONTRATO, e recortá-lo por escola daria a uma unidade a notícia
 * de que a rede perdeu um produto antes de a coordenação da rede saber. O
 * middleware garante a ÁREA; quem separa os papéis dentro dela é a api — e aqui
 * o 404, para a tela não aparecer vazia a quem não pode lê-la.
 */
export default async function RecursosDaRedePage() {
  const session = await auth();
  if (!ehDoContrato(session!.usuario.papel)) notFound();

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Recursos da rede"
        description="O que a Unooria ligou, desligou ou mudou de versão neste contrato, com o motivo. Quem opera estes interruptores é a Unooria; esta tela é o registro."
      />
      <HistoricoDeRecursos />
    </div>
  );
}
