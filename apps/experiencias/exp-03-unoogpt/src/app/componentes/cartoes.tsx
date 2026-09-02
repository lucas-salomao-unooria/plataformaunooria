import { FeatureCard } from '@edu/ui/ds-chatgpt';
import { CONJUNTO_POR_SLUG, nomeDoBairro } from '../../lib/textos';
import type { Desfecho } from '../../lib/tipos';
import type { RodadaDoModelo } from '../../lib/tipos';
import { oQueMudou } from '../../lib/cartoes';

const milhar = (n: number) => n.toLocaleString('pt-BR');

/**
 * A confiança em português de gente, com o termo técnico do lado.
 *
 * "Confiança: baixa" não foi entendido nem perguntado — que é a pior
 * combinação: o estudante segue em frente achando que entendeu um número que ele
 * deveria estar duvidando.
 */
const EM_MIUDOS: Record<string, string> = {
  alta: 'número firme',
  média: 'mais ou menos',
  media: 'mais ou menos',
  baixa: 'chute grosso',
};


/**
 * Os cartões que acompanham a fala do Cientista (ADR-0007).
 *
 * Da Investigação em diante a Missão inteira acontece na conversa: o que antes
 * era tela com botão é anexo de mensagem, gravado na Transcrição. Uma
 * superfície só — o estudante não precisa aprender a navegar antes de aprender
 * sobre dados.
 */
const rotulos = (fontes: string[]) =>
  fontes.map((f) => CONJUNTO_POR_SLUG.get(f)?.rotuloCurto ?? f).join(' + ');

