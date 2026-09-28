"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, FeedbackAlert } from "@edu/ui/ds";
import { ROTULO_DA_ETAPA, type EtapaDaTurma } from "@/lib/manifesto-tipos";

/**
 * O CHECKPOINT A da exp08ef4b — onde a professora congela 30 telas para o debate.
 *
 * Client component de propósito: ela aperta no meio da aula e precisa de
 * resposta na hora, sem recarregar. A mutação vai pelo BFF
 * (`/api/plataforma/manifesto-ia/...`), que assina o token — o client do hub
 * nunca segura bearer.
 *
 * **Não há WebSocket** (ADR-93). Este clique muda UMA linha em
 * `exp08ef4b_gates_turma`, e a tela de cada estudante a lê por polling HTTP de 5
 * segundos durante a Etapa 4. O atraso máximo é de 5s, e ele é aceitável: o
 * congelamento serve a um debate de 10 minutos, não a um jogo em tempo real.
 *
 * **Dois botões, e o congelamento é OPCIONAL.** Sem clique nenhum a missão
 * corre inteira, porque a spec admite a sessão individual assíncrona — a
 * diferença é que o debate coletivo não acontece. O painel diz isso na tela,
 * em vez de deixar a professora descobrir depois.
 */

type Acao = "pausar-para-debate" | "retomar-missao";

const MOMENTOS: Array<{ acao: Acao; etapa: EtapaDaTurma; rotulo: string; explica: string }> = [
  {
    acao: "pausar-para-debate",
    etapa: "debate",
    rotulo: "Pausar para Debate",
    explica:
      "Congela as telas de quem já chegou ao manifesto e segura a assinatura individual. Quem ainda está auditando o sistema NÃO é empurrado para a frente — são justamente essas crianças que o debate tenta alcançar.",
  },
  {
    acao: "retomar-missao",
    etapa: "missao",
    rotulo: "Retomar Missão",
    explica:
      "Solta a turma para o Meu Percurso. Nada é apagado, e quem já assinou continua onde está — o latch é do estudante, não da turma.",
  },
];

export function PainelDoDebateManifesto({
  turmaId,
  etapa,
}: {
  turmaId: string;
  etapa: EtapaDaTurma;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const [, transicionar] = useTransition();

  async function agir(acao: Acao) {
    setEnviando(acao);
    setErro(null);
    try {
      const r = await fetch(
        `/api/plataforma/manifesto-ia/turmas/${encodeURIComponent(turmaId)}/gate`,
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

  return (
    <Card variant="elevated" title="O debate">
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
                  {enviando === m.acao ? "Mudando…" : m.rotulo}
                </Button>
                {etapa === m.etapa && (
                  <span className="text-[12px] text-unooria-neutral-600">é onde a turma está</span>
                )}
              </div>
              <p className="text-[12px] leading-snug text-unooria-neutral-600">{m.explica}</p>
            </div>
          ))}
        </div>

        <p className="text-[12px] leading-snug text-unooria-neutral-600">
          A pausa leva até 5 segundos para chegar nas telas — elas consultam o servidor nesse
          intervalo. Se você não pausar, cada estudante segue direto para a assinatura no ritmo
          dele: a missão termina igual, e o debate coletivo é o que se perde.
        </p>

        {erro && <FeedbackAlert type="error" description={erro} />}
      </div>
    </Card>
  );
}
