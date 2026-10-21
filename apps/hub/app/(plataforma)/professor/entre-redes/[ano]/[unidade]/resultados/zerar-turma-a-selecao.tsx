"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FeedbackAlert, Modal } from "@edu/ui/ds";
import type { ErroDaSelecao } from "@/lib/a-selecao-tipos";

/**
 * ZERAR A TURMA da exp07ef1b — uma RODADA NOVA da mesma cobertura, SEM apagar.
 *
 * É o oposto do zerar da exp06ef2b e da exp05ef1b, e o diálogo diz isso: aqui
 * nada some. A rodada passada fica — as tríades, os pares, as legendas e as
 * reflexões —, porque é ela que o painel de habilidades mostra (ADR-112), e um
 * zerar que apagasse levaria a evidência junto. A turma volta à exploração,
 * cada um recomeça pelo pedido da Amara, e o Mural fecha.
 *
 * **O aviso da PED-13 mora no diálogo, antes do clique.** Com o MESMO tema, a
 * surpresa do Mural se perde: a turma já sabe que a cobertura tem lados, e a
 * segunda seleção mede quem aprendeu a regra, não o recorte espontâneo. O
 * caminho para reaplicar é um tema novo, no preparo — que vira atividade nova,
 * com rodada 1.
 *
 * O atributo `data-zerar-turma` e os textos "Zerar {turma}?" / "Zerar a
 * turma" são os que as suítes e2e procuram, como nas outras missões.
 */
export function ZerarTurmaASelecao({
  turmaId,
  nomeDaTurma,
  tema,
}: {
  turmaId: string;
  nomeDaTurma: string;
  /** O tema da cobertura em andamento — é ele que a rodada nova repete. */
  tema: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, transicionar] = useTransition();

  async function zerar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}/zerar`, {
        method: "POST",
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as ErroDaSelecao;
        setErro(corpo.mensagem ?? "Não deu para zerar agora.");
        return;
      }
      setAberto(false);
      transicionar(() => router.refresh());
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="outline"
        className="acao-destrutiva"
        size="sm"
        onClick={() => setAberto(true)}
        data-zerar-turma
      >
        Zerar a turma
      </Button>
      <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
        Abre uma rodada nova de {nomeDaTurma} com a mesma cobertura e volta a aula para a
        exploração. As habilidades desta cobertura são apagadas do painel, e a turma é avaliada de novo.
      </p>

      <Modal isOpen={aberto} onClose={() => setAberto(false)} title={`Zerar ${nomeDaTurma}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            A turma volta ao começo — o pedido da Amara, o feed e a publicação —, o Mural fecha e
            cada computador escolhe de novo. <strong>As habilidades desta cobertura são apagadas</strong>{" "}
            do painel, inclusive os ajustes que você fez, e a turma é avaliada do zero. As seleções,
            as legendas e as reflexões desta rodada continuam guardadas na folha da turma.
          </p>
          <FeedbackAlert
            type="warning"
            title="Com o mesmo tema, a surpresa do Mural se perde"
            description={`A rodada nova repete “${tema}”. Quem já viu o Mural sabe que a cobertura tem lados, e a segunda escolha deixa de ser espontânea. Para aplicar de novo com esta turma, prefira trocar o tema no preparo, acima: um tema novo vira uma atividade nova, e a turma recomeça na rodada 1.`}
          />
          <p className="text-[13px] leading-relaxed text-unooria-neutral-600">
            Só esta turma é afetada, e a telemetria da aula anterior continua registrada.
          </p>
          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => void zerar()} isDisabled={enviando}>
              {enviando ? "Zerando…" : "Zerar a turma"}
            </Button>
            <Button variant="secondary" onClick={() => setAberto(false)} isDisabled={enviando}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
