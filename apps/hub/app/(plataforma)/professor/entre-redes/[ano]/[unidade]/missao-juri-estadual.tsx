import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo do JÚRI ESTADUAL DE PROJETOS (6º ano · Unidade 1).
 *
 * **Existe porque a ausência dele é MUDA.** Sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do INSTANOORIA, com "Nova atividade"
 * gravando em `exp08ef1b_activities`, que esta missão nunca lê, e sem o
 * caminho para a página da atividade, onde se liberam a galeria e a lousa.
 *
 * A ficha abre com os dois fatos que mudam a condução, e eles não podem estar
 * no fim de uma lista: **a mostra se prepara antes** (o banco padrão em um
 * toque, ou a personalizada com IA) e **é um botão só, que não volta**.
 *
 * A disposição é do template (`components/ficha/ficha-de-conducao.tsx`,
 * ADR-182): aqui ficam só o aviso, o que a missão esconde e a condução.
 */
export function MissaoJuriEstadual({
  ano,
  missao,
  turma,
}: {
  ano: Ano;
  missao: Missao & { ficha: NonNullable<Missao["ficha"]> };
  /** A turma que a sala mandou conduzir (ADR-100); `null` pela trilha. */
  turma: TurmaDoProfessor | null;
}) {
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  return (
    <FichaDeConducao
      contexto={rotuloDaMissao(ano, missao)}
      titulo={missao.titulo}
      resumo={missao.resumo}
      ficha={missao.ficha}
      guia={guia}
      aviso={{
        tipo: "info",
        titulo: "Prepare antes: banco padrão ou mostra personalizada",
        texto:
          "Em Nova atividade, use o Banco Padrão Oficial (a Feira de Ciências e Sustentabilidade, sem IA, em um toque) ou gere os quarenta estandes com IA sobre o tema da sua aula — dez em cada uma das quatro áreas. Sem saldo de IA, o banco padrão entra no lugar. Durante a aula é um botão só — Liberar Auditoria —, e ele não volta. A missão só abre para a turma com uma atividade sua em andamento.",
      }}
      conducao={<AtividadesDaMissao missao={missao} expId="exp06ef1b" turma={turma} />}
      segredo={
        <>
          <p>
            <strong className="text-unooria-neutral-950">Nada na tela diz que o feed se adapta.</strong> Nenhum aviso,
            nenhum contador de afinidade: cada curtida e cada parada longa num post mudam o que vem a seguir em
            silêncio, e a cédula só oferece os estandes que o feed de cada um mostrou. É essa certeza construída sem
            saber que a Galeria Oculta confronta.
          </p>
          <p>
            Todo computador fica com a mesma quantidade de estandes fora do feed: são quarenta, e o feed mostra dez.
            O que muda é <strong>quais áreas sumiram</strong>. A Galeria Oculta mostra a cada um a contagem por área e
            o feed que ele teria visto “sem as suas curtidas”: quem curtiu recebeu quase só uma área; quem não curtiu
            viu as quatro misturadas. Não há número certo, e nenhum é anunciado.
          </p>
          <p>
            O voto é <strong>lacrado</strong>: depois de confirmar, não volta. É o que faz a turma chegar ao pico com
            uma escolha comprometida — e a revisão, depois da galeria, mostrar o que mudou com a evidência.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            Não há nota, ranking nem “você errou”: na lousa vão só os votos por área e, depois da auditoria, quanto do
            feed caiu numa área só (a média de quem curtiu e a de quem não curtiu), sem nomes; a folha com nomes não
            tem voto nem concentração. Durante a aula o feed segue uma regra fixa, sem inteligência
            artificial — a IA só escreve os estandes no preparo.
          </p>
        </>
      }
    />
  );
}
