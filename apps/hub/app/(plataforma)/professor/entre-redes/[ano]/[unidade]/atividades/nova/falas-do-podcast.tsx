"use client";

import { useEffect, useRef } from "react";
import { Button, FeedbackAlert, Icon, ProgressBar, TextArea } from "@edu/ui/ds";
import { avisoDasFalas, problemaDaFala, type FalasEscritas, type VagaDoPodcast } from "@/lib/podcast-tipos";

/**
 * AS FALAS DO PODCAST NA CRIAÇÃO DA ATIVIDADE (ADR-150) — o professor SEMPRE
 * as revisa aqui, junto do conteúdo que elas contam (decisão do Lucas,
 * 2026-10-06). O roteiro é o aprovado pela Unooria; só estas falas mudam com o
 * tema, porque dizem o que a turma vai ver nesta atividade.
 *
 * Quem escreve é a api (`POST /podcast/:expId/turmas/:turmaId/falas-do-tema`),
 * com o conteúdo como a tela o tem: o banco padrão volta com as falas do sheet,
 * sem IA; um tema próprio, com as da IA. Quem grava é a homologação da missão,
 * com estas falas no corpo.
 */

/** Pede as falas para o conteúdo da tela. Nunca lança: a falha volta como frase. */
export async function pedirFalasDoTema(
  expId: string,
  turmaId: string,
  conteudo: unknown,
): Promise<{ ok: true; falas: FalasEscritas } | { ok: false; mensagem: string }> {
  try {
    const r = await fetch(
      `/api/plataforma/podcast/${encodeURIComponent(expId)}/turmas/${encodeURIComponent(turmaId)}/falas-do-tema`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conteudo }) },
    );
    const corpo: unknown = await r.json().catch(() => null);
    if (!r.ok) {
      const mensagem = (corpo as { mensagem?: string } | null)?.mensagem;
      return { ok: false, mensagem: mensagem ?? "As falas do podcast não vieram agora. Tente de novo." };
    }
    return { ok: true, falas: corpo as FalasEscritas };
  } catch {
    return { ok: false, mensagem: "A conexão falhou ao escrever as falas do podcast. Tente de novo." };
  }
}

/** Quantas falas impedem a aprovação — a tela diz o número, e cada campo diz o porquê. */
export function falasComProblema(falas: FalasEscritas | null): number {
  return falas ? falas.vagas.filter((v) => problemaDaFala(v.texto) !== null).length : 0;
}

export function FalasDoPodcast({
  falas,
  escrevendo,
  falha,
  desatualizadas,
  travado,
  aoMudar,
  aoReescrever,
}: {
  falas: FalasEscritas | null;
  escrevendo: boolean;
  /** A frase da última tentativa que falhou, ou `null`. */
  falha: string | null;
  /** O conteúdo mudou depois que as falas foram escritas: elas podem não contar mais o que a turma vai ver. */
  desatualizadas: boolean;
  travado: boolean;
  aoMudar: (vagas: VagaDoPodcast[]) => void;
  aoReescrever: () => void;
}) {
  const aviso = falas ? avisoDasFalas(falas) : null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-unooria-neutral-200 p-4" data-falas-do-podcast>
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-semibold text-unooria-neutral-950">
          O podcast de recapitulação: o que ele conta desta atividade
        </p>
        <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
          O podcast é seu, para tocar à turma depois da aula. O roteiro é o aprovado pela Unooria; só estas falas mudam
          com o tema, porque contam o que a turma vai ver. Leia e ajuste antes de aprovar.
        </p>
      </div>

      {escrevendo ? <ProgressBar indeterminate label="Escrevendo as falas do podcast…" variant="brand" /> : null}
      {falha && !escrevendo ? <FeedbackAlert type="warning" description={falha} /> : null}
      {aviso && !escrevendo ? <FeedbackAlert type="warning" description={aviso} /> : null}
      {desatualizadas && falas && !escrevendo ? (
        <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status" data-falas-desatualizadas>
          O conteúdo mudou depois que estas falas foram escritas. Confira se elas ainda contam o que a turma vai ver, ou
          escreva de novo.
        </p>
      ) : null}

      {falas ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {falas.vagas.map((vaga) => {
            const problema = problemaDaFala(vaga.texto);
            return (
              <TextArea
                key={vaga.id}
                label={`${vaga.falante}, sobre ${vaga.sobre}`}
                value={vaga.texto}
                rows={5}
                maxLength={600}
                disabled={travado || escrevendo}
                error={problema ?? undefined}
                helperText={problema ? undefined : "De 12 a 60 palavras, sem link nem @."}
                data-fala={vaga.id}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  aoMudar(falas.vagas.map((v) => (v.id === vaga.id ? { ...v, texto: e.target.value } : v)))
                }
              />
            );
          })}
        </div>
      ) : null}

      {!travado ? (
        <div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="record_voice_over" size={18} />}
            onClick={aoReescrever}
            isDisabled={escrevendo}
            data-acao="escrever-falas-do-podcast"
          >
            {falas ? "Escrever as falas de novo" : "Escrever as falas do podcast"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Pede as falas quando um conteúdo NOVO chega à tela — a `chave` diz qual (a
 * turma, a origem e a hora do pacote). Existe porque, em algumas criações, o
 * conteúdo chega por mais de um caminho (o rascunho gravado, a IA, o banco
 * pronto) e só a função que desenha o passo conhece a turma. Não desenha nada.
 */
export function EscreverAoChegar({ chave, aoChegar }: { chave: string | null; aoChegar: () => void }) {
  const ultima = useRef<string | null>(null);
  const aoChegarAtual = useRef(aoChegar);
  aoChegarAtual.current = aoChegar;
  useEffect(() => {
    if (chave === null || chave === ultima.current) return;
    ultima.current = chave;
    aoChegarAtual.current();
  }, [chave]);
  return null;
}
