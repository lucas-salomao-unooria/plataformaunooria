import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, codigoDoErro, concluir, enviarEstado } from "../lib/api";
import {
  INTERVALO_DO_POLLING_MS,
  LATENCIA_FORCADA_MS,
  SEGUNDOS_ATE_O_APOIO,
  congelou,
  deveForcarLatencia,
  deveObservarOGate,
  podeMarcarTag,
  podeRegistrarPercurso,
  podeSubmeterClausula,
  precisaConfirmarEscolha,
  promptsDisponiveis,
  seletorAberto as calcularSeletor,
  telaDo,
} from "../lib/maquina-estados";
import { telemetria } from "../lib/telemetria";
import { CLONE, ERROS } from "../lib/textos";
import type {
  Estado,
  Fala,
  PromptPublico,
  RespostaDaClausula,
  RespostaDoDisparo,
  RespostaDoGate,
  RespostaSessao,
} from "../lib/tipos";
import { Briefing } from "./componentes/briefing";
import { Conversa } from "./componentes/conversa";
import { Decisao } from "./componentes/decisao";
import { Manifesto, Processando } from "./componentes/manifesto";
import { Pausa } from "./componentes/pausa";
import { Podcast } from "./componentes/podcast";
import { Confirmacao, Percurso } from "./componentes/percurso";

/**
 * O ORQUESTRADOR da exp08ef4b.
 *
 * Ele guarda o estado que o servidor devolveu e o que é só de TELA (o texto no
 * campo, o streaming, os temporizadores dos caminhos degenerados). A regra de
 * corte é simples: **nada que o servidor decide é recalculado aqui.** A cota de
 * auditoria, o latch e o filtro de dado pessoal chegam prontos; o que este
 * arquivo faz é não convidar a criança a bater no 409.
 *
 * As três coisas que valem ler antes de mexer:
 *
 * 1. **O polling do Checkpoint A** (ADR-93) só roda de `decisao` a `percurso`.
 *    Ligar sempre custaria 7 requisições por segundo por turma durante os 50
 *    minutos inteiros; assim, custa isso durante a Etapa 4.
 * 2. **O delay de 2000ms é o beat da capitulação** (não-negociável 2). Ele roda
 *    no cliente porque é ritmo de cena, e o número vem do servidor para a
 *    documentação e a tela lerem o mesmo valor.
 * 3. **O streaming é cosmético, e por isso ele NÃO segura o estado.** A réplica
 *    já chegou do servidor quando o efeito de digitação começa; se a criança
 *    recarregar a página no meio, ela reencontra a fala completa. O contrário —
 *    guardar a fala só depois da animação — perderia o texto num F5.
 */

/** Milissegundos por caractere no efeito de digitação. */
const MS_POR_CARACTERE = 14;
/** Teto do efeito: uma réplica de 60 palavras não pode custar 10 segundos. */
const TETO_DO_STREAMING_MS = 3200;

