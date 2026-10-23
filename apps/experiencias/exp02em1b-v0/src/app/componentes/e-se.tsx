import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Quadradinho, RespostaESe } from '../../lib/tipos';
import { CartaoDeEscolhas } from './escolhas';

type Comparacao = NonNullable<RespostaESe['comparacoes']>[number];

const decisao = (d: { alfa: string; bravo: string }) => `Alfa → ${d.alfa} · Bravo → ${d.bravo}`;

const LEGENDA: Record<Quadradinho, (c: Comparacao) => string> = {
  outra: (c) => (c.referencia.sua ? 'a outra decisão resgatou mais' : 'a segunda decisão resgatou mais'),
  referencia: (c) => (c.referencia.sua ? 'a sua resgatou mais' : 'a primeira decisão resgatou mais'),
  empate: () => 'as duas resgataram o mesmo',
};

/**
 * A FAIXA de 20 tempestades: um quadradinho por tempestade, dizendo qual das
 * duas decisões resgatou mais nela. Compensação declarada (`.faixa-de-
 * tempestades` em `estilos/globals.css`): a seção não publica a peça. O
 * equivalente para leitor de tela é a LISTA, tempestade a tempestade, sem a
 * contagem pronta — a contagem é a resposta.
 */
function Faixa({ c }: { c: Comparacao }) {
  return (
    <div className="mt-3">
      <div className="faixa-de-tempestades" aria-hidden="true">
        {c.quadradinhos.map((q, i) => (
          <span key={i} data-quem={q} title={`Tempestade ${i + 1}: ${LEGENDA[q](c)}`} />
        ))}
      </div>
      <ol className="sr-only">
        {c.quadradinhos.map((q, i) => (
          <li key={i}>
            Tempestade {i + 1}: {LEGENDA[q](c)}.
          </li>
        ))}
      </ol>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-uai-suave-60" aria-hidden="true">
        <span>
          <span className="faixa-legenda" data-quem="outra" />{' '}
          {c.referencia.sua ? 'a outra resgatou mais' : 'a segunda resgatou mais'}
        </span>
        <span>
          <span className="faixa-legenda" data-quem="referencia" />{' '}
          {c.referencia.sua ? 'a sua resgatou mais' : 'a primeira resgatou mais'}
        </span>
      </p>
    </div>
  );
}

/**
 * "E SE…" NAS MESMAS TEMPESTADES (EM13CO11, ADR-172): duas outras decisões,
 * montadas pelo servidor, em ordem embaralhada, cada uma contra as mesmas 20
 * tempestades. O grupo diz o que cada uma permite afirmar. Falhou (sem
 * comparação possível, ou erro), o bloco some e o resultado continua inteiro.
 */
export function ESe() {
  const [estado, setEstado] = useState<RespostaESe | null>(null);

  useEffect(() => {
    let viva = true;
    api
      .get<RespostaESe>('/unoogpt/e-se')
      .then((r) => viva && setEstado(r))
      .catch(() => undefined);
    return () => {
      viva = false;
    };
  }, []);

  if (!estado?.comparacoes || !estado.opcoes) return null;
  const opcoes = estado.opcoes;

  return (
    <div className="mt-8 max-w-3xl">
      <CartaoDeEscolhas
        titulo="Duas outras decisões, nas mesmas 20 tempestades"
        enunciado="Cada quadradinho é uma tempestade. Ele mostra qual das duas decisões resgatou mais naquela tempestade."
        enviada={estado.enviada}
        rotuloEnviado="Respostas enviadas ✓"
        filhos={
          /* Enviadas, as faixas ficam na tela: elas são o material do bloco
             "por que um modelo honesto entrega faixa", no debate. */
          estado.enviada ? (
            <div className="mt-3 flex flex-col gap-4">
              {estado.comparacoes.map((c) => (
                <div key={c.id}>
                  <p className="text-xs text-uai-suave-60">
                    {c.referencia.sua ? 'A sua' : 'A primeira'}: {decisao(c.referencia)} ·{' '}
                    {c.referencia.sua ? 'A outra' : 'A segunda'}: {decisao(c.outra)}
                  </p>
                  <Faixa c={c} />
                </div>
              ))}
            </div>
          ) : undefined
        }
        perguntas={estado.comparacoes.map((c) => ({
          id: c.id,
          pergunta: (
            <span>
              <span className="block text-xs font-normal text-uai-suave-60">
                {c.referencia.sua ? 'A sua' : 'A primeira'}: {decisao(c.referencia)} ·{' '}
                {c.referencia.sua ? 'A outra' : 'A segunda'}: {decisao(c.outra)}
              </span>
              <Faixa c={c} />
              <span className="mt-2 block">{c.pergunta}</span>
            </span>
          ),
          opcoes,
        }))}
        onEnviar={async (r) => setEstado(await api.post<RespostaESe>('/unoogpt/e-se', { respostas: r }))}
      />
    </div>
  );
}
