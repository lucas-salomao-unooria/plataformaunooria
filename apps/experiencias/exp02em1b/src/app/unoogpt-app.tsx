import { Avatar, Button, Modal } from "@edu/ui/ds-unooriaai";
import { useCallback, useEffect, useState } from "react";
import { api, codigoDoErro, concluir, enviarEstado } from "../lib/api";
import * as telemetria from "../lib/telemetria";
import { AVISO_FALTA_JUSTIFICAR, faltaJustificar } from "../lib/textos";
import type {
  BairroPublico,
  Fala,
  OpcaoDeJustificativa,
  Passo,
  Projecao,
  RespostaEstado,
  RespostaRegistro,
  RespostaRelogio,
  RespostaResultado,
  RespostaSaude,
  RespostaSessao,
  RespostaTurno,
  SessaoPublica,
} from "../lib/tipos";
import { VISOES, type Visao } from "../lib/visao";
import { Abertura } from "./componentes/abertura";
import { Decisao } from "./componentes/decisao";
import { Operacao } from "./componentes/operacao";
import { Registro } from "./componentes/registro";
import { LigacaoDaSaude } from "./componentes/saude";
import { PainelCientista } from "./componentes/painel-cientista";
import { RelogioDaTempestade, useContagem, useRelogioDaTurma } from "./componentes/relogio";
import { Resultado, type DadosDoResultado } from "./componentes/resultado";
import { Trilha } from "./componentes/trilha";
import { Mapa, type EquipeNoMapa } from "./arte/mapa";

/**
 * Casca da Missão — o orquestrador.
 *
 * Layout: a conversa ocupa 2/3 à esquerda, o mapa 1/3 à direita, e a trilha
 * colapsa quando a Investigação precisa de largura.
 *
 * O MAPA É PERMANENTE da Investigação em diante: o estudante investiga sobre ele,
 * aloca sobre ele e vai ver a tempestade sobre ele. Um mapa por Passo faria a
 * cidade parecer outra a cada tela.
 *
 * O QUE MUDOU NO PORTE. No projeto de origem este componente recebia o estado
 * de um server component e falava com rotas `/api/missao/:id/*`. Aqui ele
 * recebe UMA resposta (`GET /unoogpt/sessao`) e conversa pela SDK — sem id de
 * sessão em lugar nenhum, porque a identidade vem do token. E três coisas que
 * ele calculava saíram para a api: a projeção das rotas, o alcance de cada
 * equipe e o minuto da cidade. Todas dependiam do modelo, e um bundle capaz de
 * computá-las deixaria o estudante antecipar o desfecho antes de enviar.
 */
/** O resultado como a tela o guarda. */
function paraResultado(r: RespostaResultado): DadosDoResultado {
  return {
    desfecho: r.desfecho,
    esperado: r.esperado,
    naoConsultados: r.naoConsultados,
    tentativas: r.tentativas,
    sobrou: r.sobrou,
    trilha: r.trilha,
  };
}

