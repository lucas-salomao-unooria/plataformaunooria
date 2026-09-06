import { useEffect, useRef, useState } from "react";
import {
  ChatHeader,
  Icon,
  MessageBubble,
  MessageComposer,
  Radio,
  StatusBar,
  TextButton,
} from "@edu/ui/ds-whatsapp";
import type { Catalogo, OpcaoPublica, Reacao } from "../../lib/tipos";
import { BalaoDeReacao, BalaoDoEstudante, BalaoDoFeed, Digitando } from "./balao";
import { Alfinete } from "./glifos";
import { BalaoDeVoz } from "./voz";

/**
 * As telas dentro do mensageiro. Aqui quem fala é o APP: nada de "atividade",
 * "professor" ou "missão" em texto visível, inclusive nos estados de erro.
 */

/** E1-ALU-01 — a tela de bloqueio com a notificação não lida. */
export function TelaDeBloqueio({ aoAbrir }: { aoAbrir: () => void }) {
  return (
    <div className="app" style={{ background: "var(--wa-color-surface-canvas)" }}>
      <StatusBar time="14:22" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 20, gap: 28 }}>
        <div style={{ textAlign: "center", fontSize: 46, fontWeight: 300, letterSpacing: "-0.02em" }}>14:22</div>
        <button
          type="button"
          onClick={aoAbrir}
          style={{
            border: 0,
            textAlign: "left",
            cursor: "pointer",
            borderRadius: 14,
            padding: "12px 14px",
            background: "var(--wa-color-surface-elevated)",
            color: "var(--wa-color-text-primary)",
            display: "flex",
            gap: 10,
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--wa-color-surface-bubble-out)", display: "grid", placeItems: "center", flex: "none" }}>
            <Icon name="newChat" tone="onAccent" size="sm" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Amara</div>
            <div style={{ fontSize: 13, lineHeight: 1.35 }}>
              Você viu o que mandaram no grupo do bairro? Disseram que o evento virou confusão,
              mas não foi isso!
            </div>
          </div>
        </button>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--wa-color-text-meta)" }}>
          Toque para abrir
        </div>
      </div>
    </div>
  );
}

/** E1-ALU-02 e E4-ALU-03 — o chat privado com Amara. */
export function ChatDeAmara({
  falas,
  audioUrl,
  transcricao,
  cta,
  aoTocarCta,
  aoOuvirAudio,
  conversa,
}: {
  falas: string[];
  audioUrl: string | null;
  transcricao: string | null;
  cta: string;
  aoTocarCta: () => void;
  aoOuvirAudio: () => void;
  /** A conversa livre, quando ela existe (só depois da decisão). */
  conversa?: React.ReactNode;
}) {
  return (
    <div className="app">
      <StatusBar time="14:23" />
      <ChatHeader name="Amara" presence="online" initials="A" />
      <div className="app__corpo">
        <div className="feed">
          {transcricao && (
            <div className="feed__linha">
              <MessageBubble direction="in" time="14:22" tail>
                <BalaoDeVoz
                  url={audioUrl}
                  transcricao={transcricao}
                  duracaoSeg={15}
                  rotulo="áudio de Amara"
                  aoConcluir={aoOuvirAudio}
                />
              </MessageBubble>
            </div>
          )}
          {falas.map((fala, i) => (
            <div className="feed__linha" key={i}>
              <MessageBubble direction="in" time="14:23" tail>
                {fala}
              </MessageBubble>
            </div>
          ))}
          {conversa}
        </div>
      </div>
      <div style={{ padding: 12, background: "var(--wa-color-surface-appbar)" }}>
        <TextButton onClick={aoTocarCta} style={{ width: "100%" }}>
          {cta}
        </TextButton>
      </div>
    </div>
  );
}

/**
 * E2-ALU-01 — o feed do grupo, e o que ele vira nas etapas seguintes.
 *
 * A mesma tela carrega a investigação, a espera da cascata e o desfecho: no app
 * real o estudante nunca "muda de tela" para ver o bairro reagir, e recortar
 * isso em três telas quebraria a continuidade que sustenta a tensão.
 */
