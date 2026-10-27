import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo de O ASSISTENTE INVISÍVEL: DADOS QUE VIRAM DECISÕES (1ª série · Unidade
 * 1, ADR-185).
 *
 * **Existe porque a ausência dele é MUDA**: sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do Instanooria. O
 * `despachante-da-ficha.test.ts` é a rede.
 *
 * Abre com o fato que muda a condução: a missão só abre com uma atividade sua
 * em andamento, e a aula anda pelos SEUS botões — cinco liberações e duas
 * pausas, sempre para a frente.
 */
export function MissaoAssistenteInvisivel({
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
      etiquetas={["EM13CO20", "EM13CO01", "EM13CO18", "EM13CO03", "Individual com mediação"]}
      guia={guia}
      aviso={{
        tipo: "warning",
        titulo: "A missão só abre com uma atividade sua em andamento — e cada etapa é você quem libera",
        texto:
          "Crie a atividade (Usar Banco Padrão da Rede é o caminho curto) e ponha em andamento. Na página da atividade, aba Aula ao vivo, ficam os seus botões, sempre para a frente: Liberar Início dos Testes, Liberar Início da Simulação (só com 100% das apostas), Travar Telas da Turma, Liberar Bancada de Reconstrução, Pausar para Comparação e Liberar Publicação e Transparência.",
      }}
      conducao={<AtividadesDaMissao missao={missao} expId="exp01em1b" turma={turma} />}
      segredo={
        <>
          <p>
            <strong className="text-unooria-neutral-950">Os três colegas pediram a mesma coisa.</strong> Lucas,
            Beatriz e Thiago escolheram a Trilha Avançada no cadastro; só o horário de acesso (23h45 da Beatriz) e a
            conexão (instável no Thiago) mudam. O assistente roda a configuração B-B-A, que decide por esses dados
            observados — e nada na tela conta isso antes das fichas.
          </p>
          <p>
            <strong className="text-unooria-neutral-950">A aposta trava antes do resultado.</strong> O confronto
            retoma a previsão de cada estudante, e o medidor da turma mostra só os percentuais da sala, nunca quem
            apostou o quê (e só com pelo menos três apostas).
          </p>
          <p>
            No banco de critérios, 1A e 1C (e 2A e 2C) resolvem sem inferência: são caminhos éticos diferentes, e é
            essa comparação que você projeta na segunda pausa. Publicar é sempre possível; bloco em branco só gera
            aviso.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            A missão não coleta texto livre: a aposta, os cartões, os critérios e os blocos do comunicado são escolhas
            fechadas. As quatro habilidades são registradas pelo que o estudante FAZ, no relatório final e no painel de
            habilidades da atividade.
          </p>
        </>
      }
    />
  );
}
