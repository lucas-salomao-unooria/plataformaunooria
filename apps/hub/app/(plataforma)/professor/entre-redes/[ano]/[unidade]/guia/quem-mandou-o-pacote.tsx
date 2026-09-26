import { Card, Tag } from "@edu/ui/ds";
import { ROTULO_DO_STATUS, VARIANTE_DO_STATUS } from "@/lib/evidencias";
import { quadranteDe } from "@/lib/quem-mandou-regras";
import {
  ROTULO_DA_LEGENDA,
  ROTULO_DO_QUADRANTE,
  ROTULO_DO_TIPO,
  type MaterialDoProfessor,
} from "@/lib/quem-mandou-tipos";

/**
 * BLOCO VIVO do guia da exp05ef1b: o banco curado COM o gabarito, a fala da
 * Nina, o roteiro da roda de conversa, as falas do fim e as duas perguntas de
 * evidência COM o nível de cada alternativa.
 *
 * Vem de `GET /quem-mandou-isso/professor/material` (professor e gestão). Nada
 * disto é texto do guia de propósito: descrever as mensagens em vez de
 * mostrá-las apaga o que sustenta a lição — **a falsa NÃO parece malfeita e a
 * verdadeira NÃO parece profissional** — e uma cópia do roteiro ou das
 * perguntas é a que diverge na primeira revisão de copy da api.
 *
 * Duas ressalvas que a tela diz em voz alta: este é o BANCO CURADO (a turma que
 * recebeu um pacote gerado para o tema da professora leu outras oito — estão
 * em A aula e os resultados), e as alternativas das perguntas chegam à criança
 * EMBARALHADAS e sem o nível.
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

      <Card variant="elevated" title="O fim da missão: a regra e as duas perguntas da Nina">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          <p>
            <strong className="text-unooria-neutral-950">O desafio do tio</strong>, na tela da Unooria,
            antes da regra Se/Então:
          </p>
          <blockquote className="border-l-2 border-unooria-neutral-300 pl-3">{dados.textos.tio}</blockquote>
          <p className="text-[13px]">
            <span className="text-unooria-neutral-500">O “Se” que a criança escolhe:</span>{" "}
            {dados.opcoes.condicoes.map((c) => c.rotulo).join(" · ")}
          </p>
          <p className="text-[13px]">
            <span className="text-unooria-neutral-500">Ao enviar a regra:</span> {dados.textos.confirmacaoDaRegra}
          </p>

          {dados.perguntasDeEvidencia.map((pergunta) => (
            <section key={pergunta.perguntaId} className="rounded-lg border border-unooria-neutral-200 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                {pergunta.habilidade} · registrada por esta pergunta
              </p>
              <p className="mt-1 text-[13px] text-unooria-neutral-700">{pergunta.fala}</p>
              <p className="mt-1 text-[14px] font-semibold text-unooria-neutral-950">{pergunta.enunciado}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {pergunta.alternativas.map((alternativa) => (
                  <li key={alternativa.id} className="flex flex-wrap items-start gap-2 text-[13px]">
                    <Tag variant={VARIANTE_DO_STATUS[alternativa.status]} size="sm">
                      {ROTULO_DO_STATUS[alternativa.status]}
                    </Tag>
                    <span className="flex-1">{alternativa.texto}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-[12px] text-unooria-neutral-500">
            A criança recebe as alternativas embaralhadas, e nunca o nível. Quem sai antes das perguntas
            fica “Não avaliado” nelas.
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