export function FeedDoGrupo({
  catalogo,
  midia,
  reacoes,
  visiveis,
  digitando,
  respostaEnviada,
  fixada,
  cutucao,
  composer,
  aoAbrirMateria,
  aoOuvirAudio,
  aoRetomar,
}: {
  catalogo: Catalogo;
  midia: Record<string, string | null>;
  reacoes: Reacao[];
  visiveis: number;
  digitando: string[];
  respostaEnviada: string | null;
  /** O banner do alfinete: só existe depois de o Admin fixar a contraprova. */
  fixada: string | null;
  cutucao: string | null;
  composer?: React.ReactNode;
  aoAbrirMateria: () => void;
  aoOuvirAudio: (id: string) => void;
  aoRetomar: () => void;
}) {
  const corpo = useRef<HTMLDivElement | null>(null);

  /**
   * Rola para a última mensagem quando o feed cresce.
   *
   * Sem isto, a criança envia a resposta e continua olhando o topo do chat: a
   * própria mensagem e a cascata acontecem fora da tela, e o pico da missão —
   * a espera pelo bairro — não é visto por ninguém. Nenhum mensageiro real se
   * comporta assim.
   */
  useEffect(() => {
    const el = corpo.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visiveis, respostaEnviada, digitando.length, fixada]);

  return (
    <div className="app">
      <StatusBar time="14:47" />
      <ChatHeader
        name="Comunidade Alerta - Bairro São Pedro"
        presence={digitando.length > 0 ? `${digitando.join(", ")} digitando…` : "Você, Amara, Carlos, Dona Lúcia, Seu Jorge, Marcos Admin"}
        initials="CA"
      />

      {fixada && (
        <div className="fixada">
          <Alfinete />
          <span className="fixada__texto">{fixada}</span>
        </div>
      )}

      {cutucao && (
        <button
          type="button"
          onClick={aoRetomar}
          style={{
            border: 0,
            textAlign: "left",
            cursor: "pointer",
            margin: "8px 10px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--wa-color-surface-elevated)",
            color: "var(--wa-color-text-primary)",
            fontSize: 13,
            lineHeight: 1.35,
          }}
        >
          <strong style={{ display: "block", marginBottom: 2 }}>Amara</strong>
          {cutucao}
        </button>
      )}

      <div className="app__corpo" ref={corpo}>
        <div className="feed">
          {catalogo.feed.map((m) => (
            <BalaoDoFeed
              key={m.id}
              mensagem={m}
              materia={catalogo.materia}
              midia={midia}
              aoAbrirMateria={aoAbrirMateria}
              aoOuvirAudio={aoOuvirAudio}
            />
          ))}

          {respostaEnviada && <BalaoDoEstudante texto={respostaEnviada} hora="14:47" />}

          {reacoes.slice(0, visiveis).map((r, i) => (
            <BalaoDeReacao key={i} autor={r.autor} texto={r.texto} hora="14:47" />
          ))}

          <Digitando autores={digitando} />
        </div>
      </div>

      {composer ?? (
        // O campo fica na tela, desabilitado: sumir com ele denunciaria que
        // esta conversa não é como as outras. Não há digitação livre na missão.
        <MessageComposer placeholder="" value="" onChange={() => {}} />
      )}
    </div>
  );
}

