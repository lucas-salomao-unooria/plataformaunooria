import { useEffect, useRef, useState } from "react";
import { Button, ChatBubble, Composer, Modal, PromptSuggestion, Tag } from "@edu/ui/ds-unooriaai";
import type { Executar } from "../App";
import { api } from "../lib/api";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { Estado, Manchete, Sessao } from "../lib/tipos";

/** D0-5: o lembrete sutil depois de 90 s sem nenhuma mensagem. */
const INATIVIDADE_MS = 90_000;

type Vista = "chat" | "previa";

/**
 * As Etapas 1 a 3 no UnooriaAI (seção `unooriaai`).
 *
 * O chat abre com a fala do PO (`textos.abertura`, com o tema do pacote) e
 * mostra as três pílulas da copy. O UnooriaAI RESPONDE do servidor: a tela só
 * manda o texto e desenha o que voltar — a IA entende e redige, e quem decide
 * o que muda no post é a api (a conversa híbrida, ADR-181).
 *
 * A resposta leva alguns segundos: o balão do estudante entra NA HORA, com o
 * "Escrevendo…" do UnooriaAI embaixo (um `ChatBubble` do DS, sem componente
 * novo). O campo limpa no envio e o rascunho VOLTA se não entrou — só se o
 * campo continuar vazio (a lição da v0).
 *
 * Em 375 px não cabe painel lateral: a Prévia da Publicação é a OUTRA vista,
 * aberta por "Revisar Publicação". Lá o estudante tira ou devolve um parágrafo
 * e exporta; a manchete é uma janela, e o "Publicar no Unoovista" é o latch.
 */
export function Conversa({ estado, sessao, executar }: { estado: Estado; sessao: Sessao; executar: Executar }) {
  const [vista, setVista] = useState<Vista>("chat");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pendente, setPendente] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [manchete, setManchete] = useState<Manchete | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  const mensagens = estado.conversa.mensagens;
  const gerada = Boolean(estado.previa?.gerada);
  const semMensagens = estado.conversa.restantes === 0;

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, pendente]);

  useEffect(() => {
    if (mensagens.length > 0) return;
    const id = window.setTimeout(() => {
      setNudge(true);
      telemetria.inatividade();
    }, INATIVIDADE_MS);
    return () => window.clearTimeout(id);
  }, [mensagens.length]);

  async function enviar(bruto: string) {
    const t = bruto.trim();
    if (!t || enviando || semMensagens) return;
    setEnviando(true);
    setNudge(false);
    telemetria.mensagem(t.length);
    setPendente(t);
    setTexto("");
    const novo = await executar(() => api.mensagem(t));
    if (!novo) setTexto((atual) => (atual ? atual : t));
    setPendente(null);
    setEnviando(false);
  }

  async function publicar() {
    if (!manchete) return;
    const novo = await executar(() => api.publicar(manchete));
    if (novo) telemetria.publicou(manchete);
  }

  if (vista === "previa") {
    return (
      <main className="uai-tela">
        <header className="uai-topo">
          <span className="uai-topo__titulo">{TEXTOS.previa.titulo}</span>
        </header>
        <section className="uai-previa">
          <p className="uai-previa__instrucao">{TEXTOS.previa.instrucao}</p>
          {!gerada && <p className="uai-previa__vazia">{TEXTOS.previa.vazia}</p>}
          {estado.previa?.paragrafos.map((p) => (
            <article key={p.id} className={`uai-paragrafo${p.removido ? " uai-paragrafo--removido" : ""}`}>
              {p.removido ? <p className="uai-paragrafo__removido">{TEXTOS.previa.removido}</p> : <p className="uai-paragrafo__texto">{p.texto}</p>}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void executar(() => api.paragrafo(p.id, !p.removido))}
              >
                {p.removido ? TEXTOS.previa.devolver : TEXTOS.previa.remover}
              </Button>
            </article>
          ))}
        </section>
        <footer className="uai-rodape">
          <Button variant="outline" onClick={() => setVista("chat")}>
            {TEXTOS.previa.voltar}
          </Button>
          <Button disabled={!gerada} onClick={() => setEscolhendo(true)}>
            {TEXTOS.previa.exportar}
          </Button>
        </footer>
        <Modal open={escolhendo} onClose={() => setEscolhendo(false)} title={TEXTOS.manchete.titulo} closeLabel="Fechar">
          <Modal.Body>
            <p className="uai-manchete__declaracao">{TEXTOS.manchete.declaracao}</p>
            <div className="uai-manchete__opcoes" role="radiogroup" aria-label={TEXTOS.manchete.titulo}>
              {estado.manchetes?.map((m) => (
                <Tag key={m.id} role="radio" aria-checked={manchete === m.id} selected={manchete === m.id} onClick={() => setManchete(m.id)}>
                  {m.texto}
                </Tag>
              ))}
            </div>
            <p className="uai-manchete__audiencia">{TEXTOS.manchete.audiencia}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button block disabled={!manchete} onClick={() => void publicar()}>
              {TEXTOS.manchete.publicar}
            </Button>
          </Modal.Footer>
        </Modal>
      </main>
    );
  }

  return (
    <main className="uai-tela">
      <header className="uai-topo">
        <span className="uai-topo__titulo">{TEXTOS.chat.topo}</span>
        <span className="uai-topo__meta">{TEXTOS.chat.restantes(estado.conversa.restantes)}</span>
      </header>
      <section className="uai-conversa" aria-live="polite">
        {sessao.textos.abertura && <ChatBubble role="assistant">{sessao.textos.abertura}</ChatBubble>}
        {mensagens.map((m, i) => (
          <ChatBubble key={i} role={m.papel === "estudante" ? "user" : "assistant"}>
            {m.texto}
          </ChatBubble>
        ))}
        {pendente && (
          <>
            <ChatBubble role="user">{pendente}</ChatBubble>
            <ChatBubble role="assistant">{TEXTOS.chat.escrevendo}</ChatBubble>
          </>
        )}
        <div ref={fim} />
      </section>
      <footer className="uai-rodape uai-rodape--chat">
        {!semMensagens && (
          <div className="uai-pilulas">
            {sessao.textos.pilulas.map((p) => (
              <PromptSuggestion key={p} as="button" type="button" disabled={enviando} onClick={() => void enviar(p)}>
                {p}
              </PromptSuggestion>
            ))}
          </div>
        )}
        {nudge && mensagens.length === 0 && <p className="uai-nudge">{TEXTOS.chat.nudge}</p>}
        <Composer
          block
          hideLeadingActions
          value={texto}
          onValueChange={setTexto}
          onSend={(v) => void enviar(v)}
          placeholder={TEXTOS.chat.placeholder}
          sendLabel={TEXTOS.chat.enviar}
          disabled={enviando || semMensagens}
        />
        <Button variant={gerada ? "primary" : "outline"} block disabled={!gerada} onClick={() => setVista("previa")}>
          {TEXTOS.chat.revisar}
        </Button>
      </footer>
    </main>
  );
}