export function MissaoApp({ inicial }: { inicial: RespostaSessao }) {
  const [sessao, setSessao] = useState<SessaoPublica>(inicial.sessao);
  const [mapa, setMapa] = useState<BairroPublico[]>(inicial.mapa);
  const [projecao, setProjecao] = useState<Projecao>(inicial.projecao);
  const [falas, setFalas] = useState<Fala[]>(inicial.conversa);
  const [opcoesDeJustificativa, setOpcoes] = useState<OpcaoDeJustificativa[]>(
    inicial.justificativas,
  );
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false);
  const [resultado, setResultado] = useState<DadosDoResultado | null>(null);
  const [trilhaAberta, setTrilhaAberta] = useState(true);
  const [visao, setVisao] = useState<Visao>(VISOES[0]!.id);
  const [decidindo, setDecidindo] = useState(false);
  const [operacao, setOperacao] = useState<DadosDoResultado | null>(null);
  const [bairroSelecionado, setSelecionado] = useState<string | null>(null);
  /** O registro da operação (ADR-172): entre "Enviar equipes" e o resultado, sem relógio. */
  const [registro, setRegistro] = useState<RespostaRegistro | null>(null);
  /** A ligação da Saúde (ADR-172) e se ela está na tela agora. */
  const [saude, setSaude] = useState<RespostaSaude | null>(null);
  const [saudeNaTela, setSaudeNaTela] = useState(false);
  /** Abrir a decisão espera a ligação da Saúde fechar: dois diálogos de uma vez prendem o foco. */
  const [decidirDepois, setDecidirDepois] = useState(false);
  /** O professor abriu o fechamento (ADR-172). */
  const [fechamentoAberto, setFechamentoAberto] = useState(inicial.relogio.fechamentoAberto);

  // Fechar um `Modal` do design system TEM que ser a mesma funcao entre renders.
  // O `Modal` da secao `chatgpt` mantem `onClose` nas dependencias do efeito que
  // tambem faz o foco: identidade nova = cleanup (devolve o foco para fora do
  // modal) + efeito (foco no primeiro focavel, que e o botao de fechar). Com uma
  // arrow inline e o relogio da turma correndo, isso acontecia a cada tick — o
  // `<select>` da justificativa fechava sozinho no instante em que o estudante
  // clicava nele, e um Enter reflexo fechava o modal. Ver o AGENTS.md da pasta.
  const fecharDecisao = useCallback(() => setDecidindo(false), []);
  const fecharReinicio = useCallback(() => setConfirmandoReinicio(false), []);
  const fecharSaude = useCallback(() => setSaudeNaTela(false), []);

  const alocacao = sessao.alocacao;
  const justificativas = sessao.justificativas;

  /**
   * O relógio é da turma e corre sozinho. O polling existe porque a partida é
   * dada no painel do professor: o estudante está esperando com o cronômetro parado
   * e não tem o que enviar para descobrir que já pode falar.
   */
  const { relogio, estado: estadoDoTempo } = useRelogioDaTurma(
    { relogio: inicial.relogio, estado: inicial.estado },
    sessao.passo === "investigacao" && !operacao,
  );
  const segundos = useContagem(relogio, estadoDoTempo);

  /** O hub desenha chrome opcional a partir disto (`exp:estado`). */
  useEffect(() => {
    enviarEstado({ passo: sessao.passo, tentativa: sessao.tentativa });
  }, [sessao.passo, sessao.tentativa]);

  /**
   * F5 depois de "Enviar equipes": o registro volta, ou o resultado, conforme o
   * servidor (ADR-172). O passo `resultado` sem nada na tela era uma coluna em
   * branco.
   */
  useEffect(() => {
    if (inicial.sessao.passo !== "resultado") return;
    let viva = true;
    void (async () => {
      try {
        if (!inicial.sessao.registroConcluido) {
          const r = await api.get<RespostaRegistro>("/unoogpt/registro");
          if (viva) setRegistro(r);
        } else {
          const r = await api.get<RespostaResultado>("/unoogpt/resultado");
          if (viva) setResultado(paraResultado(r));
        }
      } catch {
        /* sem resultado nesta tentativa: o estudante recomeça pelo botão */
      }
    })();
    return () => {
      viva = false;
    };
  }, [inicial.sessao.passo, inicial.sessao.registroConcluido]);

  /**
   * A ligação da Saúde aparece quando o SERVIDOR a ofereceu (primeiro destino
   * ou abrir a decisão) e ainda não foi respondida — inclusive depois de um F5.
   */
  useEffect(() => {
    if (!sessao.ofertaSaude || sessao.passo !== "investigacao" || saude?.respondida) return;
    let viva = true;
    api
      .get<RespostaSaude>("/unoogpt/saude")
      .then((r) => {
        if (!viva) return;
        setSaude(r);
        if (r.ofertada && !r.respondida) setSaudeNaTela(true);
      })
      .catch(() => undefined);
    return () => {
      viva = false;
    };
  }, [sessao.ofertaSaude, sessao.passo, sessao.tentativa, saude?.respondida]);

  /** Fechada a ligação, a decisão que esperava por ela abre. */
  useEffect(() => {
    if (!saudeNaTela && decidirDepois) {
      setDecidirDepois(false);
      setDecidindo(true);
    }
  }, [saudeNaTela, decidirDepois]);

  /**
   * No Resultado, o fechamento chega quando o PROFESSOR o abre: o relógio da
   * turma o diz, consultado a cada 8 s até aparecer.
   */
  useEffect(() => {
    if (sessao.passo !== "resultado" || !resultado || fechamentoAberto) return;
    const id = setInterval(() => {
      api
        .get<RespostaRelogio>("/unoogpt/relogio")
        .then((r) => setFechamentoAberto(r.relogio.fechamentoAberto))
        .catch(() => undefined);
    }, 8000);
    return () => clearInterval(id);
  }, [sessao.passo, resultado, fechamentoAberto]);

  /**
   * Abrir a decisão. Na primeira vez da tentativa, a ligação da Saúde vem antes
   * (o servidor decide; ADR-172), e a decisão abre quando ela fechar.
   */
  async function abrirDecisao() {
    if (sessao.ofertaSaude) {
      setDecidindo(true);
      return;
    }
    try {
      const r = await api.post<RespostaSaude>("/unoogpt/saude/abrir");
      setSaude(r);
      setSessao((x) => ({ ...x, ofertaSaude: r.ofertada }));
      if (r.ofertada && !r.respondida) {
        setSaudeNaTela(true);
        setDecidirDepois(true);
        return;
      }
    } catch {
      /* a ligação não veio: a decisão abre assim mesmo */
    }
    setDecidindo(true);
  }

  /**
   * Traduz a falha em uma frase de tela.
   *
   * A api devolve código de JOGO (`sem-perguntas`, `relogio-encerrado`), e cada
   * um tem uma frase. O que nunca aparece aqui é vocabulário de infraestrutura:
   * o estudante não sabe o que é token, quota nem 429.
   */
  const reclamar = useCallback((erro: unknown) => {
    const codigo = codigoDoErro(erro);
    setAviso(
      codigo === "teto-da-sessao"
        ? "A sala de operações fechou por hoje."
        : codigo === "cientista-indisponivel"
          ? "O Cientista não conseguiu responder agora. Tente falar de novo."
          : codigo === "rede"
            ? "A conexão falhou. Tente de novo."
            : "Algo deu errado. Tente de novo.",
    );
  }, []);

  async function irPara(para: Passo) {
    try {
      const dados = await api.post<RespostaEstado>("/unoogpt/passo", { para });
      setSessao(dados.sessao);
      setAviso(null);
    } catch (erro) {
      reclamar(erro);
    }
  }

  /** Devolve se a pergunta entrou: é o que decide se o rascunho pode sumir. */
  async function perguntar(texto: string): Promise<boolean> {
    setOcupado(true);
    // A fala do estudante aparece na hora — o turno leva de 10 a 30 segundos, e um
    // campo que engole o texto e não mostra nada parece travado.
    setFalas((f) => [...f, { papel: "estudante", texto, anexo: null }]);
    try {
      // `postLento`: 45s. O default do SDK é 10s e cortaria a resposta que já
      // estava sendo gerada.
      const dados = await api.postLento<RespostaTurno>("/unoogpt/pergunta", { texto });
      setFalas((f) => [...f, { papel: "agente", texto: dados.texto, anexo: dados.anexo }]);
      setSessao(dados.sessao);
      setMapa(dados.mapa);
      setOpcoes(dados.justificativas);
      setAviso(null);
      telemetria.turnoFeito({
        debitou: dados.sessao.perguntasGastas > sessao.perguntasGastas,
        comCartao: dados.anexo !== null,
        perguntasGastas: dados.sessao.perguntasGastas,
      });
      if (dados.sessao.conjuntos.length > sessao.conjuntos.length) {
        telemetria.fontesCarregadas(dados.sessao.conjuntos.length);
      }
      // Ele confirmou na conversa: quem manda é o botão "Enviar equipes", e a
      // decisão abre para ele (ADR-172).
      if (dados.abrirEnvio) await abrirDecisao();
      // A tempestade aconteceu NESTE turno. Mesmo confirmada pelo chat ela passa
      // pela operação no mapa: era estranho o desfecho pelo painel ter as
      // equipes cruzando a cidade e o desfecho pela conversa cair direto na
      // tabela.
      if (dados.anexo?.tipo === "desfecho") await abrirOperacao();
      return true;
    } catch (erro) {
      // A fala volta para fora da conversa: ela não aconteceu, e o campo fica
      // com o texto para uma segunda tentativa sem redigitar.
      setFalas((f) => f.slice(0, -1));
      reclamar(erro);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  /** Lê o desfecho e monta a operação — as equipes cruzando o mapa. */
  async function abrirOperacao() {
    const r = await api.get<RespostaResultado>("/unoogpt/resultado");
    setRegistro(null);
    setOperacao(paraResultado(r));
    telemetria.tempestadeEnfrentada({
      salvas: r.desfecho.totais.salvas,
      fontesUsadas: sessao.conjuntos.length,
    });
  }

  // As duas bases ficam no mapa desde o começo; ganham destino e rota quando o
  // estudante decide e o Cientista registra.
  const equipesNoMapa: EquipeNoMapa[] = [
    {
      id: "alfa",
      nome: "Equipe Alfa",
      sigla: "A",
      left: "24%",
      top: "2%",
      destinoSlug: alocacao.alfa,
      minutos: null,
      cor: "alfa",
    },
    {
      id: "bravo",
      nome: "Equipe Bravo",
      sigla: "B",
      left: "74%",
      top: "95%",
      destinoSlug: alocacao.bravo,
      minutos: null,
      cor: "bravo",
    },
  ];

  /**
   * Confirmar não corta direto para o Resultado: as equipes percorrem o mapa
   * primeiro. O número que aparece no fim precisa estar preso ao trajeto que o
   * estudante mandou fazer, senão é só um placar caindo do céu.
   */
  async function enfrentarAgora() {
    // O botão não manda enquanto faltar dizer por quê: em vez de recusar, ele
    // ABRE o painel onde a pergunta está. Recusar sem mostrar onde responder é
    // um beco sem saída. (O portão de verdade é o servidor, que recusa com
    // `falta-justificar` — isto aqui é só a afordância.)
    if (faltaJustificar(alocacao, justificativas).length > 0) {
      setAviso(AVISO_FALTA_JUSTIFICAR);
      setDecidindo(true);
      return;
    }
    setOcupado(true);
    try {
      // "Enviar equipes" congela a saída e abre o REGISTRO DA OPERAÇÃO: o
      // desfecho fica retido no servidor até ele (ADR-172).
      const r = await api.post<RespostaRegistro>("/unoogpt/mandar");
      setDecidindo(false);
      setRegistro(r);
      setSessao((x) => ({ ...x, passo: "resultado" }));
      setAviso(null);
    } catch (erro) {
      reclamar(erro);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Trocar destino pelo painel ou pelo mapa vale o mesmo que dizer no chat: quem
   * decide é o estudante, e o Cientista continua sendo só o rádio.
   */
  async function trocarDestino(equipe: "alfa" | "bravo", bairro: string) {
    setOcupado(true);
    try {
      // Destino novo, porquê zerado: a razão era do bairro antigo. Quem apaga é
      // o SERVIDOR; a tela só reflete o que ele devolveu.
      const dados = await api.post<RespostaEstado>("/unoogpt/alocacao", {
        equipe,
        bairro,
        justificativa: null,
      });
      setSessao(dados.sessao);
      if (dados.projecao) setProjecao(dados.projecao);
      setAviso(null);
      telemetria.equipeAlocada(equipe, false);
    } catch (erro) {
      reclamar(erro);
    } finally {
      setOcupado(false);
    }
  }

  /** Por que aquela equipe vai para lá. Não há resposta certa; o software não julga. */
  async function justificar(equipe: "alfa" | "bravo", valor: string) {
    const bairro = alocacao[equipe];
    if (!bairro) return;
    setOcupado(true);
    try {
      const dados = await api.post<RespostaEstado>("/unoogpt/alocacao", {
        equipe,
        bairro,
        justificativa: valor,
      });
      setSessao(dados.sessao);
      if (dados.projecao) setProjecao(dados.projecao);
      setAviso(null);
      telemetria.equipeAlocada(equipe, true);
    } catch (erro) {
      reclamar(erro);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Recomeçar abre tentativa NOVA no servidor — não apaga a conversa anterior.
   * Para o estudante a tela limpa; para o professor a aula inteira continua legível.
   */
  /**
   * `origem` diz qual botão: a lixeira da Investigação ou o "Tentar de novo" do
   * Resultado. É a única parte do recomeço que só o cliente sabe — o relógio da
   * turma e a tentativa o servidor grava sozinho, no marco `recomeco`.
   */
  async function reiniciar(origem: "investigacao" | "resultado") {
    setOcupado(true);
    try {
      const dados = await api.post<RespostaEstado>("/unoogpt/reiniciar", { origem });
      const nova = await api.get<RespostaSessao>("/unoogpt/sessao");
      setSessao(nova.sessao);
      setMapa(nova.mapa);
      setProjecao(nova.projecao);
      setOpcoes(nova.justificativas);
      setFalas([]);
      setResultado(null);
      setOperacao(null);
      setRegistro(null);
      setSaude(null);
      setSaudeNaTela(false);
      setAviso(null);
      telemetria.recomecou(dados.sessao.tentativa);
    } catch (erro) {
      reclamar(erro);
    } finally {
      setOcupado(false);
      setConfirmandoReinicio(false);
    }
  }

  const naAbertura = sessao.passo === "abertura";

  // Altura TRAVADA na tela: sem isto a página inteira rola e o campo de
  // pergunta desce junto, saindo de vista no meio da conversa.
  return (
    // `bg-uai-tela` e nao `bg-uai-fundo`: a tela do cliente web tem superficie
    // propria (`--uai-web-canvas`), que o pacote publica a parte da escada
    // semantica. Hoje ela coincide com o fundo nos dois temas, mas a decisao e
    // do pacote, e trocar o apelido aqui esconderia a mudanca dele.
    <div className="flex h-screen overflow-hidden bg-uai-tela">
      <Trilha
        passo={sessao.passo}
        aberta={trilhaAberta}
        onAlternar={() => setTrilhaAberta((v) => !v)}
        onIr={irPara}
        // Recomecar mora no RODAPE da barra, com `trash`, que e onde e como o
        // arquivo poe "Clear conversations". Ele saiu do cabecalho: uma acao
        // destrutiva ao lado do cronometro competia com o relogio pela atencao
        // no momento em que o estudante mais precisa olhar para o tempo.
        onRecomecar={
          sessao.passo === 'investigacao' && !operacao ? () => setConfirmandoReinicio(true) : null
        }
        ocupado={ocupado}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {naAbertura ? (
          <Abertura
            relogio={relogio}
            bairros={mapa}
            chamada={inicial.ficha.chamada}
            contexto={inicial.ficha.contexto}
            // O Briefing substitui as duas telas de leitura: o clique atravessa
            // a Orientação, que virou o painel "Como funciona".
            onComecar={async () => {
              await irPara('orientacao');
              await irPara('investigacao');
            }}
          />
        ) : (
          <>
            {/* Sem cabeçalho na Orientação: não há nada para recomeçar antes
                de a Missão começar, e o relógio já não aparece aqui. */}
            {/* Sem título nem contador de fontes no cabeçalho: a cidade já está
                escrita no mapa ao lado, e as fontes em uso aparecem acima do
                campo de pergunta, onde elas importam. */}
            {sessao.passo === 'investigacao' && (
              <header className="flex items-center justify-between gap-4 border-b border-uai-borda px-6 py-3">
                <div className="flex items-center gap-3">
                  <Avatar size="lg" tone="inverse" initials="CD" />
                  <div>
                    <p className="text-sm font-semibold leading-tight text-uai-tinta">
                      Cientista de Dados
                    </p>
                    <p className="text-xs leading-tight text-uai-suave-60">
                      Responde fatos e previsões. Não decide.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Só na Investigação. Na Orientação ele aparecia — zerado, se
                    o estudante já tinha rodado antes — e apressava justamente a
                    tela que existe para ser lida com calma. */}
                  {/* Durante a operação o cronômetro para: as equipes já saíram,
                    e um relógio correndo ali só sugere que ainda dá para
                    mudar alguma coisa. */}
                  {/* O cronômetro aparece PARADO enquanto a missão não começa:
                      é ele que diz ao estudante que a espera é a aula e não a tela
                      travada. */}
                  {!operacao && sessao.passo === 'investigacao' && (
                    <RelogioDaTempestade estado={estadoDoTempo} segundos={segundos} />
                  )}
                </div>
                {/* Não há botão de avançar: quem move a Missão é a conversa. O
                  estudante diz para onde mandar as equipes e o Cientista registra —
                  botão aqui piscava a trilha e o servidor desfazia no turno
                  seguinte, porque o Passo é derivado do que aconteceu. */}
              </header>
            )}

            <div className="flex min-h-0 flex-1">
              {/* Proporção única na Missão inteira: conversa e Resultado ficam
                  com 2/3, o mapa com 1/3. Trocar no fim reflow a tela toda no
                  momento em que o estudante mais precisa ler com calma. */}
              <div className={`flex min-h-0 min-w-0 flex-col ${operacao ? 'w-1/3' : 'w-2/3'}`}>
                {sessao.passo === 'resultado' && resultado && (
                  <Resultado
                    desfecho={resultado.desfecho}
                    esperado={resultado.esperado}
                    naoConsultados={resultado.naoConsultados}
                    tentativas={resultado.tentativas}
                    trilha={resultado.trilha}
                    sobrou={resultado.sobrou}
                    // O mapa como ele ficou: é a leitura sobre a qual o estudante
                    // decidiu, e é dela que sai o empate quando o marco de
                    // leitura não existe naquela rodada.
                    leitura={mapa
                      .filter((b) => b.estimativa)
                      .map((b) => ({
                        nome: b.nome,
                        esperado: b.estimativa!.pessoasEmRisco.esperado,
                        margem: Math.round(
                          (b.estimativa!.pessoasEmRisco.max - b.estimativa!.pessoasEmRisco.min) / 2,
                        ),
                      }))}
                    onRecomecar={() => reiniciar("resultado")}
                    ocupado={ocupado}
                    fechamentoAberto={fechamentoAberto}
                  />
                )}

                {registro && !operacao && !resultado && (
                  <Registro registro={registro} onMudou={setRegistro} onVerResultado={() => void abrirOperacao()} />
                )}

                {operacao && (
                  <Operacao
                    desfecho={operacao.desfecho}
                    esperado={operacao.esperado}
                    tentativas={operacao.tentativas}
                    naoConsultados={operacao.naoConsultados}
                    equipes={(['alfa', 'bravo'] as const).map((equipe) => ({
                      equipe,
                      nome: mapa.find((b) => b.slug === alocacao[equipe])?.nome ?? null,
                    }))}
                    onVerResultado={() => {
                      setResultado(operacao);
                      setSessao((s) => ({ ...s, passo: "resultado" }));
                      setOperacao(null);
                      // Sem `score`: "o propósito não é acertar a alocação".
                      concluir({
                        salvas: operacao.desfecho.totais.salvas,
                        tentativa: sessao.tentativa,
                        fontesUsadas: sessao.conjuntos.length,
                      });
                    }}
                  />
                )}

                {!operacao && sessao.passo !== 'resultado' && (
                  <PainelCientista
                    falas={falas}
                    // O erro mora ao lado do campo, não no alto da página: ele
                    // renderizava acima do cabeçalho enquanto o estudante olhava o
                    // input no rodapé, e a única pista era o layout inteiro
                    // pulando.
                    aviso={aviso}
                    // O que já se sabe sobre a viagem: sai do texto corrido do
                    // Cientista e vira alerta ao lado do botão que manda. O
                    // estudante confirmou com "chega com 1 minuto de sobra" escrito
                    // no meio de um parágrafo — e a equipe chegou 4 min tarde.
                    alertas={projecao.rotas
                      .filter((r) => r.aviso !== null)
                      .map((r) => `${r.nome}: ${r.aviso}`)}
                    ocupado={ocupado}
                    emUso={sessao.conjuntos}
                    onPerguntar={perguntar}
                    // O painel de decisão existe DESDE O COMEÇO da Investigação.
                    // Antes ele só aparecia depois de já haver destino
                    // registrado — e o estudante que não conseguiu registrar nada
                    // pelo chat ficava sem saída: no playtest o relógio zerou
                    // com o campo desabilitado e nenhum botão na tela.
                    onDecidir={sessao.passo === 'investigacao' ? () => void abrirDecisao() : null}
                    onEnviar={alocacao.alfa || alocacao.bravo ? enfrentarAgora : null}
                    destinos={(['alfa', 'bravo'] as const).map((equipe) => ({
                      equipe,
                      nome: mapa.find((b) => b.slug === alocacao[equipe])?.nome ?? null,
                    }))}
                    estadoDoTempo={estadoDoTempo}
                    perguntasGastas={sessao.perguntasGastas}
                    // Um clique registra as DUAS equipes. O rodapé e o mapa
                    // continuam permitindo trocar antes de enviar.
                    onEscolherOpcao={async (o) => {
                      setOcupado(true);
                      try {
                        // Duas chamadas porque a rota é por EQUIPE: o portão da
                        // justificativa é por destino, e um endpoint que
                        // aceitasse as duas de uma vez teria de decidir o que
                        // fazer quando só uma é válida.
                        const a = await api.post<RespostaEstado>("/unoogpt/alocacao", {
                          equipe: "alfa",
                          bairro: o.alfa,
                          justificativa: null,
                        });
                        const b = await api.post<RespostaEstado>("/unoogpt/alocacao", {
                          equipe: "bravo",
                          bairro: o.bravo,
                          justificativa: null,
                        });
                        setSessao(b.sessao ?? a.sessao);
                        if (b.projecao) setProjecao(b.projecao);
                        setAviso(null);
                      } catch (erro) {
                        reclamar(erro);
                      } finally {
                        setOcupado(false);
                      }
                    }}
                  />
                )}
              </div>

              {decidindo && (
                <Decisao
                  bairros={mapa}
                  alocacao={alocacao}
                  justificativas={justificativas}
                  opcoes={opcoesDeJustificativa}
                  projecao={projecao}
                  onJustificar={justificar}
                  ocupado={ocupado}
                  onTrocar={trocarDestino}
                  // Justificou? Manda daqui. Mesma função do botão do rodapé:
                  // um portão só, em um lugar só.
                  onEnviar={alocacao.alfa || alocacao.bravo ? enfrentarAgora : null}
                  onFechar={fecharDecisao}
                />
              )}

              <div className={`min-h-0 min-w-0 ${operacao ? 'w-2/3' : 'w-1/3'}`}>
                <Mapa
                  bairros={mapa}
                  camadas={sessao.conjuntos}
                  visao={visao}
                  onVisao={setVisao}
                  selecionado={bairroSelecionado}
                  onSelecionar={setSelecionado}
                  // Tocar no bairro e mandar a equipe: a mesma ação que o chat
                  // faz, pela mão do estudante (board, tela 3).
                  onMandarEquipe={
                    sessao.passo === 'investigacao' && !operacao ? trocarDestino : undefined
                  }
                  equipes={equipesNoMapa}
                  // No registro as equipes já estão a caminho: a hora de saída
                  // foi a do clique (ADR-172).
                  emOperacao={operacao !== null || registro !== null}
                />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Apagar a conversa inteira nao se confirma numa faixa do cabecalho: era
          um "Recomecar" ao lado de outro "Recomecar", e o de cima ja tinha sido
          clicado. Aqui a pergunta trava o foco e diz o que se perde. */}
      {saudeNaTela && saude && !decidindo && (
        <LigacaoDaSaude estado={saude} onMudou={setSaude} onFechar={fecharSaude} />
      )}

      {confirmandoReinicio && (
        <Modal onClose={fecharReinicio} title="Recomeçar a Missão?">
          <Modal.Body>
            Isto apaga a conversa inteira com o Cientista e devolve as equipes para a base. O
            relógio da turma continua correndo.
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" onClick={fecharReinicio}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => reiniciar("investigacao")} disabled={ocupado}>
              Recomeçar
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
