"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert } from "@edu/ui/ds";
import type { RetratoDoRelogio } from "@/lib/unoogpt-tipos";

/**
 * O RELÓGIO DA AULA — a única tela do hub em que o professor muda o que o estudante
 * vê, ao vivo.
 *
 * Client component de propósito: ele aperta "dar a largada" no meio da aula e
 * precisa de resposta na hora, sem recarregar a página. A mutação vai pelo BFF
 * (`/api/plataforma/unoogpt/...`), que assina o token — o client do hub nunca
 * segura bearer.
 *
 * O que este painel NÃO faz: tocar no Passo de ninguém. O que o professor
 * controla é QUANDO dá para falar com o assistente, não o que a criança decide.
 */
const ROTULO_DA_FASE: Record<RetratoDoRelogio["fase"], string> = {
  aguardando: "Ainda não começou",
  correndo: "Em andamento",
  encerrado: "Encerrada",
};

function cronometro(segundos: number | null): string {
  if (segundos === null) return "—";
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Acao =
  | "largada"
  | "mais-tempo"
  | "encerrar"
  | "modo-livre"
  | "modo-cronometrado"
  | "redefinir"
  | "abrir-fechamento";

export function PainelDoRelogio({
  turmaId,
  inicial,
  fechamento,
}: {
  turmaId: string;
  inicial: RetratoDoRelogio;
  /** Quantas linhas que chegaram ao resultado já enviaram o fechamento (ADR-172). */
  fechamento: { enviaram: number; de: number };
}) {
  const router = useRouter();
  const [relogio, setRelogio] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const [, transicionar] = useTransition();

  // O estudante também está olhando o cronômetro. Aqui a atualização é mais lenta
  // (10s): o professor precisa saber a FASE, não acompanhar segundo a segundo.
  useEffect(() => {
    const id = setInterval(() => {
      transicionar(() => router.refresh());
    }, 10_000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    setRelogio(inicial);
  }, [inicial]);

  async function agir(acao: Acao) {
    setEnviando(acao);
    setErro(null);
    try {
      const r = await fetch(
        `/api/plataforma/unoogpt/professor/turmas/${encodeURIComponent(turmaId)}/relogio`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ acao }),
        },
      );
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
        setErro(corpo.mensagem ?? "Não deu para mexer no relógio agora.");
        return;
      }
      setRelogio((await r.json()) as RetratoDoRelogio);
      // A folha da turma abaixo depende do relógio (quem "começou").
      transicionar(() => router.refresh());
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  const minutosDoIncremento = Math.round(relogio.incrementoSeg / 60);

  return (
    <Card variant="elevated" title="Relógio da aula">
      <div className="flex flex-col gap-4">
        {relogio.fase === "aguardando" && (
          <FeedbackAlert
            type="warning"
            title="Ninguém consegue falar com o assistente ainda"
            description="A largada vale para a turma inteira ao mesmo tempo. Combine em voz alta antes de apertar."
          />
        )}

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">Situação</p>
            <p className="text-[16px] font-semibold text-unooria-neutral-950">
              {ROTULO_DA_FASE[relogio.fase]}
              {relogio.motivoDoFim === "professor" && " (você encerrou)"}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
              Falta para a chuva
            </p>
            <p className="font-mono text-[22px] font-bold tabular-nums text-unooria-neutral-950">
              {relogio.modo === "livre" ? "sem tempo marcado" : cronometro(relogio.segundosAteFechar)}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
              Hora na cidade
            </p>
            <p className="font-mono text-[22px] font-bold tabular-nums text-unooria-neutral-950">
              {String(17 + Math.floor(relogio.minutosGastos / 60)).padStart(2, "0")}:
              {String(relogio.minutosGastos % 60).padStart(2, "0")}
            </p>
          </div>
        </div>

        {erro && <FeedbackAlert type="error" title="Não deu" description={erro} />}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void agir("largada")}
            disabled={enviando !== null || relogio.fase !== "aguardando"}
          >
            {relogio.fase === "aguardando" ? "Dar a largada" : "Largada dada"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void agir("mais-tempo")}
            disabled={enviando !== null || relogio.fase === "aguardando"}
          >
            +{minutosDoIncremento} min
          </Button>
          <Button
            variant="secondary"
            onClick={() => void agir("encerrar")}
            disabled={enviando !== null || relogio.fase !== "correndo"}
          >
            Encerrar a investigação
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void agir(relogio.modo === "livre" ? "modo-cronometrado" : "modo-livre")
            }
            disabled={enviando !== null}
          >
            {relogio.modo === "livre" ? "Voltar a cronometrar" : "Aula sem tempo marcado"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void agir("redefinir")}
            disabled={enviando !== null}
          >
            Redefinir o relógio
          </Button>
        </div>

        {/* O FECHAMENTO (ADR-172): o pedido pelo WhatsApp e a resposta à
            moradora aparecem juntos para a turma quando o professor abre —
            depois do debate, que vem antes deles. Com ele aberto, o "Tentar de
            novo" some da tela do estudante. */}
        <div className="flex flex-col gap-2 border-t border-unooria-neutral-200 pt-4" data-fechamento>
          <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">Fechamento</p>
          {relogio.fechamentoAberto ? (
            <p className="text-[14px] text-unooria-neutral-950" data-fechamento-aberto>
              <strong>
                {fechamento.enviaram} de {fechamento.de}
              </strong>{" "}
              {fechamento.de === 1 ? "grupo enviou" : "grupos enviaram"} o fechamento. Quando todos
              enviarem, é a hora das perguntas faladas sobre cuidado com os dados e direitos.
            </p>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                Depois do debate: o pedido pelo WhatsApp e a resposta à moradora aparecem juntos
                para a turma, e o &quot;Tentar de novo&quot; some.
              </p>
              <div>
                <Button
                  variant="secondary"
                  onClick={() => void agir("abrir-fechamento")}
                  disabled={enviando !== null || relogio.fase === "aguardando"}
                >
                  Abrir o fechamento
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="text-[13px] leading-relaxed text-unooria-neutral-600">
          Somar tempo <strong>não faz a chuva andar para trás</strong>: a cidade continua de onde
          estava, mais devagar, e chega às 18h00 no novo fim. Redefinir devolve o relógio ao estado
          de antes da aula (e fecha o fechamento) e <strong>não apaga partida nenhuma</strong>.
        </p>
      </div>
    </Card>
  );
}
