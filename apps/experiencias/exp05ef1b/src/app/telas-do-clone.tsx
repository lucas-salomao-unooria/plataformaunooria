import { useEffect, useRef, useState } from "react";
import {
  AdminOnlyNotice,
  BottomSheet,
  Button,
  ChatBanner,
  ChatHeader,
  ChatListItem,
  ChatWallpaper,
  FilterChip,
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
  TypingIndicator,
} from "@edu/ui/ds-unoochat";
import {
  HORA_DA_NINA,
  HORA_DO_APARELHO,
  SEGUNDOS_ATE_O_APOIO,
  MS_DIGITANDO,
  MS_ENTRE_MENSAGENS,
  crachasDe,
  estiloDaImagem,
  horarioDaMensagem,
  tomDoRemetente,
  iniciais,
  andamentoDo,
  expressaoDoMontador,
  montadorDe,
  outrosParticipantes,
  pedidoDaVez,
  podeEnviarAlerta,
  referenciasDoAlerta,
  type MontadorDoFiltro,
} from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { Alerta, Atributo, Conector, Expressao, MensagemPublica, Opcao, PacotePublico, Revelacao } from "../lib/tipos";
import { BalaoDaMensagem, MidiaAberta } from "./componentes/balao";
/* A foto da Nina é ilustração em SVG, importada pelo Vite: entra no bundle
   versionado, e a missão continua sem mídia binária (ADR-145). */
import FOTO_DA_NINA from "../assets/nina.svg";
import { LaminaDaSintese, TermometroDaTurma, altDoTermometro } from "./componentes/midia-desenhada";

/**
 * As telas de DENTRO do mensageiro. Aqui quem fala é o APP clonado, e só ele:
 * nenhum componente, token ou palavra da plataforma entra (`@edu/ui/ds-unoochat`
 * e mais nada). O disfarce vale do convite da Nina até o alerta do grupo, no
 * Mural; o robô do grupo e o fim são da escola — ver o `AGENTS.md` da pasta.
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
 * As mensagens do grupo CHEGANDO uma a uma, como num app de verdade: um
 * intervalo, o "digitando…" e a mensagem. `emSequencia: false` (a criança
 * voltou do Mural, ou já tinha escolhido alguma) mostra tudo de uma vez, e
 * `prefers-reduced-motion` também.
 */
function useChegadaEmSequencia(total: number, emSequencia: boolean, aoTerminar: () => void) {
  const [chegaram, setChegaram] = useState(() => {
    const semMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    return emSequencia && !semMovimento ? 0 : total;
  });
  const [digitando, setDigitando] = useState(false);
  const terminar = useRef(aoTerminar);
  useEffect(() => {
    terminar.current = aoTerminar;
  }, [aoTerminar]);
  useEffect(() => {
    if (chegaram >= total) {
      terminar.current();
      return;
    }
    const antes = window.setTimeout(() => setDigitando(true), MS_ENTRE_MENSAGENS);
    const chega = window.setTimeout(() => {
      setDigitando(false);
      setChegaram((n) => n + 1);
    }, MS_ENTRE_MENSAGENS + MS_DIGITANDO);
    return () => {
      window.clearTimeout(antes);
      window.clearTimeout(chega);
    };
  }, [chegaram, total]);
  return { chegaram: Math.min(chegaram, total), digitando: digitando && chegaram < total };
}

