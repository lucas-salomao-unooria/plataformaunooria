import { useCallback, useEffect, useRef, useState } from "react";
import { api, codigoDoErro, concluir, enviarEstado, reportarErro } from "../lib/api";
import { INTERVALO_DO_GATE_MS, segundosDesde, telaDoPasso } from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type {
  Estado,
  RespostaEncaminhamento,
  RespostaGate,
  RespostaSessao,
} from "../lib/tipos";
import { EsperaAtiva, FeedDoGrupo, MuralDaTurma, MuralRevelado } from "./componentes/telas-do-clone";
import {
  TelaConcluida,
  TelaDaReflexao,
  TelaDeAbertura,
  TelaDeEsperaDoPreparo,
} from "./componentes/telas-da-escola";

/**
 * A casca da missão: uma máquina de telas sobre o que o SERVIDOR diz.
 *
 * Três regras valem para tudo aqui:
 *
 * 1. **`estado.passo`, nunca `passoDoEstudante`.** O primeiro já vem
 *    reconciliado com a etapa da turma; o segundo é o cru. Usar o cru faria a
 *    tela discordar do servidor exatamente no momento em que a professora
 *    acende o telão — e trinta crianças continuariam encaminhando com o
 *    gabarito projetado na parede.
 * 2. **Nenhuma comparação com a veracidade.** Ela não existe no lote: a api
 *    devolve `MensagemPublica` sem os três campos do gabarito, e eles só
 *    chegam dentro de `estado.revelacao`, depois do telão. Não há o que
 *    esconder no bundle porque não há o que baixar (regra 3).
 * 3. **A sessão inteira mora num estado só.** As rotas de ação devolvem
 *    `Estado` (sem o lote); `aplicar` funde o novo estado por cima da sessão,
 *    para o lote e as constantes sobreviverem a cada POST.
 */
