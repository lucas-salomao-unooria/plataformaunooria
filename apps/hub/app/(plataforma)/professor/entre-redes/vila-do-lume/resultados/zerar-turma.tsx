"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertBox,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@edu/ui/ds";

/**
 * "Zerar os dados desta turma" — o botão de rodar a missão do zero.
 *
 * ## Por que as bolhas vão junto
 *
 * Zerar apaga as partidas, os perfis E a divisão de bolhas. Sem apagar a bolha, a
 * segunda rodada serviria à mesma criança o MESMO golpe — ela reconhece, e a
 * rodada não mede nada. Quem zera está dizendo "vou rodar isto do zero"; sem
 * sortear de novo, não é do zero.
 *
 * ## O que NÃO some
 *
 * Os perfis já importados para uma atividade do Instanooria. Aquilo pertence à
 * atividade, e apagar de lá trocaria os lados de uma aula em andamento sem
 * ninguém pedir.
 */
export function ZerarTurma({
  turmaId,
  nomeDaTurma,
  partidas,
}: {
  turmaId: string;
  nomeDaTurma: string;
  /** Quantos alunos já jogaram — o botão fica inerte quando não há nada. */
  partidas: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [zerando, setZerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vazia = partidas === 0;

  function fechar() {
    if (zerando) return;
    setAberto(false);
    setErro(null);
  }

  async function zerar() {
    if (zerando) return;
    setErro(null);
    setZerando(true);
    try {
      const resposta = await fetch(
        `/api/plataforma/vila/professor/turmas/${encodeURIComponent(turmaId)}/dados`,
        { method: "DELETE" },
      );
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
        setErro(corpo?.mensagem ?? "Não foi possível zerar os dados desta turma.");
        setZerando(false);
        return;
      }
      setAberto(false);
      setZerando(false);
      router.refresh();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
      setZerando(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setAberto(true)}
        disabled={vazia}
        title={vazia ? "Ninguém desta turma jogou ainda — não há o que zerar." : undefined}
      >
        Zerar os dados desta turma
      </Button>

      <Modal isOpen={aberto} onClose={fechar} size="sm" role="alertdialog">
        <ModalHeader>
          <ModalTitle>Zerar os dados de {nomeDaTurma}?</ModalTitle>
        </ModalHeader>

        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
              As <strong>{partidas}</strong>{" "}
              {partidas === 1 ? "partida vai sumir" : "partidas vão sumir"} com tudo que veio
              delas: o retrato de valores de cada aluno e a leitura das mensagens.{" "}
              <strong>Isso não tem volta.</strong>
            </p>
            <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
              A divisão de bolhas também é refeita — sem isso, cada criança receberia o mesmo
              golpe outra vez, reconheceria, e a segunda rodada não mediria nada.
            </p>
            <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
              Perfis que você já <strong>trouxe para uma atividade</strong> do Instanooria
              ficam como estão: eles pertencem à atividade, e mudá-los agora trocaria os lados
              de uma aula em andamento.
            </p>

            {erro ? <AlertBox theme="light" variant="error" device="auto" description={erro} /> : null}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={fechar} disabled={zerando}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={zerar} isLoading={zerando}>
            Zerar dados
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
