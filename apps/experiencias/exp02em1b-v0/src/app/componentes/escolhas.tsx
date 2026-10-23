import { ChoicePoll } from '@edu/ui/ds-unooriaai';
import { useState } from 'react';
import type { Opcao } from '../../lib/tipos';

/**
 * UM CARTÃO DE ESCOLHAS do Canal A (ADR-172): uma ou mais perguntas de escolha
 * fechada, cada uma um `ChoicePoll` da seção `unooriaai` — nunca o `RadioGroup`
 * da plataforma: aqui não há revelação.
 *
 * O voto do `ChoicePoll` é definitivo no toque, e o cartão vai inteiro para a
 * api quando a ÚLTIMA pergunta dele é escolhida. Falhou o envio, as escolhas
 * voltam a abrir. A tela nunca diz se acertou: a api devolve só o estado do
 * cartão, e o gabarito fica nela.
 */
export function CartaoDeEscolhas({
  titulo,
  enunciado,
  perguntas,
  enviada,
  onEnviar,
  rotuloEnviado = 'Registrado ✓',
  filhos,
}: {
  titulo?: string;
  enunciado?: React.ReactNode;
  perguntas: { id: string; pergunta: React.ReactNode; opcoes: Opcao[] }[];
  enviada: boolean;
  onEnviar: (respostas: Record<string, string>) => Promise<void>;
  rotuloEnviado?: string;
  /** O que vem entre o enunciado e as perguntas (uma tabela, uma peça). */
  filhos?: React.ReactNode;
}) {
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function votar(id: string, opcao: string) {
    if (enviando || enviada) return;
    const proximas = { ...escolhas, [id]: opcao };
    setEscolhas(proximas);
    setFalhou(false);
    if (perguntas.every((p) => proximas[p.id])) {
      setEnviando(true);
      try {
        await onEnviar(proximas);
      } catch {
        setEscolhas({});
        setFalhou(true);
      } finally {
        setEnviando(false);
      }
    }
  }

  return (
    <section className="rounded-uai-xl border border-uai-borda p-5" aria-label={titulo}>
      {titulo && <p className="text-xs font-bold uppercase tracking-wider text-uai-suave-60">{titulo}</p>}
      {enunciado && <div className="mt-2 text-sm leading-relaxed text-uai-tinta">{enunciado}</div>}
      {filhos}
      {enviada ? (
        <p className="mt-4 text-sm font-semibold text-uai-ok">{rotuloEnviado}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {perguntas.map((p) => (
            <ChoicePoll
              key={p.id}
              question={p.pergunta}
              options={p.opcoes.map((o) => ({ id: o.id, label: o.texto }))}
              value={escolhas[p.id] ?? null}
              disabled={enviando}
              sentLabel="Escolhida ✓"
              onVote={(opcao) => void votar(p.id, opcao)}
            />
          ))}
          {falhou && <p className="text-sm text-uai-erro">Não deu para registrar agora. Escolha de novo.</p>}
        </div>
      )}
    </section>
  );
}
