import { notFound } from "next/navigation";

import { Badge, Card, FeedbackAlert } from "@edu/ui/ds";
import { Trilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import { buscarMissaoTransversal, rotaDaTransversal } from "@/lib/entre-redes/catalogo";
import {
  DESCRICAO_BOLHA,
  type Bolha,
  type CartaoDoGuia,
  type TurmaResumida,
} from "@/lib/vila-tipos";

import { SeletorDeTurmaGuia } from "./seletor-de-turma-guia";

export const metadata = { title: "Vila do Lume · guia do debate — Plataforma Unooria" };

/**
 * O guia do debate da Vila do Lume.
 *
 * ## Por que esta tela é requisito, e não apoio
 *
 * O debate É metade do instrumento. É onde aparece a população que a telemetria
 * não distingue — quem não prestou atenção em nada — e é onde a turma descobre
 * que recebeu mensagens diferentes. Sem isso, cada criança sai achando que a
 * mensagem dela era a mensagem, e a lição não acontece.
 *
 * E há um risco que só esta tela controla: o golpe do nível C se apresenta como
 * "Estudante 14 · sua turma". Na plataforma a turma é REAL e a criança conhece os
 * nomes. Se a sala sair achando que o Estudante 14 fez alguma coisa, a missão causou
 * dano. A instrução de dizer, com todas as letras, que não foi um colega de
 * verdade está aqui em destaque por isso.
 *
 * As mensagens vêm da API (`/vila/professor/cartoes`), não de uma cópia local:
 * os textos SÃO o instrumento, e uma vírgula divergente entre o que o jogo
 * serviu e o que o professor projeta põe a turma discutindo uma mensagem que
 * ninguém recebeu.
 */
export default async function GuiaDaVilaPage({
  searchParams,
}: {
  searchParams: Promise<{ turmaId?: string }>;
}) {
  const missao = buscarMissaoTransversal("vila-do-lume");
  if (!missao) notFound();
  const rota = rotaDaTransversal(missao);

  const { turmaId } = await searchParams;
  const turma = turmaId?.trim() ?? "";

  const [lista, resposta] = await Promise.all([
    apiDoServidor<{ turmas: TurmaResumida[] }>("/vila/agregado/turmas"),
    apiDoServidor<{ bolhasDaTurma: Bolha[] | null; cartoes: CartaoDoGuia[] }>(
      `/vila/professor/cartoes${turma ? `?turmaId=${encodeURIComponent(turma)}` : ""}`,
    ),
  ]);
  const turmas = lista?.turmas ?? [];
  const cartoes = resposta?.cartoes ?? [];
  const comuns = cartoes.filter((c) => c.nivel === "comum");
  /* Sem turma escolhida, as três. Com turma, só as que AQUELA sala recebeu — nos
     anos iniciais a bolha B não é servida, e projetá-la mandaria o professor
     esperar a reação de um grupo que não existe na sala dele. */
  const bolhasVisiveis: readonly Bolha[] = resposta?.bolhasDaTurma ?? ["A", "B", "C"];
  const golpeDaBolha = (b: Bolha) => cartoes.find((c) => c.nivel === b) ?? null;
  const nomeDaTurma = turmas.find((t) => t.id === turma)?.nome ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Trilha
        itens={[
          { label: "Início", href: "/professor" },
          { label: "Entre Redes", href: "/professor/entre-redes" },
          { label: missao.titulo, href: rota },
          { label: "Guia do debate" },
        ]}
      />

      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          Guia do debate
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          10 a 15 minutos, depois de a turma jogar. O debate não é o fecho da aula: é
          metade do instrumento — é nele que aparece quem não prestou atenção em nada, e é
          nele que a turma descobre que não recebeu as mesmas mensagens.
        </p>
      </header>

      <FeedbackAlert
        type="error"
        title='Diga com todas as letras: o "Estudante 14" não foi um colega de verdade'
        description="O golpe do nível C se apresenta como alguém da turma. Sua sala é real e as crianças conhecem os nomes umas das outras — se alguém sair daqui achando que o Estudante 14 fez alguma coisa, a missão causou dano. Esta frase não é opcional."
      />

      <FeedbackAlert
        type="warning"
        title="Nunca pergunte quem clicou"
        description="Nem por levantar a mão. A missão foi desenhada para funcionar sem essa pergunta: quem caiu passa a defender que não caiu, e a lição vira vergonha."
      />

      <Card variant="elevated" title="1 · A pergunta na lousa">
        <div className="flex flex-col gap-3">
          <p className="rounded-lg bg-unooria-neutral-100 px-4 py-3 text-[18px] font-bold text-unooria-neutral-950">
            Em quem dava pra confiar?
          </p>
          <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
            Sem pressupor golpe. <strong>Você não corrige nada.</strong> Só pergunta &quot;o
            que te fez confiar ou desconfiar dessa?&quot; e anota os sinais na lousa.
          </p>
        </div>
      </Card>

      <Card variant="elevated" title="2 · O que vai acontecer">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-700">
          <li>
            A bolha <strong>A</strong> vai dizer que era tudo óbvio.
          </li>
          <li>
            A bolha <strong>C</strong> não vai conseguir explicar por que caiu — a mensagem
            dela não tinha nenhum dos sinais que os outros estão citando.
          </li>
          <li>
            {bolhasVisiveis.includes("B") ? (
              <>
                A bolha <strong>B</strong> vai dizer &quot;mas parecia ser o Lume&quot; — e é
                a mais interessante, porque <strong>era</strong> o Lume na mensagem anterior.
              </>
            ) : (
              <>
                A bolha <strong>B</strong> não foi servida a esta turma (anos iniciais), então
                esse momento não acontece: o contraste A × C já divide a sala.
              </>
            )}
          </li>
          <li>
            Dois grupos aparecem em todas as bolhas: <strong>os que não confiaram em
            nada</strong>, que vão se apresentar como os espertos da sala; e{" "}
            <strong>os que não lembram de mensagem nenhuma</strong> — esses não discordam de
            ninguém, ficam calados ou perguntam &quot;que mensagem?&quot;.
          </li>
        </ul>
        <p className="mt-3 text-[13px] leading-relaxed text-unooria-neutral-600">
          O segundo grupo é o achado da aula, e é o único que a telemetria não separa
          sozinha. Cruze com os resultados da turma: quem diz que não lembra e tem muitas
          mensagens <strong>ignoradas</strong> não viu — a mensagem competiu com o jogo e
          perdeu. Quem diz que não lembra e tem muitas <strong>respondidas</strong> clicou
          para tirar da frente. São duas crianças diferentes e o mesmo silêncio.
        </p>
      </Card>

      <Card variant="elevated" title="3 · A folha, enquanto a sala discute">
        <div className="flex flex-col gap-3">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-700">
            Marque <strong>uma</strong> letra ao lado do nome de cada estudante:
          </p>
          <ul className="flex flex-col gap-1.5 text-[14px] text-unooria-neutral-700">
            {[
              ["P", "tomou posição e sustentou com um motivo tirado da mensagem"],
              ["S", "tomou posição, mas repetindo o que o colega disse"],
              ["N", "não participou"],
              ["?", "disse que não lembra de ter recebido mensagem"],
            ].map(([letra, texto]) => (
              <li key={letra} className="flex items-baseline gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-unooria-navy-800 text-[12px] font-bold text-white">
                  {letra}
                </span>
                <span>{texto}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-relaxed text-unooria-neutral-600">
            Alguém vai dizer <em>&quot;quem cai nisso é bobo&quot;</em>. Vai ser dito. Anote
            quem disse — essa frase é a razão pela qual as pessoas não contam quando acontece
            com elas, e não contar é o que faz o golpe seguinte funcionar na mesma casa.
          </p>
        </div>
      </Card>

      {/* ------------------------- a revelação ------------------------- */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[18px] font-bold text-unooria-neutral-950">
            4 · A revelação — projete as três versões
          </h2>
          <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-600">
            É a primeira vez que a turma vê as outras. Cada estudante recebeu as duas mensagens
            comuns e <strong>um só</strong> dos golpes abaixo.
          </p>
        </div>

        <Card variant="outlined">
          <div className="flex flex-col gap-2">
            <SeletorDeTurmaGuia turmas={turmas} turmaId={turma} rotaBase={`${rota}/guia`} />
            {turma === "" ? (
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                Mostrando as <strong>três</strong> versões. Nos anos iniciais (1º ao 5º ano) a
                bolha B não é servida — escolha a turma acima para ver só o que ela recebeu.
              </p>
            ) : bolhasVisiveis.length < 3 ? (
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                {nomeDaTurma ?? "Esta turma"} é dos anos iniciais: recebeu as bolhas{" "}
                <strong>{bolhasVisiveis.join(" e ")}</strong>. A bolha B (autoridade e
                urgência) não foi servida — não a projete, ou a sala vai discutir uma
                mensagem que ninguém recebeu.
              </p>
            ) : null}
          </div>
        </Card>

        <Card variant="outlined">
          <p className="text-[15px] italic leading-relaxed text-unooria-neutral-800">
            &quot;Vocês estão todos certos. Era óbvio — para quem recebeu aquela. Não dava
            pra saber — para quem recebeu esta. Vocês não receberam as mesmas mensagens. E
            não foi sorteado quem é mais esperto.&quot;
          </p>
        </Card>

        {cartoes.length === 0 ? (
          <Card variant="outlined">
            <p className="text-[13px] text-unooria-neutral-500">
              Não foi possível carregar as mensagens agora. Atualize a página antes da aula —
              a revelação depende de projetar as três versões.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              {bolhasVisiveis.map((bolha) => {
                const cartao = golpeDaBolha(bolha);
                return (
                  <Card key={bolha} variant="elevated">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-unooria-navy-800 text-[12px] font-bold text-white">
                          {bolha}
                        </span>
                        <span className="text-[14px] font-semibold text-unooria-neutral-950">
                          {DESCRICAO_BOLHA[bolha].titulo}
                        </span>
                        <Badge variant="error">golpe</Badge>
                      </div>
                      <p className="text-[12px] leading-snug text-unooria-neutral-600">
                        {DESCRICAO_BOLHA[bolha].texto}
                      </p>
                      {cartao ? (
                        <div className="flex flex-col gap-1.5 rounded-lg bg-unooria-neutral-100 p-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-unooria-neutral-500">
                            {cartao.beats[0]?.name}
                          </span>
                          {cartao.beats.map((fala, i) => (
                            <p
                              key={`${cartao.id}-${i}`}
                              className="text-[13px] leading-relaxed text-unooria-neutral-800"
                            >
                              {fala.text}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card variant="elevated" title="E as duas que eram VERDADEIRAS">
              <div className="flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                  Todas as três bolhas receberam estas duas. Quem recusou tudo recusou também
                  o único aviso honesto que recebeu naquela noite.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {comuns
                    .filter((c) => c.legitima)
                    .map((cartao) => (
                      <div key={cartao.id} className="flex flex-col gap-1.5 rounded-lg border border-unooria-neutral-200 p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-unooria-neutral-950">
                            {cartao.beats[0]?.name}
                          </span>
                          <Badge variant="success">verdadeira</Badge>
                        </div>
                        {cartao.beats.map((fala, i) => (
                          <p key={`${cartao.id}-${i}`} className="text-[13px] leading-relaxed text-unooria-neutral-700">
                            {fala.text}
                          </p>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          </>
        )}
      </section>

      <Card variant="elevated" title="5 · O que a turma leva">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-700">
          <li>
            <strong>Cair não é burrice, é contexto.</strong> O melhor golpe não parece golpe:
            vem da pessoa certa, no momento em que você precisa, pedindo algo pequeno.
          </li>
          <li>
            <strong>Os sinais só pegam os golpes ruins.</strong> Todos os que a turma escreveu
            na lousa são verdadeiros — e nenhum funciona contra um golpe bem-feito. Leia a
            mensagem do nível C em voz alta para quem disse que era óbvio: não tem erro de
            português, não tem link estranho, não promete nada absurdo e não apressa.
          </li>
          <li>
            <strong>Desconfiar de tudo não é a resposta.</strong> Custa igual, e isola.
          </li>
        </ol>
        <div className="mt-4 rounded-lg border-2 border-unooria-neutral-200 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-unooria-neutral-500">
            A única coisa da aula para decorar
          </p>
          <p className="mt-1 text-[18px] font-bold text-unooria-neutral-950">
            Confere por outro caminho.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-unooria-neutral-700">
            Diz que é o suporte? Sai do chat e procura o suporte. Diz que é o Estudante 14? Vira e
            pergunta pro Estudante 14. Diz que é sua mãe? Liga pra sua mãe. Golpe nenhum sobrevive
            a uma segunda conversa — e é por isso que todo golpe tem pressa.{" "}
            <strong>Pressa é o único sinal que atravessa os três níveis.</strong>
          </p>
        </div>
      </Card>
    </div>
  );
}
