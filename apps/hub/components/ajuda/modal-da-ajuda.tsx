"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  ProgressBar,
  ScrollBar,
  TypingIndicator,
} from "@edu/ui/ds";
import { relogio, type MensagemDaAjuda } from "@/lib/ajuda/conversa";
import { lerConfiguracao, type Atendente, type ConfiguracaoDaJanela } from "@/lib/ajuda/transporte";
import { useSessaoDaAjuda, type EstadoDoMicrofone, type SessaoDaAjuda } from "./use-sessao-da-ajuda";
import { useSessaoDoMascote } from "./use-sessao-do-mascote";

/**
 * A AJUDA (ADR-132, ADR-158): quem atende em cima, a conversa escrita embaixo.
 * Aberta pelo item "Ajuda" do menu da conta, em todas as áreas menos a do
 * estudante.
 *
 * **Dois atendentes, a mesma janela.** O `admin` escolhe o padrão da rede em
 * `/unooria/uso-de-ia`: o MASCOTE da Unooria (o modelo 3D falando pelo Gemini
 * Live, com a boca tirada do próprio áudio) ou o AVATAR em vídeo (LiveAvatar).
 * Se ele permitir, a pessoa troca por um botão — a troca desmonta a conversa
 * atual (a sessão fecha e o minuto para de contar) e monta a outra.
 *
 * Montagem do DS (`@edu/ui/ds`, seção `unooria`): `Modal` + `ModalTitle` (o
 * nome acessível do diálogo), `ChatMessage` + `ChatComposer` + `TypingIndicator`
 * — o mesmo kit do agente de IA do professor —, a lista dentro de `ScrollBar`,
 * `ProgressBar` para o mascote baixando e `AlertBox` para os estados que
 * interrompem a conversa.
 *
 * **O `<video>` e o `<canvas>` são os únicos elementos crus, e são mídia, não
 * controle**: o DS não publica player de vídeo ao vivo nem cena 3D. Não têm
 * estado nem aparência de controle — são a janela onde o atendente aparece. O
 * fundo do palco do mascote é a compensação de cor desta moldura (o degradê da
 * marca em `--unooria-color-*`), não um componente.
 *
 * A conversa só existe ENQUANTO o modal está aberto: fechar desmonta o
 * conteúdo, e a desmontagem encerra a sessão (o minuto para de contar). Nada é
 * guardado — nem aqui, nem na api.
 *
 * `data-clarity-mask` no corpo inteiro: a pessoa pode dizer ou escrever o nome
 * de um estudante (o aviso pede que não), e o Clarity grava a tela.
 */

export function ModalDaAjuda({ aberto, aoFechar, apiUrl }: { aberto: boolean; aoFechar: () => void; apiUrl: string }) {
  return (
    <Modal isOpen={aberto} onClose={aoFechar} size="lg" closeOnOverlayClick={false}>
      <ModalHeader>
        <ModalTitle>Ajuda</ModalTitle>
        <ModalDescription>Tire suas dúvidas sobre a plataforma, falando ou escrevendo.</ModalDescription>
      </ModalHeader>
      {/* Só monta aberto: é a montagem que abre a sessão e a desmontagem que a fecha. */}
      {aberto ? <JanelaDaAjuda apiUrl={apiUrl} /> : null}
    </Modal>
  );
}

const NOME_DO_ATENDENTE: Record<Atendente, string> = { mascote: "Mascote", avatar: "Atendente" };
const TROCAR_PARA: Record<Atendente, string> = {
  mascote: "Conversar com o mascote",
  avatar: "Conversar com o atendente em vídeo",
};

type Troca = { rotulo: string; aoTrocar: () => void } | null;

