"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ChatComposer,
  ChatHistory,
  ChatLauncher,
  ChatMessage,
  ChatPanel,
  ChatPanelAction,
  Icon,
  RichContent,
  Snackbar,
  TypingIndicator,
  type ChatPanelSize,
} from "@edu/ui/ds";
import { TAMANHO_MAXIMO_DA_MENSAGEM } from "@/lib/agente-professor/contrato";
import { fonteParaTela, ROTULO_DE_INTERROMPIDA, type MensagemDaTela } from "@/lib/agente-professor/conversa";
import { quandoNaLista, TITULO_PROVISORIO } from "@/lib/agente-professor/formatar";
import { MarkdownDoAgente } from "./markdown";
import { useAgenteProfessor } from "./use-agente-professor";

/**
 * O AGENTE DE IA DO PROFESSOR, flutuando no canto das telas de `/professor`.
 * Contrato das quatro pontas: `docs/regras/agente-professor.md`; o que quebra
 * se você não souber: `AGENTS.md` desta pasta.
 *
 * Montagem do DS (`@edu/ui/ds`, seção `unooria`, 0.2.10): `ChatLauncher` +
 * `ChatPanel` NÃO modal (sem véu nem prisão de foco: a tela de trás continua
 * usável), `ChatHistory` na coluna lateral, `ChatMessage` + `RichContent` nas
 * mensagens e `ChatComposer` no rodapé. O DS não move o foco: é este
 * componente que o leva ao compositor ao abrir e o devolve ao botão ao fechar.
 *
 * `data-clarity-mask` no painel INTEIRO: o professor pode escrever o nome de
 * um estudante (o aviso pede que não, e o aviso não é trava), e o Clarity grava
 * a tela. Mascarado, o painel aparece na gravação como blocos, sem texto.
 */

/** Um só por página: é o alvo do `aria-controls` do botão. */
const ID_DO_PAINEL = "agente-de-ia-do-professor";

/** O tamanho do painel é PREFERÊNCIA VISUAL e só isso — nada de conversa, token ou texto aqui. */
const CHAVE_DO_TAMANHO = "unooria:agente-professor:tamanho";

function lerTamanhoLembrado(): ChatPanelSize {
  try {
    return window.localStorage.getItem(CHAVE_DO_TAMANHO) === "expandido" ? "expandido" : "compacto";
  } catch {
    // Navegação privada, armazenamento bloqueado: fica no padrão.
    return "compacto";
  }
}

function lembrarTamanho(tamanho: ChatPanelSize): void {
  try {
    window.localStorage.setItem(CHAVE_DO_TAMANHO, tamanho);
  } catch {
    // Sem armazenamento, a preferência vale só nesta página.
  }
}

function avisoDaResposta(m: MensagemDaTela): string | undefined {
  const avisos = [...m.avisos, ...(m.interrompida ? [ROTULO_DE_INTERROMPIDA] : [])];
  return avisos.length > 0 ? avisos.join(" ") : undefined;
}

/** O que o agente faz, dito por ele mesmo. É LOCAL: não vem da api e não gasta quota. */
function BoasVindas() {
  return (
    <ChatMessage autor="agente">
      <RichContent>
        <p>
          Olá! Sou o agente de IA do professor. Tiro dúvidas sobre a BNCC — inclusive a de Computação — e sobre os
          livros da Unooria: que habilidades trabalhar em cada ano, o que cada código significa e onde o tema aparece
          no material.
        </p>
        <p>Sempre que eu usar um documento, digo qual é e em que página está.</p>
      </RichContent>
    </ChatMessage>
  );
}

