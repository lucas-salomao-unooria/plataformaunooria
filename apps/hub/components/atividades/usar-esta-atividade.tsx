"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertBox, Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from "@edu/ui/ds";
import { caminhoDoEmAndamento, corpoDoEmAndamento, type MissaoComAtividade } from "@/lib/entre-redes/atividades";
import { liberarNaSala } from "@/lib/entre-redes/criar-atividade";

type Confirmacao =
  | { tipo: "trocar" }
  /** O "Ativar" do Instanooria devolveu 422: a matriz incompleta, dita antes de forçar. */
  | { tipo: "pendencias"; itens: string[] };

/**
 * "USAR ESTA ATIVIDADE AGORA" (ADR-130): o professor escolhe o que a turma faz.
 * Criar não põe no ar — é este botão, no card da lista e na página da
 * atividade. Pôr no ar libera também a missão na Sala de Aula (ADR-146).
 *
 * Com outra em andamento, a troca pede confirmação: quem está jogando passa
 * para esta, numa rodada nova, e a outra volta a ficar pronta. No Instanooria
 * o caminho é o "Ativar" de sempre, que confere a matriz de posts e pode
 * responder 422 com as pendências — e aí a janela as diz antes de "Pôr no ar
 * mesmo assim".
 */
export function UsarEstaAtividade({
  expId,
  turmaId,
  atividadeId,
  titulo,
  emAndamentoAgora,
  variante = "secondary",
}: {
  expId: MissaoComAtividade;
  turmaId: string;
  atividadeId: string;
  titulo: string;
  /** O título da que está em andamento na turma, se não for esta — o texto da confirmação. */
  emAndamentoAgora: string | null;
  variante?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function usarAgora(forcar = false) {
    setTrocando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/plataforma${caminhoDoEmAndamento(expId, turmaId, atividadeId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpoDoEmAndamento(expId, atividadeId, forcar)),
      });
      const corpo = (await resposta.json().catch(() => null)) as { mensagem?: string; pendencias?: unknown } | null;
      if (resposta.status === 422 && Array.isArray(corpo?.pendencias)) {
        setConfirmacao({ tipo: "pendencias", itens: corpo.pendencias.filter((p): p is string => typeof p === "string") });
        return;
      }
      if (!resposta.ok) {
        setErro(corpo?.mensagem ?? "Não deu para pôr esta atividade em andamento. Tente de novo.");
        return;
      }
      /* Pôr no ar também libera a missão na sala (ADR-146): sem isto a turma
         continuava no cadeado. A atividade já está em andamento; se só a
         liberação falhar, o aviso diz onde terminar. */
      const aviso = await liberarNaSala({ expId, turmaId });
      if (aviso) setErro(aviso);
      setConfirmacao(null);
      router.refresh();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setTrocando(false);
    }
  }

  function pedir() {
    if (emAndamentoAgora) setConfirmacao({ tipo: "trocar" });
    else void usarAgora();
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant={variante}
          size="sm"
          onClick={pedir}
          isLoading={trocando && confirmacao === null}
          isDisabled={trocando}
          data-acao="usar-esta-atividade"
        >
          Usar esta atividade agora
        </Button>
      </div>
      {erro && confirmacao === null ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}

      <Modal isOpen={confirmacao !== null} onClose={() => (trocando ? undefined : setConfirmacao(null))} size="sm">
        <ModalHeader>
          <ModalTitle>
            {confirmacao?.tipo === "pendencias" ? "A atividade ainda tem pendências" : "Trocar a atividade da turma?"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
            {confirmacao?.tipo === "pendencias" ? (
              <>
                <p>Dá para pôr no ar mesmo assim, mas a turma vai sentir isto:</p>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-unooria-neutral-700">
                  {confirmacao.itens.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                A turma está fazendo <strong>“{emAndamentoAgora}”</strong>. Quem estiver jogando passa para{" "}
                <strong>“{titulo}”</strong>, que começa uma rodada nova. O que já foi feito na outra continua
                guardado, e ela volta para a lista como pronta.
              </p>
            )}
            {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setConfirmacao(null)} disabled={trocando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => void usarAgora(confirmacao?.tipo === "pendencias")}
            isLoading={trocando}
            data-acao="confirmar-usar-esta-atividade"
          >
            {confirmacao?.tipo === "pendencias" ? "Pôr no ar mesmo assim" : "Usar esta atividade agora"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
