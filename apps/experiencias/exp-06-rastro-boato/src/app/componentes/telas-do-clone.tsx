import { useEffect, useRef, useState } from "react";
import {
  ChatHeader,
  ChatListItem,
  ChatWallpaper,
  Dialog,
  Icon,
  MessageBubble,
  MessageComposer,
  Radio,
  StatusBar,
  TextButton,
  TopBar,
} from "@edu/ui/ds-whatsapp";
import { SEGUNDOS_ATE_O_ALERTA, auditadasDo, mensagensDo, segundosDesde } from "../../lib/regras";
import type { Conversa, Convocacao, Estado, Mensagem, OpcaoPublica } from "../../lib/tipos";
import { BalaoDeVoz } from "./voz";

/**
 * As telas de DENTRO do mensageiro — Etapas 2 e 3.
 *
 * Aqui quem fala é o app clonado, e só ele: nenhum token, componente ou palavra
 * da plataforma entra. O disfarce vale até o fim da decisão; do breakpoint em
 * diante quem assume é a escola (`telas-da-escola.tsx`).
 */

// ─────────────────────────────────────────── Etapa 2: a lista de conversas

export function ListaDeConversas({
  conversas,
  mensagens,
  estado,
  aoAbrir,
}: {
  conversas: Conversa[];
  mensagens: Mensagem[];
  estado: Estado;
  aoAbrir: (chatId: string) => void;
}) {
  return (
    <div className="app">
      <StatusBar />
      <TopBar title="Conversas" />
      <div className="app__corpo">
        {conversas.map((c) => {
          const auditadas = auditadasDo(estado, mensagens, c.id);
          return (
            <ChatListItem
              key={c.id}
              name={c.nome}
              preview={c.previa}
              time={c.hora}
              /* O badge de não-lidas SOME quando o estudante já auditou algo
                 nesta conversa — é a affordance nativa de "já vi isto aqui", e
                 é o que responde à criança que auditou três balões do MESMO
                 grupo por que a cota não fechou: ela é sobre fontes distintas.
                 O pacote não publica subtítulo no item, e inventar uma segunda
                 linha aqui quebraria o layout que a lista imita. */
              unread={auditadas > 0 ? undefined : c.naoLidas || undefined}
              onClick={() => aoAbrir(c.id)}
            />
          );
        })}
      </div>
      <div className="app__rodape">
        <p className="aviso-de-rede" role="status">
          Dados de mensagem abertos: {estado.totalAuditadas} de 3
        </p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────── Etapa 2: o feed e o modal

export function FeedDaConversa({
  conversa,
  mensagens,
  estado,
  aoVoltar,
  aoAuditar,
  aoOuvirAudio,
}: {
  conversa: Conversa;
  mensagens: Mensagem[];
  estado: Estado;
  aoVoltar: () => void;
  aoAuditar: (mensagem: Mensagem, segundosLendo: number) => void;
  aoOuvirAudio: (id: string) => void;
}) {
  const [aberta, setAberta] = useState<Mensagem | null>(null);
  const abertaEm = useRef(0);
  const doFeed = mensagensDo(mensagens, conversa.id);

  function abrir(m: Mensagem) {
    abertaEm.current = Date.now();
    setAberta(m);
  }

  function fechar() {
    if (aberta) aoAuditar(aberta, segundosDesde(abertaEm.current));
    setAberta(null);
  }

  return (
    <div className="app">
      <StatusBar />
      <ChatHeader name={conversa.nome} presence={conversa.subtitulo} onBack={aoVoltar} />
      <ChatWallpaper className="app__corpo">
        <div className="feed">
          {doFeed.map((m) => (
            <div className="feed__linha" key={m.id}>
              <button
                type="button"
                className="feed__balao"
                onClick={() => abrir(m)}
                aria-label={`Ver dados da mensagem de ${m.autor}`}
              >
                {m.encaminhada && (
                  <span className="selo-encaminhada">
                    <Icon name="forward" size={12} />
                    Encaminhada com frequência
                  </span>
                )}
                <span className="feed__autor">{m.autor}</span>
                <MessageBubble direction="in" time={m.hora}>
                  {m.tipo === "audio" && m.duracaoSeg && m.transcricao ? (
                    <BalaoDeVoz
                      duracaoSeg={m.duracaoSeg}
                      transcricao={m.transcricao}
                      aoOuvir={() => aoOuvirAudio(m.id)}
                    />
                  ) : m.tipo === "documento" ? (
                    <>
                      <MessageBubble.Document name={m.anexo ?? ""} />
                      {m.texto}
                    </>
                  ) : (
                    m.texto
                  )}
                </MessageBubble>
              </button>
            </div>
          ))}
        </div>
      </ChatWallpaper>
      {/* O campo fica INIBIDO: não há digitação livre nesta missão, e um alvo
          que não faz nada ensina o estudante a desconfiar da tela. */}
      {/* Inerte porque NÃO recebe `onChange` nem `onAction` — o pacote não tem
          prop `disabled`, e é assim que o campo fica sem alvo. Não há digitação
          livre nesta missão, e um campo que não responde ensina o estudante a
          desconfiar da tela. */}
      <MessageComposer placeholder="Toque numa mensagem para ver os dados de envio" />

      {aberta && <DadosDaMensagem mensagem={aberta} estado={estado} aoFechar={fechar} />}
    </div>
  );
}

function DadosDaMensagem({
  mensagem,
  estado,
  aoFechar,
}: {
  mensagem: Mensagem;
  estado: Estado;
  aoFechar: () => void;
}) {
  const { metadados } = mensagem;
  const progresso = Math.min(estado.totalAuditadas, 3);
  return (
    <Dialog open title="Dados da mensagem" onClose={aoFechar}>
      <div className="metadados">
        <div className="metadados__bloco">
          <Icon name="forward" size={20} />
          <div>
            <p className="metadados__valor">
              {/* `null` NÃO é zero: a mensagem nasceu nesta conversa, e dizer
                  "encaminhada 0 vezes" seria descrever outra coisa. */}
              {metadados.saltos === null
                ? "Não foi encaminhada"
                : metadados.saltos === 0
                  ? "Publicada aqui, sem repasses"
                  : `Encaminhada ${metadados.saltos} vezes entre grupos`}
            </p>
            <p className="metadados__detalhe">{metadados.carimbo}</p>
          </div>
        </div>
        <div className="metadados__bloco">
          <Icon name="lock" size={20} />
          <div>
            <p className="metadados__valor">{metadados.autor}</p>
            <p className="metadados__detalhe">{metadados.detalhe}</p>
          </div>
        </div>
        <div className="metadados__barra" aria-hidden="true">
          <span style={{ width: `${(progresso / 3) * 100}%` }} />
        </div>
        <p className="metadados__progresso">Mensagens verificadas: {progresso} de 3</p>
      </div>
      <TextButton onClick={aoFechar}>Fechar</TextButton>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────── Etapa 3: o PICO

/**
 * A tela da decisão. **Teto estrito de 5 elementos** (banner, balão do áudio e
 * os três cards), e nada mais.
 *
 * O silêncio pedagógico é absoluto no estado padrão: sem scaffolding, sem dica,
 * sem Tomás. Só depois de 90 segundos de inação o suporte ficcional entra — e
 * ele não dá a resposta, apenas nomeia o custo de não agir.
 */
export function TelaDaDecisao({
  convocacao,
  opcoes,
  aoDecidir,
  aoHesitar,
}: {
  convocacao: Convocacao;
  opcoes: OpcaoPublica[];
  aoDecidir: (opcao: OpcaoPublica["id"], latenciaSeg: number, hesitou: boolean) => void;
  aoHesitar: () => void;
}) {
  const [escolhida, setEscolhida] = useState<OpcaoPublica["id"] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [hesitou, setHesitou] = useState(false);
  const abertaEm = useRef(Date.now());

  useEffect(() => {
    const id = window.setTimeout(() => {
      setHesitou(true);
      aoHesitar();
    }, SEGUNDOS_ATE_O_ALERTA * 1000);
    return () => window.clearTimeout(id);
  }, [aoHesitar]);

  return (
    <div className={`app${hesitou ? " decisao--hesitando" : ""}`}>
      <StatusBar />
      <ChatHeader name="Turma 6º B" presence="28 participantes" />
      <div className="contagio" role="status">
        <Icon name="sbAlert" size={18} />
        {convocacao.banner}
      </div>
      <ChatWallpaper className="app__corpo">
        <div className="decisao">
          <div className="feed__linha">
            <div className="feed__balao" style={{ cursor: "default" }}>
              <span className="feed__autor">{convocacao.autor}</span>
              <MessageBubble direction="in" time={convocacao.hora}>
                <BalaoDeVoz
                  duracaoSeg={convocacao.duracaoSeg}
                  transcricao={convocacao.transcricao}
                />
              </MessageBubble>
            </div>
          </div>

          <div className="decisao__opcoes">
            {opcoes.map((o) => (
              <Radio
                key={o.id}
                name="intervencao"
                label={o.texto}
                checked={escolhida === o.id}
                onChange={() => setEscolhida(o.id)}
              />
            ))}
          </div>

          {/* O único texto que quebra o silêncio, e só depois de 90s. Ele nomeia
              o custo da inação sem apontar qual opção tomar. */}
          {hesitou && !escolhida && (
            <p className="decisao__alerta">
              O silêncio também deixa o boato correr. O que vamos fazer com essa mensagem?
            </p>
          )}
        </div>
      </ChatWallpaper>

      <div className="app__rodape">
        <TextButton disabled={!escolhida} onClick={() => setConfirmando(true)}>
          Enviar
        </TextButton>
      </div>

      {/* Confirmação de 1 toque: impede o clique acidental de virar latch, sem
          transformar a decisão num formulário. */}
      {confirmando && escolhida && (
        <Dialog open title="Confirmar ação no grupo?" onClose={() => setConfirmando(false)}>
          <p>{opcoes.find((o) => o.id === escolhida)?.texto}</p>
          <TextButton
            onClick={() =>
              aoDecidir(escolhida, segundosDesde(abertaEm.current), hesitou)
            }
          >
            Confirmar
          </TextButton>
        </Dialog>
      )}
    </div>
  );
}
