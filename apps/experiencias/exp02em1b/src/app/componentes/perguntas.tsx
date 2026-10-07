import { ChoicePoll } from '@edu/ui/ds-unooriaai';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { EXP_ID } from '../../lib/tipos';

/** As quatro perguntas da ficha (`apps/api/src/evidencias/fichas/exp02em1b.ts`), na ordem do PO. */
export const PERGUNTAS = ['p1', 'p2', 'p3', 'p4'] as const;
type IdDaPergunta = (typeof PERGUNTAS)[number];

interface PerguntaDaApi {
  enunciado: string;
  alternativas: { id: string; texto: string }[];
}

interface PerguntaNaTela extends PerguntaDaApi {
  id: IdDaPergunta;
}

/**
 * A memória de F5 — `sessionStorage`, só com IDS, por TENTATIVA: a pergunta
 * reaparece em cada "Tentar de novo" (vale a melhor resposta, ADR-154), então a
 * trava vale só para o resultado em que ela foi respondida. Nunca
 * `localStorage` (a máquina da escola é compartilhada) e tudo em `try/catch`.
 */
const chave = (tentativa: number) => `${EXP_ID}:perguntas:${tentativa}`;

function lerEnviadas(tentativa: number): Record<string, string> {
  try {
    const dado: unknown = JSON.parse(window.sessionStorage.getItem(chave(tentativa)) ?? '{}');
    if (!dado || typeof dado !== 'object') return {};
    return Object.fromEntries(
      Object.entries(dado as Record<string, unknown>).filter((par): par is [string, string] => typeof par[1] === 'string'),
    );
  } catch {
    return {};
  }
}

function gravarEnviadas(tentativa: number, enviadas: Record<string, string>) {
  try {
    window.sessionStorage.setItem(chave(tentativa), JSON.stringify(enviadas));
  } catch {
    /* Armazenamento bloqueado: a tela segue, só sem o F5 amigável. */
  }
}

/**
 * AS PERGUNTAS DE EVIDÊNCIA (E14, ADR-154) — as quatro do PO, no Resultado,
 * dentro do UnooriaAI: a missão não sai do disfarce, então a escolha é o
 * `ChoicePoll` da seção `unooriaai`.
 *
 * - **Nunca mostra acerto.** A api serve as alternativas sem o nível, numa ordem
 *   nova a cada leitura, e responde `{ enviada: true }` para qualquer uma.
 * - **Reaparecem a cada tentativa, e vale a melhor** (servidor). O "Tentar de
 *   novo" não espera por elas.
 * - **Falhou, some** (409 fora do resultado ou da rodada da turma, 403 com a
 *   missão encerrada, rede): o Resultado continua inteiro.
 */
export function Perguntas({ tentativa }: { tentativa: number }) {
  const [perguntas, setPerguntas] = useState<PerguntaNaTela[] | null>(null);
  const [enviadas, setEnviadas] = useState<Record<string, string>>(() => lerEnviadas(tentativa));
  const [enviando, setEnviando] = useState<IdDaPergunta | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let viva = true;
    setEnviadas(lerEnviadas(tentativa));
    Promise.all(
      PERGUNTAS.map(async (id) => ({ id, ...(await api.get<PerguntaDaApi>(`/evidencias/${EXP_ID}/perguntas/${id}`)) })),
    )
      .then((lista) => viva && setPerguntas(lista))
      .catch(() => viva && setFalhou(true));
    return () => {
      viva = false;
    };
  }, [tentativa]);

  async function votar(id: IdDaPergunta, alternativaId: string) {
    if (enviando) return;
    setEnviando(id);
    try {
      await api.post(`/evidencias/${EXP_ID}/perguntas/${id}/resposta`, { alternativaId });
      const proximas = { ...enviadas, [id]: alternativaId };
      setEnviadas(proximas);
      gravarEnviadas(tentativa, proximas);
    } catch {
      setFalhou(true);
    } finally {
      setEnviando(null);
    }
  }

  if (falhou || !perguntas) return null;

  return (
    <div className="mt-8 flex max-w-2xl flex-col gap-4" aria-label="Perguntas sobre a missão" role="group">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-uai-suave-40">Antes de fechar</p>
        <p className="mt-1 text-sm text-uai-suave-60">
          Quatro perguntas sobre o que você viveu na missão. Escolha a resposta que mais combina com o que você
          pensa.
        </p>
      </div>
      {perguntas.map((p) => (
        <ChoicePoll
          key={`${tentativa}-${p.id}`}
          question={p.enunciado}
          options={p.alternativas.map((a) => ({ id: a.id, label: a.texto }))}
          value={enviadas[p.id] ?? null}
          disabled={enviando !== null}
          onVote={(alternativa) => void votar(p.id, alternativa)}
        />
      ))}
    </div>
  );
}
