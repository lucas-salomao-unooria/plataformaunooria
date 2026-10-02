import { useEffect, useState } from "react";
import { Button, Card, CardContent, NEWS_MEDIUM_LABELS, RadioGroup, ScrollBar, SectionHeader } from "@edu/ui/ds";
import { rotas, reportarErro, tipoDaFalha } from "../../lib/api";
import { gravarMemoria, lerMemoria } from "../../lib/memoria";
import { separarEnunciado } from "../../lib/regras";
import { telemetria } from "../../lib/telemetria";
import { E6 } from "../../lib/textos";
import type { IdDaPergunta, Pergunta } from "../../lib/tipos";
import { MensagemEncaminhada } from "../pecas/mensagem-encaminhada";

type Fase = IdDaPergunta | "sintese";

interface PerguntaNaTela {
  id: IdDaPergunta;
  pergunta: string;
  alternativas: Pergunta["alternativas"];
}

/**
 * E6 — o desafio individual, FORA da redação e sem o Bento (PRD §5, Etapa 6):
 * a Unooria fala, numa tela limpa da seção `unooria`. A única peça de outra
 * seção é o boato, e ele é o que a missão quer que a criança reconheça fora da
 * escola: uma mensagem ENCAMINHADA — o `MessageBubble` do `unoochat`
 * (ADR-117, ADR-136), no mesmo contêiner lavanda da gaveta.
 *
 * **As perguntas são as da ficha da E14**, pelas rotas genéricas de
 * `/evidencias/exp04ef1b/perguntas/p1|p2` (molde: as enquetes da exp07ef1b). O
 * enunciado de P1 traz o boato, o detalhe e a pergunta separados por linha em
 * branco (`regras.ts#separarEnunciado`); as alternativas saem NA ORDEM QUE A API
 * DEVOLVE (ela embaralha a cada leitura), e a tela responde pelo `id`, nunca
 * pela posição. Cada pergunta é lida UMA vez por tela.
 *
 * **Selecionar não envia.** O `RadioGroup` muda a seleção com as setas do
 * teclado; enviar na mudança mandaria a alternativa por onde o foco passou.
 * "Responder" envia, e a resposta é única (a api guarda a primeira).
 *
 * **A síntese é ÚNICA** (decisão): o recibo é `{ enviada: true }` para qualquer
 * alternativa, a criança nunca sabe o nível, e a tela mostra a mesma síntese
 * acolhedora (`e6.feedback.sintese_inicial`) para todos. As outras duas do
 * sheet ("Você comprovou que é um editor responsável…") só fariam sentido se a
 * tela soubesse o nível — e ela não sabe, de propósito.
 *
 * **Pergunta que falha pula para a síntese** (409 `sem-atividade-em-andamento`
 * — o professor zerou a turma —, 404, rede depois da repetição do SDK): a
 * conclusão da missão nunca fica presa numa pergunta.
 */
export function DesafioFinal({
  sessaoId,
  concluindo,
  aoConcluir,
}: {
  sessaoId: string;
  concluindo: boolean;
  aoConcluir: (respondidas: number) => void;
}) {
  const [respostas, setRespostas] = useState<Record<string, string>>(() => lerMemoria(sessaoId).respostas ?? {});
  const [fase, setFase] = useState<Fase>(() => (respostas.p1 ? (respostas.p2 ? "sintese" : "p2") : "p1"));
  const [boato, setBoato] = useState<{ texto: string; detalhe: string | null } | null>(null);
  const [atual, setAtual] = useState<PerguntaNaTela | null>(null);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function pular(erro: unknown) {
    if (tipoDaFalha(erro) === "invalida") reportarErro(erro);
    setFase("sintese");
  }

  /* O boato sai do enunciado de P1 — lido uma vez, mesmo com P1 já respondida
     (depois de um F5, a P2 continua falando "de um aviso desses"). */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const p1 = await rotas.pergunta("p1");
        if (!vivo) return;
        const partes = separarEnunciado(p1.enunciado);
        if (partes.boato) setBoato({ texto: partes.boato, detalhe: partes.detalhe });
        if (fase === "p1") setAtual({ id: "p1", pergunta: partes.pergunta, alternativas: p1.alternativas });
      } catch (erro) {
        if (vivo && fase === "p1") pular(erro);
      }
    })();
    return () => {
      vivo = false;
    };
    // Uma leitura por tela: a fase inicial decide se o P1 vira pergunta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fase !== "p2") return;
    let vivo = true;
    void (async () => {
      try {
        const p2 = await rotas.pergunta("p2");
        if (!vivo) return;
        setAtual({ id: "p2", pergunta: separarEnunciado(p2.enunciado).pergunta, alternativas: p2.alternativas });
      } catch (erro) {
        if (vivo) pular(erro);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [fase]);

  async function responder() {
    if (!atual || !escolha || enviando) return;
    setEnviando(true);
    try {
      await rotas.responder(atual.id, escolha);
      const novas = { ...respostas, [atual.id]: escolha };
      setRespostas(novas);
      gravarMemoria(sessaoId, { respostas: novas });
      telemetria.respondeu(atual.id);
      setEscolha(null);
      setAtual(null);
      setFase(atual.id === "p1" ? "p2" : "sintese");
    } catch (erro) {
      pular(erro);
    } finally {
      setEnviando(false);
    }
  }

  const respondidas = Object.keys(respostas).length;

  return (
    <div className="tela tela--escola">
      <SectionHeader className="tela__topo" variant="mobile" divider title={E6.titulo} />
      <ScrollBar className="rolagem" autoHide>
        <div className="tela__corpo">
          {boato && (
            <figure className="desafio__boato">
              <MensagemEncaminhada remetente={null} texto={boato.texto} rotulo={NEWS_MEDIUM_LABELS.message} />
              {boato.detalhe && <figcaption className="tela__texto">{boato.detalhe}</figcaption>}
            </figure>
          )}

          {fase !== "sintese" && atual && (
            <div className="opcoes-amplas" key={atual.id}>
              <RadioGroup
                name={`pergunta-${atual.id}`}
                label={atual.pergunta}
                size="lg"
                value={escolha ?? ""}
                disabled={enviando}
                options={atual.alternativas.map((a) => ({ value: a.id, label: a.texto }))}
                onChange={(v) => setEscolha(String(v))}
              />
            </div>
          )}

          {fase === "sintese" && (
            <Card>
              <CardContent>
                <p className="tela__texto" role="status">
                  {E6.sintese}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollBar>
      <div className="tela__acao">
        {fase === "sintese" ? (
          <Button size="lg" fullWidth className="acao-crianca" isLoading={concluindo} onClick={() => aoConcluir(respondidas)}>
            {E6.concluir}
          </Button>
        ) : (
          <Button
            size="lg"
            fullWidth
            className="acao-crianca"
            disabled={!atual || escolha === null}
            isLoading={enviando}
            onClick={() => void responder()}
          >
            {E6.responder}
          </Button>
        )}
      </div>
    </div>
  );
}
