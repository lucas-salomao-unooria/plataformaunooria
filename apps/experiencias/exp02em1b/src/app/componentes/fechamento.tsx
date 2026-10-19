import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { RespostaFechamento } from '../../lib/tipos';
import { MensagemDoVoluntario } from '../pecas/mensagem-do-voluntario';
import { CartaoDeEscolhas } from './escolhas';

/**
 * O FECHAMENTO (ADR-172), que o professor abre depois do debate: o pedido pelo
 * WhatsApp (EM13CO08) e a resposta à moradora do bairro que ficou sem equipe
 * (EM13CO26). Aparecem juntos para a turma, no Resultado, e com eles o
 * "Tentar de novo" some. A tela nunca diz se acertou.
 *
 * O balão do pedido é a ÚNICA peça de outra seção na missão: o `MessageBubble`
 * do `unoochat` (clone dentro de clone, ADR-173). As perguntas em volta são do
 * UnooriaAI.
 */
export function Fechamento() {
  const [estado, setEstado] = useState<RespostaFechamento | null>(null);

  useEffect(() => {
    let viva = true;
    api
      .get<RespostaFechamento>('/unoogpt/fechamento')
      .then((r) => viva && setEstado(r))
      .catch(() => undefined);
    return () => {
      viva = false;
    };
  }, []);

  if (!estado) return null;
  const { whatsapp, moradora } = estado;

  return (
    <div className="mt-8 flex max-w-3xl flex-col gap-5" role="group" aria-label="Fechamento da operação">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-uai-suave-40">Antes de fechar a sala</p>
        <p className="mt-1 text-sm text-uai-suave-60">Duas mensagens chegaram à sala de operações. Decidam juntos.</p>
      </div>

      <CartaoDeEscolhas
        titulo="Uma mensagem de número desconhecido"
        enviada={whatsapp.enviada}
        filhos={
          <div className="mt-3">
            <MensagemDoVoluntario texto={whatsapp.mensagem} />
          </div>
        }
        perguntas={[
          { id: 'resposta', pergunta: whatsapp.perguntaDaResposta, opcoes: whatsapp.respostas },
          { id: 'aviso', pergunta: whatsapp.perguntaDoAviso, opcoes: whatsapp.avisos },
        ]}
        onEnviar={async (r) => setEstado(await api.post<RespostaFechamento>('/unoogpt/fechamento/whatsapp', r))}
      />

      <CartaoDeEscolhas
        titulo="A Ouvidoria repassa"
        enunciado={moradora.enunciado}
        enviada={moradora.enviada}
        rotuloEnviado="Resposta enviada ✓"
        perguntas={moradora.partes.map((p) => ({ id: p.id, pergunta: p.titulo, opcoes: p.opcoes }))}
        onEnviar={async (r) => setEstado(await api.post<RespostaFechamento>('/unoogpt/fechamento/moradora', r))}
      />
    </div>
  );
}
