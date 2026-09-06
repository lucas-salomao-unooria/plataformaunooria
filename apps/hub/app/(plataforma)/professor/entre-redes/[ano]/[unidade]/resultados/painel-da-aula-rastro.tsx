"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, FeedbackAlert } from "@edu/ui/ds";
import { ROTULO_DA_ETAPA, type EtapaDaAula } from "@/lib/rastro-tipos";

/**
 * O PAINEL DA AULA da exp-06 — onde a professora muda o que 30 estudantes veem.
 *
 * Client component de propósito: ela aperta no meio da aula e precisa de
 * resposta na hora, sem recarregar. A mutação vai pelo BFF
 * (`/api/plataforma/rastro-boato/...`), que assina o token — o client do hub
 * nunca segura bearer.
 *
 * **Dois botões, não três.** A exp-07 tem um gate por momento do roteiro dela;
 * aqui o debate acontece DEPOIS do mapa, com a turma toda já na Aula 2, e não
 * há o que congelar no meio. Um terceiro botão seria um controle morto no
 * painel — e controle morto no meio de uma aula é pior que controle nenhum.
 *
 * O que este painel NÃO faz: mexer no percurso de ninguém. O que ela controla é
 * QUANDO a turma anda junta, não o que cada criança decidiu.
 */

type Acao = "liberar-aula2" | "pausar-simulacao";

const MOMENTOS: Array<{ acao: Acao; etapa: EtapaDaAula; rotulo: string; explica: string }> = [
  {
    acao: "liberar-aula2",
    etapa: "aula2",
    rotulo: "Abrir a Aula 2",
    explica:
      "Solta quem está esperando no card de pausa e libera o gráfico, o mapa da rede, o ciclo e o Meu percurso. Sem isto, ninguém passa da decisão no grupo.",
  },
  {
    acao: "pausar-simulacao",
    etapa: "aula1",
    rotulo: "Pausar a simulação",
    explica:
      "Volta a turma para o card de pausa. É para quem abriu a Aula 2 antes da hora — nada é apagado, e quem já entregou o percurso continua concluído.",
  },
];

export function PainelDaAulaRastro({
  turmaId,
  etapa,
}: {
  turmaId: string;
  etapa: EtapaDaAula;
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
        `/api/plataforma/rastro-boato/turmas/${encodeURIComponent(turmaId)}/gate`,
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

        {erro && <FeedbackAlert type="error" description={erro} />}
      </div>
    </Card>
  );
}
