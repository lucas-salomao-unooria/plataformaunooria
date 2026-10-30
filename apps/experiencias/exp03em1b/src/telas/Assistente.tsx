import { useEffect, useRef, useState } from "react";
import { BottomSheet, Button, ChatHeader, ChatWallpaper, FilterChip, MediaViewer, MessageBubble, TextButton, TypingIndicator } from "@edu/ui/ds-unoochat";
import { descricaoDoGrafico, eixoDaEscala } from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { Escala, SessaoPreparada } from "../lib/tipos";
import { GraficoDoBoletim } from "./GraficoDoBoletim";
import { BarraDoAparelho, ChipDaCota, GuardaDoGrafico, useHoraDeAgora } from "./Pecas";
import { TabelaDoBoletim, descricaoDaTabela } from "./TabelaDoBoletim";

/** O que já estava na conversa quando o lembrete chegou: sem prévias, com as escalas sem escolha, ou com uma prévia aberta. */
type MomentoDoNudgeE2 = "semPrevias" | "escalas" | "comPrevia";

/** O nudge de inatividade (TC-04 e o da E2): 90 s sem gesto, e o "digitando" antes. */
export const NUDGE_MS =
  import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).get("nudge")
    ? Number(new URLSearchParams(location.search).get("nudge")) * 1000 // só em desenvolvimento, para ver o nudge sem esperar 90 s
    : 90_000;
const DIGITANDO_MS = 1500;

/**
 * E1-ALU-02 a E2-SIS-01, e a oferta da errata (E4-ALU-04) — o chat privado com
 * o Assistente de Dados, um bot determinístico (sem IA na aula). A conversa
 * CRESCE com os gestos: a posse e "Iniciar Estruturação de Dados"; a tabela
 * (toque → ampliada) e a nota técnica (toque → folha); as prévias das duas
 * escalas; "Abrir Compositor de Publicação". Nada aqui é gate avaliado: dá
 * para avançar sem abrir o anexo e sem olhar as prévias.
 *
 * Os marcos que a EM13CO13 lê (anexo, nudge da E2) são do SERVIDOR (`POST
 * sessao/marco`): a tela só diz que aconteceu.
 */