export function QuemMandouApp({ inicial }: { inicial: RespostaSessao }) {
  const [sessao, setSessao] = useState<RespostaSessao>(inicial);
  const [muralAberto, setMuralAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [reflexao, setReflexao] = useState<string | null>(inicial.reflexao?.texto ?? null);
  /** A frase da última ação que não foi. `null` = está tudo em dia. */
  const [falha, setFalha] = useState<string | null>(null);

  /** Quando a criança tocou "Entrar no grupo". Base do tempo até o 1º encaminhamento. */
  const entrouEm = useRef<number | null>(null);
  /** O último passo avisado ao hub, para o `exp:estado` não repetir. */
  const ultimoAvisado = useRef<string>("");

  const aplicar = useCallback((estado: Estado) => {
    setSessao((atual) => ({ ...atual, ...estado }));
    /* Qualquer resposta que chega limpa a tarja: a ação seguinte deu certo, e
       um aviso de falha pendurado depois disso mentiria sobre o estado. */
    setFalha(null);
  }, []);

  /**
   * A tarja de falha, e por que TODA mutação precisa dela.
   *
   * Nenhuma das oito ações tinha `catch`: numa sala com o Wi-Fi da escola
   * oscilando, a criança tocava "Confirmar envio", a promessa era rejeitada no
   * vazio e a tela não mudava. Sem mensagem, sem retomada, sem rastro — ela
   * tocava de novo, e de novo, achando que o dedo é que não estava pegando.
   *
   * `conflito-de-etapa` (409) tem frase própria e NÃO pede novo toque: ele quer
   * dizer que a professora mexeu no relógio da turma enquanto a criança decidia,
   * e tentar de novo daria o mesmo 409 — quem resolve é o polling de 5 s, que
   * traz a tela para o passo novo sozinho.
   *
   * O que não é erro de jogo sobe pelo SDK (`reportarErro`): depois do
   * handshake há token, e é assim que a falha deixa rastro no servidor em vez
   * de morrer no console de um Chromebook (ADR-84).
   */
  const comFalha = useCallback((acao: () => Promise<void>) => {
    return async () => {
      try {
        await acao();
      } catch (erro) {
        const codigo = codigoDoErro(erro);
        if (codigo === "rede" || codigo === "payload-invalido") reportarErro(erro);
        setFalha(codigo === "conflito-de-etapa" ? TEXTOS.erros.conflito : TEXTOS.erros.acaoFalhou);
      }
    };
  }, []);

  useEffect(() => {
    if (ultimoAvisado.current === sessao.passo) return;
    ultimoAvisado.current = sessao.passo;
    enviarEstado({ passo: sessao.passo });
  }, [sessao.passo]);

  /**
   * O polling do gate da turma (ADR-93: HTTP de 5 s, nunca WebSocket).
   *
   * Compara TRÊS coisas, e nenhuma é redundante. `passoEfetivo` é o telão da
   * professora chegando; `preparada` é a homologação do lote chegando — e é ela
   * que tira sozinha o estudante da tela de espera do preparo, sem que ninguém
   * peça para ele recarregar a página.
   *
   * **`etapa` é a terceira, e ela custou a tela do dilema.** "Liberar reflexão
   * final" NÃO mexe no passo efetivo de quem já está em `revelado`: o piso da
   * etapa `reflexao` é `revelado` de propósito (quem chega atrasado vê o Mural
   * com os selos antes da pergunta), então `passoEfetivo` continua `revelado` e
   * `preparada` continua `true`. Sem comparar a etapa, o `if` abaixo saía cedo
   * para sempre: a sessão nunca era relida, `turma.etapa` ficava congelada em
   * `revelacao` e o botão "Responder a última pergunta" — que exige
   * `etapa === "reflexao"` — nunca aparecia. A sala inteira ficava olhando o
   * rodapé de espera até alguém mandar apertar F5, e nada em tela nenhuma dizia
   * por quê.
   *
   * **Falha de rede aqui é silenciosa de propósito**: um alerta a cada 5 s
   * sobre algo que não afeta o que o estudante está fazendo seria pior que o
   * silêncio. Para quando a missão fecha — quem está em `fim` não tem mais gate
   * que o alcance, e continuar batendo na api seria trabalho para ninguém.
   */
  useEffect(() => {
    if (sessao.passo === "fim") return;
    const id = window.setInterval(() => {
      void (async () => {
        try {
          /* Sem `?passo=`: quem sabe onde a criança está é a linha da sessão,
             e mandar o passo daqui era o servidor perguntando à tela o que ele
             já tinha gravado. */
          const gate = await api.get<RespostaGate>("/quem-mandou-isso/gate");
          if (
            gate.passoEfetivo === sessao.passo &&
            gate.preparada === sessao.preparada &&
            gate.etapa === sessao.turma.etapa
          ) {
            return;
          }
          const nova = await api.get<RespostaSessao>("/quem-mandou-isso/sessao");
          setSessao(nova);
          setReflexao(nova.reflexao?.texto ?? null);
          /* O telão fecha o Mural para todo mundo: ficar na tela de curadoria
             aberta depois disso mostraria botões que a api já recusa. */
          if (nova.passo !== "curadoria") setMuralAberto(false);
        } catch {
          /* Silêncio deliberado: ver o comentário acima. */
        }
      })();
    }, INTERVALO_DO_GATE_MS);
    return () => window.clearInterval(id);
  }, [sessao.passo, sessao.passoDoEstudante, sessao.preparada, sessao.turma.etapa]);

  useEffect(() => {
    if (sessao.passo === "espera") telemetria.esperouARevelacao();
    if (sessao.passo === "revelado") telemetria.viuARevelacao();
  }, [sessao.passo]);

  const entrar = useCallback(async () => {
    telemetria.entrouNoGrupo();
    entrouEm.current = Date.now();
    aplicar(await api.post<Estado>("/quem-mandou-isso/entrar"));
  }, [aplicar]);

  const encaminhar = useCallback(
    async (ids: readonly string[]) => {
      /* Uma chamada por mensagem, em série: o UNIQUE de
         `exp_05_encaminhamentos` é por (estudante, mensagem), e mandar as
         quatro em paralelo produziria quatro escritas concorrentes na mesma
         sessão — que é o caminho normal numa sala de trinta tablets, não a
         exceção. Em série, cada resposta já traz o estado acumulado. */
      for (const mensagemId of ids) {
        const r = await api.post<RespostaEncaminhamento>("/quem-mandou-isso/encaminhar", {
          mensagemId,
        });
        const { novo, ...estado } = r;
        if (novo && estado.totalEncaminhadas === 1 && entrouEm.current !== null) {
          telemetria.primeiroEncaminhamento(segundosDesde(entrouEm.current));
        }
        aplicar(estado);
      }
    },
    [aplicar],
  );

  const removerDoMural = useCallback(
    async (mensagemId: string) => {
      /* DELETE, e não um `POST /desencaminhar`: é a remoção do recurso que o
         `POST /encaminhar` criou. Ver a nota do controller da api. */
      const r = await api.del<RespostaEncaminhamento>(
        `/quem-mandou-isso/encaminhar/${mensagemId}`,
      );
      const { novo: _novo, ...estado } = r;
      telemetria.revisouOMural(estado.totalEncaminhadas);
      aplicar(estado);
      /* Esvaziou o Mural revisando: sem nada para confirmar, o lugar dela é o
         grupo. Deixá-la num Mural vazio com o card do PICO seria oferecer um
         botão que a api recusa com 409. */
      if (estado.totalEncaminhadas === 0) setMuralAberto(false);
    },
    [aplicar],
  );

  const marcarLeituraIntegral = useCallback(async () => {
    telemetria.leuOGrupoInteiro();
    aplicar(await api.post<Estado>("/quem-mandou-isso/leitura-integral"));
  }, [aplicar]);

  const abrirMidia = useCallback(
    async (mensagemId: string, tipo: "audio" | "link") => {
      telemetria.abriuMidia(tipo);
      aplicar(await api.post<Estado>("/quem-mandou-isso/midia", { mensagemId }));
    },
    [aplicar],
  );

  const confirmar = useCallback(async () => {
    telemetria.confirmouACuradoria(sessao.totalEncaminhadas);
    const estado = await api.post<Estado>("/quem-mandou-isso/confirmar");
    aplicar(estado);
    setMuralAberto(false);
  }, [aplicar, sessao.totalEncaminhadas]);

  /**
   * Da revelação para o dilema.
   *
   * O avanço é do ESTUDANTE — a professora libera a etapa, ele decide quando
   * terminou de ler os selos —, mas quem o grava é o SERVIDOR. Avançar só no
   * cliente pareceria funcionar e quebraria cinco segundos depois: o polling
   * manda o passo cru e compara o `passoEfetivo` que volta, e o servidor
   * continuaria respondendo "revelado" — a criança seria jogada de volta ao
   * Mural com a pergunta pela metade.
   */
  const irParaReflexao = useCallback(async () => {
    aplicar(await api.post<Estado>("/quem-mandou-isso/avancar"));
  }, [aplicar]);

  const entregarReflexao = useCallback(
    async (texto: string) => {
      setSalvando(true);
      try {
        const estado = await api.post<Estado>("/quem-mandou-isso/reflexao", { texto });
        telemetria.entregouReflexao(texto.length);
        setReflexao(texto);
        aplicar(estado);
        /* Sem `score`: a missão não pontua ninguém (PED-11). O que vai ao hub é
           progresso, e nenhum desses números aparece em tela. */
        concluir({
          encaminhadas: estado.totalEncaminhadas,
          leuTudo: estado.leuTudo,
          confirmou: estado.confirmou,
        });
      } finally {
        setSalvando(false);
      }
    },
    [aplicar],
  );

  const tela = telaDoPasso(sessao.passo, sessao.preparada, muralAberto);
  const { lote, constantes, estudante } = sessao;

  /**
   * A tela do passo, e a TARJA por cima dela.
   *
   * A tarja mora aqui, e não dentro de cada tela, porque a falha é da CASCA:
   * as oito mutações passam pelo mesmo `comFalha`, e uma cópia do aviso em
   * cinco componentes seria a quinta que alguém esquece de pôr na tela nova.
   * Ela fica no rodapé, fora do fluxo do feed, para não empurrar o conteúdo
   * que a criança está lendo.
   */
  const desenharTela = () => {

    switch (tela) {
      case "preparo":
        return <TelaDeEsperaDoPreparo />;

      case "contexto":
        return (
          <TelaDeAbertura
            nome={estudante.nome}
            aoEntrar={() => void comFalha(entrar)()}
          />
        );

      case "grupo":
        /* `lote` só é `null` quando `preparada` é falsa, e aí a tela é outra. O
           ramo existe porque o tipo permite — um beco sem saída nunca pode
           nascer de um `null` que ninguém previu. */
        return lote ? (
          <FeedDoGrupo
            lote={lote}
            estado={sessao}
            aoEncaminhar={(ids) => void comFalha(() => encaminhar(ids))()}
            /* Devolve a PROMESSA, e não `void`: o `IntersectionObserver` do feed
               só desconecta depois que o `POST /leitura-integral` resolve — sem
               isso ele se desarmava antes da resposta, e uma falha de rede
               deixava `leuTudo` falso para sempre, com o Mural travado. */
            aoLerTudo={comFalha(marcarLeituraIntegral)}
            aoAbrirMidia={(id, tipo) => void comFalha(() => abrirMidia(id, tipo))()}
            aoAbrirMural={() => setMuralAberto(true)}
            aoFaltarPiso={(faltam) => telemetria.faltaPiso(faltam)}
            aoFaltarRolagem={() => telemetria.faltaRolagem()}
            aoPrecisarDeAjuda={() => telemetria.precisouDoScaffolding()}
          />
        ) : (
          <TelaDeEsperaDoPreparo />
        );

      case "mural":
        return lote ? (
          <MuralDaTurma
            lote={lote}
            estado={sessao}
            aoVoltar={() => setMuralAberto(false)}
            aoRemover={(id) => void comFalha(() => removerDoMural(id))()}
            aoConfirmar={() => void comFalha(confirmar)()}
            aoVerAtrito={() => telemetria.viuOAtritoDeTudo()}
          />
        ) : (
          <TelaDeEsperaDoPreparo />
        );

      case "espera":
        return lote ? <EsperaAtiva lote={lote} estado={sessao} /> : <TelaDeEsperaDoPreparo />;

      case "revelado":
        return lote ? (
          <MuralRevelado
            lote={lote}
            estado={sessao}
            /* O botão só existe com a etapa aberta E com o Mural confirmado: a
               api exige o par (snapshot, reflexão) e recusa com 409
               `curadoria-nao-confirmada` quem não fechou a curadoria a tempo. Oferecer
               o botão a ele seria oferecer um caminho que termina em recusa — a
               saída dele é a professora reabrir a exploração no painel. */
            aoResponder={
              sessao.turma.etapa === "reflexao" && sessao.confirmou
                ? () => void comFalha(irParaReflexao)()
                : undefined
            }
          />
        ) : (
          <TelaDeEsperaDoPreparo />
        );

      case "reflexao":
        return (
          <TelaDaReflexao
            pergunta={constantes.perguntaDaReflexao}
            piso={constantes.pisoDaReflexao}
            teto={constantes.tetoDaReflexao}
            salvando={salvando}
            aoEntregar={(texto) => void comFalha(() => entregarReflexao(texto))()}
          />
        );

      case "fim":
        return <TelaConcluida texto={reflexao} podcast={constantes.podcast} />;
    }
  };

  return (
    <>
      {desenharTela()}
      {falha && (
        <p className="tarja-de-falha" role="status">
          {falha}
        </p>
      )}
    </>
  );
}
