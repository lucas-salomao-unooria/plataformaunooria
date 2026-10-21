import { Button } from '@edu/ui/ds-unooriaai';
import { api } from '../../lib/api';
import type { RespostaRegistro } from '../../lib/tipos';
import { CartaoDeEscolhas } from './escolhas';

const milhar = (n: number) => n.toLocaleString('pt-BR');

/**
 * O REGISTRO DA OPERAÇÃO (ADR-172): o passo entre "Enviar equipes" e o
 * resultado, SEM relógio. As equipes já saíram — a hora de saída é a do
 * clique —, e o desfecho fica retido no servidor até os três cartões:
 *
 *   1. a leitura dos dados: a última tabela que o grupo pediu volta, sem a
 *      frase de empate, e duas perguntas, uma por par de bairros (EM13CO12);
 *   2. o que precisaria saber de cada fonte: dois cartões, as mesmas cinco
 *      perguntas para toda fonte (EM13CO14);
 *   3. o alerta para os bairros sem equipe, montado por partes (EM13CO24).
 *
 * O cartão que não se aplica não aparece (a api o manda `null`). A tela nunca
 * diz se acertou.
 */
export function Registro({
  registro,
  onMudou,
  onVerResultado,
}: {
  registro: RespostaRegistro;
  onMudou: (r: RespostaRegistro) => void;
  onVerResultado: () => void;
}) {
  const enviar = (rota: string, corpo: unknown) => async () => {
    onMudou(await api.post<RespostaRegistro>(rota, corpo));
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col gap-5 overflow-y-auto p-6" aria-label="Registro da operação">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-uai-suave-40">As equipes saíram</p>
        <p className="mt-1 text-lg font-semibold text-uai-tinta">Registre a operação.</p>
        <p className="mt-1 text-sm text-uai-suave-60">
          Enquanto as equipes cruzam a cidade, o grupo registra o que leu, o que perguntaria às fontes e o alerta
          para quem ficou sem equipe. Aqui não tem relógio. O resultado vem em seguida.
        </p>
      </div>

      {registro.leitura && (
        <CartaoDeEscolhas
          titulo="A leitura dos dados"
          enunciado="A última tabela que vocês pediram ao Cientista:"
          enviada={registro.leitura.enviada}
          perguntas={registro.leitura.pares.map((p) => ({ id: p.id, pergunta: p.pergunta, opcoes: p.opcoes }))}
          onEnviar={(r) => enviar('/unoogpt/registro/leitura', { respostas: r })()}
          filhos={
            <table className="mt-3 w-full max-w-md border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-uai-borda text-xs uppercase tracking-wider text-uai-suave-60">
                  <th className="pb-2">Bairro</th>
                  <th className="pb-2 text-right">Pessoas em risco</th>
                </tr>
              </thead>
              <tbody>
                {registro.leitura.tabela.map((l) => (
                  <tr key={l.bairro} className="border-b border-uai-borda">
                    <td className="py-2 font-semibold text-uai-tinta">{l.nome}</td>
                    <td className="py-2 text-right tabular-nums text-uai-tinta">
                      {milhar(l.esperado)}
                      <span className="block text-xs text-uai-suave-60">
                        pode ser entre {milhar(l.min)} e {milhar(l.max)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
      )}

      {registro.fontes && (
        <CartaoDeEscolhas
          titulo="O que vocês precisariam saber"
          enviada={registro.fontes.enviada}
          perguntas={registro.fontes.cartoes.map((c) => ({
            id: c.id,
            pergunta: c.texto,
            opcoes: registro.fontes!.perguntas,
          }))}
          onEnviar={(r) => enviar('/unoogpt/registro/fontes', { respostas: r })()}
        />
      )}

      {registro.alerta && (
        <CartaoDeEscolhas
          titulo="O alerta"
          enunciado={registro.alerta.enunciado}
          enviada={registro.alerta.enviada}
          perguntas={registro.alerta.partes.map((p) => ({ id: p.id, pergunta: p.titulo, opcoes: p.opcoes }))}
          onEnviar={(r) => enviar('/unoogpt/registro/alerta', r)()}
        />
      )}

      {registro.concluido && (
        <div className="rounded-uai-xl bg-uai-superficie p-4">
          <p className="text-sm text-uai-tinta">Operação registrada.</p>
          <Button variant="secondary" className="mt-3" onClick={onVerResultado}>
            Ver o que aconteceu
          </Button>
        </div>
      )}
    </section>
  );
}
