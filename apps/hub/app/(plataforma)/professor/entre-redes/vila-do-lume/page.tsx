import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@edu/ui/ds";
import { FaixaDaTurma, FichaDeConducao } from "@/components/ficha/ficha-de-conducao";
import { LinkButton } from "@/components/link-button";
import {
  buscarMissaoTransversal,
  MISSAO_ATUAL,
  rotaDaMissao,
  rotaDaTransversal,
} from "@/lib/entre-redes/catalogo";
import { comTurma } from "@/lib/rotas-da-missao";
import { turmaDaConducao } from "@/lib/turmas";
import { DESCRICAO_BOLHA } from "@/lib/vila-tipos";

export const metadata = { title: "Vila do Lume — Plataforma Unooria" };

/**
 * Ficha da missão transversal. Mesma estrutura das fichas de ano (competência,
 * duração, atos, preparo), sem breadcrumb de ano/unidade — ela não tem.
 *
 * O que esta tela tem e as outras não: as TRÊS BOLHAS explicadas. O professor
 * precisa saber, antes de entrar na sala, que os estudantes dele receberam golpes de
 * níveis diferentes — é sobre isso que o debate é. Ler o resultado de uma
 * criança sem saber o nível que ela recebeu produz a conclusão errada, e é a
 * conclusão mais fácil de tirar: a de que ela é ingênua.
 *
 * A disposição é a do template de toda ficha (`components/ficha/ficha-de-conducao.tsx`,
 * ADR-182): o passo a passo do professor é a condução, e o "para que serve" e
 * as três bolhas viram abas próprias de "Conhecer a missão".
 */
