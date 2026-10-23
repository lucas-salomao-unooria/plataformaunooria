import { FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { rotuloDaMissao, type Ano, type Missao } from "@/lib/entre-redes/catalogo";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import type { TurmaDoProfessor } from "@/lib/turmas";

import { AtividadesDaMissao } from "./atividades-da-missao";

/**
 * Corpo do JORNAL DA ESCOLA: A EDIÇÃO DE BENTO (4º ano · Unidade 1).
 *
 * **Existe porque a ausência dele é MUDA.** Sem ramo no despachante de
 * `page.tsx`, a missão cairia no corpo do INSTANOORIA, com "Nova atividade"
 * gravando em `exp08ef1b_activities`, que esta missão nunca lê, e sem o
 * caminho para o painel em que se prepara o pacote e se liberam as etapas.
 *
 * A ficha abre com o fato que muda a condução, e ele não pode estar no fim de
 * uma lista: **são dois portões, num botão só, e ele não volta**. Sem o
 * primeiro clique, quem publicou fica esperando; apertado cedo demais, não se
 * desfaz.
 *
 * A disposição é do template (`components/ficha/ficha-de-conducao.tsx`,
 * ADR-182): aqui ficam só o aviso, o que a missão esconde e a condução.
 */
export function MissaoJornalEscola({
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
        tipo: "warning",
        titulo: "A aula tem dois portões, num botão só, e ele não volta",
        texto:
          "Na página da atividade, o mesmo botão mostra sempre a próxima etapa: primeiro Liberar resultado, depois Liberar revisão. Sem o primeiro clique, quem publicou fica esperando. A missão cabe em uma aula ou em duas: em duas, pare depois da conversa do resultado — o progresso fica salvo, e a segunda aula começa na Chave do Editor quando você aperta Liberar revisão. A missão só abre para a turma com uma atividade sua em andamento: crie o pacote de notícias (pode partir do banco da Unooria, “Feira de Ciências e Notícias da Cidade”), gere as imagens e use a atividade quando a turma for fazer.",
      }}
      conducao={
        <AtividadesDaMissao missao={missao} expId="exp04ef1b" turma={turma} />
      }
      segredo={
        <>
          <p>
            <strong className="text-unooria-neutral-950">Nenhuma notícia chega marcada</strong> como
            confiável ou duvidosa, e antes do resultado a tela não diz que a aula é sobre checagem. As
            pistas — de onde veio, quando aconteceu, quem assina — estão disponíveis desde o começo, mas
            ninguém é obrigado a abri-las: é essa escolha espontânea que o resultado mostra.
          </p>
          <p>
            O Bento aparece <strong>só na abertura e na Chave do Editor</strong>. Na mesa ele fica
            calado: um “cuidado com a data” faria todo mundo abrir a data para cumprir a regra, e a
            descoberta do resultado morreria. Pela mesma razão, a pergunta de por que escolheram só vem
            depois da publicação.
          </p>
          <p>
            A 1ª edição é <strong>definitiva</strong>. Depois de publicar não dá para trocar notícia —
            é o que faz os leitores reagirem à escolha que a turma fez, e não à que ela faria depois de
            ouvir a conversa.
          </p>
          <p>
            A Chave do Editor <strong>não é corrigida na tela</strong>: cada dupla monta a sua uma vez, testa em
            duas matérias novas e só depois recebe, como todos, a mesma regra de referência. O nível de cada
            criança fica no painel de habilidades, só para você.
          </p>
          <p className="text-[13px] text-unooria-neutral-500">
            Não há nota, ranking nem “você errou”: o “X de 3 notícias verificadas” descreve a SELEÇÃO,
            não a criança, e é calculado pelo gabarito revisado antes da aula — nunca por um julgamento
            da inteligência artificial durante ela. Nenhuma notícia é chamada de falsa: uma notícia
            antiga pode ser verdadeira, e uma mensagem sem autor pode só não ter evidência para ir à
            capa.
          </p>
        </>
      }
    />
  );
}