/**
 * O campo de escrever do chat privado, INERTE: não recebe `onChange` nem
 * `onAction` (o pacote não tem `disabled`). Não há digitação livre nesta
 * missão (a regra Se/Então saiu, ADR-145).
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
            avatarSrc={FOTO_DA_NINA}
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
        avatarSrc={FOTO_DA_NINA}
        presence={conectado ? TEXTOS.nina.presenca : TEXTOS.erros.conectando}
        onBack={aoVoltar}
      />
      {/* A conversa rola: foco e nome para o teclado alcançá-la (WCAG 2.1.1, ADR-162). */}
      <ChatWallpaper className="app__corpo" role="region" tabIndex={0} aria-label="Conversa">
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
  emSequencia,
  aoChegarTudo,
  aoAlternar,
  aoIrParaOMural,
  aoAvisar,
}: {
  pacote: PacotePublico;
  selecao: readonly string[];
  limite: number;
  conectado: boolean;
  /** As mensagens chegam uma a uma (`regras.ts#grupoChegaEmSequencia`). */
  emSequencia: boolean;
  /** As 8 chegaram: a aba não anima de novo. */
  aoChegarTudo: () => void;
  /** Tira (se já estava) ou põe (depois do "Enviar" da folha) uma mensagem na seleção. */
  aoAlternar: (id: string) => void;
  aoIrParaOMural: () => void;
  aoAvisar: (texto: string) => void;
}) {
  const [folhaPara, setFolhaPara] = useState<MensagemPublica | null>(null);
  const [midia, setMidia] = useState<{ mensagem: MensagemPublica; hora: string } | null>(null);
  const [apoio, setApoio] = useState(false);
  const completa = selecao.length >= limite;
  const { chegaram, digitando } = useChegadaEmSequencia(pacote.mensagens.length, emSequencia, aoChegarTudo);
  const fimDoGrupo = useRolarAoFim(chegaram + (digitando ? 0.5 : 0));

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

      {/* A conversa rola: foco e nome para o teclado alcançá-la (WCAG 2.1.1, ADR-162). */}
      <ChatWallpaper className="app__corpo" role="region" tabIndex={0} aria-label="Conversa">
        <div className="conversa">
          <SystemMessage>{TEXTOS.grupo.entrou}</SystemMessage>
          {pacote.mensagens.slice(0, chegaram).map((m, i) => {
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
                  estilo={estiloDaImagem(pacote.mensagens, m.id)}
                  aoAbrirMidia={(mensagem) => setMidia({ mensagem, hora })}
                />
                {/*
                  Em 3/3 as setas que sobraram ficam ESGOTADAS (`exhausted`, DS
                  0.2.6): esmaecem e se anunciam desabilitadas, mas CONTINUAM
                  respondendo — o toque na quarta é o que dispara "Limite de 3
                  mensagens atingido" (`e2.erro.toast_limite_3`). `disabled`
                  engoliria o toque, e a recusa ficaria muda.
                */}
                <ForwardButton
                  label={TEXTOS.grupo.encaminharDe(m.remetente)}
                  selected={escolhida}
                  exhausted={esgotada}
                  onClick={() => tocarNaSeta(m)}
                />
              </div>
            );
          })}
          {digitando && pacote.mensagens[chegaram] ? (
            <TypingIndicator
              sender={pacote.mensagens[chegaram].remetente}
              senderTone={tomDoRemetente(pacote.mensagens[chegaram].remetente)}
              aria-label={TEXTOS.grupo.digitando(pacote.mensagens[chegaram].remetente)}
            />
          ) : null}
          <div ref={fimDoGrupo} />
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

      {midia && (
        <MidiaAberta
          mensagem={midia.mensagem}
          hora={midia.hora}
          estilo={estiloDaImagem(pacote.mensagens, midia.mensagem.id)}
          aoFechar={() => setMidia(null)}
        />
      )}
    </div>
  );
}

// ──────────────────────────── E3 a E5: o Mural da Turma, etapa por etapa

/**
 * Em que ponto o Mural está. É UMA conversa só, que vai ganhando mensagens:
 * as três encaminhadas, a enquete, a espera, e — depois dos botões do
 * professor — os crachás, o termômetro, o alerta do grupo e a lâmina. O
 * alerta aceita jogada só na revelação (`alerta.aberto`); na síntese ficam os
 * alertas enviados.
 */
export type EtapaDoMural = "revisao" | "enquete" | "espera" | "revelacao" | "sintese";

