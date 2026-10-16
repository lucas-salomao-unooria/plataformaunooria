import { useEffect, useRef, useState } from "react";
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
  cartaoCompleto,
  outrosParticipantes,
  partesDaFrase,
} from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { Cartao, MensagemPublica, Opcao, PacotePublico, Resposta, Revelacao } from "../lib/tipos";
import { BalaoDaMensagem, MidiaAberta } from "./componentes/balao";
/* A foto da Nina é ilustração em SVG, importada pelo Vite: entra no bundle
   versionado, e a missão continua sem mídia binária (ADR-145). */
import FOTO_DA_NINA from "../assets/nina.svg";
import { LaminaDaSintese, TermometroDaTurma, altDoTermometro } from "./componentes/midia-desenhada";

/**
 * As telas de DENTRO do mensageiro. Aqui quem fala é o APP clonado, e só ele:
 * nenhum componente, token ou palavra da plataforma entra (`@edu/ui/ds-unoochat`
 * e mais nada). O disfarce vale do convite da Nina até o cartão de frases, no
 * Mural; a regra do tio e o fim são da escola — ver o `AGENTS.md` da pasta.
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
 * professor — os crachás, o termômetro, o cartão de frases e a lâmina.
 * `cartao` é a reflexão de quem ainda não enviou o cartão (inclusive quem
 * votou atrasado): vê tudo de uma vez, e o cartão no fim.
 */
export type EtapaDoMural = "revisao" | "enquete" | "espera" | "revelacao" | "sintese" | "cartao";

export function MuralDaTurma({
  etapa,
  mensagens,
  todas,
  motivos,
  motivo,
  revelacao,
  cartao,
  falaDoCartao,
  respostas,
  conectado,
  ocupado,
  aoRevisar,
  aoConfirmar,
  aoVotar,
  aoResponderFrase,
  aoEnviarCartao,
}: {
  etapa: EtapaDoMural;
  /** As três escolhidas, na ordem do grupo. */
  mensagens: MensagemPublica[];
  /** O pacote inteiro — só para o horário original de cada uma. */
  todas: MensagemPublica[];
  motivos: Opcao[];
  motivo: string | null;
  revelacao: Revelacao | null;
  /** O cartão de frases (EF05CO03) — chega junto com a revelação desta criança. */
  cartao: Cartao | null;
  falaDoCartao: string;
  /** As respostas marcadas nesta aba, antes do envio. */
  respostas: Readonly<Record<string, Resposta>>;
  conectado: boolean;
  ocupado: boolean;
  aoRevisar: () => void;
  aoConfirmar: () => void;
  aoVotar: (motivo: string) => void;
  aoResponderFrase: (fraseId: string, resposta: Resposta) => void;
  aoEnviarCartao: () => void;
}) {
  const [escolha, setEscolha] = useState<string | null>(motivo);
  const [midia, setMidia] = useState<{ mensagem: MensagemPublica; hora: string } | null>(null);
  const topo = useRef<HTMLDivElement>(null);
  const fim = useRef<HTMLDivElement>(null);

  const revelado = etapa === "revelacao" || etapa === "sintese" || etapa === "cartao";
  const comSintese = etapa === "sintese" || etapa === "cartao";
  const cartaoAberto = revelado && cartao !== null && !cartao.enviado;
  const completo = cartao !== null && cartaoCompleto(cartao.frases, respostas);
  const confirmado = etapa !== "revisao";
  const votou = etapa !== "revisao" && etapa !== "enquete";

  /* A revelação abre no TOPO (os crachás em cima das três mensagens são o que
     salta); a síntese, o cartão pendente da reflexão e as etapas anteriores,
     no FIM (a mensagem nova). */
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

          {/* O cartão de frases vem por último: é a mensagem que espera resposta. */}
          {revelado && cartao && (
            <CartaoDeFrases
              cartao={cartao}
              fala={falaDoCartao}
              respostas={respostas}
              ocupado={ocupado}
              aoResponder={aoResponderFrase}
            />
          )}
          {etapa === "cartao" && cartao && !cartao.enviado && (
            <SystemMessage role="status">{TEXTOS.cartao.antesDoDesafio}</SystemMessage>
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
        {cartaoAberto && (
          <div className="rodape__acao">
            <Button size="lg" block onClick={aoEnviarCartao} disabled={!completo || ocupado}>
              {TEXTOS.cartao.enviar}
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

// ─────────────────────── E4: o cartão de frases (EF05CO03), no Mural

/**
 * O cartão: seis frases com E, OU e NÃO sobre as três mensagens que a criança
 * encaminhou, cada uma com Sim/Não. Vem DEPOIS dos crachás — eles dão os
 * valores simples, e a frase pede a operação sobre eles, que é o que a
 * habilidade mede.
 *
 * A resposta certa não está aqui (ela nunca desce): a tela só guarda o que a
 * criança marcou e envia as seis de uma vez. Depois do envio, tudo congela, e
 * nada diz se ela acertou. A dica do OU fica sempre à vista: em português
 * "ou" costuma soar exclusivo, e o erro seria de leitura, não de lógica.
 */
function CartaoDeFrases({
  cartao,
  fala,
  respostas,
  ocupado,
  aoResponder,
}: {
  cartao: Cartao;
  fala: string;
  respostas: Readonly<Record<string, Resposta>>;
  ocupado: boolean;
  aoResponder: (fraseId: string, resposta: Resposta) => void;
}) {
  const travado = cartao.enviado || ocupado;
  return (
    <>
      <MessageBubble direction="in">{fala}</MessageBubble>
      <MessageBubble direction="in" tail={false} maxWidth={320}>
        <div className="cartao">
          <p className="cartao__instrucao">{TEXTOS.cartao.instrucao}</p>
          <p className="cartao__dica">{TEXTOS.cartao.dicaOu}</p>
          {cartao.frases.map((f) => (
            <fieldset className="cartao__frase" key={f.id} disabled={travado}>
              <legend className="cartao__texto">
                {partesDaFrase(f.texto).map((parte, i) =>
                  parte.operador ? <strong key={i}>{parte.texto}</strong> : <span key={i}>{parte.texto}</span>,
                )}
              </legend>
              <div className="cartao__opcoes">
                {(["sim", "nao"] as const).map((r) => (
                  <Radio
                    key={r}
                    name={`frase-${f.id}`}
                    value={r}
                    label={r === "sim" ? TEXTOS.cartao.sim : TEXTOS.cartao.nao}
                    checked={respostas[f.id] === r}
                    onChange={() => aoResponder(f.id, r)}
                    disabled={travado}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </MessageBubble>
      {cartao.enviado && <SystemMessage role="status">{TEXTOS.cartao.enviado}</SystemMessage>}
    </>
  );
}
