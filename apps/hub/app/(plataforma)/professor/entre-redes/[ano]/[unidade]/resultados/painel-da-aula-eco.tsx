"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, FeedbackAlert } from "@edu/ui/ds";
import { ROTULO_DA_ETAPA, type EtapaDaAula, type PreparoDaMidia } from "@/lib/eco-tipos";

/**
 * O PAINEL DA AULA — a única tela do hub, junto do relógio da exp-03, em que a
 * professora muda o que 30 estudantes veem, ao vivo.
 *
 * Client component de propósito: ela aperta no meio da aula e precisa de
 * resposta na hora, sem recarregar. A mutação vai pelo BFF
 * (`/api/plataforma/o-eco-no-grupo/...`), que assina o token — o client do hub
 * nunca segura bearer.
 *
 * O que este painel NÃO faz: mexer no percurso de ninguém. O que ela controla é
 * QUANDO a turma anda junta, não o que cada criança decide.
 */

type Acao = "liberar-aula2" | "congelar-debate" | "liberar-reflexao" | "redefinir";

/**
 * Os três momentos, na ordem da aula. `redefinir` fica à parte: ele volta ao
 * pré-aula sem apagar percurso — é para quem abriu a Aula 2 antes da hora, não
 * um "zerar".
 */
const MOMENTOS: Array<{ acao: Acao; etapa: EtapaDaAula; rotulo: string; explica: string }> = [
  {
    acao: "liberar-aula2",
    etapa: "aula2",
    rotulo: "Abrir a Aula 2",
    explica:
      "Solta quem está esperando no card de pausa e libera o episódio e a decisão no grupo. Sem isto, ninguém passa da investigação.",
  },
  {
    acao: "congelar-debate",
    etapa: "debate",
    rotulo: "Congelar para o debate",
    explica:
      "Prende a turma inteira na mesma tela. Quem está adiantado volta, quem está atrasado avança — no debate todos precisam olhar a mesma coisa.",
  },
  {
    acao: "liberar-reflexao",
    etapa: "reflexao",
    rotulo: "Liberar o Meu percurso",
    explica: "Abre o formulário final. Cada estudante marca 2 critérios e uma justificativa.",
  },
];

export function PainelDaAulaEco({
  turmaId,
  etapa,
  midiaPronta,
}: {
  turmaId: string;
  etapa: EtapaDaAula;
  /** Quantas das mídias já estão publicadas — o preparo é por escola. */
  midiaPronta: { prontas: number; total: number };
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Acao | "midia" | null>(null);
  const [, transicionar] = useTransition();

  async function agir(acao: Acao) {
    setEnviando(acao);
    setErro(null);
    try {
      const r = await fetch(
        `/api/plataforma/o-eco-no-grupo/turmas/${encodeURIComponent(turmaId)}/gate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ acao }),
        },
      );
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
        setErro(corpo.mensagem ?? "Não deu para mudar a etapa agora.");
        return;
      }
      transicionar(() => router.refresh());
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  async function prepararMidia() {
    setEnviando("midia");
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(
        `/api/plataforma/o-eco-no-grupo/turmas/${encodeURIComponent(turmaId)}/preparar-midia`,
        { method: "POST" },
      );
      if (!r.ok) {
        setErro("Não deu para preparar a mídia agora. A missão funciona sem ela.");
        return;
      }
      const preparo = (await r.json()) as PreparoDaMidia;
      setAviso(
        preparo.falharam.length > 0
          ? `${preparo.geradas.length} prontas, ${preparo.falharam.length} não saíram. A missão funciona assim mesmo: o áudio vira texto na tela.`
          : preparo.geradas.length > 0
            ? `${preparo.geradas.length} arquivos prontos. Vale para todas as turmas da escola.`
            : "Já estava tudo pronto.",
      );
      transicionar(() => router.refresh());
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  const faltaMidia = midiaPronta.prontas < midiaPronta.total;

  return (
    <Card variant="elevated" title="A aula">
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-unooria-neutral-700" data-etapa={etapa}>
          Agora: <strong className="text-unooria-neutral-950">{ROTULO_DA_ETAPA[etapa]}</strong>
        </p>

        <div className="flex flex-col gap-3">
          {MOMENTOS.map((m) => (
            <div key={m.acao} className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <Button
                  variant={etapa === m.etapa ? "secondary" : "primary"}
                  size="sm"
                  onClick={() => void agir(m.acao)}
                  isDisabled={enviando !== null}
                  data-gate={m.acao}
                >
                  {etapa === m.etapa ? `${m.rotulo} (agora)` : m.rotulo}
                </Button>
              </div>
              <p className="text-[12px] leading-snug text-unooria-neutral-600">{m.explica}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-t border-unooria-neutral-200 pt-3">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void prepararMidia()}
              isDisabled={enviando !== null}
              data-preparar-midia
            >
              {enviando === "midia" ? "Preparando…" : "Preparar as vozes e as fotos"}
            </Button>
            <span className="text-[12px] text-unooria-neutral-600">
              {midiaPronta.prontas} de {midiaPronta.total} prontas
            </span>
          </div>
          <p className="text-[12px] leading-snug text-unooria-neutral-600">
            {faltaMidia
              ? "Leva cerca de dois minutos e vale para a escola inteira. Sem isso a missão roda igual: o áudio aparece como texto na tela e as fotos viram ilustração."
              : "Tudo pronto. Confira os fones antes de começar — há dois áudios no chat e um episódio."}
          </p>
        </div>

        <div className="flex flex-col gap-1 border-t border-unooria-neutral-200 pt-3">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => void agir("redefinir")}
            isDisabled={enviando !== null}
            data-gate="redefinir"
          >
            Voltar para a Aula 1
          </Button>
          <p className="text-[12px] leading-snug text-unooria-neutral-600">
            Abriu a Aula 2 antes da hora? Isto volta a turma para a investigação{" "}
            <strong>sem apagar</strong> o que cada estudante já fez.
          </p>
        </div>

        {aviso && <FeedbackAlert type="info" description={aviso} />}
        {erro && <FeedbackAlert type="error" description={erro} />}
      </div>
    </Card>
  );
}
