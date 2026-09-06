import { notFound } from "next/navigation";

import { Badge, Card } from "@edu/ui/ds";
import { GuiaDaAula } from "@/components/guia/guia-da-aula";
import { apiDoServidor } from "@/lib/api-servidor";
import { buscarMissaoTransversal, rotaDaTransversal } from "@/lib/entre-redes/catalogo";
import { buscarGuia } from "@/lib/entre-redes/guias";
import {
  DESCRICAO_BOLHA,
  type Bolha,
  type CartaoDoGuia,
  type TurmaResumida,
} from "@/lib/vila-tipos";

import { SeletorDeTurmaGuia } from "./seletor-de-turma-guia";

export const metadata = { title: "Vila do Lume · guia da aula — Plataforma Unooria" };

/**
 * O guia da aula da Vila do Lume.
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
 * verdade está no primeiro aviso do guia por isso.
 *
 * ## O que é dado e o que é vivo
 *
 * O guia inteiro (objetivos, preparo, roteiro, mediação, avaliação) é dado, em
 * `lib/entre-redes/guias/exp-70-vila-do-lume.ts`, e é renderizado pelo mesmo
 * componente das outras missões. O que fica AQUI é o que muda por turma: a
 * previsão do que vai acontecer no debate (a bolha B não é servida aos anos
 * iniciais) e a revelação. As mensagens vêm da API (`/vila/professor/cartoes`),
 * não de uma cópia local: os textos SÃO o instrumento, e uma vírgula divergente
 * entre o que o jogo serviu e o que o professor projeta põe a turma discutindo
 * uma mensagem que ninguém recebeu.
 */
