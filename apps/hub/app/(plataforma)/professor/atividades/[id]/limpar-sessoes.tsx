'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  AlertBox,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@edu/ui/ds';

/**
 * "Limpar dados dos alunos" — o botão de rodar a mesma atividade do zero.
 *
 * Mora aqui, dentro da atividade, e não no card da missão: excluir é a decisão
 * de fora ("não vou mais usar isto"), limpar é a decisão de dentro ("vou usar de
 * novo, com outra turma"). Juntas no mesmo lugar, a chance de clicar na errada
 * cresce — e uma delas não tem volta.
 *
 * Diferente do "Zerar" do monitor, que age numa sessão só: aqui somem todas.
 */
export function LimparSessoes({
  activityId,
  sessoes,
}: {
  activityId: string;
  sessoes: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vazia = sessoes === 0;

  function fechar() {
    if (limpando) return;
    setAberto(false);
    setErro(null);
  }

  async function limpar() {
    if (limpando) return;
    setErro(null);
    setLimpando(true);
    try {
      const resposta = await fetch(`/api/plataforma/atividades/${activityId}/limpar`, { method: 'POST' });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
        setErro(corpo?.mensagem ?? 'Não foi possível limpar os dados.');
        setLimpando(false);
        return;
      }
      setAberto(false);
      setLimpando(false);
      router.refresh();
    } catch {
      setErro('Sem conexão agora. Tente de novo.');
      setLimpando(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setAberto(true)}
        disabled={vazia}
        title={
          vazia
            ? 'Nenhum aluno usou esta atividade ainda — não há o que limpar.'
            : undefined
        }
      >
        Apagar as sessões da turma
      </Button>

      <Modal isOpen={aberto} onClose={fechar} size="sm" role="alertdialog">
        <ModalHeader>
          <ModalTitle>Apagar as sessões desta turma?</ModalTitle>
        </ModalHeader>

        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
              As <strong>{sessoes}</strong>{' '}
              {sessoes === 1 ? 'sessão vai sumir' : 'sessões vão sumir'} com tudo que a turma
              produziu: leitura, conclusões escritas e relatórios. Isso não tem volta, e a análise
              da turma some junto.
            </p>
            <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
              A atividade continua de pé — pergunta-chave, os dois lados, posts, imagens e os
              perfis importados ficam como estão. Na próxima entrada, cada aluno começa uma sessão
              nova.
            </p>
            {/*
              A pergunta que o rótulo antigo ("Limpar dados dos alunos") deixava
              em aberto: serve para reusar, ou apaga o histórico? As duas coisas
              — e é por isso que ela precisa estar escrita antes do clique.
            */}
            <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
              É o que você usa para <strong>rodar a mesma atividade com outra turma</strong>. Se
              quiser guardar o que esta turma fez, baixe o CSV da análise antes.
            </p>

            {erro ? (
              <AlertBox theme="light" variant="error" device="auto" description={erro} />
            ) : null}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={fechar} disabled={limpando}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={limpar} isLoading={limpando}>
            Limpar dados
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
