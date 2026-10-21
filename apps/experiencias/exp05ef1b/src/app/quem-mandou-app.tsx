import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, TextButton, Toast } from "@edu/ui/ds-unoochat";
import { api, classificar, concluir, enviarEstado, reportarErro } from "../lib/api";
import {
  INTERVALO_DO_GATE_MS,
  MS_DO_AVISO,
  VISTA_INICIAL,
  alternarSelecao,
  andamentoDo,
  gateDoPasso,
  gateMudou,
  grupoChegaEmSequencia,
  mensagensDoMural,
  mesclarSessao,
  mesmaAtividade,
  telaDe,
  type Vista,
} from "../lib/regras";
import { telemetria, type GateVisto } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { ClasseDeFalha, Estado, Expressao, Gate, Robo, Sessao } from "../lib/tipos";
import { ChatDoConvite, GrupoDaTurma, ListaDeConversas, MuralDaTurma, type EtapaDoMural } from "./telas-do-clone";
import { TelaConcluida, TelaDoRobo } from "./telas-da-escola";

/**
 * A casca da missão: uma máquina de telas sobre o que o SERVIDOR diz.
 *
 * Três regras valem para tudo aqui:
 *
 * 1. **O passo é do servidor** (`passoEfetivo(latches, fase)`), e a tela é
 *    `telaDe(passo, vista)`. A vista (lista ou chat da Nina, grupo ou Mural) é
 *    o que só esta aba sabe — e nada dela vale como estado: um F5 cai sempre
 *    na tela certa do passo.
 * 2. **Nenhuma comparação com o gabarito.** Ele não existe no pacote: chega só
 *    dentro de `revelacao`, depois do voto e da revelação aberta pela turma.
 * 3. **Toda ação que falha FALA** — na voz do app ("Conectando...", o aviso na
 *    base da tela, a janela de conexão expirada) ou, na casca, na da escola. Um
 *    409 não é erro para a criança: é o relógio da turma na frente, e a
 *    resposta é reler a sessão.
 */
