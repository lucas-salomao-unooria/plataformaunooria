import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge, Button, ChatBubble, Composer, Icon, Modal, PromptSuggestion, Tag } from "@edu/ui/ds-unooriaai";
import type { Executar } from "../App";
import { api } from "../lib/api";
import { proximaOpcao } from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { Estado, Manchete, Sessao } from "../lib/tipos";
import { FaixaDeConexao } from "./FaixaDeConexao";

/** A dica de inatividade: 60 s sem nenhum toque, antes do primeiro prompt (EVT-U04). */
const INATIVIDADE_MS = 60_000;

type Vista = "chat" | "previa";
type Pendencia = keyof NonNullable<Estado["previa"]>["pendencias"];
const PENDENCIAS: Pendencia[] = ["fonte", "autoria", "privacidade"];

/**
 * As Etapas 2 e 3 no UnooriaAI (seção `unooriaai`): E2-ALU-01 (o chat),
 * E2-ALU-02 (a Prévia do Post) e E3-ALU-01 (o Fechamento Editorial).
 *
 * O UnooriaAI responde do SERVIDOR, pela árvore de intenções e sem IA na aula
 * (ADR-191): a tela manda o texto e desenha o que voltar. O balão do estudante
 * entra na hora, com o "UnooriaAI está redigindo o rascunho..." embaixo.
 *
 * Em 375 px a prévia é a OUTRA vista, aberta pela barra do app assim que o
 * rascunho existe. Os avisos de pendência não travam nada: aprovar é escolha
 * do estudante, e a régua mede o Publicar. O "Exportar para o Unoovista" abre
 * a janela da manchete, e o "Publicar no Unoovista" é o latch 1.
 */
