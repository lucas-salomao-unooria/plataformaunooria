'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  AlertBox,
  Badge,
  Button,
  Card,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  TextField,
} from '@edu/ui/ds';
import type { VarianteDeStatus } from '@/lib/status-atividade';

export type ResumoDaAtividade = {
  id: string;
  titulo: string;
  disciplina: string;
  recorte: string;
  perguntaChave: string;
  status: { rotulo: string; variante: VarianteDeStatus };
  posts: number;
  sessoes: number;
  /** Estudantes com perfil importado do Ato 1 — a "turma" desta atividade. */
  estudantes?: number;
  alunos?: number;
  /** Quando foi criada, para separar três atividades do mesmo tema. */
  criadoEm: string;
};

function IconeLixeira() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11" />
      <path d="M6.5 4V2.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75V4" />
      <path d="M12.25 4v8.75a1.25 1.25 0 0 1-1.25 1.25H5a1.25 1.25 0 0 1-1.25-1.25V4" />
      <path d="M6.75 7v4M9.25 7v4" />
    </svg>
  );
}

/**
 * Card de uma atividade dentro da missão, com a exclusão embutida.
 *
 * O card inteiro é clicável por link esticado (`.link-esticado`) em vez de um
 * `<Link>` envolvendo tudo: botão dentro de link é HTML inválido e, na prática,
 * clicar em "excluir" navegaria junto. O botão sobe uma camada
 * (`.acima-do-link`) e o resto da superfície continua levando à atividade.
 *
 * A confirmação pede o **título digitado**. É atrito de propósito: a exclusão
 * leva junto posts, imagens no disco e as sessões já rodadas da turma, e não tem
 * volta.
 */
/** "12/03/2026" — a data curta basta para distinguir duas do mesmo tema. */
function formatarData(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? '—'
    : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function CartaoAtividade({ atividade }: { atividade: ResumoDaAtividade }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confere =
    confirmacao.trim().toLocaleLowerCase('pt-BR') ===
    atividade.titulo.trim().toLocaleLowerCase('pt-BR');

  function fechar() {
    if (excluindo) return;
    setAberto(false);
    setConfirmacao('');
    setErro(null);
  }

  async function excluir() {
    if (!confere || excluindo) return;
    setErro(null);
    setExcluindo(true);
    try {
      const resposta = await fetch(`/api/plataforma/atividades/${atividade.id}`, { method: 'DELETE' });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
        setErro(corpo?.mensagem ?? 'Não foi possível excluir a atividade.');
        setExcluindo(false);
        return;
      }
      setAberto(false);
      // `refresh` e não `push`: a lista da missão é Server Component, então quem
      // relista é o servidor — e o professor continua exatamente onde estava.
      router.refresh();
    } catch {
      setErro('Sem conexão agora. Tente de novo.');
      setExcluindo(false);
    }
  }

  return (
    <>
      <Card variant="interactive" interactive className="h-full cartao-atividade">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-unooria-neutral-950">
              <Link href={`/professor/atividades/${atividade.id}`} className="link-esticado">
                {atividade.titulo}
              </Link>
            </h3>
            <div className="acima-do-link flex shrink-0 items-center gap-1.5">
              <Badge variant={atividade.status.variante}>{atividade.status.rotulo}</Badge>
              <button
                type="button"
                onClick={() => setAberto(true)}
                aria-label={`Excluir a atividade ${atividade.titulo}`}
                title="Excluir atividade"
                className="acao-excluir"
              >
                <IconeLixeira />
              </button>
            </div>
          </div>

          <p className="text-[13px] text-unooria-neutral-500">
            {atividade.disciplina} · {atividade.recorte}
          </p>
          {atividade.perguntaChave ? (
            <p className="text-[14px] italic text-unooria-neutral-700">
              “{atividade.perguntaChave}”
            </p>
          ) : (
            <p className="text-[14px] italic text-unooria-neutral-500">
              Pergunta-chave ainda não definida.
            </p>
          )}
          {/*
            Três atividades do mesmo tema, com títulos quase iguais, e nada que
            diga QUAL é qual. `Activity` não tem turma no schema — uma atividade
            é de uma turma por vez, mas por convenção de uso, não por coluna —,
            então o que dá para afirmar sem inventar é o tamanho e a data. Já
            chegavam da api e eram descartados aqui.
          */}
          <p className="text-[12px] text-unooria-neutral-500">
            {atividade.posts} posts · {atividade.sessoes} sessões
            {(atividade.estudantes ?? atividade.alunos ?? 0) > 0 ? ` · ${atividade.estudantes ?? atividade.alunos} com perfil do jogo` : null}
          </p>
          <p className="text-[12px] text-unooria-neutral-500">
            criada em {formatarData(atividade.criadoEm)}
          </p>
        </div>
      </Card>

      <Modal isOpen={aberto} onClose={fechar} size="sm" role="alertdialog">
        <ModalHeader>
          <ModalTitle>Excluir “{atividade.titulo}”?</ModalTitle>
        </ModalHeader>

        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
              Isso apaga a atividade inteira e não tem volta:
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-unooria-neutral-700">
              <li>{atividade.posts} posts gerados, as personas e as imagens no servidor;</li>
              <li>
                {atividade.sessoes} sessões de estudante, com tudo que a turma produziu — leitura,
                conclusões escritas e relatórios;
              </li>
              <li>os perfis do Ato 1 importados para esta atividade.</li>
            </ul>

            {atividade.sessoes > 0 ? (
              <AlertBox
                theme="light"
                variant="warning"
                device="auto"
                description="Esta atividade já rodou com turma. Se você só quer usá-la de novo do zero, abra a atividade e use “Limpar dados dos estudantes” — o conteúdo gerado fica de pé."
              />
            ) : null}

            <TextField
              id={`confirmar-exclusao-${atividade.id}`}
              label="Digite o título para confirmar"
              placeholder={atividade.titulo}
              value={confirmacao}
              onChange={(evento) => setConfirmacao(evento.target.value)}
              autoComplete="off"
            />

            {erro ? (
              <AlertBox theme="light" variant="error" device="auto" description={erro} />
            ) : null}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={fechar} disabled={excluindo}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={excluir} disabled={!confere} isLoading={excluindo}>
            Excluir atividade
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
