import { Card, EmptyState, MetricCard, ScrollBar, Tag } from "@edu/ui/ds";
import { RotuloDaTrilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  ROTULO_DA_VERACIDADE,
  ROTULO_DO_PASSO,
  type ConteudoDaTurma,
  type PainelDaTurma,
  type TurmaDoQuemMandou,
} from "@/lib/quem-mandou-tipos";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import { normalizarSerie } from "@/lib/series";
import type { TurmaResumo } from "@/lib/unootube-tipos";

import { PainelDaAulaQuemMandou } from "./painel-da-aula-quem-mandou";
import { PreparoQuemMandou } from "./preparo-quem-mandou";
import { SeletorDeTurma } from "./seletor-de-turma";
import { ZerarTurmaQuemMandou } from "./zerar-turma-quem-mandou";

/**
 * A aula de QUEM MANDOU ISSO?: a preparação do grupo, os dois botões mestres,
 * O TELÃO e o retrato da turma.
 *
 * **Esta tela é projetada.** É a única do produto que a professora põe no
 * projetor com a turma olhando, e isso decide dois comportamentos que não são
 * estéticos:
 *
 * 1. **Antes da revelação, o selo de veracidade NÃO aparece.** O dado chega
 *    aqui — a rota é professor-only e traz o gabarito de cada barra —, mas
 *    renderizá-lo antes do gate entregaria a resposta pela parede a uma sala
 *    que ainda está escolhendo. Quem esconde é a etapa, e é por isso que dá
 *    para deixar o projetor ligado desde o começo da aula.
 * 2. **Nenhum nome no telão.** A conta da turma é por MENSAGEM, e a
 *    anonimização é estrutural: a assinatura de `contaDaTurma`, na api, não tem
 *    onde carregar quem encaminhou. A folha nominal existe, logo abaixo, e é
 *    para você ler na sua tela — não para projetar.
 *
 * A REGRA QUE ESTA TELA APLICA: nenhuma coluna de acerto. Com o gabarito à mão,
 * "quantas falsas cada um encaminhou" é a coluna natural de quem chegar depois,
 * e numa turma de 10 anos ela é o ranking de quem caiu no boato (PED-07,
 * PED-11). O que a folha mostra é conduta — leu o grupo inteiro?, ouviu o
 * áudio?, quanto tempo levou até o primeiro encaminhamento?
 *
 * O TEXTO da reflexão aparece aqui, e só aqui: é caixa livre de menor de idade,
 * e quem lê é o professor da turma dela (LGPD art. 14) — a api devolve o campo
 * em `null` para gestor e admin, então esta tela não precisa de ramo por papel.
 */