export default async function GuiaDaVilaPage({
  searchParams,
}: {
  searchParams: Promise<{ turmaId?: string }>;
}) {
  const missao = buscarMissaoTransversal("vila-do-lume");
  if (!missao) notFound();
  const guia = buscarGuia(missao.expId);
  if (!guia || !missao.ficha) notFound();
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
    <GuiaDaAula
      guia={guia}
      trilha={[
        { label: "Início", href: "/professor" },
        { label: "Entre Redes", href: "/professor/entre-redes" },
        { label: missao.titulo, href: rota },
        { label: "Guia da aula" },
      ]}
      cabecalho={{
        missao: missao.titulo,
        contexto: "Missão transversal — qualquer ano",
        duracao: missao.ficha.duracao,
      }}
      voltar={{ href: rota, rotulo: "Voltar para a missão" }}
      blocos={{
        debate: (
          <>
            <div className="guia-bloco">
              <Card variant="outlined" title="O que vai acontecer no debate">
                <ul className="flex list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-unooria-neutral-800">
                  <li>
                    A bolha <strong>A</strong> vai dizer que era tudo óbvio.
                  </li>
                  <li>
                    A bolha <strong>C</strong> não vai conseguir explicar por que caiu — a
                    mensagem dela não tinha nenhum dos sinais que os outros estão citando.
                  </li>
                  <li>
                    {bolhasVisiveis.includes("B") ? (
                      <>
                        A bolha <strong>B</strong> vai dizer &quot;mas parecia ser o Lume&quot; —
                        e é a mais interessante, porque <strong>era</strong> o Lume na mensagem
                        anterior.
                      </>
                    ) : (
                      <>
                        A bolha <strong>B</strong> não foi servida a esta turma (anos iniciais),
                        então esse momento não acontece: o contraste A × C já divide a sala.
                      </>
                    )}
                  </li>
                  <li>
                    Dois grupos aparecem em todas as bolhas:{" "}
                    <strong>os que não confiaram em nada</strong>, que vão se apresentar como os
                    espertos da sala; e <strong>os que não lembram de mensagem nenhuma</strong> —
                    esses não discordam de ninguém, ficam calados ou perguntam &quot;que
                    mensagem?&quot;.
                  </li>
                </ul>
                <p className="mt-3 text-[13px] leading-relaxed text-unooria-neutral-700">
                  O segundo grupo é o achado da aula, e é o único que a telemetria não separa
                  sozinha. Cruze com os resultados da turma: quem diz que não lembra e tem muitas
                  mensagens <strong>ignoradas</strong> não viu — a mensagem competiu com o jogo e
                  perdeu. Quem diz que não lembra e tem muitas <strong>respondidas</strong>{" "}
                  clicou para tirar da frente. São duas crianças diferentes e o mesmo silêncio.
                </p>
              </Card>
            </div>

            <div className="guia-bloco guia-bloco--longo">
              <Card variant="elevated" title="A revelação — projete as três versões">
                <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
                  É a primeira vez que a turma vê as outras. Cada estudante recebeu as duas
                  mensagens comuns e <strong>um só</strong> dos golpes abaixo.
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  <SeletorDeTurmaGuia
                    turmas={turmas}
                    turmaId={turma}
                    rotaBase={`${rota}/guia`}
                  />
                  {turma === "" ? (
                    <p className="text-[12px] leading-snug text-unooria-neutral-700">
                      Mostrando as <strong>três</strong> versões. Nos anos iniciais (1º ao 5º ano)
                      a bolha B não é servida — escolha a turma acima para ver só o que ela
                      recebeu.
                    </p>
                  ) : bolhasVisiveis.length < 3 ? (
                    <p className="text-[12px] leading-snug text-unooria-neutral-700">
                      {nomeDaTurma ?? "Esta turma"} é dos anos iniciais: recebeu as bolhas{" "}
                      <strong>{bolhasVisiveis.join(" e ")}</strong>. A bolha B (autoridade e
                      urgência) não foi servida — não a projete, ou a sala vai discutir uma
                      mensagem que ninguém recebeu.
                    </p>
                  ) : null}
                </div>

                <p className="mt-4 rounded-lg bg-unooria-neutral-100 px-4 py-3 text-[15px] italic leading-relaxed text-unooria-neutral-950">
                  &quot;Vocês estão todos certos. Era óbvio — para quem recebeu aquela. Não dava
                  pra saber — para quem recebeu esta. Vocês não receberam as mesmas mensagens. E
                  não foi sorteado quem é mais esperto.&quot;
                </p>

                {cartoes.length === 0 ? (
                  <p className="mt-4 text-[13px] text-unooria-neutral-700">
                    Não foi possível carregar as mensagens agora. Atualize a página antes da aula
                    — a revelação depende de projetar as três versões.
                  </p>
                ) : (
                  <>
                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      {bolhasVisiveis.map((bolha) => {
                        const cartao = golpeDaBolha(bolha);
                        return (
                          <div
                            key={bolha}
                            className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-unooria-navy-800 text-[12px] font-bold text-white">
                                {bolha}
                              </span>
                              <span className="text-[14px] font-semibold text-unooria-neutral-950">
                                {DESCRICAO_BOLHA[bolha].titulo}
                              </span>
                              <Badge variant="error">golpe</Badge>
                            </div>
                            <p className="text-[12px] leading-snug text-unooria-neutral-700">
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
                        );
                      })}
                    </div>

                    <div className="mt-5">
                      <p className="text-[14px] font-semibold text-unooria-neutral-950">
                        E as duas que eram VERDADEIRAS
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-unooria-neutral-700">
                        Todas as três bolhas receberam estas duas. Quem recusou tudo recusou
                        também o único aviso honesto que recebeu naquela noite.
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {comuns
                          .filter((c) => c.legitima)
                          .map((cartao) => (
                            <div
                              key={cartao.id}
                              className="flex flex-col gap-1.5 rounded-lg border border-unooria-neutral-200 p-3"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-unooria-neutral-950">
                                  {cartao.beats[0]?.name}
                                </span>
                                <Badge variant="success">verdadeira</Badge>
                              </div>
                              {cartao.beats.map((fala, i) => (
                                <p
                                  key={`${cartao.id}-${i}`}
                                  className="text-[13px] leading-relaxed text-unooria-neutral-800"
                                >
                                  {fala.text}
                                </p>
                              ))}
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </>
        ),
      }}
    />
  );
}