export function CartaoTendencia({
  rodada,
  hora,
  /** A leitura anterior: o que não mudou desde ela vira uma linha, não um bloco. */
  anterior,
  /** Só o cartão da última fala fica aberto. Os de trás viram uma linha. */
  expandido = true,
}: {
  rodada: RodadaDoModelo;
  hora?: string;
  anterior?: RodadaDoModelo | null;
  expandido?: boolean;
}) {
  const mudou = oQueMudou(anterior, rodada);
  // A procedência que quase toda linha tem: vai uma vez no cabeçalho.
  const contagem = new Map<string, number>();
  for (const e of rodada.estimativas) {
    const chave = rotulos(e.sustentadaPor);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  const procedenciaComum = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  return (
    <div className="animate-entrar-cartao mt-3 rounded-gpt-xl border border-gpt-borda bg-gpt-fundo p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-gpt-suave-40">
          O que os dados mostram
          {/* A hora deixa claro que cada leitura é de um momento — e que o
              momento seguinte custou tempo. */}
          {hora && <span className="ml-2 font-normal normal-case">· com {hora} no relógio</span>}
        </p>
        {/* "78% da cidade sob algum dado" é jargão de quem fez o modelo. O que
            o estudante precisa saber é quanto ele está enxergando. */}
        <p className="text-xs text-gpt-suave-60">
          você enxerga {Math.round(rodada.coberturaDaCidade * 100)}% da cidade
          {procedenciaComum && <span className="block text-right">com {procedenciaComum}</span>}
        </p>
      </div>

      <table className="mt-3 w-full text-left text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gpt-suave-60">
            <th className="pb-1 font-bold">Bairro</th>
            <th className="pb-1 font-bold">Pessoas em risco</th>
            <th className="pb-1 font-bold">Confiança</th>
          </tr>
        </thead>
        <tbody>
          {rodada.estimativas.map((e) => (
            <tr key={e.bairro} className="border-t border-gpt-borda align-top">
              <td className="py-2 pr-3 font-semibold text-gpt-tinta">
                {nomeDoBairro(e.bairro)}
                {/* Procedência só quando ESTA linha vê diferente das outras.
                    Repetir "cadastro + satélite" em seis linhas é ruído: o que
                    informa é a exceção — o bairro que só uma fonte enxerga. */}
                {rotulos(e.sustentadaPor) !== procedenciaComum && (
                  <span className="block text-[10px] font-normal leading-tight text-gpt-suave-60">
                    só {rotulos(e.sustentadaPor)}
                  </span>
                )}
              </td>
              {/* O intervalo dito por extenso já É a margem: "pode ser 2.166 ou
                  3.688". O "±761" ao lado era a MESMA ideia em jargão, e o
                  estudante lia a linha duas vezes para descobrir isso. */}
              <td className="py-2 pr-3 text-gpt-tinta">
                {milhar(e.pessoasEmRisco.esperado)}
                <span className="block text-[10px] leading-tight text-gpt-suave-60">
                  pode ser {milhar(e.pessoasEmRisco.min)} ou {milhar(e.pessoasEmRisco.max)}
                </span>
              </td>
              {/* "mais ou menos" com "confiança média" embaixo é a tradução ao
                  lado do original — e o original é justamente a palavra que o
                  ADR-0009 tirou por não ter sido entendida nem perguntada. */}
              <td className="py-2 text-gpt-suave-60">{EM_MIUDOS[e.confianca] ?? e.confianca}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* A margem vira consequência: dentro dela, a ordem da tabela não separa
          esses bairros — e ordenar não é decidir. */}
      {/* Empate geral não informa nada: se TODOS se cruzam, o recado é que a
          leitura atual não separa a cidade — e isso se diz em uma frase. */}
      {/* O empate é a informação que quebra a decisão e era a quinta linha de
          um bloco de texto: o estudante leu, mandou as duas equipes para os dois
          bairros empatados e seguiu. Agora tem caixa, cor e peso próprios. */}
      {rodada.empates.length > 0 && !mudou.empates && (
        <p className="mt-3 text-xs leading-relaxed text-gpt-alerta">
          O empate entre{' '}
          {rodada.empates.map((g) => g.map(nomeDoBairro).join(' e ')).join(' e entre ')} continua.
        </p>
      )}
      {rodada.empates.length > 0 && mudou.empates && (
        <div className="mt-3 rounded-gpt-md border-l-4 border-gpt-alerta bg-gpt-superficie p-3">
          {rodada.empates[0]!.length === rodada.estimativas.length ? (
            <p className="text-xs leading-relaxed text-gpt-tinta">
              <strong>Nenhum bairro se destaca.</strong> Os números de todos eles se misturam. A
              ordem da tabela não é um ranking — escolher o de cima não é escolher o maior.
            </p>
          ) : (
            rodada.empates.map((grupo) => (
              <p key={grupo.join()} className="text-xs leading-relaxed text-gpt-tinta">
                <strong>{grupo.map(nomeDoBairro).join(' e ')} estão empatados.</strong> Qualquer um
                deles pode ser o maior: o que está por cima na tabela não é o maior de verdade, é só
                o que a leitura de hoje colocou por cima.
              </p>
            ))
          )}
        </div>
      )}

      {/* O conflito é a aula: duas fontes honestas, o mesmo bairro, números que
          não batem. Fica DEPOIS da tabela porque explica o que ela mostra. */}
      {rodada.conflitos.length > 0 && !mudou.conflitos && (
        <p className="mt-3 text-xs leading-relaxed text-gpt-alerta">
          {rodada.conflitos.map((c) => nomeDoBairro(c.bairro)).join(' e ')}: as fontes continuam sem
          concordar.
        </p>
      )}
      {rodada.conflitos.length > 0 && mudou.conflitos && (
        <div className="mt-3 rounded-gpt-md bg-gpt-superficie p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gpt-alerta">
            As fontes não concordam
          </p>
          {rodada.conflitos.map((c) => (
            <p key={c.bairro} className="mt-1.5 text-xs leading-relaxed text-gpt-tinta">
              <strong>{nomeDoBairro(c.bairro)}</strong>: {c.encolhe.comoFalar} vê{' '}
              <strong>{milhar(c.encolhe.pessoas)}</strong> pessoas, {c.infla.comoFalar} vê{' '}
              <strong>{milhar(c.infla.pessoas)}</strong>.
            </p>
          ))}
          <p className="mt-1.5 text-xs text-gpt-suave-60">
            Nenhuma das duas está mentindo — elas medem coisas diferentes. Por isso a barra desses
            bairros fica mais larga.
          </p>
        </div>
      )}

      {rodada.pontosCegos.length > 0 && (
        <p className="mt-3 text-xs text-gpt-alerta">
          Sem dado nenhum sobre: {rodada.pontosCegos.map(nomeDoBairro).join(', ')}
        </p>
      )}
      {/* Causalidade por subtração: o que ESTA fonte fez com a leitura. Só no
          cartão aberto: no fechado ele é a terceira linha de uma coisa que o
          estudante já leu. */}
      {expandido && rodada.efeito && rodada.efeito.mudou.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-gpt-tinta">
          <strong>
            Depois de somar {CONJUNTO_POR_SLUG.get(rodada.efeito.fonte)?.rotuloCurto}:
          </strong>{' '}
          {rodada.efeito.mudou
            .map(
              (m) =>
                `${nomeDoBairro(m.bairro)} ${milhar(m.de)} → ${milhar(m.para)} (${
                  m.para > m.de ? '+' : '−'
                }${milhar(Math.abs(m.para - m.de))})`,
            )
            .join(' · ')}
        </p>
      )}

      {expandido && <p className="mt-2 text-xs italic text-gpt-suave-60">{rodada.aviso}</p>}
    </div>
  );
}

/**
 * As duas alternativas, como dois botões.
 *
 * Simétricos de propósito: mesma cor, mesmo peso, ordem que a LLM propôs, sem
 * "recomendada". A proposta já existia em prosa — o prompt obriga o Cientista a
 * pôr duas opções na mesa e perguntar qual o estudante quer. O que muda é ele não
 * precisar digitar a resposta com o cronômetro correndo.
 *
 * O número de pessoas sai da RODADA, que é o motor. A LLM não põe número aqui.
 */
export function CartaoOpcoes({
  opcoes,
  rodada,
  onEscolher,
  ocupado = false,
}: {
  opcoes: { alfa: string; bravo: string }[];
  rodada: RodadaDoModelo;
  /** Ausente no cartão de uma fala antiga: a alocação já mudou desde então. */
  onEscolher?: (opcao: { alfa: string; bravo: string }) => void;
  /**
   * Trava enquanto uma chamada está em voo. Escolher uma opção dispara DOIS
   * `POST /unoogpt/alocacao` (a rota é por equipe), e sem esta trava um duplo
   * clique manda quatro — o segundo par com o estado que o primeiro ainda não
   * gravou. Os outros controles da missão já se travam por aqui; este ficou de
   * fora, e um cartão que não responde ao primeiro clique convida ao segundo.
   */
  ocupado?: boolean;
}) {
  const pessoas = (slug: string) =>
    rodada.estimativas.find((e) => e.bairro === slug)?.pessoasEmRisco.esperado ?? null;

  return (
    <div className="animate-entrar-cartao mt-3 grid gap-2">
      {opcoes.map((o, i) => {
        const soma = [o.alfa, o.bravo].map(pessoas);
        const total = soma.every((x) => x !== null)
          ? (soma as number[]).reduce((a, b) => a + b, 0)
          : null;
        return (
          // `FeatureCard` é o cartão de capacidade do arquivo de design, e é
          // exatamente esta a leitura: duas alternativas na mesa, simétricas,
          // sem "recomendada". `as="button"` porque clicar nela decide.
          <FeatureCard
            key={`${o.alfa}-${o.bravo}`}
            as="button"
            type="button"
            block
            onClick={() => onEscolher?.(o)}
            disabled={!onEscolher || ocupado}
            className="text-left disabled:opacity-50"
            title={
              <span className="text-xs font-bold uppercase tracking-wider text-gpt-suave-40">
                Opção {i + 1}
              </span>
            }
            description={
              <>
                <span className="block text-sm text-gpt-tinta">
                  <strong className="text-gpt-azul">Alfa</strong> · {nomeDoBairro(o.alfa)} ·{' '}
                  <strong className="text-gpt-roxo">Bravo</strong> · {nomeDoBairro(o.bravo)}
                </span>
                {total !== null && (
                  <span className="mt-0.5 block text-xs text-gpt-suave-60">
                    {milhar(total)} pessoas em risco nos dois, pela leitura de agora
                  </span>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}

export function CartaoAlocacao({ alfa, bravo }: { alfa: string | null; bravo: string | null }) {
  return (
    <div className="animate-entrar-cartao mt-3 rounded-gpt-xl border-2 border-gpt-borda-forte bg-gpt-fundo p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-gpt-suave-40">
        Decisão registrada
      </p>
      <p className="mt-1 text-sm text-gpt-tinta">
        <strong className="text-gpt-azul">Equipe Alfa</strong> ·{' '}
        {alfa ? nomeDoBairro(alfa) : <span className="text-gpt-suave-60">sem destino</span>}
      </p>
      <p className="text-sm text-gpt-tinta">
        <strong className="text-gpt-roxo">Equipe Bravo</strong> ·{' '}
        {bravo ? nomeDoBairro(bravo) : <span className="text-gpt-suave-60">sem destino</span>}
      </p>
    </div>
  );
}

export function CartaoDesfecho({
  desfecho,
}: {
  desfecho: Desfecho;
  esperado?: unknown;
  naoConsultados?: unknown;
}) {
  const { totais } = desfecho;
  return (
    <div className="animate-entrar-cartao mt-3 rounded-gpt-xl border border-gpt-borda bg-gpt-fundo p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-gpt-suave-40">
        A tempestade passou
      </p>
      <p className="mt-2 text-gpt-tinta">
        <strong className="text-gpt-ok">{milhar(totais.salvas)}</strong> pessoas tiradas de risco ·{' '}
        <strong className="text-gpt-erro">{milhar(totais.vitimas)}</strong> afetadas.
      </p>
      <p className="mt-2 text-xs text-gpt-suave-60">O resultado completo está na tela ao lado.</p>
    </div>
  );
}
