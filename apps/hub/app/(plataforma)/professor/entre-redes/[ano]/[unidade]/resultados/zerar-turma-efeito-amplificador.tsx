"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import {
  Button,
  Checkbox,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Snackbar,
} from "@edu/ui/ds";
import { erroDaApi } from "@/lib/efeito-amplificador-tipos";

const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";

/** "Zerar Turma" de O Efeito Amplificador: a rodada seguinte do mesmo pacote e a evidência apagada (ADR-155). */
export function ZerarTurmaEfeitoAmplificador({
  turmaId,
  nomeDaTurma,
  rodada,
}: {
  turmaId: string;
  nomeDaTurma: string;
  /** A rodada atual, como o painel a mostrou. */
  rodada: number;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const idDoTitulo = useId();
  const [aberto, setAberto] = useState(false);
  const [entendeu, setEntendeu] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function fechar() {
    if (enviando) return;
    setAberto(false);
    setEntendeu(false);
    setErro(null);
  }

  async function zerar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/plataforma/efeito-amplificador/turmas/${encodeURIComponent(turmaId)}/zerar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rodada }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para zerar a turma agora.").mensagem);
        /* 409 `rodada-desatualizada`: outra tela já andou. Relê para a professora ver a rodada certa. */
        if (r.status === 409) transicionar(() => router.refresh());
        return;
      }
      setAberto(false);
      setEntendeu(false);
      setAviso(`${nomeDaTurma} recomeçou na ${rodada + 1}ª rodada.`);
      transicionar(() => router.refresh());
    } catch {
      setErro(SEM_REDE);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2" data-zerar-turma>
      {aviso ? <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} /> : null}
      <Button variant="outline" className="acao-destrutiva" size="sm" onClick={() => setAberto(true)}>
        Zerar Turma para Nova Aplicação
      </Button>
      <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
        Abre a {rodada + 1}ª rodada com o mesmo pacote e volta a aula ao começo. As habilidades deste pacote
        são apagadas do painel, e a {rodada + 1}ª rodada avalia a turma do zero.
      </p>

      <Modal isOpen={aberto} onClose={fechar} size="sm" theme="light" aria-labelledby={idDoTitulo}>
        <ModalHeader showCloseButton={false}>
          <ModalTitle id={idDoTitulo}>Zerar {nomeDaTurma} para nova aplicação?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-700">
            <p>
              A turma recomeça do começo — o UnooriaAI, o Publicar e o feed da madrugada — na{" "}
              <strong>{rodada + 1}ª rodada</strong>, com o mesmo pacote, e as telas voltam a andar sem pausa.
            </p>
            <p className="text-[13px] text-unooria-neutral-600">
              <strong>As habilidades deste pacote são apagadas do painel</strong>, inclusive os ajustes que
              você fez. O que cada estudante fez na {rodada}ª rodada continua guardado.
            </p>
            <p className="text-[13px] text-unooria-neutral-600">
              <strong>A rodada nova mede todas as habilidades do zero</strong>, com o mesmo pacote: o nível
              de cada estudante passa a ser o desta aplicação.
            </p>
            <Checkbox
              label="Entendi: a turma recomeça do começo numa rodada nova."
              checked={entendeu}
              onChange={(marcado) => setEntendeu(marcado)}
            />
            {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" isDisabled={enviando} onClick={fechar}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="md"
            isDisabled={!entendeu || enviando}
            isLoading={enviando}
            onClick={() => void zerar()}
          >
            Zerar a turma
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
