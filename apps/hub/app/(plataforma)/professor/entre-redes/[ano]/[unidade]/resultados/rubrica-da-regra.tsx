"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, FeedbackAlert } from "@edu/ui/ds";
import { ajustesEmMassa, caminhoDoPainel, ROTULO_DO_STATUS } from "@/lib/evidencias";
import { HABILIDADE_DA_RUBRICA, NIVEIS_DA_RUBRICA, type NivelDaRubrica } from "@/lib/quem-mandou-regras";

const EXP_ID = "exp05ef1b";

/**
 * A RUBRICA DO SE/ENTÃO (régua v2, ADR-120): o CRIAR da EF05CO04, ao lado da
 * regra que a criança escreveu. Um clique grava um AJUSTE da evidência — a
 * mesma rota do painel de habilidades — para a rodada desta aula, e o ajuste
 * vale sobre o nível que veio da P2. Com equipe, vale para todos do
 * computador: a regra foi escrita junto.
 *
 * Só aparece para quem lê o texto da regra (quem leciona na turma): classificar
 * sem ler seria chutar.
 */
export function RubricaDaRegra({
  turmaId,
  pacoteId,
  rodada,
  estudanteIds,
  nome,
  atual,
}: {
  turmaId: string;
  pacoteId: string;
  rodada: number;
  /** Quem recebe a classificação: a criança, ou todos do computador. */
  estudanteIds: readonly string[];
  /** Para o nome acessível do grupo de botões. */
  nome: string;
  /** O que o professor já deu nesta rodada, se deu. */
  atual: NivelDaRubrica | undefined;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function classificar(status: NivelDaRubrica) {
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await fetch(`${caminhoDoPainel(turmaId, EXP_ID, pacoteId)}/rodadas/${rodada}/ajustes`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ajustes: ajustesEmMassa(estudanteIds, HABILIDADE_DA_RUBRICA, status) }),
      });
      if (!resposta.ok) {
        setErro("A plataforma recusou a classificação. Tente de novo.");
        return;
      }
      /* Relê a página: a folha acende o botão e o painel de habilidades mostra o ajuste. */
      router.refresh();
    } catch {
      setErro("Não deu para falar com a plataforma. Confira a conexão e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1" data-rubrica-co04>
      <div
        role="group"
        aria-label={`Classificar a regra de ${nome} na ${HABILIDADE_DA_RUBRICA}`}
        className="flex flex-wrap items-center gap-1"
      >
        <span className="text-[11px] font-semibold text-unooria-neutral-700">{HABILIDADE_DA_RUBRICA}:</span>
        {NIVEIS_DA_RUBRICA.map((nivel) => (
          <Button
            key={nivel}
            size="sm"
            variant={atual === nivel ? "primary" : "outline"}
            aria-pressed={atual === nivel}
            disabled={ocupado}
            onClick={() => void classificar(nivel)}
          >
            {ROTULO_DO_STATUS[nivel]}
          </Button>
        ))}
      </div>
      {erro ? <FeedbackAlert type="error" description={erro} /> : null}
    </div>
  );
}
