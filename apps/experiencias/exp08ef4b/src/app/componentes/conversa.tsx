import { useEffect, useRef, useState } from "react";
import { Button, ChatBubble, Composer, PromptSuggestion } from "@edu/ui/ds-chatgpt";
import { CLONE, comContagem } from "../../lib/textos";
import type { Fala, PromptPublico } from "../../lib/tipos";

/**
 * E1-ALU-02 e E2 — a conversa com o EduPredict IA. **Seção `chatgpt`.**
 *
 * Três decisões desta tela que são regra, não estilo:
 *
 * 1. **O `Composer` não aceita digitação.** `readOnly` + `hideLeadingActions`:
 *    escrever livre não existe nesta missão (é a ausência deliberada da spec —
 *    guardrail contra jailbreak e conteúdo fora da faixa), e os alvos de anexo
 *    e de voz saem porque um alvo que não faz nada ensina o estudante a
 *    desconfiar da tela. O campo mostra o texto do questionamento ESCOLHIDO,
 *    que é o que dá a sensação de ter perguntado.
 * 2. **Amara está ausente.** Não-negociável 3: silenciamento absoluto na Etapa
 *    2. A única exceção é o balão de apoio depois de 120 segundos sem ação, e
 *    ele é do caminho degenerado — quem o desenha é `ManifestoApp`.
 * 3. **O `forms` do manifesto existe por causa deste componente.** O `Composer`
 *    do DS é um `<form>`, e sem o token de sandbox o navegador BLOQUEIA o
 *    submit em silêncio: o estudante escolheria o card, apertaria enviar e nada
 *    aconteceria (a armadilha que custou um bug inteiro na exp02em1b).
 */
export function Conversa({
  nomeDoAssistente,
  principios,
  falas,
  prompts,
  seletorAberto,
  streaming,
  textoNoCampo,
  contador,
  destravado,
  onDestravar,
  onEscolher,
  onEnviar,
  children,
}: {
  nomeDoAssistente: string;
  principios: string;
  falas: Fala[];
  prompts: PromptPublico[];
  seletorAberto: boolean;
  streaming: boolean;
  textoNoCampo: string;
  contador: { feitas: number; total: number };
  /** Antes de "Abrir conversa" o seletor não existe — é a Etapa 1. */
  destravado: boolean;
  onDestravar: () => void;
  onEscolher: (prompt: PromptPublico) => void;
  onEnviar: () => void;
  /** O aviso do sistema, o balão de apoio — o que a orquestração decidir. */
  children?: React.ReactNode;
}) {
  const corpo = useRef<HTMLDivElement>(null);
  const [ultima, setUltima] = useState(falas.length);

  /* Rola para o fim quando uma fala NOVA entra — não em toda renderização. A
     diferença aparece quando o estudante rola para reler a primeira defesa da
     máquina: um scroll em cada render o jogaria de volta para baixo, e reler é
     exatamente o que a Etapa 2 quer que ele faça. */
  useEffect(() => {
    if (falas.length === ultima) return;
    setUltima(falas.length);
    corpo.current?.scrollTo({ top: corpo.current.scrollHeight, behavior: "smooth" });
  }, [falas.length, ultima]);

  return (
    <div className="conversa">
      <header className="conversa__topo">
        <strong className="conversa__nome">{nomeDoAssistente}</strong>
        <span className="conversa__contador" data-contador="auditorias">
          {comContagem(CLONE.contadorDeAuditoria, {
            count: contador.feitas,
            total: contador.total,
          })}
        </span>
      </header>

      {/* A faixa dos três princípios em disputa. Compensação marcada no CSS. */}
      <p className="principios">{principios}</p>

      <div className="conversa__corpo" ref={corpo}>
        <div className="miolo">
          <div className="falas">
            {falas.map((fala, indice) => (
              <ChatBubble
                key={`${fala.promptId ?? "abertura"}-${indice}-${fala.papel}`}
                role={fala.papel}
                avatarInitials="AI"
                className={`fala--${fala.papel}`}
              >
                {fala.texto}
              </ChatBubble>
            ))}

            {streaming && (
              <ChatBubble role="assistant" avatarInitials="AI" className="fala--assistant">
                <span className="digitando" />
              </ChatBubble>
            )}
          </div>

          {/* A live region do streaming. `aria-live` e não texto sempre visível:
              quem vê a tela já percebe o cursor; quem usa leitor de tela
              precisa ser avisado de que a máquina está respondendo. */}
          <p className="status-da-maquina" role="status" aria-live="polite">
            {streaming ? CLONE.streaming : ""}
          </p>

          {children}

          {seletorAberto && prompts.length > 0 && (
            <div className="seletor">
              <p className="seletor__instrucao">{CLONE.instrucaoDoSeletor}</p>
              <div className="seletor__cards">
                {prompts.map((prompt) => (
                  <PromptSuggestion
                    key={prompt.id}
                    as="button"
                    type="button"
                    block
                    onClick={() => onEscolher(prompt)}
                    data-prompt={prompt.id}
                  >
                    {prompt.rotuloBotao}
                  </PromptSuggestion>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Composer.Dock className="conversa__doca">
        <div className="miolo">
          {destravado ? (
            <Composer
              block
              /* `readOnly`, não `disabled`: um campo desabilitado sai do fluxo
                 de foco e o leitor de tela deixa de anunciar o texto que o card
                 injetou — e é esse texto que diz o que está sendo perguntado. */
              readOnly
              value={textoNoCampo}
              placeholder={CLONE.instrucaoDoSeletor}
              hideLeadingActions
              sendLabel={CLONE.enviarMensagem}
              disabled={streaming || textoNoCampo.length === 0}
              onSend={() => onEnviar()}
            />
          ) : (
            /* Etapa 1: a barra está atenuada e o que existe é o botão de
               destravar, sobreposto a ela (critério de aceite de E1-ALU-02). */
            <Button variant="secondary" block onClick={onDestravar} data-acao="abrir-conversa">
              {CLONE.abrirConversa}
            </Button>
          )}
        </div>
      </Composer.Dock>
    </div>
  );
}
