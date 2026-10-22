import { Button, ChoicePoll, Modal } from '@edu/ui/ds-unooriaai';
import { useCallback, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { RespostaSaude } from '../../lib/tipos';

const milhar = (n: number) => n.toLocaleString('pt-BR');
const NOMES: Record<string, string> = {
  ribeirinha: 'Ribeirinha',
  valeverde: 'Vale Verde',
  morroalto: 'Morro Alto',
  industrial: 'Industrial',
};

/**
 * A LIGAÇÃO DA SECRETARIA DE SAÚDE (EM13CO26, ADR-172), dentro da sala de
 * operações. Aparece no primeiro destino escolhido ou ao abrir a decisão — o
 * servidor decide quando (`sessao.ofertaSaude`). O grupo escolhe o que pedir;
 * a tela devolve a CONSEQUÊNCIA (a contagem, e quem pediu lista vê que os nomes
 * ficaram no sistema), nunca um julgamento. "Agora não" fecha sem resposta: fica
 * registrado, e não há marca.
 *
 * `onFechar` vem estável do pai (o `Modal` do DS refaz o foco a cada identidade
 * nova de `onClose` — ver o AGENTS.md da pasta).
 */
export function LigacaoDaSaude({
  estado,
  onMudou,
  onFechar,
}: {
  estado: RespostaSaude;
  onMudou: (s: RespostaSaude) => void;
  onFechar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const respondida = useRef(estado.respondida);
  respondida.current = estado.respondida;

  /* ESTÁVEL: fechar pelo X sem responder é "agora não" — registrado, sem marca. */
  const fechar = useCallback(() => {
    if (!respondida.current) {
      void api
        .post<RespostaSaude>('/unoogpt/saude', { opcao: null })
        .then(onMudou)
        .catch(() => undefined);
    }
    onFechar();
  }, [onFechar, onMudou]);

  async function responder(opcao: string) {
    setEnviando(true);
    setFalhou(false);
    try {
      onMudou(await api.post<RespostaSaude>('/unoogpt/saude', { opcao }));
    } catch {
      setFalhou(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal onClose={fechar} aria-label="Ligação da Secretaria de Saúde" className="w-full max-w-lg">
      <Modal.Header onClose={fechar}>Secretaria de Saúde na linha</Modal.Header>
      <Modal.Body>
        {!estado.respondida ? (
          <ChoicePoll
            question={estado.texto}
            options={estado.opcoes.map((o) => ({ id: o.id, label: o.texto }))}
            value={null}
            disabled={enviando}
            onVote={(id) => void responder(id)}
          />
        ) : estado.entrega?.contagem ? (
          <div className="text-sm leading-relaxed text-uai-tinta">
            <p>A Saúde mandou a contagem por bairro:</p>
            <table className="mt-3 w-full border-collapse text-left">
              <tbody>
                {estado.entrega.contagem.map((c) => (
                  <tr key={c.bairro} className="border-b border-uai-borda">
                    <td className="py-2">{NOMES[c.bairro] ?? c.bairro}</td>
                    <td className="py-2 text-right tabular-nums">{milhar(c.pessoas)} pessoas</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {estado.entrega.aviso && <p className="mt-3 text-uai-suave-60">{estado.entrega.aviso}</p>}
          </div>
        ) : (
          <p className="text-sm text-uai-tinta">A Saúde não mandou nada.</p>
        )}
        {falhou && <p className="mt-3 text-sm text-uai-erro">A ligação caiu. Tente de novo.</p>}
      </Modal.Body>
      <Modal.Footer>
        {estado.respondida ? (
          <Button variant="secondary" onClick={fechar}>
            Voltar para a operação
          </Button>
        ) : (
          <Button variant="outline" onClick={fechar} disabled={enviando}>
            Agora não
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
