import { Button } from '@edu/ui/ds-chatgpt';
import { useEffect, useState } from 'react';
import type { Desfecho } from '../../lib/tipos';
import type { Tentativa } from './resultado';

const COR = { alfa: 'bg-gpt-azul', bravo: 'bg-gpt-roxo' } as const;

function milhar(n: number) {
  return n.toLocaleString('pt-BR');
}

/**
 * A operação acontecendo, e a conclusão dela.
 *
 * Tudo aqui é curto de propósito: o aluno acabou de ver as equipes cruzarem o
 * mapa e quer saber se foi bom. Um parágrafo de contexto neste momento não é
 * lido — e a versão anterior tinha quatro, sem nem caber na tela.
 */
export function Operacao({
  desfecho,
  esperado,
  tentativas = [],
  equipes,
  naoConsultados,
  onVerResultado,
}: {
  desfecho: Desfecho;
  esperado: { media: number; faixa: readonly [number, number] };
  tentativas?: Tentativa[];
  equipes: { equipe: 'alfa' | 'bravo'; nome: string | null }[];
  naoConsultados: { rotuloCurto: string; serve: string }[];
  onVerResultado: () => void;
}) {
  const [etapa, setEtapa] = useState(0);

  useEffect(() => {
    // Os marcos acompanham a animação do mapa (4,5s de percurso).
    const marcos = [1200, 3200, 4800].map((atraso, i) => setTimeout(() => setEtapa(i + 1), atraso));
    return () => marcos.forEach(clearTimeout);
  }, []);

  const pct = (parte: number) => {
    const v = (parte / desfecho.totais.emRisco) * 100;
    return (v < 10 ? v.toFixed(1) : Math.round(v).toString()).replace('.', ',');
  };

  const comDestino = equipes.filter((e) => e.nome !== null);
  const anterior = tentativas.length > 1 ? tentativas[tentativas.length - 2] : null;

  // Onde estava o risco da cidade, e quanto dele os seus dois bairros cobriam.
  // É a medida da DECISÃO — a sorte da rodada mexe no resultado, não nisto.
  const atendidos = desfecho.porBairro.filter((b) => b.equipe !== null);
  const cobertura = Math.round(
    (atendidos.reduce((soma, b) => soma + b.emRisco, 0) / desfecho.totais.emRisco) * 100,
  );
  const maiorDeFora = desfecho.porBairro
    .filter((b) => b.equipe === null)
    .sort((a, b) => b.emRisco - a.emRisco)[0];

  return (
    <section className="flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-gpt-suave-40">
        {etapa < 3 ? 'Operação em curso' : 'A tempestade passou'}
      </p>

      <ul className="grid gap-2">
        {comDestino.map((e, i) => {
          const bairro = desfecho.porBairro.find((b) => b.equipe === e.equipe);
          const visivel = etapa > i;
          return (
            <li
              key={e.equipe}
              className={`flex items-center gap-2.5 rounded-gpt-xl border border-gpt-borda px-3 py-2.5 transition-opacity duration-500 ${
                visivel ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-gpt-md text-xs font-bold text-gpt-tinta-inv ${COR[e.equipe]}`}
              >
                {e.equipe.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-tight">
                <strong className="block truncate text-gpt-tinta">{e.nome}</strong>
                <span className="block truncate text-xs text-gpt-suave-60">
                  {!visivel ? 'a caminho…' : (bairro?.motivo ?? 'chegou com margem')}
                </span>
              </span>
              {visivel && bairro && (
                <strong className="shrink-0 text-sm text-gpt-ok">+{milhar(bairro.salvas)}</strong>
              )}
            </li>
          );
        })}
      </ul>

      {etapa >= 3 ? (
        <div className="animate-entrar-cartao grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-gpt-xl bg-gpt-superficie px-4 py-3">
              <p className="text-3xl font-bold tracking-tight text-gpt-ok">
                {pct(desfecho.totais.salvas)}%
              </p>
              <p className="text-sm font-semibold text-gpt-tinta">resgatadas</p>
              <p className="text-xs text-gpt-suave-60">{milhar(desfecho.totais.salvas)} pessoas</p>
            </div>
            <div className="rounded-gpt-xl bg-gpt-superficie px-4 py-3">
              <p className="text-3xl font-bold tracking-tight text-gpt-erro">
                {pct(desfecho.totais.vitimas)}%
              </p>
              <p className="text-sm font-semibold text-gpt-tinta">afetadas</p>
              <p className="text-xs text-gpt-suave-60">{milhar(desfecho.totais.vitimas)} pessoas</p>
            </div>
          </div>

          {/* A medida da DECISÃO, em barra: quanto do risco da cidade estava
              onde ele mandou as equipes — a parte do resultado que é dele. */}
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-gpt-tinta">Risco que você cobriu</span>
              <strong className="text-gpt-tinta">{cobertura}%</strong>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-gpt-full bg-gpt-borda">
              <div
                className="h-full rounded-gpt-full bg-gpt-azul"
                style={{ width: `${cobertura}%` }}
              />
            </div>
            {maiorDeFora && (
              <p className="mt-1.5 text-xs text-gpt-suave-60">
                Maior foco sem equipe: {maiorDeFora.nome} · {milhar(maiorDeFora.emRisco)} em risco
              </p>
            )}
          </div>

          <ul className="grid gap-1.5 text-sm leading-snug">
            <li className="flex justify-between gap-3">
              <span className="text-gpt-suave-60">Costuma dar, com essa decisão</span>
              <span className="text-gpt-tinta">
                {milhar(esperado.faixa[0])}–{milhar(esperado.faixa[1])}
              </span>
            </li>
            {anterior && (
              <li className="flex justify-between gap-3">
                <span className="text-gpt-suave-60">Sua rodada anterior</span>
                <span
                  className={
                    desfecho.totais.salvas > anterior.salvas ? 'text-gpt-ok' : 'text-gpt-erro'
                  }
                >
                  {desfecho.totais.salvas > anterior.salvas ? '▲' : '▼'} {milhar(anterior.salvas)}
                </span>
              </li>
            )}
            {naoConsultados.length > 0 && (
              <li className="flex justify-between gap-3">
                <span className="text-gpt-suave-60">Não consultado</span>
                <span className="text-right text-gpt-tinta">{naoConsultados[0]?.rotuloCurto ?? '—'}</span>
              </li>
            )}
          </ul>

          <Button size="lg" variant="secondary" onClick={onVerResultado}>
            Ver o resultado completo
          </Button>
        </div>
      ) : (
        <p className="text-sm text-gpt-suave-60">Fechando a conta da cidade…</p>
      )}
    </section>
  );
}
