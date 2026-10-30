import { useEffect, useRef, useState, type ReactNode } from "react";
import { AssistantCard, Badge, Button, ChatBubble, Composer, Icon, Modal, PromptSuggestion, Tag } from "@edu/ui/ds-unooriaai";
import { TEXTOS } from "../../lib/textos";
import type { AncoraId, Documento, Mensagem, ProjetoNaTela, Sessao } from "../../lib/tipos";

/**
 * O CLONE — o UnooriaAI do Conselho Municipal de Apoio Social. Este arquivo
 * importa SÓ a ponte `@edu/ui/ds-unooriaai` (DS híbrido, ADR-202: a
 * mecânica da missão é `unooria`, em `../mecanica/`). Tokens `--uai-*` no CSS.
 */

type Tela = Sessao["textos"]["tela"];

/** O cromo do workspace: o nome, o crachá do relator e a base de dados conectada (`00b`, ficha do ambiente). */
export function Workspace({ tela, semRede, children, rodape }: { tela: Tela; semRede: boolean; children: ReactNode; rodape?: ReactNode }) {
  return (
    <main className="uai-tela">
      {semRede && (
        <p className="uai-faixa" role="alert">
          <Icon name="shieldWarning" size={16} />
          <span>{tela.quedaDeSinal}</span>
        </p>
      )}
      <header className="uai-topo">
        <div className="uai-topo__identidade">
          <h1 className="uai-topo__titulo">{tela.workspace}</h1>
          <span className="uai-topo__meta">{tela.cracha}</span>
        </div>
        <Badge variant="default" className="uai-topo__base">
          {tela.base}
        </Badge>
      </header>
      <section className="uai-conversa" aria-live="polite">
        {children}
      </section>
      {rodape && <footer className="uai-rodape">{rodape}</footer>}
    </main>
  );
}

/** Os três cartões de contexto da abertura (E1-ALU-01). */
export function CartoesDosProjetos({ projetos }: { projetos: ProjetoNaTela[] }) {
  return (
    <div className="uai-cartoes">
      {projetos.map((p) => (
        <AssistantCard key={p.id} className="uai-cartao" name={p.nome} description={`${p.nome}: ${p.card}`} initial={p.nome.slice(0, 1)} />
      ))}
    </div>
  );
}

/** Um chip de anexo: abre os metadados do documento (E2-SIS-01). */
function ChipDeAnexo({ arquivo, onAbrir }: { arquivo: string; onAbrir: (arquivo: string) => void }) {
  return (
    <Tag className="uai-anexo" onClick={() => onAbrir(arquivo)} aria-label={`Abrir ${arquivo}`}>
      <Icon name="chatText" size={14} />
      <span>{arquivo}</span>
    </Tag>
  );
}

/**
 * A thread. O balão do sistema (o limiar, os projetos inscritos) vai como nota
 * centrada; o do assistente pode trazer chips de anexo. Na E5 (`marcar`), as
 * mensagens-âncora ganham o "Marcar no histórico" (message highlight).
 */
export function Thread({
  mensagens,
  pendente,
  digitando,
  onAnexo,
  marcar,
}: {
  mensagens: Mensagem[];
  pendente?: string | null;
  digitando?: string;
  onAnexo: (arquivo: string) => void;
  marcar?: { marcadas: AncoraId[]; alternar: (a: AncoraId) => void } | null;
}) {
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, pendente]);
  return (
    <>
      {mensagens.map((m) => {
        if (m.autor === "sistema") {
          return (
            <p key={m.id} className="uai-nota" role="status">
              {m.texto}
            </p>
          );
        }
        const marcavel = marcar && m.ancora;
        const marcada = marcavel ? marcar.marcadas.includes(m.ancora as AncoraId) : false;
        return (
          <div key={m.id} className={`uai-mensagem${marcada ? " uai-mensagem--marcada" : ""}`} data-ancora={m.ancora ?? undefined}>
            <ChatBubble role={m.autor === "estudante" ? "user" : "assistant"}>
              {m.texto}
              {m.anexos.length > 0 && (
                <span className="uai-anexos">
                  <span className="uai-anexos__rotulo">{TEXTOS.anexos}</span>
                  {m.anexos.map((a) => (
                    <ChipDeAnexo key={a} arquivo={a} onAbrir={onAnexo} />
                  ))}
                </span>
              )}
            </ChatBubble>
            {marcavel && (
              <Tag selected={marcada} aria-pressed={marcada} className="uai-marcar" onClick={() => marcar.alternar(m.ancora as AncoraId)}>
                {marcada ? `✓ ${TEXTOS.ancoraMarcada}` : TEXTOS.marcarAncora}
              </Tag>
            )}
          </div>
        );
      })}
      {pendente && (
        <>
          <ChatBubble role="user">{pendente}</ChatBubble>
          <ChatBubble role="assistant" aria-busy="true">
            {digitando}
          </ChatBubble>
        </>
      )}
      <div ref={fim} />
    </>
  );
}