export function ManifestoApp({ inicial }: { inicial: RespostaSessao }) {
  const { catalogo } = inicial;

  const [estado, setEstado] = useState<Estado>(inicial);
  const [falas, setFalas] = useState<Fala[]>(inicial.falas);
  const [percurso, setPercurso] = useState(inicial.percurso);

  // ── estado só de TELA ────────────────────────────────────────────────────
  const [destravado, setDestravado] = useState(inicial.passo !== "briefing");
  const [escolhido, setEscolhido] = useState<PromptPublico | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [bloqueadoAte, setBloqueadoAte] = useState<number | null>(null);
  const [mostrarApoio, setMostrarApoio] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(estado.clausulaId);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mostrarAmara, setMostrarAmara] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>(percurso?.tags ?? []);
  const [justificativa, setJustificativa] = useState(percurso?.justificativa ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ultimoDisparo = useRef<number | null>(null);
  const entrouNaDecisao = useRef<number>(Date.now());
  const temTurma = useRef<boolean>(inicial.turma.etapa !== undefined);

  const tela = telaDo(estado);

  // ── o que a api decidiu, aplicado de uma vez ─────────────────────────────
  const aplicar = useCallback((novo: Estado) => {
    setEstado(novo);
    setErro(null);
  }, []);

  /** Traduz a falha em texto de tela. O 422 é o único código inequívoco. */
  const tratar = useCallback((e: unknown) => {
    const codigo = codigoDoErro(e);
    if (codigo === "dado-pessoal-no-texto") {
      telemetria.percursoRecusado();
      setErro(ERROS.dadoPessoal);
      return;
    }
    setErro(codigo === "conflito" ? ERROS.conflito : ERROS.rede);
  }, []);

  // ── o chrome opcional do hub ─────────────────────────────────────────────
  useEffect(() => {
    enviarEstado({ passo: estado.passo, auditorias: estado.totalAuditorias });
  }, [estado.passo, estado.totalAuditorias]);

  // ── o POLLING do Checkpoint A (ADR-93) ───────────────────────────────────
  useEffect(() => {
    if (!deveObservarOGate(estado.passoDoEstudante, temTurma.current)) return;
    let vivo = true;
    const id = setInterval(() => {
      void (async () => {
        try {
          const gate = await api.get<RespostaDoGate>(
            `/manifesto-ia/gate?passo=${encodeURIComponent(estado.passoDoEstudante)}`,
          );
          if (!vivo) return;
          setEstado((atual) => {
            if (congelou(atual.turma.etapa, gate.etapa)) telemetria.esperouODebate();
            return {
              ...atual,
              passo: gate.passoEfetivo,
              /* O que o SERVIDOR afirma, nunca o que a tela deduz: com
                 `passoEfetivo !== passo` quem estava parado em `manifesto`
                 nunca congelava. */
              aguardandoATurma: gate.aguardandoATurma,
              turma: { etapa: gate.etapa },
            };
          });
        } catch {
          /* Silêncio de propósito: o polling que falha não é um erro que a
             criança deva ver. Se a rede caiu, a próxima leitura resolve — e uma
             faixa vermelha piscando a cada 5s no meio da aula é pior que o
             congelamento chegar dois ciclos atrasado. */
        }
      })();
    }, INTERVALO_DO_POLLING_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [estado.passoDoEstudante]);

  // ── o balão de apoio de Amara, depois de 120s sem ação (degenerado) ──────
  useEffect(() => {
    if (estado.passoDoEstudante !== "chat" || !destravado) return;
    setMostrarApoio(false);
    const id = setTimeout(() => {
      setMostrarApoio(true);
      telemetria.hesitouNaAuditoria();
    }, SEGUNDOS_ATE_O_APOIO * 1000);
    return () => clearTimeout(id);
    // `falas.length` na dependência: cada disparo reinicia a contagem, que é o
    // comportamento certo — quem acabou de perguntar não está travado.
  }, [estado.passoDoEstudante, destravado, falas.length]);

  // ── a latência forçada dos cliques rápidos (degenerado) ──────────────────
  useEffect(() => {
    if (bloqueadoAte === null) return;
    const restante = bloqueadoAte - Date.now();
    if (restante <= 0) {
      setBloqueadoAte(null);
      return;
    }
    const id = setTimeout(() => setBloqueadoAte(null), restante);
    return () => clearTimeout(id);
  }, [bloqueadoAte]);

  // ── o cronômetro da tela do PICO (para a provocação de <5s) ──────────────
  useEffect(() => {
    if (estado.passo === "decisao") entrouNaDecisao.current = Date.now();
  }, [estado.passo]);

  const bloqueado = bloqueadoAte !== null;
  const disponiveis = useMemo(
    () => promptsDisponiveis(catalogo.prompts, estado.promptsEnviados),
    [catalogo.prompts, estado.promptsEnviados],
  );

  // ── ações ────────────────────────────────────────────────────────────────

  async function abrirConversa() {
    try {
      const novo = await api.post<Estado>("/manifesto-ia/abrir-conversa");
      aplicar(novo);
      setDestravado(true);
      telemetria.abriuConversa();
    } catch (e) {
      tratar(e);
    }
  }

  function escolherPrompt(prompt: PromptPublico) {
    setEscolhido(prompt);
    setMostrarApoio(false);
  }

  async function enviarPrompt() {
    if (!escolhido || streaming) return;

    /* O caminho degenerado dos cliques rápidos: a máquina entra em latência
       forçada e bloqueia novos comandos por 15s. O objetivo é fazer a criança
       LER a réplica — sem isso, três cliques em cinco segundos a levam ao pico
       com a contradição na tela e nenhum olho nela. */
    const agora = Date.now();
    if (deveForcarLatencia(ultimoDisparo.current, agora)) {
      setBloqueadoAte(agora + LATENCIA_FORCADA_MS);
      setEscolhido(null);
      telemetria.latenciaForcada();
      return;
    }

    const prompt = escolhido;
    const latenciaSeg = Math.max(
      0,
      Math.round((agora - (ultimoDisparo.current ?? agora)) / 1000),
    );
    setEscolhido(null);
    setFalas((atuais) => [
      ...atuais,
      { papel: "user", texto: prompt.textoPrompt, promptId: prompt.id },
    ]);
    setStreaming(true);

    try {
      const resposta = await api.post<RespostaDoDisparo>("/manifesto-ia/disparar", {
        promptId: prompt.id,
        latenciaSeg,
      });
      ultimoDisparo.current = Date.now();
      telemetria.disparouPrompt(prompt.id, resposta.totalAuditorias);

      /* O efeito de digitação é COSMÉTICO: a fala já está guardada. Um F5 no
         meio da animação devolve a réplica completa, porque quem a guarda é o
         servidor. */
      const duracao = Math.min(resposta.replica.length * MS_POR_CARACTERE, TETO_DO_STREAMING_MS);
      setTimeout(() => {
        setStreaming(false);
        setFalas((atuais) => {
          const proximas: Fala[] = [
            ...atuais,
            { papel: "assistant", texto: resposta.replica, promptId: prompt.id },
          ];
          /* A concessão do PICO entra quando a cota fecha, e é a fala que abre a
             Etapa 3. Antes disso ela não pode estar na tela. */
          if (resposta.cotaAtingida) {
            proximas.push({ papel: "assistant", texto: catalogo.concessaoDoBot });
          }
          return proximas;
        });
        aplicar(resposta);
      }, duracao);
    } catch (e) {
      setStreaming(false);
      /* A fala do estudante sai da tela: ela não foi registrada no servidor, e
         deixá-la ali daria a impressão de uma pergunta feita que a máquina
         ignorou. */
      setFalas((atuais) => atuais.filter((f) => !(f.papel === "user" && f.promptId === prompt.id)));
      tratar(e);
    }
  }

  async function submeterClausula() {
    if (!selecionada) return;

    const segundos = Math.round((Date.now() - entrouNaDecisao.current) / 1000);
    /* Exploração mínima: o sistema ACEITA a escolha (não frustrar é regra da
       spec), mas a máquina devolve uma provocação e pede o segundo toque. */
    if (precisaConfirmarEscolha(segundos, aguardandoConfirmacao)) {
      setAguardandoConfirmacao(true);
      telemetria.viuProvocacao();
      return;
    }

    setEnviando(true);
    try {
      const resposta = await api.post<RespostaDaClausula>("/manifesto-ia/clausula", {
        clausulaId: selecionada,
        latenciaSeg: segundos,
        confirmouProvocacao: aguardandoConfirmacao,
      });
      telemetria.fixouClausula(selecionada, segundos);

      /* O delay diegético de 2000ms — não-negociável 2. Ele existe para a
         capitulação ser VIVIDA: sem ele o manifesto aparece no mesmo quadro do
         clique e a rendição vira uma troca de tela. */
      setProcessando(true);
      setTimeout(() => {
        setProcessando(false);
        aplicar(resposta);
        setMostrarAmara(true);
        telemetria.viuOManifesto();
      }, resposta.delayMs);
    } catch (e) {
      tratar(e);
    } finally {
      setEnviando(false);
    }
  }

  async function copiar() {
    const texto = estado.manifestoMarkdown;
    if (!texto) return;
    try {
      /* O `allow="clipboard-write"` do `ExpFrame` já concede a permissão a
         todas as experiências — não é campo do manifesto, e declará-lo em
         `permissoes` derrubaria o `PUT /experiencias/:expId` do deploy. */
      await navigator.clipboard.writeText(texto);
    } catch {
      /* Fallback de seleção, como o handoff prevê: se a Clipboard API não
         estiver disponível (contexto não seguro, política do navegador da
         escola), seleciona o bloco para o Ctrl+C funcionar. Falhar em silêncio
         seria o botão que não faz nada — o defeito que a app-90 teve com o
         download bloqueado pelo sandbox. */
      const bloco = document.querySelector('[data-manifesto="promulgado"]');
      if (bloco) {
        const faixa = document.createRange();
        faixa.selectNodeContents(bloco);
        const selecao = window.getSelection();
        selecao?.removeAllRanges();
        selecao?.addRange(faixa);
      }
    }
    telemetria.copiouOManifesto();
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function alternarTag(id: string) {
    setMarcadas((atuais) => {
      if (atuais.includes(id)) return atuais.filter((t) => t !== id);
      if (!podeMarcarTag(atuais, id, catalogo.tagsExigidas)) return atuais;
      return [...atuais, id];
    });
  }

  async function registrarPercurso() {
    setEnviando(true);
    try {
      const texto = justificativa.trim();
      const novo = await api.post<Estado>("/manifesto-ia/percurso", {
        tags: marcadas,
        justificativa: texto,
      });
      setPercurso({ tags: marcadas, justificativa: texto });
      /**
       * A TELA fica no percurso; o ESTUDANTE já está no podcast.
       *
       * A api avança o passo ao gravar (`avancarAte(..., "podcast")`) — esse é
       * o estado real dela e o polling do gate o usa, para que quem já assinou
       * não seja mais alcançado pela pausa. Mas aplicar esse passo à tela pula
       * a `Confirmacao`, que é a devolutiva do gesto mais importante da missão:
       * a cláusula, as palavras-chave e o parágrafo dela, como ficaram
       * registrados. Ela estava escrita e era INALCANÇÁVEL — a suíte e2e achou
       * em 2026-09-11, esperando um selo que nunca aparecia.
       *
       * Quem avança daqui é o botão dela. Um F5 nesta tela vai para o podcast,
       * e está certo: o registro já aconteceu, e o servidor é quem manda.
       */
      aplicar({ ...novo, passo: "percurso" });
      // Só as tags e o TAMANHO. O texto nunca vai à telemetria (regra 6).
      telemetria.assinouOPercurso(marcadas, texto.length);
    } catch (e) {
      tratar(e);
    } finally {
      setEnviando(false);
    }
  }

  async function finalizar() {
    setEnviando(true);
    try {
      const novo = await api.post<Estado>("/manifesto-ia/concluir");
      aplicar(novo);
      telemetria.concluiuAMissao();
      /* Sem `score`: a missão não pontua, e as quatro cláusulas valem igual. O
         que vai ao hub é a evidência do percurso. */
      concluir({ clausulaId: novo.clausulaId, tags: marcadas });
    } catch (e) {
      tratar(e);
    } finally {
      setEnviando(false);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────

  const clausulaEscolhida = catalogo.clausulas.find((c) => c.id === estado.clausulaId);

  /* `inert` no conteúdo de baixo quando a turma está congelada: ele bloqueia
     clique, rolagem E FOCO. `pointer-events: none` pararia o clique e deixaria o
     Tab passar — 30 botões focáveis atrás de um véu é a mesma classe de defeito
     que o `Collapse` da app-92 produziu. */
  const congelada = tela === "pausa";

  return (
    <>
      <div className="app" inert={congelada}>
        {(() => {
          if (processando) return <Processando />;

          switch (congelada ? "manifesto" : tela) {
            case "briefing":
              return <Briefing onIniciar={() => void abrirConversa()} />;

            case "conversa":
            case "decisao":
              return (
                <Conversa
                  nomeDoAssistente={CLONE.assistente}
                  principios={catalogo.principiosEmDisputa}
                  falas={falas}
                  prompts={disponiveis}
                  seletorAberto={calcularSeletor(
                    estado.passo === "decisao" ? "chat" : estado.passo,
                    streaming,
                    bloqueado,
                  ) && estado.passo === "chat"}
                  streaming={streaming}
                  textoNoCampo={escolhido?.textoPrompt ?? ""}
                  contador={{
                    feitas: estado.totalAuditorias,
                    total: catalogo.promptsExigidos,
                  }}
                  destravado={destravado}
                  onDestravar={() => void abrirConversa()}
                  onEscolher={escolherPrompt}
                  onEnviar={() => void enviarPrompt()}
                >
                  {bloqueado && (
                    <p className="aviso-do-sistema">{CLONE.latenciaRapida}</p>
                  )}
                  {estado.passo === "decisao" && (
                    <Decisao
                      concessao={catalogo.concessaoDoBot}
                      clausulas={catalogo.clausulas}
                      selecionada={selecionada}
                      habilitado={podeSubmeterClausula(estado, selecionada, enviando)}
                      enviando={enviando}
                      aguardandoConfirmacao={aguardandoConfirmacao}
                      onSelecionar={setSelecionada}
                      onSubmeter={() => void submeterClausula()}
                    />
                  )}
                </Conversa>
              );

            case "manifesto":
              return (
                <Manifesto
                  markdown={estado.manifestoMarkdown ?? ""}
                  copiado={copiado}
                  onCopiar={() => void copiar()}
                  onAvancar={() =>
                    setEstado((atual) => ({
                      ...atual,
                      /* A transição para a Etapa 5 é de TELA: o servidor já
                         gravou o manifesto, e o passo `percurso` é o que a
                         assinatura grava. Pedir uma rota só para andar aqui
                         seria uma requisição que não decide nada. */
                      passo: "percurso",
                      passoDoEstudante: "percurso",
                    }))
                  }
                />
              );

            case "percurso":
              return percurso ? (
                <Confirmacao
                  clausula={clausulaEscolhida}
                  tags={marcadas.map(
                    (id) => catalogo.tags.find((t) => t.id === id)?.rotulo ?? id,
                  )}
                  justificativa={percurso.justificativa}
                  onAvancar={() =>
                    setEstado((atual) => ({
                      ...atual,
                      passo: "podcast",
                      passoDoEstudante: "podcast",
                    }))
                  }
                />
              ) : (
                <Percurso
                  clausula={clausulaEscolhida}
                  tags={catalogo.tags}
                  marcadas={marcadas}
                  exigidas={catalogo.tagsExigidas}
                  justificativa={justificativa}
                  piso={catalogo.pisoDaJustificativa}
                  teto={catalogo.tetoDaJustificativa}
                  habilitado={podeRegistrarPercurso(
                    marcadas,
                    justificativa,
                    catalogo.pisoDaJustificativa,
                    catalogo.tagsExigidas,
                    enviando,
                  )}
                  enviando={enviando}
                  erro={erro}
                  onAlternarTag={alternarTag}
                  onEscrever={setJustificativa}
                  onRegistrar={() => void registrarPercurso()}
                />
              );

            case "podcast":
            case "fim":
              return (
                <Podcast
                  titulo={catalogo.podcast.titulo}
                  blocos={catalogo.podcast.blocos}
                  pergunta={catalogo.perguntaDaReflexao}
                  insignia={catalogo.insignia}
                  concluido={Boolean(estado.concluidoEm)}
                  enviando={enviando}
                  onAbrirTranscricao={telemetria.abriuATranscricao}
                  onFinalizar={() => void finalizar()}
                />
              );

            default:
              return null;
          }
        })()}

        {/* O balão de apoio de Amara — a ÚNICA quebra do silêncio dela na Etapa
            2, e só depois de 120 segundos sem ação. */}
        {mostrarApoio && estado.passo === "chat" && (
          <p className="apoio-da-guia" role="status">
            {CLONE.apoioNaInatividade}
          </p>
        )}

        {/* A notificação de canto pós-Aha!, na voz de Amara. Discreta de
            propósito: o centro da tela é o documento. */}
        {mostrarAmara && tela === "manifesto" && (
          <p className="toast toast--claro" role="status">
            {CLONE.popupDeAmara}
          </p>
        )}

        {/* O toast de cópia, 2000ms. */}
        {copiado && (
          <p className="toast" role="status">
            {CLONE.copiado}
          </p>
        )}

        {erro && tela !== "percurso" && (
          <p className="toast toast--claro" role="alert">
            {erro}
          </p>
        )}
      </div>

      {congelada && <Pausa />}
    </>
  );
}
