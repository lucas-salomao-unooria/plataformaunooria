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
 * — um cartão de frases já respondido e as peças da regra do tio com o que
 * cada uma faz.
 *
 * Vem de `GET /quem-mandou-isso/professor/material` (professor e gestão). Nada
 * disto é texto do guia de propósito: descrever as mensagens em vez de
 * mostrá-las apaga o que sustenta a lição — **a falsa NÃO parece malfeita e a
 * verdadeira NÃO parece profissional** — e uma cópia do roteiro ou das
 * perguntas é a que diverge na primeira revisão de copy da api.
 *
 * Duas ressalvas que a tela diz em voz alta: este é o BANCO CURADO (a turma que
 * recebeu um pacote gerado para o tema da professora leu outras oito — estão
 * em A aula e os resultados), e cada criança recebe o cartão com as frases das
 * TRÊS mensagens dela, sem a resposta.
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

      <Card variant="elevated" title="Depois dos crachás: o cartão de frases (EF05CO03)">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          <p>
            Junto com os crachás, cada criança recebe no Mural seis frases sobre as três mensagens que ela
            encaminhou, com E, OU e NÃO, e marca Sim (a frase está certa) ou Não. Os crachás dão o valor de
            cada mensagem; a frase pede a operação sobre eles. Quem ainda não respondeu quando você libera
            a reflexão responde antes da regra do tio.
          </p>
          <p className="text-[13px] text-unooria-neutral-600">
            <span className="text-unooria-neutral-500">A fala da Nina:</span> {dados.textos.cartao}
          </p>
          <ul className="flex flex-col gap-2" data-cartao-de-exemplo>
            {dados.cartao.exemplo.map((frase) => (
              <li key={frase.texto} className="flex flex-wrap items-start gap-2 text-[13px]">
                <Tag variant={frase.esperado === "sim" ? "success" : "danger"} size="sm">
                  {frase.esperado === "sim" ? "Sim" : "Não"}
                </Tag>
                <span className="flex-1">{frase.texto}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-unooria-neutral-500">
            Um exemplo com três mensagens do banco curado. Metade das frases é certa e metade é errada: quem
            responde tudo igual acerta só três. A criança nunca vê a resposta.
          </p>
        </div>
      </Card>

      <Card variant="elevated" title="O fim da missão: a regra do tio (EF05CO04)">
        <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-unooria-neutral-800">
          <p>
            Quando você aperta Liberar Reflexão, cada criança monta uma regra com peças, “SE a mensagem for…
            ENTÃO eu… E DEPOIS…”, diz o que acha que a regra vai fazer com o áudio do tio e só então testa.
            Prever antes de ver é a simulação que a habilidade pede. Ela pode mudar e testar de novo, mas o
            nível olha a primeira regra testada e a primeira previsão.
          </p>
          <blockquote className="border-l-2 border-unooria-neutral-300 pl-3 text-[14px] text-unooria-neutral-800">
            {dados.textos.tio}
          </blockquote>
          <p className="text-[13px] font-semibold text-unooria-neutral-950">As condições (SE a mensagem for…)</p>
          <ul className="flex flex-col gap-1 text-[13px]">
            {dados.regra.condicoes.map((c) => (
              <li key={c.id}>
                {c.rotulo} — <span className="text-unooria-neutral-500">{c.pegaOAudio ? "pega o áudio do tio" : "deixa o áudio passar"}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] font-semibold text-unooria-neutral-950">As ações (ENTÃO eu… / E DEPOIS…)</p>
          <ul className="flex flex-col gap-1 text-[13px]">
            {dados.regra.acoes.map((a) => (
              <li key={a.id}>
                {a.rotulo} — <span className="text-unooria-neutral-500">{ROTULO_DO_TIPO_DE_ACAO[a.tipo]}</span>
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
