"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FeedbackAlert, Modal } from "@edu/ui/ds";
import { caminhoDaTurma, erroDaResposta } from "@/lib/juri-estadual-tipos";

/**
 * ZERAR A TURMA da exp06ef1b — uma RODADA NOVA do mesmo pacote, SEM apagar.
 * Molde: o zerar do Jornal (`zerar-turma-jornal-escola.tsx`).
 *
 * A rodada passada fica — os votos, a auditoria da galeria e a cadeia —, porque é ela que o painel de habilidades mostra. A turma volta à
 * exploração, a Galeria Oculta fecha e cada computador recomeça pela
 * credencial.
 *
 * **O aviso mora no diálogo, antes do clique.** Com os mesmos estandes, a
 * descoberta se perde: a turma já sabe que o feed se adapta (a rodada nova
 * mede tudo de novo, ADR-145, mas o voto deixa de ser espontâneo). O caminho
 * para reaplicar é uma atividade nova, com outro tema.
 *
 * O atributo `data-zerar-turma` e os textos "Zerar {turma}?" / "Zerar a
 * turma" são os que as suítes e2e procuram, como nas outras missões.
 */
export function ZerarTurmaJuriEstadual({
  turmaId,
  nomeDaTurma,
  tema,
}: {
  turmaId: string;
  nomeDaTurma: string;
  /** O tema do pacote em andamento — é ele que a rodada nova repete. */
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
      const r = await fetch(`/api/plataforma${caminhoDaTurma(turmaId)}/zerar`, { method: "POST" });
      if (!r.ok) {
        setErro(erroDaResposta(await r.json().catch(() => null), "Não deu para zerar agora.").mensagem);
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
      <Button variant="outline" className="acao-destrutiva" size="sm" onClick={() => setAberto(true)} data-zerar-turma>
        Zerar a turma
      </Button>
      <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
        Abre uma rodada nova de {nomeDaTurma} com a mesma mostra e volta a aula para a exploração. As habilidades
        desta mostra são apagadas do painel, e a turma é avaliada de novo.
      </p>

      <Modal isOpen={aberto} onClose={() => setAberto(false)} title={`Zerar ${nomeDaTurma}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            A turma volta ao começo — a credencial, o feed e a cédula —, a Galeria Oculta fecha e cada computador
            julga a mostra de novo. <strong>As habilidades desta mostra são apagadas</strong> do painel, inclusive
            os ajustes que você fez, e a turma é avaliada do zero. Os votos, a auditoria da galeria e a cadeia
            desta rodada continuam guardados na folha da turma.
          </p>
          <FeedbackAlert
            type="warning"
            title="Com os mesmos estandes, a descoberta se perde"
            description={`A rodada nova repete “${tema}”. Quem já viu a Galeria Oculta sabe que o feed se adapta às curtidas, e o voto deixa de ser espontâneo. Para aplicar de novo com esta turma, prefira criar uma atividade com outro tema: ela começa na rodada 1, e esta fica no histórico.`}
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
