import { useEffect, useState } from 'react';

import { api } from '../../lib/api';

/**
 * A REFLEXÃO que fecha a atividade (fluxo v2). É pós-revelação: aqui o
 * vocabulário do mecanismo é permitido — o aluno acabou de aprender as palavras.
 *
 * O enunciado é a peça pedagógica desta tela, e foi escrito com três cuidados:
 *
 * 1. **Uma pergunta, não uma lista.** Cinco perguntas fazem o aluno responder a
 *    primeira e parar. A pergunta central é aberta e curta.
 * 2. **Andaimes opcionais, em três níveis.** Se ele travar, os três marcadores vão
 *    do concreto ("o que te fez salvar o que salvou") ao mecanismo ("por que o
 *    feed do colega era diferente") e daí à transferência ("onde mais isso
 *    acontece"). É a progressão de uma boa pergunta de reflexão — e ele escolhe
 *    onde entra.
 * 3. **Ancorada no que ele acabou de viver**, não em teoria. Ele viu os posts que
 *    perdeu segundos atrás; a pergunta parte dali.
 *
 * Sem limite de caracteres. O mínimo é curto e existe só para "gostei" não passar
 * — e ele VEM DA API (`GET /runs/:id/reflexao`), que é quem vai recusar o texto.
 * Havia um 60 aqui e outro no schema da rota, sem nada que os obrigasse a
 * concordar: no dia em que divergissem, quem descobriria seria o aluno, com o
 * botão liberado e a api dizendo que estava curto.
 *
 * O fallback existe só para a tela abrir antes da resposta chegar.
 */
const MINIMO_ATE_A_API_RESPONDER = 60;

export function Reflexao({ runId }: { runId: string }) {
  const [texto, setTexto] = useState('');
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [minimo, setMinimo] = useState(MINIMO_ATE_A_API_RESPONDER);

  /** Recupera o que ele já escreveu: reabrir a tela não pode perder texto. */
  useEffect(() => {
    let ativo = true;
    api
      .get<{ texto: string; minimo?: number }>(`/runs/${runId}/reflexao`)
      .then((corpo) => {
        if (!ativo) return;
        setTexto(corpo.texto ?? '');
        setSalvo(Boolean(corpo.texto));
        if (corpo.minimo) setMinimo(corpo.minimo);
      })
      .catch(() => undefined)
      .finally(() => ativo && setCarregado(true));
    return () => {
      ativo = false;
    };
  }, [runId]);

  const faltam = Math.max(0, minimo - texto.trim().length);
  const podeSalvar = faltam === 0 && !salvando;

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await api.post(`/runs/${runId}/reflexao`, { texto: texto.trim() });
      setSalvo(true);
    } catch {
      setErro('Não deu pra salvar agora. Tenta de novo — seu texto está aqui.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex flex-col overflow-y-auto overscroll-contain bg-night px-5 py-8 text-white">
      <div className="mx-auto flex w-full max-w-[340px] flex-col gap-5">
        <header className="flex flex-col gap-3">
          <p className="text-[12px] uppercase tracking-widest text-white/60">última coisa</p>
          <h1 className="text-[21px] font-bold leading-tight">
            Você viu o que seu feed te mostrou — e o que ele deixou de fora.
          </h1>
          <p className="text-[17px] font-semibold leading-snug text-brand-coral">
            O que isso te faz pensar?
          </p>
        </header>

        {/*
          Andaimes: aparecem como sugestão, não como perguntas a responder. Quem
          já sabe o que dizer ignora; quem travou tem por onde começar.
        */}
        <details className="rounded-xl bg-white/5 px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-white/80">
            travou? pensa em uma destas
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-[13px] leading-relaxed text-white/70">
            <li>O que te fez salvar justamente os posts que você salvou?</li>
            <li>Por que o feed de quem senta do seu lado era diferente do seu?</li>
            <li>Onde mais na sua vida isso acontece — e o que você faz com isso?</li>
          </ul>
        </details>

        <label className="flex flex-col gap-1.5">
          <textarea
            className="min-h-[220px] w-full rounded-xl border border-white/20 bg-white/5 p-3 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/40 focus:border-brand-coral"
            placeholder="Escreve com suas palavras — umas duas linhas já bastam."
            value={texto}
            disabled={!carregado}
            onChange={(evento) => {
              setTexto(evento.target.value);
              setSalvo(false);
            }}
          />
          <span className="flex justify-between text-[12px] text-white/50">
            <span>
              {faltam > 0
                ? `escreve mais um pouco — faltam ${faltam} caracteres`
                : `${texto.trim().length} caracteres · escreve o quanto quiser`}
            </span>
            {salvo ? <span className="text-brand-coral">salvo</span> : null}
          </span>
        </label>

        {erro ? <p className="text-[13px] text-brand-coral">{erro}</p> : null}

        <button
          type="button"
          className="h-12 w-full rounded-xl bg-white text-[15px] font-semibold text-night disabled:opacity-40"
          disabled={!podeSalvar}
          onClick={() => void salvar()}
        >
          {salvando ? 'salvando…' : salvo ? 'Salvar de novo' : 'Salvar'}
        </button>

        {salvo ? (
          <p className="text-[13px] leading-relaxed text-white/60">
            Guardado. Pode continuar escrevendo se lembrar de mais alguma coisa.
          </p>
        ) : null}
      </div>
    </div>
  );
}