export function MuralDaTurma({
  etapa,
  mensagens,
  todas,
  motivos,
  motivo,
  revelacao,
  alerta,
  limiteDeExecucoes,
  conectado,
  ocupado,
  aoRevisar,
  aoConfirmar,
  aoVotar,
  aoExecutarAlerta,
  aoEnviarAlerta,
}: {
  etapa: EtapaDoMural;
  /** As três escolhidas, na ordem do grupo. */
  mensagens: MensagemPublica[];
  /** O pacote inteiro — só para o horário original de cada uma. */
  todas: MensagemPublica[];
  motivos: Opcao[];
  motivo: string | null;
  revelacao: Revelacao | null;
  /** O alerta do grupo (EF05CO03) — chega junto com a revelação desta criança. */
  alerta: Alerta | null;
  /** "Ver resultado" por pedido (`limites.execucoes`). */
  limiteDeExecucoes: number;
  conectado: boolean;
  ocupado: boolean;
  aoRevisar: () => void;
  aoConfirmar: () => void;
  aoVotar: (motivo: string) => void;
  aoExecutarAlerta: (pedido: number, expressao: Expressao) => void;
  aoEnviarAlerta: (pedido: number, expressao: Expressao) => void;
}) {
  const [escolha, setEscolha] = useState<string | null>(motivo);
  const [midia, setMidia] = useState<{ mensagem: MensagemPublica; hora: string } | null>(null);
  const topo = useRef<HTMLDivElement>(null);
  const fim = useRef<HTMLDivElement>(null);

  const revelado = etapa === "revelacao" || etapa === "sintese";
  const comSintese = etapa === "sintese";
  const confirmado = etapa !== "revisao";
  const votou = etapa !== "revisao" && etapa !== "enquete";

  /* A revelação abre no TOPO (os crachás em cima das três mensagens são o que
     salta, e a faixa do alerta convida a rolar); a síntese e as etapas
     anteriores, no FIM (a mensagem nova). */
  useEffect(() => {
    if (etapa === "revelacao") topo.current?.scrollIntoView({ block: "start" });
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

      {/* A conversa rola: foco e nome para o teclado alcançá-la (WCAG 2.1.1, ADR-162). */}
      <ChatWallpaper className="app__corpo" role="region" tabIndex={0} aria-label="Conversa">
        <div className="conversa">
          <div ref={topo} />
          {/* E3-ALU-02: na enquete, o histórico recua a 30% — o PICO é um elemento só.
              Recuado, ele é FUNDO, como atrás de uma janela: sai da leitura e do
              foco (`inert` + `aria-hidden`). A 30% o texto não passaria em
              contraste nenhum, e o leitor de tela teria o que o olho não tem
              (WCAG 1.4.3, ADR-162). */}
          <div
            className={etapa === "enquete" ? "historico historico--esmaecido" : "historico"}
            inert={etapa === "enquete" || undefined}
            aria-hidden={etapa === "enquete" || undefined}
          >
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
                    estilo={estiloDaImagem(todas, m.id)}
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

          {/* O alerta vem depois dos crachás e do termômetro: é a mensagem que
              espera a criança agir. Na síntese ficam só os enviados. */}
          {revelado && alerta && (
            <AlertaDoGrupo
              alerta={alerta}
              limite={limiteDeExecucoes}
              ocupado={ocupado}
              aoExecutar={aoExecutarAlerta}
              aoEnviar={aoEnviarAlerta}
            />
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
        <AdminOnlyNotice>{TEXTOS.grupo.soAdmins}</AdminOnlyNotice>
      </div>

      {midia && (
        <MidiaAberta
          mensagem={midia.mensagem}
          hora={midia.hora}
          estilo={estiloDaImagem(todas, midia.mensagem.id)}
          aoFechar={() => setMidia(null)}
        />
      )}
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

// ─────────────────────── E4-ALU-01: o alerta do grupo (EF05CO03), no Mural

/**
 * O alerta do grupo: quatro pedidos, um por vez. Para cada um, a criança monta
 * um filtro (uma condição, ou duas ligadas por E ou OU, cada uma com o NÃO),
 * toca "Ver resultado" — o SERVIDOR executa e devolve quem passou — e envia o
 * alerta ao grupo. Enviado, o pedido trava e vira uma bolha no grupo.
 *
 * Nada aqui sabe a expressão esperada (ela não desce): a tela pinta o que o
 * servidor executou, sem cor de acerto. Se o filtro estava errado, a bolha
 * lista as mensagens erradas — a tela não comenta.
 */
function AlertaDoGrupo({
  alerta,
  limite,
  ocupado,
  aoExecutar,
  aoEnviar,
}: {
  alerta: Alerta;
  limite: number;
  ocupado: boolean;
  aoExecutar: (pedido: number, expressao: Expressao) => void;
  aoEnviar: (pedido: number, expressao: Expressao) => void;
}) {
  const daVez = pedidoDaVez(alerta);
  const enviados = alerta.andamento
    .filter((a) => a.enviado)
    .sort((x, y) => x.pedido - y.pedido);
  return (
    <>
      <SystemMessage>{TEXTOS.alerta.faixa}</SystemMessage>
      {enviados.map((a) => (
        <MessageBubble key={a.pedido} direction="out" delivery="read" maxWidth={300}>
          <strong>{TEXTOS.alerta.bolhaTitulo}</strong>
          <br />
          {TEXTOS.alerta.bolha(referenciasDoAlerta(a.enviado?.passam ?? [], alerta.quadro))}
        </MessageBubble>
      ))}
      {daVez && alerta.aberto && (
        /* `key`: o montador de cada pedido nasce vazio (ou com a última execução dele). */
        <MontadorDoAlerta
          key={daVez.n}
          alerta={alerta}
          pedido={daVez}
          primeiro={enviados.length === 0}
          limite={limite}
          ocupado={ocupado}
          aoExecutar={aoExecutar}
          aoEnviar={aoEnviar}
        />
      )}
      {!daVez && <SystemMessage role="status">{TEXTOS.alerta.enviados}</SystemMessage>}
      {daVez && !alerta.aberto && <SystemMessage role="status">{TEXTOS.alerta.fechou}</SystemMessage>}
    </>
  );
}

const ATRIBUTOS_DO_FILTRO: readonly Atributo[] = ["falsa", "emocional"];
const CONECTORES_DO_FILTRO: readonly Conector[] = ["E", "OU"];

function MontadorDoAlerta({
  alerta,
  pedido,
  primeiro,
  limite,
  ocupado,
  aoExecutar,
  aoEnviar,
}: {
  alerta: Alerta;
  /** Execuções por pedido (`limites.execucoes`). */
  limite: number;
  pedido: { n: number; texto: string };
  primeiro: boolean;
  ocupado: boolean;
  aoExecutar: (pedido: number, expressao: Expressao) => void;
  aoEnviar: (pedido: number, expressao: Expressao) => void;
}) {
  const { execucoes } = andamentoDo(alerta, pedido.n);
  const ultima = execucoes.at(-1) ?? null;
  /* Um F5 no meio do pedido volta ao último filtro executado. */
  const [montador, setMontador] = useState<MontadorDoFiltro>(() => montadorDe(ultima?.expressao ?? null));
  const naTela = expressaoDoMontador(montador);
  const restam = execucoes.length < limite;
  const podeEnviar = podeEnviarAlerta(execucoes, naTela);
  const passam = new Set(ultima?.passam ?? []);
  const total = alerta.pedidos.length;

  const condicao = (lado: "a" | "b", rotulo: string) => {
    const c = montador[lado];
    return (
      <div className="alerta__condicao" role="group" aria-label={rotulo}>
        <FilterChip
          label={TEXTOS.alerta.nao}
          selected={c.nao}
          disabled={ocupado}
          onClick={() => setMontador((m) => ({ ...m, [lado]: { ...m[lado], nao: !m[lado].nao } }))}
        />
        {ATRIBUTOS_DO_FILTRO.map((attr) => (
          <FilterChip
            key={attr}
            label={TEXTOS.alerta.atributo[attr]}
            selected={c.attr === attr}
            disabled={ocupado}
            onClick={() =>
              setMontador((m) => ({ ...m, [lado]: { ...m[lado], attr: m[lado].attr === attr ? null : attr } }))
            }
          />
        ))}
      </div>
    );
  };

  return (
    <MessageBubble direction="in" tail={false} maxWidth={320}>
      <div className="alerta">
        <p className="alerta__contador">{TEXTOS.alerta.contador(pedido.n, total)}</p>
        <p className="alerta__pedido">{pedido.texto}</p>
        {primeiro && <p className="alerta__instrucao">{TEXTOS.alerta.instrucao}</p>}

        <p className="alerta__rotulo">{TEXTOS.alerta.quadro}</p>
        <ul className="alerta__quadro">
          {alerta.quadro.map((m) => {
            const v = TEXTOS.revelacao.veracidade[m.veracidade];
            const t = TEXTOS.revelacao.tom[m.tom];
            const classe = ultima ? (passam.has(m.id) ? "alerta__linha alerta__linha--passa" : "alerta__linha alerta__linha--fora") : "alerta__linha";
            return (
              <li key={m.id} className={classe}>
                <span className="alerta__nome">{m.rotulo}</span>
                <span className="alerta__etiquetas">
                  {m.voceEnviou && <MessageTag>{TEXTOS.alerta.voceEnviou}</MessageTag>}
                  <MessageTag icon={v.icone}>{v.rotulo}</MessageTag>
                  <MessageTag icon={t.icone}>{t.rotulo}</MessageTag>
                  {ultima && passam.has(m.id) && (
                    <MessageTag icon={TEXTOS.alerta.destacada.icone}>{TEXTOS.alerta.destacada.rotulo}</MessageTag>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="alerta__rotulo">{TEXTOS.alerta.montar}</p>
        {condicao("a", TEXTOS.alerta.primeiraCondicao)}
        <div className="alerta__condicao" role="group" aria-label={TEXTOS.alerta.ligacao}>
          {CONECTORES_DO_FILTRO.map((op) => (
            <FilterChip
              key={op}
              label={TEXTOS.alerta.conector[op]}
              selected={montador.op === op}
              disabled={ocupado}
              onClick={() => setMontador((m) => ({ ...m, op: m.op === op ? null : op }))}
            />
          ))}
        </div>
        {montador.op && condicao("b", TEXTOS.alerta.segundaCondicao)}
        <p className="alerta__dica">{TEXTOS.alerta.dicaOu}</p>

        {ultima && (
          <p className="alerta__resultado" role="status">
            {TEXTOS.alerta.passam(ultima.passam.length)} {TEXTOS.alerta.execucao(execucoes.length, limite)}
          </p>
        )}
        <div className="alerta__acoes">
          <Button variant="outline" block disabled={!naTela || !restam || ocupado} onClick={() => naTela && aoExecutar(pedido.n, naTela)}>
            {TEXTOS.alerta.verResultado}
          </Button>
          <Button block disabled={!podeEnviar || ocupado} onClick={() => naTela && aoEnviar(pedido.n, naTela)}>
            {TEXTOS.alerta.enviar}
          </Button>
        </div>
        {!restam && !podeEnviar && <p className="alerta__dica">{TEXTOS.alerta.semExecucoes}</p>}
        {!podeEnviar && restam && <p className="alerta__dica">{TEXTOS.alerta.executeAntes}</p>}
      </div>
    </MessageBubble>
  );
}
