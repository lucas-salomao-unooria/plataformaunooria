import { notFound } from "next/navigation";

import { AlertBox, Card } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import { Trilha } from "@/components/trilha";
import {
  MISSAO_ATUAL,
  buscarMissao,
  rotaDaMissao,
  rotuloDaMissao,
} from "@/lib/entre-redes/catalogo";

/**
 * Guia da aula da missão — doc 09 renderizado.
 *
 * Vive dentro da missão (`/professor/entre-redes/[ano]/[unidade]/guia`) e não
 * mais num atalho do header: cada missão do Entre Redes tem o seu guia, e o guia
 * fora da missão não diria de qual aula está falando.
 *
 * A missão tem **dois atos**: o jogo (fora da plataforma, que mede o perfil de
 * valores) e o Instanooria. Nenhum aluno deve suspeitar que os dois se conectam
 * antes da revelação — é essa surpresa que faz o relatório final funcionar.
 */
export default async function GuiaPage({
  params,
}: {
  params: Promise<{ ano: string; unidade: string }>;
}) {
  // O middleware já garante sessão de professor em /professor/**.
  const { ano: anoSlug, unidade: unidadeSlug } = await params;

  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  // Só missão publicada tem guia: unidade "em breve" não tem aula para guiar.
  // E este guia é o do Instanooria (doc 09) — outras missões têm o próprio
  // roteiro na página da missão, não este.
  if (!encontrado || encontrado.missao.status !== "disponivel") notFound();
  if (encontrado.missao.expId !== MISSAO_ATUAL.expId) notFound();
  const { ano, missao } = encontrado;

  return (
    <div className="flex flex-col gap-6">
      <Trilha
        itens={[
          { label: "Início", href: "/professor" },
          { label: "Entre Redes", href: "/professor/entre-redes" },
          { label: rotuloDaMissao(ano, missao), href: rotaDaMissao(missao) },
          { label: "Guia da aula" },
        ]}
      />

      <div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">
          Guia da aula
        </h1>
        <p className="text-[14px] text-unooria-neutral-500">
          {missao.titulo} · {rotuloDaMissao(ano, missao)}. A missão tem{" "}
          <strong>dois atos</strong>. O Ato 1 é o jogo, fora da plataforma, que
          mede o perfil de valores. Este guia cobre o Ato 2: duas aulas (100 min),
          da missão ao fechamento escrito.
        </p>
      </div>

      <AlertBox
        theme="light"
        variant="warning"
        device="auto"
        title="O que você sabe e a turma não"
        description="Cada aluno recebe um feed já puxado para um dos dois lados, e o lado vem do perfil que o jogo mediu — não é sorteio. O mesmo argumento foi escrito em quatro linguagens, e cada um recebe mais a que combina com ele. O outro lado nunca desaparece: passa sempre pelo menos 1 post em 6, o mais calmo, para que virar de lado seja possível. Nada disso é dito antes da revelação."
      />

      <Card variant="outlined" title="Antes da aula">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
          <li>
            <strong>Crie a atividade a partir do seu tema.</strong> Você não
            escreve mais a pergunta-chave: informe disciplina, tema/recorte e o
            que já foi trabalhado. A IA propõe 2–3 perguntas com dois lados
            defensáveis e uma nota de equilíbrio.{" "}
            <strong>Escolha uma, edite à vontade ou escreva a sua</strong> — a
            palavra final é sempre sua.
          </li>
          <li>
            <strong>Valide os dois lados</strong> que a IA destilou (rótulo,
            tese, argumentos, tom) e a tabela de afinidade perfil → lado.
          </li>
          <li>
            <strong>Configure os neutros.</strong> Dentro do tema, fora do tema,
            os dois ou nenhum. Recomendação: deixe <strong>os dois</strong>{" "}
            ligados — sem neutros o feed fica visivelmente monotemático desde o
            primeiro post e o disfarce enfraquece.
          </li>
          <li>
            <strong>Revise os posts gerados.</strong> Use a visão de matriz (2
            lados × 4 perfis) para checar se alguma linguagem ficou fraca.
          </li>
          <li>Ative a atividade e teste você mesmo com um login de aluno.</li>
          <li>
            <strong>Confira os perfis e a distribuição da turma.</strong> Você vê,
            antes de começar, em que lado cada aluno vai cair. Se a turma cair
            quase toda num lado, use o botão de <strong>redistribuir</strong>: ele
            move primeiro os de perfil menos decidido, preservando a pedagogia
            onde o sinal é forte.
          </li>
          <li>
            <strong>Decida se os perfis respondem.</strong> Um botão nesta
            atividade liga a interação ao vivo: quando um aluno publica algo, os
            perfis do feed comentam de verdade, com texto gerado na hora. Passa
            por quatro camadas de proteção — elenco fechado, vocabulário
            bloqueado, sem link/contato/dado pessoal e nada que instrua
            comportamento. Se qualquer camada reprovar, o comentário não aparece:
            nunca entra texto substituto.
          </li>
          <li>
            <strong>Em sala, apresente a missão:</strong> “vocês vão investigar
            uma pergunta num app e, no fim, me dizer o que acham”. Diga também a
            instrução que faz o debate funcionar:{" "}
            <strong>“salvem os posts que vão ajudar vocês a responder”</strong>.
            Nada de algoritmo, bolha ou perfil.
          </li>
          <li>Combine silêncio durante o uso (cada um na sua experiência).</li>
        </ol>
      </Card>

      <Card variant="outlined" title="Você conduz — os seis botões">
        <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
          A atividade não roda sozinha: ninguém passa para o momento seguinte sem
          que você aperte o botão. Isso existe para que a sala chegue{" "}
          <strong>junta</strong> no debate e na revelação — o momento-espelho
          depende de todos terem acabado de sair do feed. O painel da atividade
          mostra o momento de agora em destaque, o botão da próxima ação e uma
          linha dizendo o que vai mudar na tela dos alunos. Dá para voltar um
          momento se você adiantou sem querer.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="text-[12px] text-unooria-neutral-500">
                <th className="w-52 py-2 font-semibold">Botão</th>
                <th className="py-2 font-semibold">
                  O que acontece na tela do aluno
                </th>
              </tr>
            </thead>
            <tbody className="align-top">
              {[
                [
                  "Começar investigação",
                  "libera o feed (figurinha + nome + missão)",
                ],
                [
                  "Encerrar investigação",
                  "fecha o feed; aparece a pergunta com três opções (mais para A / em dúvida / mais para B). Não tem campo de texto aqui.",
                ],
                [
                  "Iniciar debate",
                  "a tela trava na coleção: só os posts que ele salvou, e só abrir/fechar. Nada de rolar feed, curtir ou comentar.",
                ],
                [
                  "Encerrar debate",
                  "libera a explicação de como o feed dele foi montado, e o relatório.",
                ],
                [
                  "Mostrar o que perderam",
                  "o feed volta em cinza, só com os posts do outro lado que nunca chegaram até ele.",
                ],
                [
                  "Abrir reflexão",
                  "campo de escrita livre, sem limite: o fechamento da atividade.",
                ],
              ].map(([botao, efeito]) => (
                <tr key={botao} className="border-t border-unooria-neutral-200">
                  <td className="py-2.5 pr-3 font-semibold text-unooria-neutral-950">
                    {botao}
                  </td>
                  <td className="py-2.5 leading-relaxed text-unooria-neutral-800">
                    {efeito}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-unooria-neutral-500">
          A etapa da turma é <strong>piso, não teto</strong>: quem terminou de ler
          o relatório antes dos colegas não fica preso, mas ninguém passa do que
          você liberou. A única exceção é o <strong>debate</strong> — ele trava
          todo mundo na mesma tela, de propósito.
        </p>
      </Card>

      <Card variant="outlined" title="Roteiro (2 aulas / 100 min)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="text-[12px] text-unooria-neutral-500">
                <th className="w-20 py-2 font-semibold">Tempo</th>
                <th className="py-2 font-semibold">Momento</th>
                <th className="w-44 py-2 font-semibold">Seu botão</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {[
                [
                  "0–5",
                  "Enquadramento da missão e login dos alunos.",
                  "Começar investigação",
                ],
                [
                  "5–25",
                  "Investigação individual. Diga em voz alta a única instrução que importa: “salvem os posts que vão ajudar vocês a responder”. Enquanto eles rolam, o monitor mostra em tempo real quem salvou o quê — clique em qualquer aluno e abre o aparelho dele num popup. Fique de olho no alerta de ocioso: é o único que pede ação sua na hora.",
                  "—",
                ],
                [
                  "25–30",
                  "A resposta. Quando o monitor mostrar a maioria com coleção formada, encerre. Cada aluno escolhe um dos três lados; ninguém escreve nada ainda.",
                  "Encerrar investigação",
                ],
                [
                  "30–45",
                  "Debate. As telas travam na coleção de cada um. Projete a pergunta-chave e peça que defendam a resposta usando os posts que salvaram. Quem está em dúvida fala por último. Você ainda não revelou nada — e é isso que faz funcionar: dois alunos citam posts diferentes sobre o mesmo tema e a sala estranha sozinha.",
                  "Iniciar debate",
                ],
                [
                  "45–47",
                  "Momento-espelho. Antes de liberar a explicação: “quem respondeu A, levanta a mão”. Depois: “e quem viu mais posts defendendo A?”. A correlação aparece a olho nu, e está medida na aba de análise.",
                  "—",
                ],
                [
                  "47–60",
                  "Explicação + relatório individual, no ritmo de cada um: por que o feed dele começou daquele lado, o que prendeu a atenção dele, e a resposta que ele deu.",
                  "Encerrar debate",
                ],
                [
                  "60–68",
                  "O que eles perderam. O feed volta em cinza, só com o que nunca chegou. Um minuto de silêncio olhando o número vale mais que qualquer explicação sua.",
                  "Mostrar o que perderam",
                ],
                [
                  "68–80",
                  "Duplas de bolhas opostas: relatório comparativo (abaixo). Use o monitor para formar as duplas — ele mostra quem recebeu qual lado.",
                  "—",
                ],
                [
                  "80–88",
                  "Socialização + conexão com a disciplina: história/ciência é disputa de narrativa; o algoritmo escolheu a sua — e escolheu como te falar.",
                  "—",
                ],
                [
                  "88–100",
                  "Reflexão escrita individual (sem limite de caracteres) + combinados para “furar a bolha”.",
                  "Abrir reflexão",
                ],
              ].map(([tempo, momento, botao]) => (
                <tr key={tempo} className="border-t border-unooria-neutral-200">
                  <td className="py-2.5 pr-3 font-semibold text-unooria-neutral-950">
                    {tempo}
                  </td>
                  <td className="py-2.5 pr-3 leading-relaxed text-unooria-neutral-800">
                    {momento}
                  </td>
                  <td className="py-2.5 text-[13px] font-semibold text-unooria-primary-700">
                    {botao}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-unooria-neutral-500">
          O bloco de feed é de 18 min / 60 posts, com <strong>piso de 8 min</strong>
          : rolagem muito rápida não encerra a sessão antes disso. A missão é
          investigativa, e investigar leva mais segundos por post que passar o
          tempo. Outro “8” aparece na análise e não se confunde com esse: só entra
          na <strong>média de imersão</strong> quem viu 8 posts ou mais — o
          relatório fecha para todo mundo, inclusive para quem viu menos.
        </p>
      </Card>

      <Card
        variant="outlined"
        title="Relatório comparativo (entregável do aluno)"
      >
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
          <li>
            O que UM viu que o OUTRO nunca viu? (usem a tela cinza dos posts
            perdidos)
          </li>
          <li>
            Como duas pessoas na mesma sala saíram com versões diferentes do
            mesmo tema?
          </li>
          <li>
            Quais comportamentos de vocês o algoritmo usou? Expliquem com suas
            palavras.
          </li>
          <li>
            Olhem a “escalada”: o que aconteceu com o tom dos posts ao longo do
            feed? Por quê?
          </li>
          <li>
            Comparem o <strong>lado inicial</strong> de cada um com a{" "}
            <strong>resposta</strong> que cada um deu. O lado que vocês
            receberam influenciou? Como vocês sabem?
          </li>
          <li>
            Olhem a seção “o jeito de falar com você”. O que mais prendeu cada um:
            descoberta, justiça, mérito ou segurança? Vocês receberam o mesmo
            argumento escrito de jeitos diferentes — isso muda algo no que
            concluíram?
          </li>
          <li>Onde isso acontece na vida real de vocês? 1 exemplo cada.</li>
          <li>Duas atitudes práticas para furar a bolha a partir de amanhã.</li>
        </ol>
      </Card>

      <Card variant="outlined" title="Cuidados">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
          <li>
            Nunca avaliar o “lado” em que o aluno caiu; avaliar a análise.
          </li>
          <li>
            <strong>O perfil de valores não é rótulo de aluno.</strong> Não usar
            como apelido, categoria de turma, nota ou adjetivo (“o competitivo”,
            “a que se importa com os outros”). É o que o jogo captou naquele dia,
            e a divergência entre o jogo e o feed é dado interessante — não erro
            de ninguém.
          </li>
          <li>
            Reforçar: todos caem em bolhas, inclusive adultos — o exercício mede
            o poder do sistema, não a inteligência de ninguém.
          </li>
          <li>
            Deixar explícito que perfis e posts foram gerados por IA para a
            atividade.
          </li>
          <li>
            Se a turma perguntar por que ninguém avisou: é exatamente a pergunta
            certa. Nenhuma rede social avisa.
          </li>
          <li>
            Se alguém disser “então eu sou o tipo que cai nisso”: corte na hora. O
            perfil não é defeito nem destino — e a prova está na própria sala, nos
            colegas que viraram de lado.
          </li>
        </ul>
      </Card>

      <div>
        <LinkButton href={rotaDaMissao(missao)} variant="outline">
          Voltar para a missão
        </LinkButton>
      </div>
    </div>
  );
}
