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
import { data as formatarData } from '@edu/sdk';
import { UsarEstaAtividade } from '@/components/atividades/usar-esta-atividade';
import {
  ROTULO_DO_ESTADO,
  textoDasRodadas,
  type AtividadeNaLista,
  type MissaoComAtividade,
} from '@/lib/entre-redes/atividades';

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
 * Card de UMA ATIVIDADE na ficha da missão (ADR-130) — o mesmo para as quatro
 * missões com atividade, no molde do card do Instanooria, que foi o que o dono
 * do produto pediu para todas.
 *
 * O card inteiro é clicável por link esticado (`.link-esticado`) em vez de um
 * `<Link>` envolvendo tudo: botão dentro de link é HTML inválido e, na prática,
 * clicar em "Usar agora" ou em "excluir" navegaria junto. Os botões sobem uma
 * camada (`.acima-do-link`) e o resto da superfície leva à atividade.
 *
 * "USAR ESTA ATIVIDADE AGORA" é o professor escolhendo o que a turma faz:
 * criar não põe no ar. Com outra em andamento, a troca pede confirmação — quem
 * está jogando passa para esta, numa rodada nova.
 *
 * A exclusão pede o **título digitado**. É atrito de propósito: ela leva junto
 * posts, imagens no disco e as sessões já rodadas da turma, e não tem volta.
 */
export function CartaoAtividade({
  atividade,
  href,
  expId,
  turmaId,
  emAndamentoAgora,
}: {
  atividade: AtividadeNaLista;
  href: string;
  expId: MissaoComAtividade;
  turmaId: string;
  /** O título da que está em andamento na turma, se não for esta — o texto da confirmação. */
  emAndamentoAgora: string | null;
}) {
  const router = useRouter();
  const { complemento, exclusao } = atividade;
  const estado = ROTULO_DO_ESTADO[atividade.estado];

  const [excluindoAberto, setExcluindoAberto] = useState(false);
  const [tituloDigitado, setTituloDigitado] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confere =
    tituloDigitado.trim().toLocaleLowerCase('pt-BR') === atividade.titulo.trim().toLocaleLowerCase('pt-BR');

  function fecharExclusao() {
    if (excluindo) return;
    setExcluindoAberto(false);
    setTituloDigitado('');
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
      setExcluindoAberto(false);
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
      <Card variant="interactive" interactive className="h-full cartao-atividade" data-atividade={atividade.id}>
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-unooria-neutral-950">
              <Link href={href} className="link-esticado">
                {atividade.titulo}
              </Link>
            </h3>
            <div className="acima-do-link flex shrink-0 items-center gap-1.5">
              <Badge variant={estado.variante} data-estado={atividade.estado}>
                {estado.rotulo}
              </Badge>
              {exclusao ? (
                <button
                  type="button"
                  onClick={() => setExcluindoAberto(true)}
                  aria-label={`Excluir a atividade ${atividade.titulo}`}
                  title="Excluir atividade"
                  className="acao-excluir"
                >
                  <IconeLixeira />
                </button>
              ) : null}
            </div>
          </div>

          {atividade.detalhe ? <p className="text-[13px] text-unooria-neutral-500">{atividade.detalhe}</p> : null}
          {complemento ? <p className="text-[14px] italic text-unooria-neutral-700">“{complemento}”</p> : null}
          <p className="text-[12px] text-unooria-neutral-500">
            {textoDasRodadas(atividade.rodadas)} · criada em {formatarData(atividade.criadaEm)}
          </p>

          {atividade.estado === 'pronta' ? (
            <div className="acima-do-link">
              <UsarEstaAtividade
                expId={expId}
                turmaId={turmaId}
                atividadeId={atividade.id}
                titulo={atividade.titulo}
                emAndamentoAgora={emAndamentoAgora}
              />
            </div>
          ) : null}
        </div>
      </Card>

      {exclusao ? (
        <Modal isOpen={excluindoAberto} onClose={fecharExclusao} size="sm" role="alertdialog">
          <ModalHeader>
            <ModalTitle>Excluir “{atividade.titulo}”?</ModalTitle>
          </ModalHeader>

          <ModalBody>
            <div className="flex flex-col gap-4">
              <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
                Isso apaga a atividade inteira e não tem volta:
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-unooria-neutral-700">
                <li>{exclusao.posts} posts gerados, as personas e as imagens no servidor;</li>
                <li>
                  {exclusao.sessoes} sessões de estudante, com tudo que a turma produziu — leitura, conclusões
                  escritas e relatórios;
                </li>
                <li>os perfis do Ato 1 importados para esta atividade.</li>
              </ul>

              {exclusao.sessoes > 0 ? (
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
                value={tituloDigitado}
                onChange={(evento) => setTituloDigitado(evento.target.value)}
                autoComplete="off"
              />

              {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" onClick={fecharExclusao} disabled={excluindo}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={excluir} disabled={!confere} isLoading={excluindo}>
              Excluir atividade
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </>
  );
}
