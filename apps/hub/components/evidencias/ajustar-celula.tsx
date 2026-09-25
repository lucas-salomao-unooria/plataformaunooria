"use client";

import { useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  RadioGroup,
} from "@edu/ui/ds";
import {
  ROTULO_DA_ORIGEM,
  type LeituraDaCelula,
  type StatusDaEvidencia,
} from "@/lib/evidencias";

import { ErroDoPainel, OPCOES_DE_NIVEL, type Erro } from "./erro-do-painel";

export interface CelulaEmAjuste {
  estudanteId: string;
  nome: string;
  codigo: string;
  descricao: string;
  rodada: number;
  leitura: LeituraDaCelula;
}

/**
 * O ajuste de UMA célula: um estudante, uma habilidade, uma rodada.
 *
 * O nível que está lá hoje vem marcado; o que o professor escolher vira a
 * origem `professor`, que nada sobrescreve depois (nem a marca da criança, nem
 * a cópia da equipe). O componente é montado por célula (a `key` é do pai),
 * então a escolha começa sempre do que está salvo.
 */
export function AjustarCelula({
  alvo,
  ocupado,
  erro,
  onSalvar,
  onFechar,
}: {
  alvo: CelulaEmAjuste;
  ocupado: boolean;
  erro: Erro | null;
  onSalvar: (status: StatusDaEvidencia) => void;
  onFechar: () => void;
}) {
  const [escolha, setEscolha] = useState<StatusDaEvidencia | "">(alvo.leitura.status ?? "");
  const { leitura } = alvo;
  const hoje = leitura.origem ? `${leitura.rotulo} · ${ROTULO_DA_ORIGEM[leitura.origem]}` : leitura.rotulo;

  return (
    <Modal isOpen onClose={() => (ocupado ? undefined : onFechar())} size="sm" theme="light">
      <ModalHeader showCloseButton={false}>
        <ModalTitle>{alvo.nome}</ModalTitle>
        <ModalDescription>
          {alvo.codigo} · Rodada {alvo.rodada}
        </ModalDescription>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          {alvo.descricao ? <p className="text-[13px] text-unooria-neutral-700">{alvo.descricao}</p> : null}
          <p className="text-[13px] text-unooria-neutral-500">
            Hoje: <span className="font-semibold text-unooria-neutral-800">{hoje}</span>
            {leitura.aRevisar ? " — ainda não conta até você confirmar a aula projetada ou ajustar aqui." : ""}
          </p>
          <RadioGroup
            label="Nível nesta rodada"
            name={`nivel-${alvo.estudanteId}-${alvo.codigo}-${alvo.rodada}`}
            direction="vertical"
            value={escolha}
            onChange={(valor) => setEscolha(String(valor) as StatusDaEvidencia)}
            options={OPCOES_DE_NIVEL}
          />
          <ErroDoPainel erro={erro} />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="md" isDisabled={ocupado} onClick={onFechar}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="md"
          isDisabled={!escolha || ocupado}
          isLoading={ocupado}
          onClick={() => escolha && onSalvar(escolha)}
        >
          Salvar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