export function AgenteFlutuante() {
  const [aberto, setAberto] = useState(false);
  const [tamanho, setTamanho] = useState<ChatPanelSize>("compacto");
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const abertoRef = useRef(false);

  // O selo conta só as respostas que TERMINARAM com o painel fechado.
  const aoResponder = useCallback(() => {
    if (!abertoRef.current) setNaoLidas((n) => n + 1);
  }, []);
  const agente = useAgenteProfessor({ aoResponder });
  const { conversa } = agente;

  /* Depois de montar, e não no `useState`: no servidor não há `localStorage`,
     e ler no primeiro render faria o HTML do servidor e o do navegador
     discordarem (erro de hidratação). */
  useEffect(() => {
    setTamanho(lerTamanhoLembrado());
  }, []);

  const focarCompositor = () => requestAnimationFrame(() => campoRef.current?.focus());

  const abrir = () => {
    abertoRef.current = true;
    setAberto(true);
    setNaoLidas(0);
    if (agente.conversas === null) void agente.carregarLista();
    focarCompositor();
  };

  const fechar = () => {
    abertoRef.current = false;
    setAberto(false);
    botaoRef.current?.focus();
  };

  const compacto = tamanho === "compacto";

  const alternarTamanho = () => {
    const proximo: ChatPanelSize = compacto ? "expandido" : "compacto";
    setTamanho(proximo);
    lembrarTamanho(proximo);
  };

  const alternarHistorico = () => {
    const abrirHistorico = !historicoAberto;
    setHistoricoAberto(abrirHistorico);
    // Abrir o histórico relê a lista: o título e a ordem são da api.
    if (abrirHistorico) void agente.carregarLista();
  };

  const novaConversa = () => {
    agente.novaConversa();
    if (compacto) setHistoricoAberto(false);
    focarCompositor();
  };

  const abrirConversa = (id: string) => {
    void agente.abrirConversa(id);
    // No compacto o histórico toma o lugar da conversa: escolher volta a ela.
    if (compacto) setHistoricoAberto(false);
  };

  const ultimaPergunta = [...conversa.mensagens].reverse().find((m) => m.autor === "professor")?.id;

  const itensDoHistorico = (agente.conversas ?? []).map((c) => ({
    id: c.id,
    titulo: c.titulo ?? TITULO_PROVISORIO,
    atualizadaEm: quandoNaLista(c.atualizadaEm),
  }));

  return (
    <>
      <ChatLauncher
        ref={botaoRef}
        /* O gancho da folga embaixo do `main` em janela estreita
           (`packages/ui/styles/plataforma.css`): o botão não cobre o fim da página. */
        data-agente-professor=""
        expanded={aberto}
        controls={ID_DO_PAINEL}
        badge={naoLidas}
        onClick={() => (aberto ? fechar() : abrir())}
      />
      <ChatPanel
        id={ID_DO_PAINEL}
        data-clarity-mask="true"
        open={aberto}
        size={tamanho}
        onClose={fechar}
        /* O TÍTULO fica "Agente de IA do professor" (o padrão do DS) e o da
           conversa vai no SUBTÍTULO: o título é o nome acessível da região, e
           o leitor de tela precisa achar o painel pelo mesmo nome sempre — com
           o título da conversa ali, a região se chamaria "Números naturais no
           6º ano" e mudaria a cada conversa. */
        subtitle={conversa.titulo ?? TITULO_PROVISORIO}
        scrollToEndKey={ultimaPergunta}
        sidebarOpen={historicoAberto}
        sidebar={
          <ChatHistory
            items={itensDoHistorico}
            activeId={conversa.conversaId ?? agente.abrindo ?? undefined}
            loading={agente.carregandoLista && agente.conversas === null}
            onSelect={abrirConversa}
            onDelete={(id) => void agente.apagar(id)}
            {...(agente.falhaDaLista && itensDoHistorico.length === 0
              ? { emptyTitle: "Não foi possível carregar as conversas", emptyDescription: agente.falhaDaLista }
              : {})}
          />
        }
        actions={
          <>
            <ChatPanelAction icon="add_comment" label="Nova conversa" onClick={novaConversa} />
            <ChatPanelAction
              icon="history"
              label="Histórico de conversas"
              pressed={historicoAberto}
              onClick={alternarHistorico}
            />
            <ChatPanelAction
              icon={compacto ? "open_in_full" : "close_fullscreen"}
              label={compacto ? "Expandir" : "Recolher"}
              onClick={alternarTamanho}
            />
            <ChatPanelAction icon="close" label="Fechar" onClick={fechar} />
          </>
        }
        footer={
          <>
            {/* Fixo, junto do campo: é na hora de escrever que o aviso serve.
                `pb-2` e não margem: no expandido o DS centraliza os filhos do
                rodapé com `margin: 0 auto`, que venceria a margem. */}
            <p className="flex items-center gap-1 pb-2 text-[12px] text-unooria-neutral-500">
              <Icon name="privacy_tip" size="3xs" color="currentColor" aria-hidden="true" />
              <span>Não escreva nomes de estudantes.</span>
            </p>
            <ChatComposer
              ref={campoRef}
              maxLength={TAMANHO_MAXIMO_DA_MENSAGEM}
              transmitindo={conversa.transmitindo}
              disabled={agente.abrindo !== null}
              onSend={agente.enviar}
              onStop={agente.parar}
            />
          </>
        }
      >
        <BoasVindas />

        {agente.abrindo ? <TypingIndicator label="Carregando a conversa…" showLabel /> : null}

        {agente.falhaAoAbrir ? (
          <ChatMessage
            autor="agente"
            estado="erro"
            erro={agente.falhaAoAbrir.mensagem}
            onRetry={() => void agente.abrirConversa(agente.falhaAoAbrir!.id)}
          />
        ) : null}

        {conversa.mensagens.map((m) =>
          m.autor === "professor" ? (
            <ChatMessage key={m.id} autor="professor" estado={m.estado}>
              {m.texto}
            </ChatMessage>
          ) : (
            <ChatMessage
              key={m.id}
              autor="agente"
              estado={m.estado}
              fontes={m.fontes?.map(fonteParaTela)}
              aviso={avisoDaResposta(m)}
              erro={m.erro}
              onRetry={m.estado === "erro" && m.podeRepetir ? () => agente.repetir(m.id) : undefined}
            >
              {m.texto ? <MarkdownDoAgente texto={m.texto} /> : null}
            </ChatMessage>
          ),
        )}
      </ChatPanel>

      {agente.aviso ? <Snackbar severity="danger" title={agente.aviso} onClose={agente.fecharAviso} /> : null}
    </>
  );
}