export function Assistente({
  sessao,
  retomada,
  ocupado,
  aoVoltar,
  aoMarcar,
  aoAbrirCompositor,
  aoAbrirErrata,
  aoPularErrata,
}: {
  sessao: SessaoPreparada;
  /** A aba chegou aqui por F5 (ou volta): a conversa já começou, sem "Iniciar". */
  retomada: boolean;
  ocupado: boolean;
  aoVoltar: () => void;
  aoMarcar: (marco: "anexo_aberto" | "nudge_e2") => void;
  aoAbrirCompositor: () => void;
  aoAbrirErrata: () => void;
  aoPularErrata: () => void;
}) {
  const { textos, conteudo, passo, marcos } = sessao;
  const agora = useHoraDeAgora();
  const depoisDosDados = passo !== "dados";
  const [iniciado, setIniciado] = useState(retomada || depoisDosDados);
  const [previas, setPrevias] = useState(retomada || depoisDosDados);
  const [escalaDaPrevia, setEscalaDaPrevia] = useState<Escala | null>(null);
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const [notaAberta, setNotaAberta] = useState(false);
  const [nudgeE1, setNudgeE1] = useState<"nao" | "digitando" | "sim">("nao");
  const [digitandoE2, setDigitandoE2] = useState(false);
  /* Em que ponto a conversa estava quando o lembrete da E2 chegou: decide o
     texto e o LUGAR dele (antes das prévias, se elas ainda não existiam). */
  const [momentoDoNudgeE2, setMomentoDoNudgeE2] = useState<MomentoDoNudgeE2 | null>(null);
  const momentoAgora = useRef<MomentoDoNudgeE2>("semPrevias");
  momentoAgora.current = !previas ? "semPrevias" : escalaDaPrevia === null ? "escalas" : "comPrevia";
  const fim = useRef<HTMLDivElement>(null);

  /* TC-04: 90 s na posse sem tocar em "Iniciar". */
  useEffect(() => {
    if (iniciado || nudgeE1 !== "nao") return;
    const id = window.setTimeout(() => {
      setNudgeE1("digitando");
      telemetria.inatividade("E1");
      window.setTimeout(() => setNudgeE1("sim"), DIGITANDO_MS);
    }, NUDGE_MS);
    return () => window.clearTimeout(id);
  }, [iniciado, nudgeE1]);

  /* O nudge da E2: 90 s com a tabela na tela, sem abrir o compositor. O marco carimba a hora no servidor. */
  useEffect(() => {
    if (!iniciado || passo !== "dados" || marcos.nudgeE2) return;
    const id = window.setTimeout(() => {
      setDigitandoE2(true);
      telemetria.inatividade("E2");
      window.setTimeout(() => {
        setDigitandoE2(false);
        setMomentoDoNudgeE2(momentoAgora.current);
        aoMarcar("nudge_e2");
      }, DIGITANDO_MS);
    }, NUDGE_MS);
    return () => window.clearTimeout(id);
  }, [iniciado, passo, marcos.nudgeE2, aoMarcar]);

  /* A conversa rola até a mensagem nova, como no app. */
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [iniciado, previas, escalaDaPrevia, nudgeE1, digitandoE2, marcos.nudgeE2, passo]);

  const abrirNota = () => {
    setNotaAberta(true);
    if (!marcos.anexoAberto) {
      telemetria.anexo();
      aoMarcar("anexo_aberto");
    }
  };

  const serie = conteudo.servico.serie;
  const barras = serie.map((p) => ({ rotulo: p.periodo, valor: p.valor }));
  /* Sem o momento (F5 com o marco já gravado), vale o que está na tela agora. */
  const momentoDoNudge = momentoDoNudgeE2 ?? momentoAgora.current;
  const nudgeE2 = marcos.nudgeE2 && (passo === "dados" || passo === "compositor") && (
    <MessageBubble direction="in" time={agora}>
      {momentoDoNudge === "semPrevias" ? textos.chat.nudgeE2SemPrevias : momentoDoNudge === "escalas" ? textos.chat.nudgeE2 : textos.chat.nudgeE2ComPrevia}
    </MessageBubble>
  );
  const rotuloDaEscala = (e: Escala) => (e === 0 ? textos.chat.escalas.zero : textos.chat.escalas.oitenta);

  let rodape: React.ReactNode = null;
  if (passo === "dados" && !iniciado) {
    rodape = (
      <Button size="lg" block onClick={() => setIniciado(true)}>
        {textos.chat.iniciar}
      </Button>
    );
  } else if (passo === "dados" && !previas) {
    rodape = (
      <Button size="lg" block onClick={() => setPrevias(true)}>
        {TEXTOS.assistente.gerarPrevias}
      </Button>
    );
  } else if (passo === "dados" || passo === "compositor") {
    rodape = (
      <Button size="lg" block onClick={aoAbrirCompositor} disabled={ocupado}>
        {TEXTOS.assistente.abrirCompositor}
      </Button>
    );
  } else if (passo === "errata") {
    rodape = (
      <>
        <Button size="lg" block onClick={aoAbrirErrata} disabled={ocupado}>
          {textos.chat.publicarErrata}
        </Button>
        <TextButton onClick={aoPularErrata} disabled={ocupado}>
          {textos.chat.pularErrata}
        </TextButton>
      </>
    );
  }

  return (
    <div className="app">
      <BarraDoAparelho />
      <ChatHeader
        name={textos.chat.bot}
        initials="AD"
        presence={TEXTOS.assistente.presenca}
        onBack={aoVoltar}
        trailing={<ChipDaCota restantes={sessao.slotsRestantes} />}
      />
      <ChatWallpaper className="app__corpo" role="region" tabIndex={0} aria-label={TEXTOS.grupo.conversa}>
        <div className="conversa">
          <MessageBubble direction="in" time={agora}>
            {textos.chat.posse}
          </MessageBubble>

          {nudgeE1 === "digitando" && !iniciado && <TypingIndicator aria-label={TEXTOS.assistente.nudgeDigitando} />}
          {nudgeE1 === "sim" && (
            <MessageBubble direction="in" time={agora} tail={false}>
              {textos.chat.nudgeE1}
            </MessageBubble>
          )}

          {iniciado && (
            <>
              <MessageBubble direction="in" time={agora}>
                {textos.chat.introDaTabela}
              </MessageBubble>
              <MessageBubble direction="in" time={agora} tail={false} maxWidth={300}>
                <MessageBubble.Media
                  alt={descricaoDaTabela(serie)}
                  ratio="auto"
                  onClick={() => setTabelaAberta(true)}
                  actionLabel={TEXTOS.assistente.ampliar}
                >
                  <TabelaDoBoletim serie={serie} />
                </MessageBubble.Media>
              </MessageBubble>
              <MessageBubble direction="in" time={agora} tail={false} maxWidth={300}>
                <MessageBubble.Document
                  name={conteudo.notaTecnica.arquivo}
                  details={[...TEXTOS.assistente.anexoDetalhes]}
                  onClick={abrirNota}
                  actionLabel={TEXTOS.assistente.abrirAnexo(conteudo.notaTecnica.arquivo)}
                />
                <p className="balao__legenda">{TEXTOS.assistente.anexoProcedencia}</p>
              </MessageBubble>
            </>
          )}

          {momentoDoNudge === "semPrevias" && nudgeE2}

          {previas && (
            <>
              <MessageBubble direction="in" time={agora}>
                {textos.chat.perguntaDaPrevia}
              </MessageBubble>
              <MessageBubble direction="in" time={agora} tail={false} maxWidth={300}>
                <div className="previas" role="group" aria-label={textos.chat.perguntaDaPrevia}>
                  {([0, 80] as const).map((e) => (
                    <FilterChip key={e} label={rotuloDaEscala(e)} selected={escalaDaPrevia === e} onClick={() => setEscalaDaPrevia(e)} />
                  ))}
                </div>
                {escalaDaPrevia !== null && (
                  <>
                    <MessageBubble.Media
                      alt={descricaoDoGrafico(barras, eixoDaEscala(escalaDaPrevia).origem, 100, "%")}
                      ratio="auto"
                    >
                      <GuardaDoGrafico aoFalhar={() => telemetria.erro("grafico-indisponivel", "E2")}>
                        <GraficoDoBoletim barras={barras} {...eixoDaEscala(escalaDaPrevia)} />
                      </GuardaDoGrafico>
                    </MessageBubble.Media>
                    <p className="balao__legenda">{TEXTOS.assistente.exibindo(rotuloDaEscala(escalaDaPrevia))}</p>
                  </>
                )}
              </MessageBubble>
            </>
          )}

          {momentoDoNudge !== "semPrevias" && nudgeE2}
          {digitandoE2 && <TypingIndicator aria-label={TEXTOS.assistente.nudgeDigitando} />}

          {(passo === "errata" || sessao.publicacoes.errata || sessao.publicacoes.errataPulada) && (
            <MessageBubble direction="in" time={agora} data-mensagem="errata">
              {textos.chat.errata}
            </MessageBubble>
          )}
          <div ref={fim} />
        </div>
      </ChatWallpaper>

      {rodape && <div className="rodape rodape__acao rodape__acao--dupla">{rodape}</div>}

      <MediaViewer
        open={tabelaAberta}
        title={TEXTOS.assistente.ampliar}
        subtitle={conteudo.servico.orgao}
        backLabel={TEXTOS.assistente.voltarDaTabela}
        onClose={() => setTabelaAberta(false)}
        caption={
          <span className="legenda-da-tabela">
            <span className="so-leitor">{descricaoDaTabela(serie)} </span>
            {conteudo.servico.indicador} — {conteudo.servico.unidade}. {conteudo.servico.abrangencia}. {conteudo.servico.periodicidade}.
          </span>
        }
      >
        <TabelaDoBoletim serie={serie} ampliada />
      </MediaViewer>

      <BottomSheet
        open={notaAberta}
        title={conteudo.notaTecnica.titulo}
        onClose={() => setNotaAberta(false)}
        footer={
          <Button block onClick={() => setNotaAberta(false)}>
            {TEXTOS.assistente.concluirLeitura}
          </Button>
        }
      >
        <div className="folha">
          <p className="folha__orgao">{conteudo.notaTecnica.orgao}</p>
          <p className="folha__texto">{conteudo.notaTecnica.resumo}</p>
          {conteudo.notaTecnica.secoes.map((s) => (
            <section key={s.titulo} className="folha__secao">
              <h3 className="folha__subtitulo">{s.titulo}</h3>
              <p className="folha__texto">{s.texto}</p>
            </section>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
