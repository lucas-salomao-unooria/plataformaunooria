import { Card, Tag } from "@edu/ui/ds";
import { ROTULO_DO_STATUS, VARIANTE_DO_STATUS } from "@/lib/evidencias";
import { quadranteDe } from "@/lib/quem-mandou-regras";
import {
  ROTULO_DA_LEGENDA,
  ROTULO_DO_QUADRANTE,
  ROTULO_DO_TIPO,
  ROTULO_DO_TIPO_DE_ACAO,
  type MaterialDoProfessor,
} from "@/lib/quem-mandou-tipos";

/**
 * BLOCO VIVO do guia da exp05ef1b: o banco curado COM o gabarito, a fala da
 * Nina, o roteiro da roda de conversa, e as duas ações de evidência por dentro
 * — os quatro pedidos do alerta do grupo com o filtro esperado, e os blocos do
 * robô do grupo com o que cada um faz e as quatro mensagens que ele recebe.
 *
 * Vem de `GET /quem-mandou-isso/professor/material` (professor e gestão). Nada
 * disto é texto do guia de propósito: descrever as mensagens em vez de
 * mostrá-las apaga o que sustenta a lição — **a falsa NÃO parece malfeita e a
 * verdadeira NÃO parece profissional** — e uma cópia do roteiro ou das
 * perguntas é a que diverge na primeira revisão de copy da api.
 *
 * Duas ressalvas que a tela diz em voz alta: este é o BANCO CURADO (a turma que
 * recebeu um pacote gerado para o tema da professora leu outras oito — estão
 * em A aula e os resultados — e o alerta opera sobre as oito DELES), e a
 * criança nunca vê o filtro esperado nem o tipo de cada bloco.
 */
