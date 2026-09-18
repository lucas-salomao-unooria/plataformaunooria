"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert } from "@edu/ui/ds";
import { ROTULO_DA_ETAPA, type EtapaDaTurma } from "@/lib/quem-mandou-tipos";

/**
 * O PAINEL DA AULA da exp-05 — onde a professora muda o que 30 estudantes veem.
 *
 * Client component de propósito: ela aperta no meio da aula, na frente da sala,
 * e precisa de resposta na hora, sem recarregar. A mutação vai pelo BFF
 * (`/api/plataforma/quem-mandou-isso/...`), que assina o token — o client do
 * hub nunca segura bearer.
 *
 * **DOIS botões mestres, mais o inverso.** É um a mais que a exp-06 porque esta
 * missão tem dois momentos coletivos, e eles não podem ser o mesmo clique: a
 * revelação FECHA o Mural da sala inteira e acende o telão; a reflexão abre a
 * pergunta do tio, e ela vem DEPOIS do debate, que acontece fora da tela. Juntá
 * -los daria à turma a pergunta final antes de a conversa ter acontecido.
 *
 * O inverso (`voltar-exploracao`) não é um "zerar": nada é apagado, quem já
 * confirmou continua confirmado e quem já entregou a reflexão fica concluído.
 * Ele existe para o clique errado às 7h50 — sem ele, a saída seria zerar a
 * turma, que apaga o que as crianças escreveram.
 *
 * O que este painel NÃO faz: mexer no percurso de ninguém. O que ela controla é
 * QUANDO a turma anda junta, nunca o que cada criança escolheu.
 */

type Acao = "iniciar-revelacao" | "liberar-reflexao" | "voltar-exploracao";

const MOMENTOS: Array<{ acao: Acao; etapa: EtapaDaTurma; rotulo: string; explica: string }> = [
  {
    acao: "iniciar-revelacao",
    etapa: "revelacao",
    rotulo: "Iniciar revelação coletiva",
    explica:
      "Fecha o Mural de todo mundo e acende o telão: o histograma da sala aparece aqui para você projetar, e no Mural de cada estudante os selos VERDADEIRA, FALSA e AMBÍGUA aparecem sobre o que ele encaminhou, com quantas pessoas encaminharam a mesma mensagem. Quem ainda não tinha confirmado para de poder encaminhar.",
  },
  {
    acao: "liberar-reflexao",
    etapa: "reflexao",
    rotulo: "Liberar reflexão final",
    explica:
      "Abre a última pergunta — o áudio do tio no grupo da família. Aperte depois do debate: a resposta dela é sobre a conversa que a turma acabou de ter, não sobre a tela.",
  },
  {
    acao: "voltar-exploracao",
    etapa: "exploracao",
    rotulo: "Voltar para a exploração",
    explica:
      "Desfaz os dois de cima, para quando você revelou antes da hora. Nada é apagado: quem já confirmou continua confirmado, e quem já respondeu a pergunta final continua concluído.",
  },
];

export function PainelDaAulaQuemMandou({
  turmaId,
  etapa,
  /** Sem lote publicado não há aula para conduzir — e o botão que não faz nada é pior que o botão ausente. */
  preparada,
}: {
  turmaId: string;
  etapa: EtapaDaTurma;
  preparada: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Acao | null>(null);
  const [, transicionar] = useTransition();

  /* A TELA ANDA SOZINHA enquanto a turma confirma — e quem a faz andar é este
     intervalo, pela PÁGINA inteira e não só por este card: `router.refresh()`
     refaz o render do servidor, e é de lá que vêm a barra de prontidão, o telão
     e a folha da turma.

     COMO FALHAVA: nada na árvore da exp-05 pedia dado de novo. A professora
     abria a tela às 8h e projetava; ela ficava em "0/30 confirmaram (0%)"
     enquanto os 30 confirmavam — com a frase "Espere cerca de 90% antes de
     iniciar a revelação" embaixo de um número que não andava, e nada em tela
     pedindo F5. Ela decide a hora de acender o telão POR esse número: parado,
     ela revela no escuro ou espera indefinidamente. Quem precisou contornar
     isso primeiro foi a própria suíte, que recarrega a página antes de ler o
     telão.

     O molde é o relógio da exp-03 (`painel-do-relogio.tsx`): a transição troca
     o render sem piscar a tela e sem derrubar o que ela já digitou no preparo
     logo acima — aquele formulário é estado de client, e `refresh` não o
     remonta.

     E PARA fora da exploração, de propósito: depois que o telão acende não há
     mais prontidão a acompanhar (o Mural fechou para todos de uma vez), e um
     painel que consulta para sempre é trabalho para ninguém — três chamadas a
     cada 5 s, por professora, até ela fechar a aba. */
  useEffect(() => {
    if (etapa !== "exploracao") return;
    const id = setInterval(() => {
      transicionar(() => router.refresh());
    }, 5_000);
    return () => clearInterval(id);
  }, [etapa, router]);

  async function agir(acao: Acao) {
    setEnviando(acao);
    setErro(null);
    try {
      const r = await fetch(
        `/api/plataforma/quem-mandou-isso/turmas/${encodeURIComponent(turmaId)}/gate`,
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

        {!preparada && (
          <FeedbackAlert
            type="warning"
            description="Publique o lote acima antes de conduzir: sem ele a turma não entra no grupo, e não há o que revelar."
          />
        )}

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
                  data-etapa={m.etapa}
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