/** E3-ALU-01/02 — o menu das três respostas, e a citação armada no composer. */
export function SheetDeIntervencao({
  opcoes,
  marcada,
  aoMarcar,
  aoEnviar,
  bloqueio,
  enviando,
}: {
  opcoes: OpcaoPublica[];
  marcada: string | null;
  aoMarcar: (id: string) => void;
  aoEnviar: () => void;
  /** O que falta para poder enviar, na voz do app. `null` = pode. */
  bloqueio: string | null;
  enviando: boolean;
}) {
  return (
    <div style={{ background: "var(--wa-color-surface-sheet)", borderTop: "1px solid var(--wa-color-surface-elevated)" }}>
      <div style={{ padding: "10px 14px 4px", fontSize: 13, color: "var(--wa-color-text-secondary)" }}>
        Selecione como responder ao print encaminhado:
      </div>

      {/*
        `Radio` com o texto no `label`, e NÃO `ListItem`: a linha de lista do
        pacote tem `white-space: nowrap` no título — certo para uma lista de
        conversas, errado aqui. As três opções são texto longo, e truncá-las
        faria a criança escolher sem ler, que é exatamente o comportamento que
        a missão existe para desfazer. O `Radio` quebra linha por construção.
      */}
      {opcoes.map((o) => (
        <label
          key={o.id}
          style={{
            display: "block",
            padding: "10px 14px",
            borderBottom: "1px solid var(--wa-color-surface-elevated)",
            cursor: "pointer",
          }}
        >
          <Radio
            name="intervencao"
            checked={marcada === o.id}
            onChange={() => aoMarcar(o.id)}
            label={<span style={{ fontSize: 13, lineHeight: 1.4 }}>{o.texto}</span>}
          />
        </label>
      ))}

      {marcada && (
        <div
          style={{
            margin: "10px 14px 0",
            padding: "8px 10px",
            borderLeft: "4px solid var(--wa-color-surface-bubble-out)",
            background: "var(--wa-color-surface-datechip)",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          <div style={{ color: "var(--wa-color-text-meta)", marginBottom: 2 }}>
            Respondendo a: Print da notícia
          </div>
          {opcoes.find((o) => o.id === marcada)?.texto}
        </div>
      )}

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {bloqueio && <div style={{ fontSize: 12, color: "var(--wa-color-text-meta)" }}>{bloqueio}</div>}
        <TextButton onClick={aoEnviar} disabled={Boolean(bloqueio) || enviando}>
          {enviando ? "Enviando…" : "Enviar resposta ao grupo"}
        </TextButton>
      </div>
    </div>
  );
}

/** E4-ALU-02-DEG — a recuperação formativa, depois do pânico. */
export function Desfazer({ aoDesfazer, ocupado }: { aoDesfazer: () => void; ocupado: boolean }) {
  return (
    <div style={{ padding: 14, background: "var(--wa-color-surface-sheet)" }}>
      <TextButton onClick={aoDesfazer} disabled={ocupado} style={{ width: "100%" }}>
        Apagar para todos e tentar outra resposta
      </TextButton>
    </div>
  );
}

/** A conversa livre com Amara — o único texto livre da missão, e só no fim. */
export function ConversaComAmara({
  falas,
  turnosRestantes,
  aoEnviar,
  ocupado,
  erro,
}: {
  falas: Array<{ papel: "estudante" | "amara"; texto: string }>;
  turnosRestantes: number;
  aoEnviar: (texto: string) => void;
  ocupado: boolean;
  erro: string | null;
}) {
  const [texto, setTexto] = useState("");

  return (
    <>
      {falas.map((f, i) => (
        <div className={`feed__linha${f.papel === "estudante" ? " feed__linha--out" : ""}`} key={i}>
          <MessageBubble direction={f.papel === "estudante" ? "out" : "in"} time="14:52" tail>
            {f.texto}
          </MessageBubble>
        </div>
      ))}

      {erro && (
        <div className="feed__linha">
          <MessageBubble direction="in" tail={false}>
            <span style={{ fontSize: 12, color: "var(--wa-color-text-meta)" }}>{erro}</span>
          </MessageBubble>
        </div>
      )}

      {turnosRestantes > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const limpo = texto.trim();
            if (!limpo || ocupado) return;
            aoEnviar(limpo);
            setTexto("");
          }}
        >
          <MessageComposer
            placeholder="Mensagem"
            value={texto}
            onChange={(v: string) => setTexto(v.slice(0, 600))}
            onAction={() => {
              const limpo = texto.trim();
              if (!limpo || ocupado) return;
              aoEnviar(limpo);
              setTexto("");
            }}
          />
        </form>
      )}
    </>
  );
}

/** Os erros do app, na voz do app. Nunca "erro 500", nunca stack trace. */
export function ErroDiegetico({ mensagem }: { mensagem: string }) {
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisivel(false), 6000);
    return () => clearTimeout(id);
  }, [mensagem]);
  if (!visivel) return null;
  return (
    <div
      role="status"
      style={{
        padding: "8px 12px",
        background: "var(--wa-color-surface-notice)",
        color: "var(--wa-color-text-primary)",
        fontSize: 12,
        textAlign: "center",
      }}
    >
      {mensagem}
    </div>
  );
}