export function QuemMandouOPacote({ dados }: { dados: MaterialDoProfessor | null }) {
  if (!dados) {
    return (
      <div className="guia-bloco">
        <Card variant="outlined" title="O pacote e o roteiro não carregaram">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Atualize esta página antes da aula. O debate desta missão parte das mensagens que a turma
            leu na tela e das três perguntas do roteiro — conduzi-lo de memória troca as palavras que
            fizeram cada um encaminhar.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="guia-bloco guia-bloco--longo flex flex-col gap-4">
      <Card variant="elevated" title="Roda de Conversa — Roteiro de Perguntas">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          <p className="text-[13px] text-unooria-neutral-600">
            As mesmas que o painel da aula mostra depois da revelação. De 5 a 7 minutos.
          </p>
          <ul className="flex flex-col gap-2 text-[15px] text-unooria-neutral-950">
            {dados.roteiro.perguntas.map((pergunta) => (
              <li key={pergunta}>{pergunta}</li>
            ))}
          </ul>
          <p className="text-[13px]">
            <strong className="text-unooria-neutral-950">Liberar Revelação:</strong>{" "}
            {dados.roteiro.instrucoes.revelacao}
          </p>
          <p className="text-[13px]">
            <strong className="text-unooria-neutral-950">Liberar Reflexão:</strong>{" "}
            {dados.roteiro.instrucoes.reflexao}
          </p>
        </div>
      </Card>

      <Card variant="elevated" title={`O pacote curado e o gabarito — só para você`}>
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          <strong>Não projete esta lista e não a entregue impressa à turma.</strong> Leia antes para
          conduzir: a falsa neutra tem cara de comunicado oficial, e a verdadeira emocional parece
          exagero. São duas mensagens de cada quadrante, e a imagem e o link têm uma verdadeira e uma
          falsa cada — o formato não entrega a resposta.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-unooria-neutral-600">
          Este é o banco curado da Unooria, “{dados.padrao.nome}”. <strong>Se você aprovou um pacote
          gerado para o tema da sua turma</strong>, o que ela leu não é isto — está em A aula e os
          resultados, e é de lá que você conduz.
        </p>

        <p className="mt-4 text-[13px] font-semibold text-unooria-neutral-950">A fala da Nina, na abertura</p>
        <blockquote className="mt-1 border-l-2 border-unooria-neutral-300 pl-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          {dados.padrao.convite}
        </blockquote>

        <ol className="mt-4 flex flex-col gap-3">
          {dados.padrao.mensagens.map((m, indice) => (
            <li key={m.id} className="rounded-lg border border-unooria-neutral-200 p-3" data-mensagem={m.id}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  {indice + 1}ª · {m.remetente} · {ROTULO_DO_TIPO[m.tipo]}
                </span>
                <Tag variant={m.veracidade === "verdadeira" ? "success" : "danger"} size="sm" pill>
                  {ROTULO_DO_QUADRANTE[quadranteDe(m)]}
                </Tag>
              </span>
              <p className="mt-1 text-[15px] leading-relaxed text-unooria-neutral-950">{m.texto}</p>
              {m.tipo !== "texto" && m.legenda ? (
                <p className="mt-1 text-[13px] leading-relaxed text-unooria-neutral-700">
                  <span className="text-unooria-neutral-500">{ROTULO_DA_LEGENDA[m.tipo]}:</span> {m.legenda}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>

      <Card variant="elevated" title="Depois dos crachás: o alerta do grupo (EF05CO03)">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          <p>
            Logo abaixo dos crachás, o Mural mostra as oito mensagens com os dois crachás de cada uma e
            quatro pedidos, um por vez. Para cada pedido, a criança monta um filtro com os chips Falsa e
            Emocional, o NÃO antes de cada um e o E ou o OU entre eles, toca Ver resultado (até{" "}
            {dados.alerta.execucoes} vezes) e envia o alerta ao grupo. A tela destaca quem passou, sem dizer
            se está certo. <strong>Os alertas fecham quando você aperta Apresentar Síntese.</strong>
          </p>
          <ol className="flex flex-col gap-2" data-pedidos-do-alerta>
            {dados.alerta.pedidos.map((p) => (
              <li key={p.n} className="rounded-lg border border-unooria-neutral-200 p-3 text-[13px]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  Alerta {p.n} de {dados.alerta.pedidos.length}
                </span>
                <p className="mt-1 text-[14px] text-unooria-neutral-950">{p.texto}</p>
                <p className="mt-1">
                  <span className="text-unooria-neutral-500">Filtro esperado:</span>{" "}
                  <strong>{p.emPalavras}</strong>{" "}
                  <span className="text-unooria-neutral-500">
                    (no banco curado, {p.passamNoPadrao} {p.passamNoPadrao === 1 ? "mensagem passa" : "mensagens passam"})
                  </span>
                </p>
              </li>
            ))}
          </ol>
          <p className="text-[12px] text-unooria-neutral-500">
            Vale também a ordem trocada (“Emocional E Falsa”): o que conta é o que o filtro destaca. Cada
            alerta vale 2 pontos se o primeiro Ver resultado já tinha o filtro certo e 1 se a criança chegou
            a ele depois de ver o resultado.
          </p>
        </div>
      </Card>

      <Card variant="elevated" title="O fim da missão: o robô do grupo (EF05CO04)">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          <p>
            Quando você aperta Liberar Reflexão, cada criança monta, com blocos, o robô do grupo: o laço{" "}
            {dados.robo.laco.icone} “{dados.robo.laco.rotulo}” (opcional, não vem montado), “SE a mensagem
            for…”, “ENTÃO o robô…” e “E DEPOIS…”. Ela liga o robô e vê as quatro mensagens chegando, com o
            robô agindo em cada uma — sem o laço, ele só olha a primeira. Pode mudar e ligar de novo (até{" "}
            {dados.robo.ligacoes} vezes), mas o nível olha a primeira vez que ela ligou.
          </p>
          <blockquote className="border-l-2 border-unooria-neutral-300 pl-3 text-[14px] text-unooria-neutral-800">
            {dados.textos.tio}
          </blockquote>
          <p className="text-[13px] font-semibold text-unooria-neutral-950">As quatro mensagens que o robô recebe</p>
          <ol className="flex flex-col gap-1 text-[13px]" data-mensagens-do-robo>
            {dados.robo.mensagens.map((m) => (
              <li key={m.id}>
                <strong>{m.remetente}</strong>
                {m.tipo === "audio" ? " (áudio)" : ""}: “{m.texto}” —{" "}
                <span className="text-unooria-neutral-500">
                  {m.atributos.length === 0
                    ? "sem sinais de alerta (a de controle)"
                    : m.atributos
                        .map((a) => dados.robo.condicoes.find((c) => c.id === a)?.rotulo ?? a)
                        .join(" · ")}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[13px] font-semibold text-unooria-neutral-950">As condições (SE a mensagem for…)</p>
          <ul className="flex flex-col gap-1 text-[13px]">
            {dados.robo.condicoes.map((c) => (
              <li key={c.id}>
                <span aria-hidden="true">{c.icone}</span> {c.rotulo} —{" "}
                <span className="text-unooria-neutral-500">{c.pegaOTio ? "pega o áudio do tio" : "deixa o áudio do tio passar"}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] font-semibold text-unooria-neutral-950">As ações (ENTÃO o robô… / E DEPOIS…)</p>
          <ul className="flex flex-col gap-1 text-[13px]">
            {dados.robo.acoes.map((a) => (
              <li key={a.id}>
                <span aria-hidden="true">{a.icone}</span> {a.rotulo} —{" "}
                <span className="text-unooria-neutral-500">{ROTULO_DO_TIPO_DE_ACAO[a.tipo]}</span>
              </li>
            ))}
          </ul>
          {dados.habilidades.map((h) => (
            <section key={h.codigo} className="rounded-lg border border-unooria-neutral-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                {h.codigo} · {h.rotulo}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {(["atingiu", "em_processo", "nao_atingiu"] as const).map((nivel) => (
                  <li key={nivel} className="flex flex-wrap items-start gap-2 text-[13px]">
                    <Tag variant={VARIANTE_DO_STATUS[nivel]} size="sm">
                      {ROTULO_DO_STATUS[nivel]}
                    </Tag>
                    <span className="flex-1">{h.criterios[nivel]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-[12px] text-unooria-neutral-500">
            Quem não faz uma das ações fica “Não avaliado” nela, e você pode ajustar no painel de habilidades.
          </p>

          <p>
            <span className="text-unooria-neutral-500">O encerramento da Nina:</span> {dados.textos.encerramento}
          </p>
          <p className="text-[13px]">
            <span className="text-unooria-neutral-500">As opções da enquete do Mural:</span>{" "}
            {dados.opcoes.motivos.map((m) => m.rotulo).join(" · ")}
          </p>
        </div>
      </Card>
    </div>
  );
}
