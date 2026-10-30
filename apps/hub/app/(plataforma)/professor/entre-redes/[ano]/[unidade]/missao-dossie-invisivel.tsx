import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de O DOSSIÊ INVISÍVEL (9º ano · Unidade 1, ADR-202).
 *
 * **Existe porque a ausência dele é MUDA**: sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do Instanooria. O
 * `despachante-da-ficha.test.ts` é a rede.
 *
 * Abre com o fato que muda a condução: sem uma atividade em andamento a missão
 * não abre (os três projetos e os cadernos vêm do pacote), e as três travas
 * da aula são do professor. Individual: sem equipes (E13).
 */
export function MissaoDossieInvisivel({
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
      etiquetas={["EF09CO08", "EF09CO07", "UnooriaAI", "Individual com debate coletivo"]}
      guia={guia}
      aviso={{
        tipo: "warning",
        titulo: "A missão só abre com uma atividade sua em andamento — e as três travas da aula são suas",
        texto:
          "Os três projetos, os documentos e os cadernos vêm do pacote da sua atividade, então sem uma atividade em andamento o estudante vê uma tela de espera. Durante a aula são três botões seus, na aba Aula ao vivo da atividade, sempre para a frente: Liberar Próxima Pauta, Abrir Revisão da Decisão e Destravar Explicar e Protocolo.",
      }}
      conducao={<AtividadesDaMissao missao={missao} expId="exp09ef1b" turma={turma} />}
      segredo={
        <>
          <p>
            <strong className="text-unooria-neutral-950">A descoberta central:</strong> o assistente não estava avaliando
            o resultado dos projetos, e sim os rastros digitais que eles deixaram. O projeto de alimentação, com 180
            registros diários anotados em cadernos de papel, aparece em último só porque o sistema não lê papel.
          </p>
          <p>
            <strong className="text-unooria-neutral-950">Nada avisa que falta alguma coisa.</strong> O assistente compara
            12 relatórios digitais com uma ficha cadastral e recomenda o projeto da nuvem. Os cadernos só aparecem para
            quem pergunta pela falta de documentos — é a investigação que a missão mede.
          </p>
          <p>
            <strong className="text-unooria-neutral-950">A virada é sua.</strong> Quando você libera a próxima pauta, os
            cadernos entram na conta e, com os MESMOS critérios, o parecer da máquina se inverte. É esse contraste, com
            a distribuição de votos da turma no projetor, que abre o seu debate.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            A missão não coleta redação: as perguntas ao assistente ficam na conversa, e a escolha, o ranking dos
            critérios e o protocolo são escolhas fechadas. As duas habilidades são registradas pelo que o estudante FAZ,
            no painel de habilidades da atividade.
          </p>
        </>
      }
    />
  );
}
