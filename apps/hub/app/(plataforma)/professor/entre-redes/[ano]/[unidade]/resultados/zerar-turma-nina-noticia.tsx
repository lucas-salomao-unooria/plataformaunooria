"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FeedbackAlert, Modal } from "@edu/ui/ds";
import { COPY_DO_PAINEL, caminhoDaTurma, erroDaResposta } from "@/lib/nina-noticia-tipos";

/**
 * "Zerar Turma" da exp03ef1b — uma RODADA NOVA do mesmo pacote (ADR-155).
 * Molde: `zerar-turma-juri-estadual.tsx`.
 *
 * A turma volta ao começo (a galeria, com a etapa da escolha) e os portões
 * fecham de novo; **as habilidades desta atividade são apagadas** do painel e a
 * turma é avaliada do zero. O aviso mora no diálogo, ANTES do clique: com as
 * mesmas notícias, a descoberta se perde — quem já viu a do telão sumir sabe
 * que a ficha está vazia. O caminho para reaplicar é uma atividade nova.
 */
export function ZerarTurmaNinaNoticia({
  turmaId,
  nomeDaTurma,
  tema,
}: {
  turmaId: string;
  nomeDaTurma: string;
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
        {COPY_DO_PAINEL.zerar}
      </Button>
      <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
        Abre uma rodada nova de {nomeDaTurma} com as mesmas notícias e volta a aula para o começo. As habilidades desta
        atividade são apagadas do painel, e a turma é avaliada de novo.
      </p>

      <Modal isOpen={aberto} onClose={() => !enviando && setAberto(false)} title={`Zerar ${nomeDaTurma}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Cada computador volta às fotos da feira, a escolha destrava e os dois portões — o filtro e a inspeção —
            fecham de novo. <strong>As habilidades desta atividade são apagadas</strong> do painel, inclusive os ajustes
            que você fez, e a turma é avaliada do zero.
          </p>
          <FeedbackAlert
            type="warning"
            title="Com as mesmas notícias, a descoberta se perde"
            description={`A rodada nova repete “${tema}”. Quem já viu a notícia do telão sumir sabe que a ficha está vazia. Para aplicar de novo com esta turma, prefira criar uma atividade com outro tema: ela começa na rodada 1, e esta fica no histórico.`}
          />
          <p className="text-[13px] leading-relaxed text-unooria-neutral-600">Só esta turma é afetada.</p>
          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => void zerar()} isDisabled={enviando} data-acao="confirmar-zerar">
              {enviando ? "Zerando…" : "Zerar e começar nova rodada"}
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
