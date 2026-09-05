"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@edu/ui/ds";
import type { EstadoDaMissao } from "@/lib/salas";

/**
 * Liberar ou encerrar uma missão nesta turma (ADR-69).
 *
 * Client-side porque o professor aperta na FRENTE DA SALA: recarregar a página
 * inteira para ver o estado mudar é tempo de aula. Passa pelo BFF
 * (`/api/plataforma/salas/...`), que assina o token — a guarda de papel está na
 * api, e ela recusa quem não tem matrícula na turma.
 *
 * `router.refresh()` e não estado local: o que muda não é só este botão — a
 * linha inteira muda de estado, e a contagem no topo da aba junto. Reler do
 * servidor é o que mantém a tela verdadeira.
 */
export function BotaoLiberar({
  turmaId,
  expId,
  estado,
  nome,
}: {
  turmaId: string;
  expId: string;
  estado: EstadoDaMissao;
  nome: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const abrir = estado !== "liberada";
  const alvo = abrir ? "liberada" : "encerrada";

  async function alternar() {
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch(
        `/api/plataforma/salas/turma/${encodeURIComponent(turmaId)}/missoes/${encodeURIComponent(expId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ estado: alvo }),
        },
      );
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
        setErro(corpo?.mensagem ?? "Não deu para mudar agora. Tente de novo.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Não deu para falar com a plataforma. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={abrir ? "primary" : "secondary"}
        size="sm"
        onClick={alternar}
        isDisabled={enviando}
        aria-label={`${abrir ? "Liberar" : "Encerrar"} ${nome} nesta turma`}
      >
        {enviando ? "…" : abrir ? "Liberar" : "Encerrar"}
      </Button>
      {erro ? <span className="text-[12px] text-unooria-neutral-700">{erro}</span> : null}
    </div>
  );
}