export function Conversa({
  estado,
  textos,
  semRede,
  executar,
}: {
  estado: Estado;
  textos: Sessao["textos"];
  semRede: boolean;
  executar: Executar;
}) {
  const [vista, setVista] = useState<Vista>("chat");
  const [texto, setTexto] = useState("");
  const [pendente, setPendente] = useState<string | null>(null);
  const [dica, setDica] = useState(false);
  const [fechamento, setFechamento] = useState(false);
  const [manchete, setManchete] = useState<Manchete | null>(null);
  const [publicando, setPublicando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const opcoes = useRef<(HTMLButtonElement | null)[]>([]);
  const relogioDaDica = useRef<number | undefined>(undefined);
  const dicaJaMostrada = useRef(false);
  const etapa3Registrada = useRef(false);

  const mensagens = estado.conversa.mensagens;
  const previa = estado.previa;
  const gerada = Boolean(previa?.gerada);
  const aprovada = Boolean(previa?.aprovada);
  const semMensagens = estado.conversa.restantes <= 0;
  const enviando = pendente !== null;
  const manchetes = estado.manchetes ?? [];
  const nenhumaMensagem = useRef(mensagens.length === 0);
  nenhumaMensagem.current = mensagens.length === 0;

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, pendente]);

  /* A dica aparece UMA vez, depois de 60 s sem toque; qualquer toque a apaga e rearma a contagem. */
  const armarDica = useCallback(() => {
    window.clearTimeout(relogioDaDica.current);
    if (dicaJaMostrada.current) return;
    relogioDaDica.current = window.setTimeout(() => {
      if (!nenhumaMensagem.current) return;
      dicaJaMostrada.current = true;
      setDica(true);
      telemetria.inatividade();
    }, INATIVIDADE_MS);
  }, []);

  useEffect(() => {
    armarDica();
    return () => window.clearTimeout(relogioDaDica.current);
  }, [armarDica]);

  function tocou() {
    if (dica) setDica(false);
    armarDica();
  }

  async function enviar(bruto: string) {
    const t = bruto.trim();
    if (!t || enviando || semMensagens) return;
    setDica(false);
    telemetria.prompt(t.length);
    setPendente(t);
    setTexto("");
    const novo = await executar(() => api.mensagem(t));
    /* O rascunho VOLTA ao campo se não entrou — só se o campo continuar vazio. */
    if (!novo) setTexto((atual) => (atual ? atual : t));
    setPendente(null);
  }

  async function revisar() {
    const novo = await executar(() => api.previa("revisar"));
    if (novo) setVista("chat");
  }

  function abrirFechamento() {
    if (!etapa3Registrada.current) {
      etapa3Registrada.current = true;
      telemetria.etapa("E3");
    }
    setFechamento(true);
  }

  async function publicar() {
    if (!manchete || publicando) return;
    setPublicando(true);
    const novo = await executar(() => api.publicar(manchete));
    if (novo) telemetria.publicou(manchete);
    setPublicando(false);
  }

  function setas(e: KeyboardEvent<HTMLDivElement>) {
    const atual = manchetes.findIndex((m) => m.id === manchete);
    const proxima = proximaOpcao(atual, e.key, manchetes.length);
    if (proxima === null) return;
    e.preventDefault();
    setManchete(manchetes[proxima]!.id);
    opcoes.current[proxima]?.focus();
  }

  if (vista === "previa" && previa) {
    const ativas = PENDENCIAS.filter((p) => previa.pendencias[p]);
    return (
      <main className="uai-tela">
        {semRede && <FaixaDeConexao />}
        <header className="uai-topo">
          <h1 className="uai-topo__titulo">{TEXTOS.previa.titulo}</h1>
          <Button variant="outline" size="sm" onClick={() => setVista("chat")}>
            {TEXTOS.previa.fechar}
          </Button>
        </header>
        <div className="uai-corpo">
          <article className="uai-previa__texto">
            {previa.paragrafos.map((p) => (
              <p key={p.id}>{p.texto}</p>
            ))}
          </article>
          {ativas.length > 0 && (
            <ul className="uai-pendencias">
              {ativas.map((p) => (
                <li key={p}>
                  <Badge variant="warning" className="uai-pendencia">
                    <Icon name="shieldWarning" size={16} />
                    <span>{TEXTOS.previa.pendencias[p]}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="uai-rodape">
          {aprovada ? (
            <Button block size="lg" trailingIcon={<Icon name="arrowForward" size={16} />} onClick={abrirFechamento}>
              {TEXTOS.previa.exportar}
            </Button>
          ) : (
            <>
              <Button block variant="outline" onClick={() => void revisar()}>
                {TEXTOS.previa.revisar}
              </Button>
              <Button block onClick={() => void executar(() => api.previa("aprovar"))}>
                {TEXTOS.previa.aprovar}
              </Button>
            </>
          )}
        </footer>

        <Modal
          open={fechamento}
          onClose={() => setFechamento(false)}
          title={TEXTOS.manchete.titulo}
          closeLabel={TEXTOS.previa.fechar}
          className="uai-fechamento"
        >
          <Modal.Body className="uai-fechamento__corpo">
            <blockquote className="uai-fechamento__previa">{previa.paragrafos.map((p) => p.texto).join(" ")}</blockquote>
            <p id="manchete-guia" className="uai-fechamento__guia">
              {TEXTOS.manchete.guia}
            </p>
            <div className="uai-manchetes" role="radiogroup" aria-labelledby="manchete-guia" onKeyDown={setas}>
              {manchetes.map((m, i) => {
                const escolhida = manchete === m.id;
                const focavel = escolhida || (manchete === null && i === 0);
                return (
                  <Tag
                    key={m.id}
                    ref={(el: HTMLButtonElement | null) => {
                      opcoes.current[i] = el;
                    }}
                    role="radio"
                    aria-checked={escolhida}
                    aria-pressed={undefined}
                    tabIndex={focavel ? 0 : -1}
                    selected={escolhida}
                    className="uai-manchete"
                    onClick={() => setManchete(m.id)}
                  >
                    <span className="uai-manchete__conteudo">
                      <Badge variant={escolhida ? "primary" : "default"}>{TEXTOS.manchete.tipos[m.id]}</Badge>
                      <span>{m.texto}</span>
                    </span>
                  </Tag>
                );
              })}
            </div>
            <p className="uai-fechamento__audiencia">{TEXTOS.manchete.audiencia}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button block size="lg" disabled={!manchete || publicando} onClick={() => void publicar()}>
              {TEXTOS.manchete.publicar}
            </Button>
          </Modal.Footer>
        </Modal>
      </main>
    );
  }

  return (
    <main className="uai-tela" onPointerDownCapture={tocou} onKeyDownCapture={tocou}>
      {semRede && <FaixaDeConexao />}
      <header className="uai-topo">
        <div className="uai-topo__identidade">
          <h1 className="uai-topo__titulo">{TEXTOS.chat.topo}</h1>
          <span className="uai-topo__meta">{TEXTOS.chat.restantes(estado.conversa.restantes)}</span>
        </div>
        {gerada && (
          <Button
            size="sm"
            variant={aprovada ? "outline" : "primary"}
            leadingIcon={<Icon name="chatText" size={16} />}
            onClick={() => setVista("previa")}
          >
            {TEXTOS.chat.abrirPrevia}
          </Button>
        )}
      </header>
      <section className="uai-conversa" aria-live="polite">
        <ChatBubble role="assistant">{textos.boasVindas}</ChatBubble>
        {mensagens.map((m, i) => (
          <ChatBubble key={i} role={m.papel === "estudante" ? "user" : "assistant"}>
            {m.texto}
          </ChatBubble>
        ))}
        {pendente && (
          <>
            <ChatBubble role="user">{pendente}</ChatBubble>
            <ChatBubble role="assistant" aria-busy="true">
              {TEXTOS.chat.digitando}
            </ChatBubble>
          </>
        )}
        <div ref={fim} />
      </section>
      <footer className="uai-rodape">
        {!semMensagens && (
          <div className="uai-sugestoes">
            {textos.sugestoes.map((s) => (
              <PromptSuggestion key={s} as="button" type="button" block disabled={enviando} onClick={() => void enviar(s)}>
                {s}
              </PromptSuggestion>
            ))}
          </div>
        )}
        {dica && (
          <p className="uai-dica" role="status">
            {TEXTOS.chat.inatividade}
          </p>
        )}
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
      </footer>
    </main>
  );
}
