"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FeedbackAlert, Modal } from "@edu/ui/ds";

/**
 * ZERAR A TURMA — o caminho de exclusão desta missão.
 *
 * Ele existe no lugar de um prazo de retenção: houve um `expires_at` de 30 dias
 * no projeto de origem com uma rota de cron para cumpri-lo, e esta plataforma
 * não tem job agendado, de propósito. Prazo que nenhuma rotina cumpre é pior que
 * prazo nenhum — quem lê o schema acredita nele. Aqui quem apaga é quem tem a
 * posse pedagógica, quando decide apagar.
 *
 * O RELÓGIO VAI JUNTO, e o diálogo diz isso: rodar de novo com a aula "já
 * começada" faria a segunda rodada nascer no meio da tempestade.
 *
 * Escopado À TURMA: o professor da 2A não apaga a partida da 2B.
 */
export function ZerarTurma({ turmaId, nomeDaTurma }: { turmaId: string; nomeDaTurma: string }) {
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
        `/api/plataforma/unoogpt/professor/turmas/${encodeURIComponent(turmaId)}`,
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
    <>
      <Button
        variant="outline"
        className="acao-destrutiva"
        onClick={() => setAberto(true)}
        data-zerar-turma
      >
        Zerar a turma
      </Button>

      {/* `isOpen` é obrigatório no `Modal` da seção da PLATAFORMA — o da seção
          `chatgpt`, usado dentro da experiência, tem outra API. Seções
          diferentes, contratos diferentes. */}
      {aberto && (
        <Modal isOpen onClose={() => setAberto(false)} title={`Zerar a ${nomeDaTurma}?`}>
          <Modal.Body>
            <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
              <p>
                Isto apaga <strong>todas as partidas desta turma</strong> — as conversas com o
                assistente, as decisões e os desfechos. Não tem volta.
              </p>
              <p>
                O <strong>relógio da aula volta ao início</strong> junto. É de propósito: rodar de
                novo com a aula já começada faria a segunda rodada nascer no meio da tempestade.
              </p>
              <p className="text-[13px] text-unooria-neutral-500">
                Só esta turma. As outras não são tocadas.
              </p>
              {erro && <FeedbackAlert type="error" title="Não deu" description={erro} />}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void zerar()} disabled={enviando}>
              Zerar a turma
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
