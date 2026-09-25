"use client";

import { Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from "@edu/ui/ds";
import { juntarNomes, rotulosCurtos, type EquipeSalva } from "@/lib/equipes";

/**
 * "Mostrar equipes": a tela que vai para o PROJETOR, para cada estudante achar
 * o computador da sua equipe.
 *
 * Só o nome da equipe e o PRIMEIRO nome de quem está nela — nada de ausentes,
 * de desempenho nem de quem ficou sem equipe: é uma tela que a sala inteira lê.
 * O nome repetido na turma ganha a inicial do sobrenome (`rotulosCurtos`).
 *
 * É uma janela do DS no maior tamanho, e não uma rota: uma página de tela
 * cheia dentro de `/professor` herdaria a trilha e o layout da área, e sair
 * dela seria navegar de volta para a ficha no meio da aula.
 */
export function MostrarEquipes({
  aberto,
  onFechar,
  equipes,
}: {
  aberto: boolean;
  onFechar: () => void;
  equipes: readonly EquipeSalva[];
}) {
  const rotulos = rotulosCurtos(equipes.flatMap((equipe) => equipe.membros));
  return (
    <Modal isOpen={aberto} onClose={onFechar} size="full" theme="light">
      <ModalHeader showCloseButton={false}>
        <ModalTitle>Equipes</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <div className="grid gap-x-10 gap-y-8 py-2 sm:grid-cols-2 xl:grid-cols-3">
          {[...equipes]
            .sort((a, b) => a.ordem - b.ordem)
            .map((equipe) => (
              <section key={equipe.id} className="flex flex-col gap-2">
                <h3 className="text-[32px] font-bold leading-tight text-unooria-neutral-950">{equipe.nome}</h3>
                <p className="text-[24px] leading-snug text-unooria-neutral-800">
                  {juntarNomes(equipe.membros.map((pessoa) => rotulos.get(pessoa.id) ?? ""))}
                </p>
              </section>
            ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" size="md" onClick={onFechar}>
          Fechar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
