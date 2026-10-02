"use client";

import { useEffect, useRef } from "react";

import {
  AlertBox,
  Button,
  ChatComposer,
  ChatMessage,
  Icon,
  Modal,
  ModalBody,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  ScrollBar,
  TypingIndicator,
} from "@edu/ui/ds";
import { relogio, type MensagemDaAjuda } from "@/lib/ajuda/conversa";
import { useSessaoDaAjuda, type EstadoDoMicrofone } from "./use-sessao-da-ajuda";

/**
 * A AJUDA COM ATENDENTE (ADR-132): o atendente em vídeo em cima, a conversa
 * escrita embaixo. Aberta pelo item "Ajuda" do menu da conta, em todas as
 * áreas menos a do estudante.
 *
 * Montagem do DS (`@edu/ui/ds`, seção `unooria`): `Modal` + `ModalTitle` (o
 * nome acessível do diálogo), `ChatMessage` + `ChatComposer` + `TypingIndicator`
 * — o mesmo kit do agente de IA do professor —, a lista dentro de `ScrollBar`,
 * e `AlertBox` para os estados que interrompem a conversa.
 *
 * **O `<video>` é o único elemento cru, e é mídia, não controle**: o DS não
 * publica player de vídeo ao vivo, e o SDK do vendor pede um `HTMLMediaElement`
 * para `attach()`. Não tem estado nem aparência de controle — é a janela onde o
 * atendente aparece. O `overflow-hidden` da moldura só arredonda os cantos; não
 * rola nada.
 *
 * A conversa só existe ENQUANTO o modal está aberto: fechar desmonta o
 * conteúdo, e a desmontagem encerra a sala do vendor (o minuto para de contar).
 * Nada é guardado — nem aqui, nem na api.
 *
 * `data-clarity-mask` no corpo inteiro: a pessoa pode dizer ou escrever o nome
 * de um estudante (o aviso pede que não), e o Clarity grava a tela.
 */

export function ModalDaAjuda({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  return (
    <Modal isOpen={aberto} onClose={aoFechar} size="lg" closeOnOverlayClick={false}>
      <ModalHeader>
        <ModalTitle>Ajuda</ModalTitle>
        <ModalDescription>
          Tire suas dúvidas sobre a plataforma com o nosso atendente, falando ou escrevendo.
        </ModalDescription>
      </ModalHeader>
      {/* Só monta aberto: é a montagem que abre a sala e a desmontagem que a fecha. */}
      {aberto ? <ConversaComAtendente /> : null}
    </Modal>
  );
}

const ROTULO_DO_MICROFONE: Record<EstadoDoMicrofone, string> = {
  desligado: "Falar",
  ligando: "Ligando o microfone…",
  ligado: "Silenciar microfone",
  mudo: "Ligar microfone",
  bloqueado: "Microfone bloqueado",
};

function ConversaComAtendente() {
  const video = useRef<HTMLVideoElement>(null);
  const fimDaLista = useRef<HTMLDivElement>(null);
  const ajuda = useSessaoDaAjuda(video);
  const { fase, conversa } = ajuda;

  /* Rola até a última fala a cada mensagem nova (ou pedaço de resposta). */
  const ultima = conversa.mensagens.at(-1);
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ block: "nearest" });
  }, [conversa.mensagens.length, ultima?.texto]);

  const conversando = fase === "conversando";
  const microfoneAberto = ajuda.microfone === "ligado";

  return (
    <ModalBody scrollable={false}>
      <div className="flex flex-col gap-4" data-clarity-mask="true" data-ajuda="">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-unooria-neutral-950">
          {/* `playsInline`: no iPhone, sem ele o vídeo abriria em tela cheia. O
              áudio do atendente vem pela mesma trilha (o `attach` do SDK). */}
          <video
            ref={video}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
            aria-label="Vídeo do atendente"
          />

          {fase === "abrindo" || fase === "conectando" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-unooria-neutral-950/70">
              <TypingIndicator
                theme="dark"
                showLabel
                label={fase === "abrindo" ? "Chamando o atendente…" : "Conectando o vídeo…"}
              />
            </div>
          ) : null}
        </div>

        {fase === "erro" && ajuda.erro ? (
          <AlertBox
            theme="light"
            variant="warning"
            device="auto"
            title="A Ajuda não abriu"
            description={ajuda.erro.mensagem}
            {...(ajuda.erro.podeRepetir
              ? { primaryAction: { label: "Tentar de novo", onClick: ajuda.tentarDeNovo } }
              : {})}
          />
        ) : null}

        {fase === "encerrada" ? (
          <AlertBox
            theme="light"
            variant="info"
            device="auto"
            title="A conversa terminou"
            description="Se ainda tiver alguma dúvida, é só começar de novo."
            primaryAction={{ label: "Começar de novo", onClick: ajuda.tentarDeNovo }}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant={microfoneAberto ? "primary" : "outline"}
              size="sm"
              onClick={ajuda.alternarMicrofone}
              disabled={!conversando || ajuda.microfone === "ligando" || ajuda.microfone === "bloqueado"}
              aria-pressed={microfoneAberto}
              leftIcon={
                <Icon name={microfoneAberto ? "mic" : "mic_off"} size="xs" color="currentColor" aria-hidden />
              }
            >
              {ROTULO_DO_MICROFONE[ajuda.microfone]}
            </Button>
            <span className="text-[12px] text-unooria-neutral-500" aria-live="polite">
              {ajuda.pessoaFalando
                ? "Ouvindo você…"
                : ajuda.atendenteFalando
                  ? "O atendente está falando"
                  : ajuda.microfone === "bloqueado"
                    ? "Sem microfone: escreva a sua pergunta abaixo."
                    : null}
            </span>
          </div>
          {conversando && ajuda.restanteS !== null ? (
            <span className="flex items-center gap-1 text-[12px] text-unooria-neutral-600">
              <Icon name="schedule" size="3xs" color="currentColor" aria-hidden />
              <span>Tempo desta conversa: {relogio(ajuda.restanteS)}</span>
            </span>
          ) : null}
        </div>

        <ScrollBar maxHeight={220} autoHide>
          <div className="flex flex-col gap-3 pr-2" aria-live="polite">
            {conversa.mensagens.map((m) => (
              <Fala key={m.id} mensagem={m} />
            ))}
            <div ref={fimDaLista} />
          </div>
        </ScrollBar>

        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-1 text-[12px] text-unooria-neutral-500">
            <Icon name="privacy_tip" size="3xs" color="currentColor" aria-hidden="true" />
            <span>Não diga nem escreva nomes de estudantes.</span>
          </p>
          <ChatComposer
            label="Escreva a sua pergunta"
            placeholder="Escreva a sua pergunta sobre a plataforma"
            maxLength={500}
            disabled={!conversando}
            onSend={ajuda.enviar}
          />
        </div>
      </div>
    </ModalBody>
  );
}

function Fala({ mensagem }: { mensagem: MensagemDaAjuda }) {
  if (mensagem.autor === "pessoa") {
    return (
      <ChatMessage autor="professor" authorLabel="Você">
        {mensagem.texto}
      </ChatMessage>
    );
  }
  if (mensagem.estado === "erro") {
    return <ChatMessage autor="agente" authorLabel="Atendente" estado="erro" erro={mensagem.texto} />;
  }
  return (
    <ChatMessage
      autor="agente"
      authorLabel="Atendente"
      estado={mensagem.estado === "transmitindo" ? "transmitindo" : "pronta"}
    >
      {mensagem.texto}
    </ChatMessage>
  );
}
