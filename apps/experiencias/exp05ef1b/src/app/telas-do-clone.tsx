import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AdminOnlyNotice,
  BottomSheet,
  Button,
  ChatBanner,
  ChatHeader,
  ChatListItem,
  ChatWallpaper,
  ForwardButton,
  MessageBubble,
  MessageComposer,
  MessageTag,
  Poll,
  Radio,
  StatusBar,
  SystemMessage,
  TabBar,
  TopBar,
} from "@edu/ui/ds-whatsapp";
import {
  HORA_DA_NINA,
  HORA_DO_APARELHO,
  SEGUNDOS_ATE_O_APOIO,
  crachasDe,
  horarioDaMensagem,
  iniciais,
  outrosParticipantes,
} from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { MensagemPublica, Opcao, PacotePublico, Pergunta, Revelacao } from "../lib/tipos";
import { BalaoDaMensagem, MidiaAberta } from "./componentes/balao";
import { LaminaDaSintese, TermometroDaTurma, altDoTermometro } from "./componentes/midia-desenhada";

/**
 * As telas de DENTRO do mensageiro. Aqui quem fala é o APP clonado, e só ele:
 * nenhum componente, token ou palavra da plataforma entra (`@edu/ui/ds-whatsapp`
 * e mais nada). O disfarce vale do convite da Nina até a síntese, e volta a
 * valer no chat da Nina das perguntas finais — ver o `AGENTS.md` da pasta.
 *
 * As falhas também falam na voz do app: "Conectando..." no lugar da presença do
 * cabeçalho (como o app real faz sem sinal), nunca "erro de servidor".
 */

// ─────────────────────────────────────────────────────── peças comuns

/** A barra do aparelho, coerente com o horário do grupo. */
function BarraDoAparelho() {
  return <StatusBar time={HORA_DO_APARELHO} batteryLabel="85%" batteryLevel={0.85} showAlert={false} />;
}

/** Rola até o fim quando a conversa ganha mensagem nova — o gesto do app ao receber. */
function useRolarAoFim(chave: unknown) {
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [chave]);
  return fim;
}

/**
 * O campo de escrever do chat privado, INERTE: não recebe `onChange` nem
 * `onAction` (o pacote não tem `disabled`). Não há digitação livre dentro do
 * mensageiro nesta missão — o único texto livre é o `Então`, na casca.
 */
function CampoInerte() {
  return (
    <div className="campo-inerte" inert>
      <MessageComposer placeholder={TEXTOS.nina.campo} />
    </div>
  );
}

// ─────────────────────────────────────── E1-ALU-01: a lista de conversas

