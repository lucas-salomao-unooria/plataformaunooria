"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FeedbackAlert, Modal } from "@edu/ui/ds";

/**
 * ZERAR A TURMA — o caminho de exclusão desta missão, e a preparação para uma
 * segunda aplicação.
 *
 * O GATE DA AULA VAI JUNTO, e o diálogo diz isso: rodar de novo com a Aula 2 já
 * aberta faria a segunda rodada nascer no meio da decisão, sem a investigação
 * que a sustenta.
 *
 * O que NÃO é apagado é a telemetria: a trilha analítica da aula anterior
 * continua legível para a rede. E o percurso de outra turma não é tocado — o
 * professor do 7A não apaga o 7B.
 */
export function ZerarTurmaEco({ turmaId, nomeDaTurma }: { turmaId: string; nomeDaTurma: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, transicionar] = useTransition();

  async function zerar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(
        `/api/plataforma/o-eco-no-grupo/turmas/${encodeURIComponent(turmaId)}`,
        { method: "DELETE" },
      );
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
      <Button variant="tertiary" size="sm" onClick={() => setAberto(true)} data-zerar-turma>
        Zerar a turma
      </Button>
      <p className="text-[12px] leading-snug text-unooria-neutral-600">
        Apaga o percurso de {nomeDaTurma} e volta a aula para a investigação. Use antes de aplicar
        a missão de novo com a mesma turma.
      </p>

      <Modal isOpen={aberto} onClose={() => setAberto(false)} title={`Zerar ${nomeDaTurma}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Isto apaga, só desta turma: o que cada estudante investigou, a resposta que deu no
            grupo, a conversa com Amara e o &quot;Meu percurso&quot; entregue. A aula volta para a
            investigação, com a Aula 2 fechada.
          </p>
          <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
            Não dá para desfazer. O histórico analítico da rede não é afetado.
          </p>
          {erro && <FeedbackAlert type="error" description={erro} />}
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => void zerar()} isDisabled={enviando}>
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
