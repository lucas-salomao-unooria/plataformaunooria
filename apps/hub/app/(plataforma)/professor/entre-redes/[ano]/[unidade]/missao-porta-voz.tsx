import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de O PORTA-VOZ DOS DADOS (3ª série · Unidade 1, ADR-198).
 *
 * **Existe porque a ausência dele é MUDA**: sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do Instanooria. O
 * `despachante-da-ficha.test.ts` é a rede.
 *
 * Abre com o fato que muda a condução: sem uma atividade em andamento a missão
 * não abre (o recorte da aula entra no nome do grupo, na tabela e nas falas
 * dos moradores), e os dois botões da aula são do professor. Individual: sem
 * equipes (E13).
 */
export function MissaoPortaVoz({
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
      etiquetas={["EM13CO12", "EM13CO13", "EM13CO14", "EM13CO21", "EM13CO22", "EM13CO26", "Individual com debate coletivo"]}
      guia={guia}
      aviso={{
        tipo: "warning",
        titulo: "A missão só abre com uma atividade sua em andamento — e o debate é você quem abre",
        texto:
          "O recorte da sua aula entra no nome do grupo da cidade, na tabela e nas falas dos moradores, então sem uma atividade em andamento o estudante vê uma tela de espera. Durante a aula são dois botões seus, na aba Aula ao vivo da atividade, sempre para a frente: Pausar para o debate e Liberar Retomada da Turma.",
      }}
      conducao={<AtividadesDaMissao missao={missao} expId="exp03em1b" turma={turma} />}
      segredo={
        <>
          <p>
            <strong className="text-unooria-neutral-950">A descoberta central:</strong> mesmo quando dois gráficos usam
            os mesmos números verdadeiros e oficiais, a escolha de onde começa o eixo vertical e a presença de uma
            explicação mudam completamente o que as pessoas entendem e como a comunidade reage.
          </p>
          <p>
            <strong className="text-unooria-neutral-950">Nada avisa que a escala engana.</strong> O compositor começa
            sem escala marcada: o estudante escolhe entre o eixo em 0% e o eixo em 80%, e as três informações (a
            explicação da escala, a fonte e o contexto da queda) são opcionais. A nota técnica anexa conta que a queda
            ficou em duas ruas durante uma obra — só para quem a abre.
          </p>
          <p>
            <strong className="text-unooria-neutral-950">A escola rival não é anunciada.</strong> Dez segundos depois
            da publicação, a mesma planilha aparece no grupo com a escala oposta. É esse contraste que abre o seu debate.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            A missão não coleta texto livre: a escala, as informações e o parecer da perícia são escolhas fechadas. As
            seis habilidades são registradas pelo que o estudante FAZ, no painel de habilidades da atividade.
          </p>
        </>
      }
    />
  );
}