/** Lê quem atende (a configuração da rede) antes de abrir qualquer sessão. */
function JanelaDaAjuda({ apiUrl }: { apiUrl: string }) {
  const [config, setConfig] = useState<ConfiguracaoDaJanela | null | "carregando">("carregando");
  const [atendente, setAtendente] = useState<Atendente | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let viva = true;
    setConfig("carregando");
    void lerConfiguracao().then((lida) => {
      if (!viva) return;
      setConfig(lida);
      setAtendente(lida?.atendente ?? null);
    });
    return () => {
      viva = false;
    };
  }, [tentativa]);

  if (config === "carregando") {
    return (
      <ModalBody scrollable={false}>
        <div className="flex justify-center py-10">
          <TypingIndicator showLabel label="Chamando quem atende…" />
        </div>
      </ModalBody>
    );
  }
  if (!config || !atendente) {
    return (
      <ModalBody scrollable={false}>
        <AlertBox
          theme="light"
          variant="warning"
          device="auto"
          title="A Ajuda não abriu"
          description={
            config
              ? "A Ajuda com atendente não está disponível agora."
              : "Não foi possível falar com a plataforma. Confira a conexão e tente de novo."
          }
          primaryAction={{ label: "Tentar de novo", onClick: () => setTentativa((n) => n + 1) }}
        />
      </ModalBody>
    );
  }

  const outro: Atendente = atendente === "mascote" ? "avatar" : "mascote";
  const troca: Troca = config.podeTrocar ? { rotulo: TROCAR_PARA[outro], aoTrocar: () => setAtendente(outro) } : null;

  // `key`: trocar de atendente DESMONTA a conversa anterior, e a desmontagem fecha a sessão dela.
  return atendente === "mascote" ? (
    <ConversaComMascote key="mascote" modeloUrl={config.modeloDoMascote} apiUrl={apiUrl} troca={troca} />
  ) : (
    <ConversaComAtendente key="avatar" troca={troca} />
  );
}

function ConversaComAtendente({ troca }: { troca: Troca }) {
  const video = useRef<HTMLVideoElement>(null);
  const ajuda = useSessaoDaAjuda(video);
  const { fase } = ajuda;

  return (
    <ModalBody scrollable={false}>
      <div className="flex flex-col gap-4" data-clarity-mask="true" data-ajuda="" data-atendente="avatar">
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

        <PainelDaConversa ajuda={ajuda} atendente="avatar" troca={troca} />
      </div>
    </ModalBody>
  );
}

/** O degradê da marca atrás do canvas transparente — os tokens do DS, com o valor de reserva deles. */
const PALCO_DO_MASCOTE =
  "radial-gradient(120% 90% at 50% 15%, var(--unooria-color-opacity-brandnavy-100, rgba(127, 165, 226, 0.1)), transparent 70%), var(--unooria-color-neutral-50, #f7f8fa)";

function ConversaComMascote({ modeloUrl, apiUrl, troca }: { modeloUrl: string; apiUrl: string; troca: Troca }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ajuda = useSessaoDoMascote(canvas, { modeloUrl, apiUrl });
  const { fase, carregandoModelo } = ajuda;

  return (
    <ModalBody scrollable={false}>
      <div className="flex flex-col gap-4" data-clarity-mask="true" data-ajuda="" data-atendente="mascote">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl" style={{ background: PALCO_DO_MASCOTE }}>
          <canvas ref={canvas} className="h-full w-full" role="img" aria-label="O mascote da Unooria" />

          {carregandoModelo !== null ? (
            <div className="absolute inset-x-6 bottom-6">
              <ProgressBar
                value={Math.round(carregandoModelo * 100)}
                label="Chamando o mascote…"
                valuePosition="none"
                variant="brand"
              />
            </div>
          ) : fase === "abrindo" || fase === "conectando" ? (
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <TypingIndicator showLabel label={fase === "abrindo" ? "Chamando o mascote…" : "Conectando a conversa…"} />
            </div>
          ) : null}

          {ajuda.semRosto ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[14px] text-unooria-neutral-600">
              O mascote não apareceu nesta tela, mas a conversa continua por voz e por escrito.
            </div>
          ) : null}
        </div>

        <PainelDaConversa ajuda={ajuda} atendente="mascote" troca={troca} />
      </div>
    </ModalBody>
  );
}

