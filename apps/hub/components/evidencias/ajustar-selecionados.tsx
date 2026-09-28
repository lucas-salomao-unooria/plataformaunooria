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
  Selection,
} from "@edu/ui/ds";
import type { HabilidadeDaFicha, StatusDaEvidencia } from "@/lib/evidencias";

import { ErroDoPainel, OPCOES_DE_NIVEL, type Erro } from "./erro-do-painel";

/**
 * "Ajustar a seleção": o MESMO nível numa habilidade para cada estudante
 * marcado, numa rodada — o caso da turma que fez a atividade fora da missão,
 * ou do grupo que faltou ("Não participou").
 *
 * Nada vem escolhido de antemão (a não ser a habilidade, quando a ficha só tem
 * uma): um padrão nosso viraria a resposta de quem não leu, e aqui ele mudaria
 * vários estudantes de uma vez.
 */
export function AjustarSelecionados({
  quantos,
  rodada,
  habilidades,
  ocupado,
  erro,
  onSalvar,
  onFechar,
}: {
  quantos: number;
  rodada: number;
  habilidades: readonly HabilidadeDaFicha[];
  ocupado: boolean;
  erro: Erro | null;
  onSalvar: (habilidade: string, status: StatusDaEvidencia) => void;
  onFechar: () => void;
}) {
  const [habilidade, setHabilidade] = useState(habilidades.length === 1 ? habilidades[0]!.codigo : "");
  const [status, setStatus] = useState<StatusDaEvidencia | "">("");
  const escolhida = habilidades.find((h) => h.codigo === habilidade);
  const alvo = quantos === 1 ? "1 estudante" : `${quantos} estudantes`;

  return (
    <Modal isOpen onClose={() => (ocupado ? undefined : onFechar())} size="md" theme="light">
      <ModalHeader showCloseButton={false}>
        <ModalTitle>Ajustar a seleção</ModalTitle>
        <ModalDescription>
          {alvo} · Rodada {rodada}
        </ModalDescription>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          <Selection
            label="Habilidade"
            placeholder="Escolha a habilidade"
            value={habilidade}
            options={habilidades.map((h) => ({ value: h.codigo, label: h.codigo }))}
            onChange={(valor) => setHabilidade(String(valor))}
            helperText={escolhida?.descricao || undefined}
            disabled={ocupado}
            showOptionCheckbox={false}
            maxBoxHeight={240}
            fullWidth
          />
          <RadioGroup
            label="Nível nesta rodada"
            name={`nivel-em-massa-${rodada}`}
            direction="vertical"
            value={status}
            onChange={(valor) => setStatus(String(valor) as StatusDaEvidencia)}
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
          isDisabled={!habilidade || !status || ocupado}
          isLoading={ocupado}
          onClick={() => habilidade && status && onSalvar(habilidade, status)}
        >
          {`Aplicar a ${alvo}`}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
