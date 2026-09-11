"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FeedbackAlert, Modal } from "@edu/ui/ds";

/**
 * ZERAR A TURMA — o caminho de exclusão da exp-08, e a preparação para uma
 * segunda aplicação.
 *
 * **O PREPARO SOBREVIVE, e o diálogo diz isso.** É a diferença desta missão
 * para a exp-06: o caso que a professora contextualizou e as réplicas que ela
 * revisou custaram tempo dela, e apagá-los junto obrigaria a refazer a
 * curadoria para aplicar a missão na turma seguinte no mesmo dia.
 *
 * O que vai: as auditorias, a cláusula fixada, o manifesto compilado e **o
 * texto que cada estudante escreveu** — e o diálogo avisa, porque apagar sem
 * dizer seria apagar um portfólio às escondidas. O que NÃO vai: a telemetria,
 * que é trilha analítica imutável, e a turma vizinha.
 *
 * O gate volta a `missao`, senão a segunda rodada nasceria congelada num debate
 * que já aconteceu.
 */
export function ZerarTurmaManifesto({
  turmaId,
  nomeDaTurma,
}: {
  turmaId: string;
  nomeDaTurma: string;
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
      const r = await fetch(`/api/plataforma/manifesto-ia/turmas/${encodeURIComponent(turmaId)}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
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
      <p className="text-[12px] leading-snug text-unooria-neutral-600">
        Apaga o percurso de {nomeDaTurma} e volta a missão ao início. O conteúdo que você aprovou
        para esta turma é preservado.
      </p>

      <Modal isOpen={aberto} onClose={() => setAberto(false)} title={`Zerar ${nomeDaTurma}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Isto apaga os questionamentos enviados, a cláusula que cada um fixou, o manifesto
            compilado e <strong>o texto que cada estudante escreveu no Meu Percurso</strong>. A
            missão volta ao início.
          </p>
          <p className="text-[13px] leading-relaxed text-unooria-neutral-600">
            <strong>O conteúdo que você aprovou fica</strong> — não é preciso refazer a preparação.
            Só esta turma é afetada, e a telemetria da aula anterior continua registrada.
          </p>
          {erro && <FeedbackAlert type="error" description={erro} />}
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