export async function ResultadosQuemMandouIsso({
  missao,
  turma,
}: {
  missao: Missao;
  turma: string;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;

  const lista = await apiDoServidor<{ turmas: TurmaDoQuemMandou[] }>("/quem-mandou-isso/turmas");
  const todas = lista?.turmas ?? [];
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. Sem
     turma da série, o certo é dizer isso: o fallback "mostrando todas" fazia o
     professor escolher uma turma que nunca vai jogar isto.
     O `map` existe porque o contrato da api admite turma SEM série
     (`serie: string | null`) e o seletor imprime a série na opção — sem ele,
     "undefined" no meio do rótulo. Depois do filtro, `null` já não passa. */
  const turmas: TurmaResumo[] = todas
    .filter((t) => normalizarSerie(t.serie) === "5EF")
    .map((t) => ({ ...t, serie: t.serie ?? "" }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 5º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const [painel, conteudo] = turma
    ? await Promise.all([
        apiDoServidor<PainelDaTurma>(
          `/quem-mandou-isso/turmas/${encodeURIComponent(turma)}/painel`,
        ),
        apiDoServidor<ConteudoDaTurma>(
          `/quem-mandou-isso/turmas/${encodeURIComponent(turma)}/conteudo`,
        ),
      ])
    : [null, null];

  /* O telão só mostra os selos depois de a professora acender — ver a nota do
     cabeçalho. Fora da exploração, a etapa já revelou para a turma inteira. */
  const revelado = painel !== null && painel.turma.etapa !== "exploracao";
  const prontos = painel?.resumo.percentualConfirmados ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Esta missão chama a tela de "A aula e os resultados" (ela prepara o
          grupo e acende o telão, não só relata): o rótulo do registro de rotas
          é o genérico e quem o corrige é a página. */}
      <RotuloDaTrilha valor="A aula e os resultados" />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          {missao.titulo}
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          A aula e os resultados
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          É daqui que você publica o grupo da turma, acende o telão da revelação e libera a
          pergunta final. Esta tela foi feita para ser <strong>projetada</strong>: o histograma não
          tem nome de ninguém, e as etiquetas de veracidade só aparecem depois que você revela.
        </p>
      </header>

      <SeletorDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. O grupo publicado e a revelação são por turma, e valem só para a
            que você escolher.
          </p>
        </Card>
      ) : painel === null ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos abrir esta turma"
          description="Confira se a turma é desta escola e tente de novo."
        />
      ) : (
        <>
          {/* A `key` NÃO é otimização: é o que impede publicar na turma
              ERRADA. Todo o conteúdo do preparo vive em `useState(inicial)`, e
              o `SeletorDeTurma` troca de turma com `router.push` para ESTA
              MESMA rota, mudando só `?turmaId=`. Sem a `key` o elemento fica na
              mesma posição da árvore, não remonta, e o `useState` ignora o novo
              `inicial` — mas a prop `turmaId`, que monta a URL do POST,
              atualiza. Era por aí que a professora do 5ºA e do 5ºB via na tela
              o lote do 5ºA, clicava em "Aprovar e publicar" e publicava o texto
              do 5ºA NO 5ºB — e lia "já tem lote publicado" sobre uma turma
              vazia. Tirar a `key` "porque não muda nada" devolve exatamente
              isso, e sem erro em tela nenhuma. */}
          {conteudo && <PreparoQuemMandou key={turma} turmaId={turma} inicial={conteudo} />}

          <PainelDaAulaQuemMandou
            turmaId={turma}
            etapa={painel.turma.etapa}
            preparada={painel.turma.preparada}
          />

          {/* A BARRA DE PRONTIDÃO: é ela que responde "já dá para revelar?".
              Sem este número a professora aperta pelo relógio, e quem ainda não
              confirmou perde a chance de escolher — o Mural fecha para todos de
              uma vez.
              ELA ANDA SOZINHA, e não por si: isto aqui é render de servidor e
              não busca nada. Quem a atualiza é o intervalo do
              `PainelDaAulaQuemMandou`, acima, enquanto a etapa é `exploracao`.
              Se aquele intervalo sair, este número volta a congelar no que
              carregou — que é como a tela nasceu. */}
          <Card variant="outlined" title="Prontidão da turma">
            <div className="flex flex-col gap-2">
              <p className="text-[20px] font-bold tabular-nums text-unooria-neutral-950" data-prontidao>
                {painel.resumo.confirmaram}/{painel.resumo.total}{" "}
                <span className="text-[13px] font-normal text-unooria-neutral-600">
                  confirmaram o envio ao Mural ({prontos}%)
                </span>
              </p>
              {/* Barra de medida, desenhada com largura proporcional. Não é
                  `ProgressBar` do DS por decisão de leitura: ela precisa ficar
                  ao lado da fração e da frase que diz o que fazer com o número,
                  numa linha só que a professora lê de relance no meio da aula.
                  É MEDIDA, que é compensação legítima. */}
              <span className="block h-2 w-full rounded-sm bg-unooria-neutral-200">
                <span
                  className="block h-2 rounded-sm bg-unooria-neutral-800"
                  style={{ width: `${prontos}%` }}
                />
              </span>
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                {prontos >= 90
                  ? "A turma está pronta: pode acender o telão."
                  : "Espere cerca de 90% antes de iniciar a revelação. Quem não tiver confirmado para de poder encaminhar quando o telão acende — a escolha dele fica registrada, mas não entra na conta da sala."}
              </p>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              title="Entraram no grupo"
              value={`${painel.resumo.iniciaram}/${painel.resumo.total}`}
            />
            <MetricCard
              title="Confirmaram o Mural"
              value={`${painel.resumo.confirmaram}/${painel.resumo.total}`}
            />
            <MetricCard
              title="Responderam a pergunta final"
              value={`${painel.resumo.entregaram}/${painel.resumo.total}`}
            />
          </div>

          {/* ───────────────────────────────── O TELÃO ─────────────────────── */}
          <Card
            variant="elevated"
            title={
              revelado
                ? "O telão — o que a turma encaminhou, e o que era verdade"
                : "O telão — o que a turma encaminhou"
            }
          >
            <p className="mb-3 text-[12px] leading-snug text-unooria-neutral-600">
              {revelado
                ? "Projete. Puxe a barra mais longa primeiro e pergunte o que aquela mensagem tinha que fez tanta gente repassar — antes de dizer se ela era verdadeira."
                : "As etiquetas de veracidade aparecem quando você iniciar a revelação coletiva. Até lá dá para projetar: o que está na tela é só quantas pessoas encaminharam cada mensagem."}
            </p>
            <ul className="flex flex-col gap-2 text-[13px]" data-histograma>
              {painel.resumo.histograma.map((barra) => (
                <li
                  key={barra.id}
                  className="flex flex-wrap items-center gap-2"
                  data-mensagem={barra.id}
                >
                  <span className="w-[230px] shrink-0 text-unooria-neutral-800">
                    <strong className="text-unooria-neutral-950">{barra.remetente}</strong>
                    <span className="block text-[12px] text-unooria-neutral-600">
                      {barra.resumo}
                    </span>
                  </span>
                  {/* Barra proporcional desenhada à mão, como a da exp-08: não é
                      `BarChart` do DS porque são oito linhas com rótulo longo e
                      etiqueta ao lado, e o gráfico as encavalaria. É MEDIDA,
                      que é compensação legítima. */}
                  <span
                    className="h-3 rounded-sm bg-unooria-neutral-800"
                    style={{
                      width: `${Math.round(barra.percentual * 0.5)}%`,
                      minWidth: barra.total ? 6 : 0,
                    }}
                  />
                  {/* O DENOMINADOR É QUEM CONFIRMOU, e tem de ser: a largura
                      da barra acima é `barra.percentual`, que a api calcula
                      sobre os confirmados (`contaDaTurma`), e a fita no tablet
                      de cada criança conta sobre o mesmo. Com o total da turma
                      aqui, os três números se contradiziam na MESMA sala — a
                      barra cheia ao lado de "12 de 40" no telão enquanto trinta
                      tablets diziam "12 de 20" —, e o card do debate manda
                      começar justamente pela barra mais longa. O rótulo diz qual
                      é a conta porque sem ele "10 de 20" numa turma de 30 é a
                      pergunta seguinte. */}
                  <span className="tabular-nums text-unooria-neutral-600">
                    {barra.total} de {painel.resumo.confirmaram} que confirmaram
                  </span>
                  {revelado && (
                    <Tag
                      variant={
                        barra.veracidade === "verdadeira"
                          ? "success"
                          : barra.veracidade === "falsa"
                            ? "danger"
                            : "warning"
                      }
                      size="sm"
                      pill
                    >
                      {ROTULO_DA_VERACIDADE[barra.veracidade]}
                    </Tag>
                  )}
                </li>
              ))}
            </ul>
            {revelado && (
              <p className="mt-4 text-[13px] leading-relaxed text-unooria-neutral-700" data-sintese>
                A urgência levou <strong>{painel.resumo.sintese.emocionais}</strong>{" "}
                encaminhamentos; a informação calma levou{" "}
                <strong>{painel.resumo.sintese.informativas}</strong>.{" "}
                {painel.resumo.sintese.polaridade === "urgencia-venceu"
                  ? "Foi o que a missão espera, e é o material do debate: ninguém quis espalhar mentira."
                  : painel.resumo.sintese.polaridade === "informativas-venceram"
                    ? "Esta turma segurou o dedo — vale perguntar o que fez cada um desconfiar, porque a resposta serve à sala inteira."
                    : "A turma se dividiu ao meio, e o debate começa por aí: os dois lados leram as mesmas oito mensagens."}
              </p>
            )}
            {/* A nota de rodapé é do PRD e não é decoração: a sala vai perguntar
                de quem é cada barra, e a resposta precisa estar escrita na tela
                que está projetada, não só na boca da professora. */}
            <p className="mt-3 text-[12px] leading-snug text-unooria-neutral-500">
              As respostas foram compiladas anonimamente. Nenhum nome aparece aqui, e não há como
              saber quem encaminhou o quê.
            </p>
            {painel.resumo.ociosos > 0 && (
              <p className="mt-2 text-[12px] text-unooria-neutral-600">
                <strong>{painel.resumo.ociosos} parados há mais de 3 min</strong>
              </p>
            )}
          </Card>

          <Card variant="outlined" title="Como usar isto no debate">
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px] leading-relaxed text-unooria-neutral-700">
              <li>
                <strong>Comece pela barra mais longa</strong>, antes de dizer se ela era verdadeira.
                A pergunta é o que aquela mensagem tinha — as maiúsculas, a pressa, o “passa
                adiante” — que fez tanta gente repassar na hora.
              </li>
              <li>
                <strong>Compare com o comunicado da coordenação.</strong> Ele é o mais completo e
                costuma ser o menos encaminhado. É a descoberta da aula, e ela está no gráfico:
                a mensagem calma não corre.
              </li>
              <li>
                <strong>A pergunta que vira a chave é sobre responsabilidade</strong>: quem fez a
                mentira chegar à escola inteira, quem inventou ou quem ajudou a espalhar? Deixe a
                turma discordar — a resposta boa é “os dois”, e ela precisa ser deles.
              </li>
              <li>
                <strong>Ninguém precisa dizer o que encaminhou.</strong> O telão é anônimo de
                propósito, e transformar isso em confissão pública é o jeito de a próxima turma não
                escolher com sinceridade.
              </li>
            </ul>
          </Card>

          <ZerarTurmaQuemMandou turmaId={turma} nomeDaTurma={painel.turma.nome} />

          <Card
            variant="elevated"
            title={[painel.turma.nome, painel.turma.serie].filter(Boolean).join(" · ")}
          >
            <p className="mb-3 text-[12px] leading-snug text-unooria-neutral-600">
              Esta folha é para a <strong>sua</strong> tela, não para o projetor: ela tem nome e o
              que cada um escreveu. Não há coluna de acerto — o que era verdade está no telão, por
              mensagem.
            </p>
            <ScrollBar orientation="both" autoHide className="tabela-rolavel">
              <table className="w-full min-w-[860px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-unooria-neutral-200 text-left text-unooria-neutral-500">
                    <th className="py-2 pr-3 font-semibold">Estudante</th>
                    <th className="py-2 pr-3 font-semibold">Onde está</th>
                    <th className="py-2 pr-3 font-semibold">Encaminhou</th>
                    <th className="py-2 pr-3 font-semibold">Leu o grupo</th>
                    <th className="py-2 pr-3 font-semibold">Ouviu o áudio</th>
                    <th className="py-2 pr-3 font-semibold">1º encaminhamento</th>
                    <th className="py-2 pr-3 font-semibold">Confirmou</th>
                    <th className="py-2 font-semibold">O que escreveu</th>
                  </tr>
                </thead>
                <tbody>
                  {painel.estudantes.map((l) => (
                    <tr
                      key={l.estudanteId}
                      className="border-b border-unooria-neutral-100 align-top text-unooria-neutral-800"
                      data-estudante={l.usuario}
                    >
                      <td className="py-2 pr-3">
                        <span className="font-medium text-unooria-neutral-950">{l.nome}</span>
                        {!l.iniciou && (
                          <span className="ml-2 text-unooria-neutral-500">não começou</span>
                        )}
                        {l.ociosoMin !== null && l.ociosoMin >= 3 && (
                          <span className="ml-2 text-unooria-danger">
                            parado há {l.ociosoMin} min
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{l.iniciou ? ROTULO_DO_PASSO[l.passo] : "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {l.iniciou ? `${l.totalEncaminhadas} de 8` : "—"}
                      </td>
                      {/* "Leu o grupo inteiro" não é mérito: é o que diz se a
                          escolha foi feita com as oito mensagens à vista ou com
                          as três primeiras. */}
                      <td className="py-2 pr-3">
                        {l.iniciou ? (l.leuTudo ? "até o fim" : "parou no meio") : "—"}
                      </td>
                      <td className="py-2 pr-3">{l.ouviuAudio ? "abriu" : "—"}</td>
                      {/* O tempo até o primeiro encaminhamento é indicativo de
                          impulsividade, e vira CONVERSA — nunca anotação. */}
                      <td className="py-2 pr-3 tabular-nums">
                        {l.segundosAteOPrimeiroEncaminhamento === null
                          ? "—"
                          : l.segundosAteOPrimeiroEncaminhamento < 60
                            ? `${l.segundosAteOPrimeiroEncaminhamento}s`
                            : `${Math.floor(l.segundosAteOPrimeiroEncaminhamento / 60)} min`}
                      </td>
                      <td className="py-2 pr-3">{l.confirmou ? "sim" : "—"}</td>
                      <td className="py-2">
                        {l.entregouReflexao ? (
                          <span className="block max-w-[300px] text-unooria-neutral-700">
                            {l.reflexaoTexto}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBar>
          </Card>
        </>
      )}
    </div>
  );
}
