"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FeedbackAlert, Modal } from "@edu/ui/ds";

/**
 * ZERAR A TURMA — o caminho de exclusão da exp-05, e a preparação para a turma
 * seguinte do mesmo dia.
 *
 * **O LOTE APROVADO SOBREVIVE, e o diálogo diz isso.** É a diferença desta
 * missão para a exp-06: aqui o lote é PRÉ-CONDIÇÃO — sem ele ninguém entra —,
 * e apagá-lo junto deixaria a turma seguinte diante de uma tela de espera com a
 * professora achando que zerou só as respostas. O que ela curou custou tempo
 * dela, e refazer no intervalo de 10 minutos não é uma opção real.
 *
 * O que vai: o que cada estudante encaminhou, a confirmação do Mural e **o
 * texto que ele escreveu sobre o áudio do tio** — e o diálogo avisa, porque
 * apagar sem dizer seria apagar um portfólio às escondidas. O que NÃO vai: a
 * telemetria, que é trilha analítica imutável, e a turma vizinha.
 *
 * O gate volta a `exploracao`, senão a segunda rodada nasceria com o telão
 * aceso e a revelação já gasta.
 */
export function ZerarTurmaQuemMandou({
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
      const r = await fetch(
        `/api/plataforma/quem-mandou-isso/turmas/${encodeURIComponent(turmaId)}`,
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
        Apaga o percurso de {nomeDaTurma} e volta a missão ao início. O lote que você publicou
        para esta turma é preservado.
      </p>

      <Modal isOpen={aberto} onClose={() => setAberto(false)} title={`Zerar ${nomeDaTurma}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Isto apaga o que cada estudante encaminhou, a confirmação do Mural e{" "}
            <strong>o texto que ele escreveu sobre o áudio do tio</strong>. A missão volta ao
            começo, e o telão apaga.
          </p>
          <p className="text-[13px] leading-relaxed text-unooria-neutral-600">
            <strong>O lote que você publicou fica</strong> — a próxima turma entra no mesmo grupo,
            sem você refazer a preparação. Só esta turma é afetada, e a telemetria da aula anterior
            continua registrada.
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