export function QuemMandouApp({ inicial }: { inicial: Sessao }) {
  const [sessao, setSessao] = useState<Sessao>(inicial);
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL);
  const [conectado, setConectado] = useState(true);
  const [expirou, setExpirou] = useState(false);
  const [bloqueada, setBloqueada] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /** A falha de rede de um envio da casca (o robô): a casca fala por um alerta, não pelo aviso do app. */
  const [falhaDoRobo, setFalhaDoRobo] = useState<"rede" | null>(null);
  const [tentativa, setTentativa] = useState(0);

  /** Para o polling (um `setInterval`) ler a sessão de AGORA, não a da montagem. */
  const atual = useRef(sessao);
  atual.current = sessao;
  const gatesVistos = useRef(new Set<GateVisto>());
  const filaDaSelecao = useRef<Promise<void>>(Promise.resolve());
  const concluindo = useRef(false);

  // ─────────────────────────────────────────────────── falhas e avisos

  const avisar = useCallback((texto: string) => setAviso(texto), []);

  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(null), MS_DO_AVISO);
    return () => window.clearTimeout(id);
  }, [aviso]);

  /** Tudo o que saiu bem acende a conexão e fecha as janelas de falha. */
  const deuCerto = useCallback(() => {
    setConectado(true);
    setExpirou(false);
    setBloqueada(false);
  }, []);

  /**
   * Relê a sessão inteira. Atividade NOVA (pacote novo aprovado, ou "Zerar a
   * turma") zera tudo o que a aba sabia: a vista era de outro grupo (o filtro
   * e o robô em montagem vivem nas telas, que remontam com a sessão nova).
   */
  const recarregar = useCallback(async () => {
    try {
      const nova = await api.get<Sessao>("/quem-mandou-isso/sessao");
      deuCerto();
      if (!mesmaAtividade(atual.current.atividade, nova.atividade)) {
        setVista(VISTA_INICIAL);
        concluindo.current = false;
        gatesVistos.current.clear();
      }
      setSessao((s) => mesclarSessao(s, nova));
    } catch (erro) {
      tratarFalhaDeLeitura(erro);
    }
  }, [deuCerto]);

  /** A falha de uma LEITURA (polling, releitura): nunca um aviso na tela — só o estado da conexão. */
  function tratarFalhaDeLeitura(erro: unknown): ClasseDeFalha {
    const classe = classificar(erro);
    if (classe === "rede") setConectado(false);
    else if (classe === "sessao-expirada") setExpirou(true);
    else if (classe === "nao-liberada") setBloqueada(true);
    else reportarErro(erro);
    return classe;
  }

  /**
   * A falha de uma AÇÃO da criança. Devolve a classe para quem chamou decidir
   * o que uma `recusada` quis dizer ali (só a tela sabe qual ação fez).
   */
  const tratarFalhaDeAcao = useCallback(
    (erro: unknown, avisarRede: boolean): ClasseDeFalha => {
      const classe = classificar(erro);
      switch (classe) {
        case "rede":
          setConectado(false);
          if (avisarRede) avisar(TEXTOS.erros.naoEnviou);
          break;
        case "sessao-expirada":
          setExpirou(true);
          break;
        case "nao-liberada":
          setBloqueada(true);
          break;
        case "conflito":
          void recarregar();
          break;
        case "recusada":
        case "inesperada":
          reportarErro(erro);
          void recarregar();
          break;
      }
      return classe;
    },
    [avisar, recarregar],
  );

  /** O `Estado` de uma ação por cima da sessão (o pacote, os textos e as opções ficam). */
  const aplicar = useCallback(
    (estado: Estado) => {
      deuCerto();
      setSessao((s) => ({ ...s, ...estado }));
    },
    [deuCerto],
  );

  // ─────────────────────────────────────────────────────────── polling

  /**
   * O gate da turma, a cada 3 s (ADR-93). Leve de propósito: só relê a sessão
   * quando o passo, a fase, o preparo ou a atividade mudaram (`gateMudou`).
   * Para quando a missão fecha — quem está em `concluida` não tem gate que o
   * alcance. Uma volta por vez: rede lenta não empilha pedidos.
   */
  const concluida = sessao.passo === "concluida";
  useEffect(() => {
    if (concluida) return;
    let emVoo = false;
    const id = window.setInterval(() => {
      if (emVoo) return;
      emVoo = true;
      void (async () => {
        try {
          const gate = await api.get<Gate>("/quem-mandou-isso/gate");
          deuCerto();
          if (gateMudou(gate, atual.current)) await recarregar();
        } catch (erro) {
          tratarFalhaDeLeitura(erro);
        } finally {
          emVoo = false;
        }
      })();
    }, INTERVALO_DO_GATE_MS);
    return () => window.clearInterval(id);
  }, [concluida, deuCerto, recarregar]);

  // ────────────────────────────────────────────── efeitos por passo/tela

  const tela = telaDe(sessao, vista);

  /* O aviso rápido é da tela em que nasceu: trocar de tela o leva junto. */
  useEffect(() => setAviso(null), [tela]);

  useEffect(() => {
    enviarEstado({ passo: sessao.passo });
    const gate = gateDoPasso(sessao.passo);
    if (gate && !gatesVistos.current.has(gate)) {
      gatesVistos.current.add(gate);
      telemetria.viuOGate(gate);
    }
  }, [sessao.passo]);

  /* O Mural fecha quando o grupo acaba (latch 1, ou a turma andou). */
  useEffect(() => {
    if (sessao.passo !== "grupo") setVista((v) => (v.muralAberto ? { ...v, muralAberto: false } : v));
  }, [sessao.passo]);

  // ────────────────────────────────────────────────────────── as ações

  const abriuAntes = useRef(false);
  const abrirNina = useCallback(() => {
    /* O começo do funil é UM evento: voltar para a lista e abrir de novo não
       é outra tentativa. */
    if (!abriuAntes.current) telemetria.abriuAMissao();
    abriuAntes.current = true;
    setVista((v) => ({ ...v, ninaAberta: true }));
  }, []);

  const entrar = useCallback(async () => {
    setOcupado(true);
    try {
      aplicar(await api.post<Estado>("/quem-mandou-isso/entrar"));
      telemetria.entrouNoGrupo();
    } catch (erro) {
      tratarFalhaDeAcao(erro, true);
    } finally {
      setOcupado(false);
    }
  }, [aplicar, tratarFalhaDeAcao]);

  /**
   * A seleção muda NA TELA na hora, e o servidor a guarda para o F5
   * (`PUT /selecao`). Os `PUT` saem EM FILA: dois toques rápidos viram dois
   * pedidos em ordem, e o último a chegar é o último que a criança fez. A
   * resposta não sobrescreve a seleção da tela — e um `PUT` perdido não é
   * perda: o `POST /mural` leva as três que ela está VENDO.
   */
  const alternar = useCallback(
    (id: string) => {
      const r = alternarSelecao(atual.current.selecao, id, atual.current.limites.encaminhamentos);
      if (!r.ok) {
        avisar(TEXTOS.grupo.limiteAtingido);
        return;
      }
      if (r.entrou) telemetria.encaminhou(r.selecao.length);
      /* O ref anda JUNTO, e não no próximo render: dois toques antes de o
         React desenhar leriam a seleção velha e o segundo desfaria o primeiro. */
      atual.current = { ...atual.current, selecao: r.selecao };
      setSessao((s) => ({ ...s, selecao: r.selecao }));
      filaDaSelecao.current = filaDaSelecao.current.then(async () => {
        try {
          const estado = await api.put<Estado>("/quem-mandou-isso/selecao", { selecao: r.selecao });
          deuCerto();
          setSessao((s) => (estado.passo === "grupo" ? { ...s, ...estado, selecao: s.selecao } : { ...s, ...estado }));
        } catch (erro) {
          tratarFalhaDeAcao(erro, false);
        }
      });
    },
    [avisar, deuCerto, tratarFalhaDeAcao],
  );

  const irParaOMural = useCallback(() => setVista((v) => ({ ...v, muralAberto: true })), []);
  const revisar = useCallback(() => setVista((v) => ({ ...v, muralAberto: false })), []);
  const marcarGrupoChegou = useCallback(() => setVista((v) => (v.grupoChegou ? v : { ...v, grupoChegou: true })), []);

  /** "Confirmar envio" — o LATCH 1. O corpo é a seleção que a criança está VENDO. */
  const confirmarMural = useCallback(async () => {
    setOcupado(true);
    try {
      await filaDaSelecao.current;
      const estado = await api.post<Estado>("/quem-mandou-isso/mural", { selecao: atual.current.selecao });
      aplicar(estado);
      telemetria.confirmouOMural(estado.selecao.length);
    } catch (erro) {
      tratarFalhaDeAcao(erro, true);
    } finally {
      setOcupado(false);
    }
  }, [aplicar, tratarFalhaDeAcao]);

  /** O voto na enquete — o LATCH 2. */
  const votar = useCallback(
    async (motivo: string) => {
      setOcupado(true);
      try {
        aplicar(await api.post<Estado>("/quem-mandou-isso/enquete", { motivo }));
        telemetria.votou(motivo);
      } catch (erro) {
        tratarFalhaDeAcao(erro, true);
      } finally {
        setOcupado(false);
      }
    },
    [aplicar, tratarFalhaDeAcao],
  );

  // ─────────────────────────────── o alerta do grupo (EF05CO03)

  /**
   * "Ver resultado": o servidor executa o filtro e devolve quem passou. Um 409
   * é a turma andando (a síntese fechou o alerta) ou outra aba: relê.
   */
  const executarAlerta = useCallback(
    async (pedido: number, expressao: Expressao) => {
      setOcupado(true);
      try {
        const estado = await api.post<Estado>("/quem-mandou-isso/alerta/execucao", { pedido, expressao });
        aplicar(estado);
        const { execucoes } = estado.alerta ? andamentoDo(estado.alerta, pedido) : { execucoes: [] };
        telemetria.executouOAlerta(pedido, execucoes.length, execucoes.at(-1)?.passam.length ?? 0);
      } catch (erro) {
        tratarFalhaDeAcao(erro, true);
      } finally {
        setOcupado(false);
      }
    },
    [aplicar, tratarFalhaDeAcao],
  );

  /** "Enviar alerta ao grupo": o que está na tela, que é a última execução. */
  const enviarAlerta = useCallback(
    async (pedido: number, expressao: Expressao) => {
      setOcupado(true);
      try {
        aplicar(await api.post<Estado>("/quem-mandou-isso/alerta/envio", { pedido, expressao }));
        telemetria.enviouOAlerta(pedido);
      } catch (erro) {
        tratarFalhaDeAcao(erro, true);
      } finally {
        setOcupado(false);
      }
    },
    [aplicar, tratarFalhaDeAcao],
  );

  // ─────────────────────────────────── o robô do grupo (EF05CO04)

  /** Uma ação da casca. A rede falha num alerta da própria casca; o resto, como no clone. */
  const acaoDaCasca = useCallback(
    async (caminho: string, corpo: unknown): Promise<Estado | null> => {
      setOcupado(true);
      setFalhaDoRobo(null);
      try {
        const estado = await api.post<Estado>(caminho, corpo);
        aplicar(estado);
        return estado;
      } catch (erro) {
        if (tratarFalhaDeAcao(erro, false) === "rede") setFalhaDoRobo("rede");
        return null;
      } finally {
        setOcupado(false);
      }
    },
    [aplicar, tratarFalhaDeAcao],
  );

  /** Só os blocos vão ao servidor — nunca a frase nem o resultado de uma ligação. */
  const corpoDoRobo = (r: Robo) => ({ laco: r.laco, condicao: r.condicao, acoes: [...r.acoes] });

  /** "Ligar o robô": o servidor executa nas quatro mensagens; a tela anima `robo.ligacoes`. */
  const ligarRobo = useCallback(
    async (robo: Robo) => {
      const estado = await acaoDaCasca("/quem-mandou-isso/robo/ligar", corpoDoRobo(robo));
      if (estado?.robo) telemetria.ligouORobo(estado.robo.ligacoes.length, robo.laco);
    },
    [acaoDaCasca],
  );

  /** "Enviar meu robô" — definitivo. O fim da missão sai logo depois (o efeito abaixo). */
  const enviarRobo = useCallback(
    async (robo: Robo) => {
      const estado = await acaoDaCasca("/quem-mandou-isso/robo", corpoDoRobo(robo));
      if (estado?.robo) telemetria.enviouORobo(estado.robo.ligacoes.length);
    },
    [acaoDaCasca],
  );

  /**
   * O robô enviado fecha a missão: o `POST /concluir` sai sozinho, e a casca
   * "Missão Concluída" mostra o robô. Sem rede, tenta de novo no ciclo
   * seguinte (o `concluir` é idempotente no servidor).
   */
  const roboEnviado = Boolean(sessao.robo?.enviado);
  useEffect(() => {
    if (!roboEnviado || sessao.passo !== "regra" || concluindo.current) return;
    concluindo.current = true;
    void (async () => {
      try {
        aplicar(await api.post<Estado>("/quem-mandou-isso/concluir"));
        telemetria.concluiu();
        concluir({});
      } catch (erro) {
        tratarFalhaDeAcao(erro, false);
        window.setTimeout(() => {
          concluindo.current = false;
          setTentativa((t) => t + 1);
        }, INTERVALO_DO_GATE_MS);
      }
    })();
  }, [roboEnviado, sessao.passo, tentativa, aplicar, tratarFalhaDeAcao]);

  // ─────────────────────────────────────────────────────────── a tela

  const desenhar = () => {
    const { pacote, textos, opcoes, limites } = sessao;

    if (bloqueada) {
      return (
        <div className="app app--centrado">
          <p className="aviso-de-rede">{TEXTOS.erros.naoLiberada}</p>
        </div>
      );
    }

    switch (tela) {
      case "preparo":
      case "lista":
        return (
          <ListaDeConversas preparada={sessao.preparada} conectado={conectado} aoAbrirNina={abrirNina} />
        );

      case "nina":
        return pacote && textos.nina.convite ? (
          <ChatDoConvite
            convite={textos.nina.convite}
            grupo={pacote.grupo.nome}
            conectado={conectado}
            entrando={ocupado}
            aoVoltar={() => setVista((v) => ({ ...v, ninaAberta: false }))}
            aoEntrar={() => void entrar()}
          />
        ) : (
          <ListaDeConversas preparada={false} conectado={conectado} aoAbrirNina={abrirNina} />
        );

      case "grupo":
        return pacote ? (
          <GrupoDaTurma
            pacote={pacote}
            selecao={sessao.selecao}
            limite={limites.encaminhamentos}
            conectado={conectado}
            emSequencia={grupoChegaEmSequencia(vista, sessao.selecao)}
            aoChegarTudo={marcarGrupoChegou}
            aoAlternar={alternar}
            aoIrParaOMural={irParaOMural}
            aoAvisar={avisar}
          />
        ) : null;

      case "mural":
      case "enquete":
      case "espera":
      case "revelacao":
      case "sintese": {
        if (!pacote) return null;
        const etapa: EtapaDoMural = tela === "mural" ? "revisao" : tela;
        return (
          <MuralDaTurma
            etapa={etapa}
            mensagens={mensagensDoMural(pacote.mensagens, sessao.selecao)}
            todas={pacote.mensagens}
            motivos={opcoes.motivos}
            motivo={sessao.motivo}
            revelacao={sessao.revelacao}
            alerta={sessao.alerta}
            limiteDeExecucoes={limites.execucoes}
            conectado={conectado}
            ocupado={ocupado}
            aoRevisar={revisar}
            aoConfirmar={() => void confirmarMural()}
            aoVotar={(m) => void votar(m)}
            aoExecutarAlerta={(n, e) => void executarAlerta(n, e)}
            aoEnviarAlerta={(n, e) => void enviarAlerta(n, e)}
          />
        );
      }

      case "regra":
        return (
          <TelaDoRobo
            /* Atividade nova (outro grupo) remonta o robô em montagem. */
            key={sessao.atividade ? `${sessao.atividade.pacoteId}:${sessao.atividade.rodada}` : "sem-atividade"}
            tio={textos.nina.tio}
            laco={opcoes.laco}
            condicoes={opcoes.condicoes}
            acoes={opcoes.acoes}
            robo={sessao.robo}
            limite={limites.ligacoes}
            falha={falhaDoRobo}
            ocupado={ocupado || roboEnviado}
            aoLigar={(r) => void ligarRobo(r)}
            aoEnviar={(r) => void enviarRobo(r)}
          />
        );

      case "concluida":
        return (
          <TelaConcluida
            robo={sessao.robo?.enviado ?? null}
            laco={opcoes.laco}
            condicoes={opcoes.condicoes}
            acoes={opcoes.acoes}
            encerramento={textos.nina.encerramento}
          />
        );
    }
  };

  return (
    <div className="raiz">
      {desenhar()}
      {/* O aviso rápido da base da tela: região viva sempre montada (o DS a
          mantém), para o leitor de tela anunciar o texto quando ele aparece. */}
      <Toast open={aviso !== null}>{aviso}</Toast>
      {/* `e2.erro.sessao_expirada_modal` — na voz do app. Reconectar é reler: o
          hub renova o token por conta própria (`exp:token-expirando`), e o
          primeiro pedido que passar fecha a janela. */}
      <Dialog
        open={expirou}
        onClose={() => void recarregar()}
        footer={<Dialog.Footer actions={<TextButton onClick={() => void recarregar()}>{TEXTOS.erros.reconectar}</TextButton>} />}
      >
        <p className="janela__texto">{TEXTOS.erros.sessaoExpirada}</p>
      </Dialog>
    </div>
  );
}
