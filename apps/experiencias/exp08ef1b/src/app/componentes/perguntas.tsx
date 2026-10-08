/**
 * As folhas da PLATAFORMA, no chunk da reflexão: ela já chega por `React.lazy`
 * (`instanooria-app.tsx`), então o CSS do DS só desce depois da revelação e não
 * acompanha o feed — o mesmo cuidado de `dossie/graficos.tsx`.
 */
import '@unooria/design-system/unooria.css';
import '@unooria/design-system/fonts/unooria.css';

import { useEffect, useRef, useState } from 'react';
import { Button, RadioGroup } from '@edu/ui/ds';

import { api } from '../../lib/api';

/** O id da missão nas rotas da evidência — o mesmo do `bootstrap` e do manifesto. */
const EXP_ID = 'exp08ef1b';

/** As três perguntas da ficha (`apps/api/src/evidencias/fichas/exp08ef1b.ts`), na ordem do PO. */
export const PERGUNTAS = ['p1', 'p2', 'p3'] as const;
type IdDaPergunta = (typeof PERGUNTAS)[number];

interface PerguntaDaApi {
  enunciado: string;
  alternativas: { id: string; texto: string }[];
}

interface PerguntaNaTela extends PerguntaDaApi {
  id: IdDaPergunta;
  /** O `id` enviado; `null` = ainda não. */
  enviada: string | null;
}

/**
 * A memória de F5 — `sessionStorage`, só com IDS, e só conveniência: a api
 * guarda a PRIMEIRA resposta de qualquer jeito. Aqui fica qual alternativa foi
 * enviada, para a pergunta reabrir travada sem convidar a um segundo envio que
 * não valeria nada. Nunca `localStorage` (a máquina da escola é compartilhada)
 * e tudo em `try/catch` (aba anônima lança).
 */
const chave = (runId: string) => `${EXP_ID}:${runId}:perguntas`;

function lerEnviadas(runId: string): Record<string, string> {
  try {
    const bruto = window.sessionStorage.getItem(chave(runId));
    const dado: unknown = bruto ? JSON.parse(bruto) : {};
    if (!dado || typeof dado !== 'object') return {};
    return Object.fromEntries(
      Object.entries(dado as Record<string, unknown>).filter((par): par is [string, string] => typeof par[1] === 'string'),
    );
  } catch {
    return {};
  }
}

function gravarEnviada(runId: string, perguntaId: string, alternativaId: string) {
  try {
    window.sessionStorage.setItem(chave(runId), JSON.stringify({ ...lerEnviadas(runId), [perguntaId]: alternativaId }));
  } catch {
    /* Armazenamento bloqueado: a tela segue, só sem o F5 amigável. */
  }
}

/**
 * AS PERGUNTAS DE EVIDÊNCIA (E14) — as três do PO, depois da reflexão salva,
 * na mesma tela escura. Fora do disfarce (é a escola perguntando, não o
 * Unoovista), então os controles são da PLATAFORMA (`RadioGroup` e `Button`),
 * no tema escuro que a tela pede; o texto em volta segue a reflexão.
 *
 * - **Uma de cada vez**: a próxima chega depois do envio, como nas enquetes da
 *   A Seleção. Escolher não envia: o envio é o botão, e um toque errado na
 *   alternativa ainda se desfaz.
 * - **Nunca mostra acerto.** A api devolve as alternativas sem o nível, numa
 *   ordem nova a cada leitura, e responde `{ enviada: true }` para qualquer uma
 *   (regra 3). Depois do envio, só "Resposta enviada".
 * - **Falhou, acabou** (409 sem atividade, 404, rede): as perguntas somem e a
 *   tela fica com a reflexão. A missão nunca fica presa numa pergunta.
 */
export function Perguntas({ runId }: { runId: string }) {
  const [perguntas, setPerguntas] = useState<PerguntaNaTela[]>([]);
  const [proxima, setProxima] = useState(0);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const enviadas = useRef(lerEnviadas(runId));

  useEffect(() => {
    const id = PERGUNTAS[proxima];
    if (falhou || !id) return;
    let viva = true;
    api
      .get<PerguntaDaApi>(`/evidencias/${EXP_ID}/perguntas/${id}`)
      .then((p) => {
        if (!viva) return;
        const guardada = enviadas.current[id];
        const enviada = guardada && p.alternativas.some((a) => a.id === guardada) ? guardada : null;
        setPerguntas((atuais) => [...atuais.filter((q) => q.id !== id), { ...p, id, enviada }]);
        // Já enviada antes do F5: segue para a próxima sem pedir de novo.
        if (enviada) setProxima((n) => n + 1);
      })
      .catch(() => viva && setFalhou(true));
    return () => {
      viva = false;
    };
  }, [proxima, falhou]);

  async function enviar(id: IdDaPergunta) {
    if (!escolha || enviando) return;
    setEnviando(true);
    try {
      await api.post(`/evidencias/${EXP_ID}/perguntas/${id}/resposta`, { alternativaId: escolha });
      enviadas.current = { ...enviadas.current, [id]: escolha };
      gravarEnviada(runId, id, escolha);
      setPerguntas((atuais) => atuais.map((q) => (q.id === id ? { ...q, enviada: escolha } : q)));
      setEscolha(null);
      setProxima((n) => n + 1);
    } catch {
      setFalhou(true);
    } finally {
      setEnviando(false);
    }
  }

  if (falhou) return null;
  const terminou = proxima >= PERGUNTAS.length;

  return (
    <section aria-label="Perguntas sobre a missão" className="flex flex-col gap-5 border-t border-white/10 pt-6">
      <header className="flex flex-col gap-1.5">
        <p className="text-[12px] uppercase tracking-widest text-white/60">mais três perguntas</p>
        <p className="text-[13px] leading-relaxed text-white/60">Escolhe a resposta que mais combina com o que você pensa.</p>
      </header>

      {perguntas.map((q, indice) => (
        <div key={q.id} className="flex flex-col gap-3 rounded-xl bg-white/5 px-4 py-4">
          <RadioGroup
            theme="dark"
            name={`pergunta-${q.id}`}
            label={
              <span className="text-[15px] font-semibold leading-snug text-white">
                {indice + 1}. {q.enunciado}
              </span>
            }
            options={q.alternativas.map((a) => ({ value: a.id, label: a.texto }))}
            /* Controlado desde o primeiro render: `''` é "nada escolhido". Com
               `undefined` no começo, o rádio trocava de não controlado para
               controlado na primeira escolha, e o React avisava no console. */
            value={q.enviada ?? escolha ?? ''}
            disabled={q.enviada !== null || enviando}
            onChange={(valor) => setEscolha(String(valor))}
          />
          {q.enviada ? (
            <p className="text-[13px] text-brand-coral">Resposta enviada ✓</p>
          ) : (
            <Button
              theme="dark"
              variant="light"
              fullWidth
              isLoading={enviando}
              loadingText="Enviando…"
              disabled={!escolha || enviando}
              onClick={() => void enviar(q.id)}
            >
              Enviar resposta
            </Button>
          )}
        </div>
      ))}

      {terminou ? (
        <p className="text-[13px] leading-relaxed text-white/60">Pronto. Suas respostas foram enviadas.</p>
      ) : null}
    </section>
  );
}
