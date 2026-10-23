import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de O EFEITO AMPLIFICADOR (2ª série · Unidade 1, ADR-181).
 *
 * **Existe porque a ausência dele é MUDA**: sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do Instanooria. O
 * `despachante-da-ficha.test.ts` é a rede.
 *
 * Abre com o fato que muda a condução: **sem uma atividade em andamento a
 * missão não abre** (o tema dela entra na fala de abertura do UnooriaAI), e os
 * dois botões da aula são seus. As equipes (E13) são de cada atividade.
 */
export function MissaoEfeitoAmplificador({
  ano,
  missao,
  turma,
}: {
  ano: Ano;
  missao: Missao & { ficha: NonNullable<Missao["ficha"]> };
  turma: TurmaDoProfessor | null;
}) {
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  return (
    <FichaDeConducao
      contexto={rotuloDaMissao(ano, missao)}
      titulo={missao.titulo}
      resumo={missao.resumo}
      ficha={missao.ficha}
      etiquetas={["EM13CO24"]}
      guia={guia}
      aviso={{
        tipo: "warning",
        titulo: "A missão só abre com uma atividade sua em andamento — e a revelação é você quem conduz",
        texto:
          "O tema do pacote entra na fala de abertura do UnooriaAI, então sem uma atividade em andamento o estudante vê uma tela de espera. Durante a aula são dois botões seus, na página da atividade, sempre para a frente: Pausar Telas para Debate e Liberar Etapa 5.",
      }}
      conducao={
        <AtividadesDaMissao missao={missao} expId="exp02em1b" turma={turma} />
      }
      segredo={
        <>
          <p>
            <strong className="text-unooria-neutral-950">Nenhum problema do rascunho chega marcado.</strong> O
            UnooriaAI escreve com segurança e cortesia; a estatística inventada, o trecho copiado e o colega exposto
            só aparecem para quem pergunta. Não há mascote nem aviso dizendo “cuidado, isso viola a LGPD”.
          </p>
          <p>
            <strong className="text-unooria-neutral-950">O feed não muda com o texto.</strong> Qualquer manchete,
            qualquer cuidado: a rede pinça uma frase e entrega o post de madrugada para todo mundo. É essa
            uniformidade que desmonta a culpa individual no debate — por isso o painel mostra a curva da turma.
          </p>
          <p>
            As ferramentas de proteção ficam nos três pontos, <strong>sem ninguém pedir</strong>: usar ou não é o que
            a EM13CO08 mede. O Publicar e os seus dois botões não voltam.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            O que o estudante escreve ao UnooriaAI fica só no aparelho dele: nem você nem a coordenação o leem. As
            quatro habilidades são registradas pelo que ele FAZ, no painel de habilidades da atividade.
          </p>
        </>
      }
    />
  );
}