export function ListaDeConversas({
  preparada,
  conectado,
  aoAbrirNina,
}: {
  preparada: boolean;
  conectado: boolean;
  aoAbrirNina: () => void;
}) {
  return (
    <div className="app">
      <BarraDoAparelho />
      <TopBar
        title={conectado ? TEXTOS.lista.titulo : TEXTOS.erros.conectando}
        showSearch={false}
        showMenu={false}
        footer={
          <TabBar
            items={[{ id: "conversas", label: TEXTOS.lista.abaConversas }]}
            activeId="conversas"
            showCamera={false}
          />
        }
      />
      <div className="app__corpo">
        {preparada ? (
          <ChatListItem
            name={TEXTOS.lista.nina}
            initials="N"
            preview={TEXTOS.lista.previaDaNina}
            time={HORA_DA_NINA}
            unread={1}
            onClick={aoAbrirNina}
          />
        ) : (
          /* A missão nasce vazia: sem pacote aprovado não há Nina. Quem tira a
             criança daqui é o polling, sozinho, quando o professor aprova. */
          <p className="lista__vazia" role="status">
            {TEXTOS.lista.grupoEmPreparo}
          </p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────── E1-ALU-02: o chat da Nina com o convite

export function ChatDoConvite({
  convite,
  grupo,
  conectado,
  entrando,
  aoVoltar,
  aoEntrar,
}: {
  convite: string;
  grupo: string;
  conectado: boolean;
  entrando: boolean;
  aoVoltar: () => void;
  aoEntrar: () => void;
}) {
  return (
    <div className="app">
      <BarraDoAparelho />
      <ChatHeader
        name={TEXTOS.lista.nina}
        initials="N"
        presence={conectado ? TEXTOS.nina.presenca : TEXTOS.erros.conectando}
        onBack={aoVoltar}
      />
      <ChatWallpaper className="app__corpo">
        <div className="conversa">
          <MessageBubble direction="in" time={HORA_DA_NINA}>
            {convite}
          </MessageBubble>
          <MessageBubble direction="in" time={HORA_DA_NINA} tail={false}>
            <MessageBubble.Invite
              title={grupo}
              subtitle={TEXTOS.nina.conviteSubtitulo}
              initials={iniciais(grupo)}
              actionLabel={TEXTOS.nina.entrarNoGrupo}
              actionDisabled={entrando}
              onAction={aoEntrar}
            />
          </MessageBubble>
        </div>
      </ChatWallpaper>
      <CampoInerte />
    </div>
  );
}

// ───────────────────────────────────── E2-ALU-01/02/03: o grupo da turma

export function GrupoDaTurma({
  pacote,
  selecao,
  limite,
  conectado,
  aoAlternar,
  aoIrParaOMural,
  aoAvisar,
}: {
  pacote: PacotePublico;
  selecao: readonly string[];
  limite: number;
  conectado: boolean;
  /** Tira (se já estava) ou põe (depois do "Enviar" da folha) uma mensagem na seleção. */
  aoAlternar: (id: string) => void;
  aoIrParaOMural: () => void;
  aoAvisar: (texto: string) => void;
}) {
  const [folhaPara, setFolhaPara] = useState<MensagemPublica | null>(null);
  const [midia, setMidia] = useState<{ mensagem: MensagemPublica; hora: string } | null>(null);
  const [apoio, setApoio] = useState(false);
  const completa = selecao.length >= limite;

  /* O apoio da Nina: 90 s sem encaminhar nada. O relógio recomeça a cada
     mudança na seleção, e o apoio some no primeiro encaminhamento — ele ensina
     o GESTO (a seta), nunca a escolha. */
  useEffect(() => {
    setApoio(false);
    if (completa) return;
    const id = window.setTimeout(() => setApoio(true), SEGUNDOS_ATE_O_APOIO * 1000);
    return () => window.clearTimeout(id);
  }, [selecao.length, completa]);

  function tocarNaSeta(m: MensagemPublica) {
    if (selecao.includes(m.id)) {
      aoAlternar(m.id);
      return;
    }
    if (completa) {
      aoAvisar(TEXTOS.grupo.limiteAtingido);
      return;
    }
    setFolhaPara(m);
  }

  /* A faixa fixa é tocável, como a mensagem fixada do app real: com 3 ela
     leva ao Mural, com menos a recusa FALA (`e2.erro.toast_menor_3`). */
  function tocarNaFaixa() {
    if (completa) aoIrParaOMural();
    else aoAvisar(TEXTOS.grupo.faltamMensagens);
  }

  return (
    <div className="app">
      <BarraDoAparelho />
      <ChatHeader
        name={pacote.grupo.nome}
        initials={iniciais(pacote.grupo.nome)}
        presence={
          conectado
            ? TEXTOS.grupo.participantes(outrosParticipantes(pacote.grupo.participantes))
            : TEXTOS.erros.conectando
        }
      />
      <ChatBanner
        role="button"
        tabIndex={0}
        className="faixa-tocavel"
        onClick={tocarNaFaixa}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            tocarNaFaixa();
          }
        }}
        trailing={<span aria-hidden="true">{TEXTOS.grupo.contadorCurto(selecao.length)}</span>}
      >
        {TEXTOS.grupo.banner}
      </ChatBanner>
      {/* O contador por extenso vai à região viva: a faixa mostra só "N/3". */}
      <p className="so-leitor" role="status">
        {TEXTOS.grupo.contador(selecao.length)}
      </p>
      {apoio && (
        <ChatBanner role="status" className="faixa-de-apoio">
          {TEXTOS.grupo.apoioDaNina}
        </ChatBanner>
      )}

      <ChatWallpaper className="app__corpo">
        <div className="conversa">
          <SystemMessage>{TEXTOS.grupo.entrou}</SystemMessage>
          {pacote.mensagens.map((m, i) => {
            const escolhida = selecao.includes(m.id);
            const esgotada = completa && !escolhida;
            const hora = horarioDaMensagem(i);
            return (
              <div className="linha-do-grupo" key={m.id}>
                <BalaoDaMensagem
                  mensagem={m}
                  direcao="in"
                  hora={hora}
                  comRemetente
                  aoAbrirMidia={(mensagem) => setMidia({ mensagem, hora })}
                />
                {/*
                  (b) COMPENSAÇÃO — em 3/3 as setas que sobraram ficam a 30%, mas
                  CONTINUAM respondendo: o toque na quarta é o que dispara
                  "Limite de 3 mensagens atingido" (`e2.erro.toast_limite_3`). O
                  `ForwardButton` só esmaece por `:disabled`, e `<button
                  disabled>` engole o toque — a recusa ficaria muda. Então o
                  botão fica ACESSÍVEL (`aria-disabled`, que o leitor anuncia) e
                  a opacidade vem de `.encaminhar--esgotado`. PEDIDO ao
                  `storybook-unooria`: `ForwardButton` com estado esgotado que
                  esmaeça sem engolir o toque.
                */}
                <ForwardButton
                  label={TEXTOS.grupo.encaminharDe(m.remetente)}
                  selected={escolhida}
                  aria-disabled={esgotada || undefined}
                  className={esgotada ? "encaminhar--esgotado" : undefined}
                  onClick={() => tocarNaSeta(m)}
                />
              </div>
            );
          })}
        </div>
      </ChatWallpaper>

      <div className="rodape">
        {completa && (
          <div className="rodape__acao">
            <Button size="lg" block onClick={aoIrParaOMural}>
              {TEXTOS.grupo.irParaOMural}
            </Button>
          </div>
        )}
        <AdminOnlyNotice>{TEXTOS.grupo.soAdmins}</AdminOnlyNotice>
      </div>

      <BottomSheet
        open={folhaPara !== null}
        title={TEXTOS.folha.titulo}
        onClose={() => setFolhaPara(null)}
        footer={
          <Button
            onClick={() => {
              if (folhaPara) aoAlternar(folhaPara.id);
              setFolhaPara(null);
            }}
          >
            {TEXTOS.folha.enviar}
          </Button>
        }
      >
        {/* Um destino só, e já marcado: a folha é o gesto do app, não uma escolha. */}
        <div className="folha__destino">
          <Radio
            name="destino"
            checked
            readOnly
            label={
              <span className="folha__rotulo">
                <span>{TEXTOS.folha.destino}</span>
                <span className="folha__subrotulo">{TEXTOS.folha.subdestino}</span>
              </span>
            }
          />
        </div>
      </BottomSheet>

      {midia && <MidiaAberta mensagem={midia.mensagem} hora={midia.hora} aoFechar={() => setMidia(null)} />}
    </div>
  );
}

// ──────────────────────────── E3 a E5: o Mural da Turma, etapa por etapa

/**
 * Em que ponto o Mural está. É UMA conversa só, que vai ganhando mensagens:
 * as três encaminhadas, a enquete, a espera, e — depois dos botões do
 * professor — os crachás, o termômetro e a lâmina. `atrasada` é quem votou
 * depois de a turma já estar na reflexão: vê revelação e síntese de uma vez, e
 * segue com "Continuar".
 */
export type EtapaDoMural = "revisao" | "enquete" | "espera" | "revelacao" | "sintese" | "atrasada";

export function MuralDaTurma({
  etapa,
  mensagens,
  todas,
  motivos,
  motivo,
  revelacao,
  conectado,
  ocupado,
  aoRevisar,
  aoConfirmar,
  aoVotar,
  aoContinuar,
}: {
  etapa: EtapaDoMural;
  /** As três escolhidas, na ordem do grupo. */
  mensagens: MensagemPublica[];
  /** O pacote inteiro — só para o horário original de cada uma. */
  todas: MensagemPublica[];
  motivos: Opcao[];
  motivo: string | null;
  revelacao: Revelacao | null;
  conectado: boolean;
  ocupado: boolean;
  aoRevisar: () => void;
  aoConfirmar: () => void;
  aoVotar: (motivo: string) => void;
  aoContinuar: () => void;
}) {
  const [escolha, setEscolha] = useState<string | null>(motivo);
  const [midia, setMidia] = useState<{ mensagem: MensagemPublica; hora: string } | null>(null);
  const topo = useRef<HTMLDivElement>(null);
  const fim = useRef<HTMLDivElement>(null);

  const revelado = etapa === "revelacao" || etapa === "sintese" || etapa === "atrasada";
  const comSintese = etapa === "sintese" || etapa === "atrasada";
  const confirmado = etapa !== "revisao";
  const votou = etapa !== "revisao" && etapa !== "enquete";

  /* A revelação abre no TOPO (os crachás em cima das três mensagens são o que
     salta); a síntese e as etapas anteriores, no FIM (a mensagem nova). */
  useEffect(() => {
    if (etapa === "revelacao" || etapa === "atrasada") topo.current?.scrollIntoView({ block: "start" });
    else fim.current?.scrollIntoView({ block: "end" });
  }, [etapa]);

  const rotuloDoMotivo = motivos.find((o) => o.id === (revelacao?.motivo ?? motivo))?.rotulo ?? "";
  const horaDe = (m: MensagemPublica) => horarioDaMensagem(todas.findIndex((x) => x.id === m.id));

  return (
    <div className="app">
      <BarraDoAparelho />
      <ChatHeader
        name={TEXTOS.mural.titulo}
        initials={iniciais(TEXTOS.mural.titulo)}
        presence={conectado ? TEXTOS.mural.presenca : TEXTOS.erros.conectando}
        onBack={etapa === "revisao" ? aoRevisar : undefined}
      />
      {etapa === "revisao" && <ChatBanner>{TEXTOS.mural.confira}</ChatBanner>}

      <ChatWallpaper className="app__corpo">
        <div className="conversa">
          <div ref={topo} />
          {/* E3-ALU-02: na enquete, o histórico recua a 30% — o PICO é um elemento só. */}
          <div className={etapa === "enquete" ? "historico historico--esmaecido" : "historico"}>
            {mensagens.map((m) => {
              const crachas = revelado ? crachasDe(revelacao, m.id) : null;
              return (
                <div className="linha-do-mural" key={m.id}>
                  <BalaoDaMensagem
                    mensagem={m}
                    direcao="out"
                    hora={horaDe(m)}
                    encaminhada
                    entrega={confirmado ? "read" : "none"}
                    aoAbrirMidia={(mensagem) => setMidia({ mensagem, hora: horaDe(mensagem) })}
                  />
                  {crachas && <CrachasDaMensagem veracidade={crachas.veracidade} tom={crachas.tom} />}
                </div>
              );
            })}
          </div>

          {confirmado && (
            <MessageBubble direction="in" tail={false} maxWidth={300}>
              <Poll
                question={TEXTOS.enquete.pergunta}
                options={motivos.map((o) => ({ id: o.id, label: o.rotulo }))}
                value={votou ? motivo : escolha}
                onChange={setEscolha}
                onVote={() => escolha && aoVotar(escolha)}
                voted={votou}
                disabled={ocupado}
                voteLabel={TEXTOS.enquete.votar}
              />
            </MessageBubble>
          )}

          {etapa === "espera" && (
            <SystemMessage role="status">
              <strong>{TEXTOS.espera.titulo}</strong>
              <br />
              {TEXTOS.espera.descricao}
              <br />
              {TEXTOS.espera.status}
            </SystemMessage>
          )}

          {revelado && revelacao && (
            <>
              <SystemMessage>{TEXTOS.revelacao.motivoDeclarado(rotuloDoMotivo)}</SystemMessage>
              <MessageBubble direction="in">{revelacao.callback}</MessageBubble>
              <MessageBubble direction="in" maxWidth={300}>
                <MessageBubble.Media
                  alt={altDoTermometro(revelacao.turma.falsaNeutra, revelacao.turma.verdadeiraEmocionalDescartada)}
                  ratio="auto"
                >
                  <TermometroDaTurma
                    falsaNeutra={revelacao.turma.falsaNeutra}
                    verdadeiraEmocionalDescartada={revelacao.turma.verdadeiraEmocionalDescartada}
                  />
                </MessageBubble.Media>
              </MessageBubble>
            </>
          )}

          {comSintese && (
            <>
              <MessageBubble direction="in" maxWidth={300}>
                <MessageBubble.Media alt={TEXTOS.sintese.altDaLamina} ratio="auto">
                  <LaminaDaSintese />
                </MessageBubble.Media>
                <p className="balao__texto">{TEXTOS.sintese.frase}</p>
              </MessageBubble>
              <MessageBubble direction="in">{TEXTOS.sintese.callback}</MessageBubble>
              {etapa === "sintese" && <SystemMessage role="status">{TEXTOS.sintese.trava}</SystemMessage>}
            </>
          )}
          <div ref={fim} />
        </div>
      </ChatWallpaper>

      <div className="rodape">
        {etapa === "revisao" && (
          <div className="rodape__acao rodape__acao--dupla">
            <Button variant="outline" block onClick={aoRevisar} disabled={ocupado}>
              {TEXTOS.mural.revisar}
            </Button>
            <Button size="lg" block onClick={aoConfirmar} disabled={ocupado}>
              {TEXTOS.mural.confirmar}
            </Button>
          </div>
        )}
        {etapa === "atrasada" && (
          <div className="rodape__acao">
            <Button size="lg" block onClick={aoContinuar}>
              {TEXTOS.revelacao.continuar}
            </Button>
          </div>
        )}
        <AdminOnlyNotice>{TEXTOS.grupo.soAdmins}</AdminOnlyNotice>
      </div>

      {midia && <MidiaAberta mensagem={midia.mensagem} hora={midia.hora} aoFechar={() => setMidia(null)} />}
    </div>
  );
}

/** E4-ALU-01: os dois crachás, independentes — o AHA é ver que um eixo não prediz o outro. */
function CrachasDaMensagem({ veracidade, tom }: { veracidade: "verdadeira" | "falsa"; tom: "emocional" | "neutra" }) {
  const v = TEXTOS.revelacao.veracidade[veracidade];
  const t = TEXTOS.revelacao.tom[tom];
  return (
    <div className="crachas">
      <MessageTag icon={v.icone}>{v.rotulo}</MessageTag>
      <MessageTag icon={t.icone}>{t.rotulo}</MessageTag>
    </div>
  );
}

// ─────────────────────────── as perguntas finais: de volta ao chat da Nina

/**
 * O chat da Nina, de novo — a SEGUNDA travessia da fronteira: a regra foi
 * escrita na casca da escola, e as perguntas de evidência (Canal B) voltam ao
 * mensageiro, na voz da Nina, com a MESMA enquete da Etapa 3.
 *
 * O enunciado e as alternativas vêm de `GET /evidencias/exp05ef1b/perguntas/:id`
 * — embaralhadas a cada leitura, sem o nível. A tela mostra na ordem que
 * recebeu e responde pelo `id`; o recibo é sempre `{ enviada: true }`, então
 * nada aqui sabe (nem mostra) se a criança acertou.
 */
export function ChatDasPerguntas({
  convite,
  falas,
  perguntas,
  respondidas,
  despedida,
  mostrarDespedida,
  conectado,
  ocupado,
  aoResponder,
}: {
  convite: string | null;
  /** As falas da Nina antes de cada pergunta, na ordem (`textos.perguntas`). */
  falas: { perguntaId: string; fala: string }[];
  perguntas: Readonly<Record<string, Pergunta>>;
  respondidas: Readonly<Record<string, string>>;
  despedida: string;
  mostrarDespedida: boolean;
  conectado: boolean;
  ocupado: boolean;
  aoResponder: (perguntaId: string, alternativaId: string) => void;
}) {
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const visiveis: ReactNode[] = [];
  for (const { perguntaId, fala } of falas) {
    const pergunta = perguntas[perguntaId];
    const respondida = respondidas[perguntaId];
    visiveis.push(
      <MessageBubble direction="in" key={`fala-${perguntaId}`}>
        {fala}
      </MessageBubble>,
    );
    if (!pergunta) break;
    visiveis.push(
      <MessageBubble direction="in" tail={false} key={`enquete-${perguntaId}`} maxWidth={300}>
        <Poll
          question={pergunta.enunciado}
          options={pergunta.alternativas.map((a) => ({ id: a.id, label: a.texto }))}
          value={respondida ?? escolhas[perguntaId] ?? null}
          onChange={(id) => setEscolhas((e) => ({ ...e, [perguntaId]: id }))}
          onVote={() => {
            const alternativa = escolhas[perguntaId];
            if (alternativa) aoResponder(perguntaId, alternativa);
          }}
          voted={respondida !== undefined}
          disabled={ocupado}
          voteLabel={TEXTOS.enquete.votar}
          votedLabel={TEXTOS.perguntas.respostaEnviada}
        />
      </MessageBubble>,
    );
    if (respondida === undefined) break;
  }
  if (mostrarDespedida) {
    visiveis.push(
      <MessageBubble direction="in" key="despedida">
        {despedida}
      </MessageBubble>,
    );
  }
  const fim = useRolarAoFim(visiveis.length);

  return (
    <div className="app">
      <BarraDoAparelho />
      <ChatHeader
        name={TEXTOS.lista.nina}
        initials="N"
        presence={conectado ? TEXTOS.nina.presenca : TEXTOS.erros.conectando}
      />
      <ChatWallpaper className="app__corpo">
        <div className="conversa">
          {convite && (
            <MessageBubble direction="in" time={HORA_DA_NINA}>
              {convite}
            </MessageBubble>
          )}
          {visiveis}
          <div ref={fim} />
        </div>
      </ChatWallpaper>
      <CampoInerte />
    </div>
  );
}
