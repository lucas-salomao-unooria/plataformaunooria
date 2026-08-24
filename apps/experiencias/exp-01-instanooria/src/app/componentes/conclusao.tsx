import { useState } from 'react';

export type Inclinacao = 'A' | 'B' | 'duvida';

/**
 * A resposta à pergunta-chave (fluxo v2): **só a escolha de um lado**.
 *
 * O campo de texto livre saiu daqui. Duas razões:
 *
 * 1. Neste ponto da aula o que interessa é o dado comparável — o par
 *    "lado que o feed dele nasceu × lado que ele escolheu" é o resultado
 *    experimental da turma, e é o que o professor projeta no momento-espelho.
 * 2. O texto livre virou a REFLEXÃO do fim, e mudou de assunto: em vez de defender
 *    uma tese histórica, o aluno escreve sobre o que entendeu do próprio viés.
 *    Pedir texto duas vezes cansaria, e a segunda vez é a que importa.
 *
 * Depois de responder, a tela NÃO avança: quem move a turma é quem está
 * conduzindo a aula. O aluno vê que registrou e pode trocar de ideia enquanto
 * espera.
 *
 * Nada aqui antecipa a revelação — sem menção a lado semeado, algoritmo ou bolha
 * (regra de ouro 1).
 */
export function Conclusao({
  perguntaChave,
  ladoALabel,
  ladoBLabel,
  aoEnviar,
}: {
  perguntaChave: string;
  ladoALabel: string;
  ladoBLabel: string;
  aoEnviar: (inclinacao: Inclinacao) => Promise<boolean>;
}) {
  const [inclinacao, setInclinacao] = useState<Inclinacao | null>(null);
  const [registrada, setRegistrada] = useState<Inclinacao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes: { valor: Inclinacao; rotulo: string }[] = [
    { valor: 'A', rotulo: `mais para ${ladoALabel}` },
    { valor: 'duvida', rotulo: 'ainda em dúvida' },
    { valor: 'B', rotulo: `mais para ${ladoBLabel}` },
  ];

  const enviar = async (escolha: Inclinacao) => {
    setEnviando(true);
    setErro(null);
    const ok = await aoEnviar(escolha);
    if (ok) setRegistrada(escolha);
    else setErro('Não deu pra enviar agora. Toca de novo.');
    setEnviando(false);
  };

  return (
    /**
     * Cobre a tela inteira, sem o feed atrás: a investigação acabou, e deixar o
     * feed acessível aqui faria o aluno voltar a rolar em vez de decidir.
     */
    <div className="fixed inset-0 z-[85] flex flex-col overflow-y-auto overscroll-contain bg-surface px-5 py-8">
      <div className="mx-auto flex w-full max-w-[340px] flex-col gap-5">
        <header className="flex flex-col gap-3">
          <h1 className="text-[20px] font-semibold text-ink">E aí, o que você acha?</h1>
          <p className="rounded-xl bg-canvas px-4 py-3 text-[16px] font-semibold leading-snug text-ink">
            “{perguntaChave}”
          </p>
        </header>

        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Sua resposta</legend>
          {opcoes.map((opcao) => {
            const marcada = (registrada ?? inclinacao) === opcao.valor;
            return (
              <button
                key={opcao.valor}
                type="button"
                role="radio"
                aria-checked={marcada}
                disabled={enviando}
                onClick={() => {
                  setInclinacao(opcao.valor);
                  void enviar(opcao.valor);
                }}
                className={`flex h-12 items-center rounded-full border px-4 text-left text-[15px] transition-colors disabled:opacity-60 ${
                  marcada
                    ? 'border-action bg-action/10 font-semibold text-ink'
                    : 'border-hairline text-ink/80 active:opacity-70'
                }`}
              >
                {opcao.rotulo}
              </button>
            );
          })}
        </fieldset>

        {erro ? <p className="text-[13px] text-like-texto">{erro}</p> : null}

        {registrada ? (
          <div className="flex flex-col gap-2 rounded-xl bg-action/10 px-4 py-3">
            <p className="text-[14px] font-semibold text-ink">Resposta registrada.</p>
            <p className="text-[13px] leading-snug text-ink/70">
              Pode trocar de ideia enquanto espera — vale a última.
            </p>
          </div>
        ) : (
          <p className="text-[13px] leading-snug text-muted">
            Toca na opção que mais combina com o que você viu.
          </p>
        )}
      </div>
    </div>
  );
}