export default async function VilaDoLumePage({
  searchParams,
}: {
  /** `?turmaId=` chega da SALA DE AULA (ADR-100) — daqui a Vila é a única porta. */
  searchParams: Promise<{ turmaId?: string }>;
}) {
  const missao = buscarMissaoTransversal("vila-do-lume");
  if (!missao || !missao.ficha) notFound();
  const { ficha } = missao;
  const rota = rotaDaTransversal(missao);
  const { turmaId } = await searchParams;
  const turma = await turmaDaConducao(turmaId);

  const guia = comTurma(`${rota}/guia`, turma?.id);

  return (
    <div className="flex flex-col gap-6">
      {turma ? (
        <FaixaDaTurma
          nome={turma.nome}
          descricao="Os resultados abaixo já abrem nesta turma. Para ver as outras, entre pela trilha do Entre Redes."
        />
      ) : null}
      <FichaDeConducao
        contexto="Missão transversal · vale para qualquer ano"
        titulo={missao.titulo}
        resumo={missao.resumo}
        ficha={ficha}
        guia={guia}
        aviso={{
          tipo: "warning",
          titulo: "Não conte nada antes",
          texto:
            'A instrução para a turma é só "vocês vão manter a vila acesa". Avisar para prestarem atenção nas mensagens destrói a missão: a criança entra em alerta e o que se mede passa a ser o quanto ela ouviu você.',
        }}
        conducao={
          /*
            O passo a passo. A ficha já descreve os atos DA MISSÃO; isto é a ordem do
            que o PROFESSOR faz, que é outra coisa — e é o que ele procura quando abre
            a tela pela primeira vez.
          */
          <Card variant="elevated" title="Passo a passo">
            <div className="flex flex-col gap-4">
              <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[14px] leading-relaxed text-unooria-neutral-700">
                <li>
                  <strong>Leia o guia do debate antes.</strong> A missão só fecha no debate, e há
                  coisas que você precisa saber para não estragá-la — a começar por não contar
                  nada à turma de antemão.
                </li>
                <li>
                  <strong>Mande a turma jogar.</strong> Cada estudante entra pelo hub dele e escolhe a
                  Vila do Lume. São 15 a 25 minutos, e a partida se perde se ele fechar a aba —
                  reserve o tempo de uma aula.
                </li>
                <li>
                  <strong>Confira os resultados.</strong> Veja se as três bolhas estão na sua
                  turma: sem as três, a revelação não tem o que comparar, e vale esperar mais
                  estudantes jogarem.
                </li>
                <li>
                  <strong>Faça o debate</strong>, com o roteiro do guia. 10 a 15 minutos.
                </li>
                <li>
                  <strong>Depois, se quiser:</strong> leia o relatório de um estudante específico, e/ou
                  traga os perfis para uma atividade do Unoovista.
                </li>
              </ol>
              <div>
                <LinkButton href={comTurma(`${rota}/resultados`, turma?.id)}>Ver resultados da turma</LinkButton>
              </div>
            </div>
          </Card>
        }
        abasExtras={[
          {
            /*
              PARA QUE SERVE, na prática. O professor que abre esta ficha precisa saber
              duas coisas antes de decidir rodar: que ela vale para a turma dele seja
              qual for o ano, e que o resultado é consumido por outra missão. Sem isto
              a Vila parece um jogo solto no meio de uma trilha por ano.
            */
            id: "para-que-serve",
            rotulo: "Para que ela serve",
            icone: "hub",
            conteudo: (
              <section className="flex flex-col gap-3">
                <p className="max-w-3xl text-[14px] font-semibold leading-relaxed text-unooria-neutral-800">
                  {missao.porQueTransversal}
                </p>
                <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-700">
                  <p>
                    <strong>Vale para qualquer ano.</strong> A Vila do Lume não é a missão de uma
                    série: o que ela lê — como a criança escolhe quando escolher custa algo — não é
                    conteúdo de ano nenhum. Rode com a sua turma seja qual for o ano dela. A única
                    diferença: nos anos iniciais (1º ao 5º) a plataforma não serve o golpe de
                    autoridade, porque &quot;suporte&quot; exige entender o que é suporte.
                  </p>
                  <p>
                    <strong>Ela rende duas coisas.</strong> A primeira é o debate — que é metade da
                    missão, e tem roteiro próprio no guia. A segunda é um retrato de valores por
                    estudante, que você lê nos resultados da turma.
                  </p>
                  <p>
                    <strong>E esse retrato alimenta outra missão.</strong> Hoje, o{" "}
                    {/* Rota DERIVADA do catálogo: se a missão mudar de ano ou de unidade,
                        o link acompanha. Fixá-la aqui criaria uma segunda verdade sobre
                        onde o Unoovista mora. */}
                    <Link
                      href={rotaDaMissao(MISSAO_ATUAL)}
                      className="font-semibold text-unooria-navy-900 underline"
                    >
                      Unoovista
                    </Link>{" "}
                    (8º ano · Unidade 1): é o perfil da Vila que decide
                    de que lado o feed de cada estudante nasce lá — o &quot;Ato 1&quot; que a ficha
                    daquela missão descreve. Na tela da atividade do Unoovista há um botão{" "}
                    <em>Trazer perfis da Vila do Lume</em>. Quem não jogou entra no sorteio
                    balanceado, e você pode completar à mão.
                  </p>
                  <p className="text-[13px] text-unooria-neutral-600">
                    Não é obrigatório usar as duas: a Vila funciona sozinha, com o debate dela. E o
                    Unoovista funciona sem a Vila, sorteando os lados.
                  </p>
                </div>
              </section>
            ),
          },
          {
            id: "tres-bolhas",
            rotulo: "As três bolhas",
            icone: "bubble_chart",
            conteudo: (
              <section className="flex flex-col gap-3">
                <h3 className="text-[16px] font-bold text-unooria-neutral-950">As três bolhas — cada estudante recebe UMA</h3>
                <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-600">
                  As três recebem as <strong>mesmas duas mensagens verdadeiras</strong>. Só o golpe
                  principal muda de nível — e o que muda nele não é a quantidade, é a qualidade e o
                  momento em que ele chega. A turma é dividida pela plataforma, de forma equilibrada;
                  você não escolhe.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["A", "B", "C"] as const).map((bolha) => (
                    <Card key={bolha} variant="outlined">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-unooria-navy-800 text-[12px] font-bold text-white">
                            {bolha}
                          </span>
                          <span className="text-[14px] font-semibold text-unooria-neutral-950">
                            {DESCRICAO_BOLHA[bolha].titulo}
                          </span>
                        </div>
                        <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                          {DESCRICAO_BOLHA[bolha].texto}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}
