"use client";

import { useId } from "react";
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from "@edu/ui/ds";
import { juntarNomes, rotulosCurtos, turmaInteira, type EquipeSalva, type PessoaDaEquipe } from "@/lib/equipes";

/**
 * "Mostrar equipes": a tela que vai para o PROJETOR, para cada estudante achar
 * o computador da sua equipe.
 *
 * Só o nome da equipe e o PRIMEIRO nome de quem está nela — nada de ausentes,
 * de desempenho nem de quem ficou sem equipe: é uma tela que a sala inteira lê.
 * O nome que empata na turma sobe só o necessário para desempatar
 * (`rotulosCurtos`): "Maria S.", e "Gabriela Cardoso" quando duas ficariam
 * "Gabriela C.". O desempate é sobre a TURMA inteira — quem está sem equipe
 * não aparece, mas chega atrasado e precisa achar o próprio nome.
 *
 * É uma janela do DS no maior tamanho, e não uma rota: uma página de tela
 * cheia dentro de `/professor` herdaria a trilha e o layout da área, e sair
 * dela seria navegar de volta para a ficha no meio da aula.
 *
 * `aria-labelledby` é COMPENSAÇÃO de uma lacuna do DS (0.2.2): o `Modal` só liga
 * o título ao `role="dialog"` no atalho `title=`; montado com `ModalTitle`, o
 * título ganha id e o diálogo fica SEM NOME acessível — o leitor de tela anuncia
 * "diálogo" e mais nada.
 */
export function MostrarEquipes({
  aberto,
  onFechar,
  equipes,
  semEquipe,
}: {
  aberto: boolean;
  onFechar: () => void;
  equipes: readonly EquipeSalva[];
  /** Não vai para a tela; entra só no desempate dos nomes. */
  semEquipe: readonly PessoaDaEquipe[];
}) {
  const idDoTitulo = useId();
  const rotulos = rotulosCurtos(turmaInteira({ equipes: [...equipes], semEquipe: [...semEquipe] }));
  return (
    <Modal isOpen={aberto} onClose={onFechar} size="full" theme="light" aria-labelledby={idDoTitulo}>
      <ModalHeader showCloseButton={false}>
        <ModalTitle id={idDoTitulo}>Equipes</ModalTitle>
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