/** Uma fala solta do assistente (a oferta dos cadernos na E4, o contrafactual): o mesmo balão da thread. */
export function FalaDoAssistente({ children, titulo }: { children: ReactNode; titulo?: string }) {
  return (
    <ChatBubble role="assistant">
      {titulo && <strong className="uai-fala__titulo">{titulo}</strong>}
      {children}
    </ChatBubble>
  );
}

/** O composer com as três sugestões efêmeras (somem na primeira mensagem, para sempre). */
export function Entrada({
  tela,
  sugestoes,
  ativo,
  enviando,
  onEnviar,
}: {
  tela: Tela;
  sugestoes: string[] | null;
  ativo: boolean;
  enviando: boolean;
  onEnviar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  return (
    <>
      {sugestoes && (
        <div className="uai-sugestoes">
          {sugestoes.map((s) => (
            <PromptSuggestion key={s} as="button" type="button" disabled={enviando || !ativo} onClick={() => onEnviar(s)}>
              {s}
            </PromptSuggestion>
          ))}
        </div>
      )}
      <Composer
        block
        hideLeadingActions
        value={texto}
        onValueChange={setTexto}
        onSend={(v) => {
          onEnviar(v);
          setTexto("");
        }}
        placeholder={ativo ? tela.placeholderAtivo : tela.placeholderInativo}
        sendLabel={TEXTOS.enviar}
        disabled={!ativo || enviando}
      />
    </>
  );
}

/** Um botão do app (as ações da thread: Ver Projetos, Escolher Projeto, Digitalizar cadernos…). */
export function AcaoDoApp({
  children,
  variante = "primary",
  onClick,
  disabled,
  grande,
}: {
  children: ReactNode;
  variante?: "primary" | "outline";
  onClick: () => void;
  disabled?: boolean;
  grande?: boolean;
}) {
  return (
    <Button variant={variante} size={grande ? "lg" : "md"} onClick={onClick} disabled={disabled} className="uai-acao">
      {children}
    </Button>
  );
}

/** As duas pílulas dirigidas da E4 (o mesmo componente das sugestões). */
export function PilulasDirigidas({ pilulas, feitas, onPilula }: { pilulas: Array<[string, string]>; feitas: string[]; onPilula: (id: string) => void }) {
  return (
    <div className="uai-sugestoes uai-sugestoes--dirigidas">
      {pilulas.map(([id, rotulo]) => (
        <PromptSuggestion key={id} as="button" type="button" disabled={feitas.includes(id)} onClick={() => onPilula(id)}>
          {rotulo}
        </PromptSuggestion>
      ))}
    </div>
  );
}

/**
 * Os metadados do documento (E2-SIS-01). Os cadernos (`.dat`) mostram a
 * transcrição do OCR; sem o resumo do documento, o modo texto (ERRO_MIDIA_FALHOU).
 */
export function ModalDoAnexo({
  tela,
  arquivo,
  documento,
  cadernos,
  onFechar,
}: {
  tela: Tela;
  arquivo: string | null;
  documento: Documento | null;
  cadernos: { amostras: string[]; resumo: string } | null;
  onFechar: () => void;
}) {
  const ehCaderno = Boolean(arquivo?.endsWith(".dat"));
  return (
    <Modal open={arquivo !== null} onClose={onFechar} title={tela.modalTitulo} closeLabel={tela.fechar} className="uai-modal">
      <Modal.Body className="uai-modal__corpo">
        <p>
          <strong>Arquivo:</strong> {arquivo}
        </p>
        {ehCaderno && cadernos ? (
          <>
            <p>{cadernos.resumo}</p>
            <ul className="uai-modal__lista">
              {cadernos.amostras.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </>
        ) : documento ? (
          <>
            <p>{documento.resumo}</p>
            <p className="uai-modal__nota">{tela.modalCorpo}</p>
          </>
        ) : (
          <p className="uai-modal__nota" role="status">
            {tela.midiaFalhou}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button block onClick={onFechar}>
          {tela.fechar}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