const ROTULO_DO_MICROFONE: Record<EstadoDoMicrofone, string> = {
  desligado: "Falar",
  ligando: "Ligando o microfone…",
  ligado: "Silenciar microfone",
  mudo: "Ligar microfone",
  bloqueado: "Microfone bloqueado",
};

/** Os controles, a conversa e o campo — iguais para os dois atendentes. */
function PainelDaConversa({ ajuda, atendente, troca }: { ajuda: SessaoDaAjuda; atendente: Atendente; troca: Troca }) {
  const fimDaLista = useRef<HTMLDivElement>(null);
  const { fase, conversa } = ajuda;
  const nome = NOME_DO_ATENDENTE[atendente];

  /* Rola até a última fala a cada mensagem nova (ou pedaço de resposta). */
  const ultima = conversa.mensagens.at(-1);
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ block: "nearest" });
  }, [conversa.mensagens.length, ultima?.texto]);

  const conversando = fase === "conversando";
  const microfoneAberto = ajuda.microfone === "ligado";
  const trocar = useCallback(() => troca?.aoTrocar(), [troca]);

  return (
    <>
      {fase === "erro" && ajuda.erro ? (
        <AlertBox
          theme="light"
          variant="warning"
          device="auto"
          title="A Ajuda não abriu"
          description={ajuda.erro.mensagem}
          {...(ajuda.erro.podeRepetir ? { primaryAction: { label: "Tentar de novo", onClick: ajuda.tentarDeNovo } } : {})}
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
            leftIcon={<Icon name={microfoneAberto ? "mic" : "mic_off"} size="xs" color="currentColor" aria-hidden />}
          >
            {ROTULO_DO_MICROFONE[ajuda.microfone]}
          </Button>
          <span className="text-[12px] text-unooria-neutral-500" aria-live="polite">
            {ajuda.pessoaFalando
              ? "Ouvindo você…"
              : ajuda.atendenteFalando
                ? atendente === "mascote"
                  ? "O mascote está falando"
                  : "O atendente está falando"
                : ajuda.microfone === "bloqueado"
                  ? "Sem microfone: escreva a sua pergunta abaixo."
                  : null}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {conversando && ajuda.restanteS !== null ? (
            <span className="flex items-center gap-1 text-[12px] text-unooria-neutral-600">
              <Icon name="schedule" size="3xs" color="currentColor" aria-hidden />
              <span>Tempo desta conversa: {relogio(ajuda.restanteS)}</span>
            </span>
          ) : null}
          {troca ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={trocar}
              leftIcon={<Icon name="swap_horiz" size="xs" color="currentColor" aria-hidden />}
            >
              {troca.rotulo}
            </Button>
          ) : null}
        </div>
      </div>

      <ScrollBar maxHeight={220} autoHide>
        <div className="flex flex-col gap-3 pr-2" aria-live="polite">
          {conversa.mensagens.map((m) => (
            <Fala key={m.id} mensagem={m} nome={nome} />
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
    </>
  );
}

function Fala({ mensagem, nome }: { mensagem: MensagemDaAjuda; nome: string }) {
  if (mensagem.autor === "pessoa") {
    return (
      <ChatMessage autor="professor" authorLabel="Você">
        {mensagem.texto}
      </ChatMessage>
    );
  }
  if (mensagem.estado === "erro") {
    return <ChatMessage autor="agente" authorLabel={nome} estado="erro" erro={mensagem.texto} />;
  }
  return (
    <ChatMessage autor="agente" authorLabel={nome} estado={mensagem.estado === "transmitindo" ? "transmitindo" : "pronta"}>
      {mensagem.texto}
    </ChatMessage>
  );
}
