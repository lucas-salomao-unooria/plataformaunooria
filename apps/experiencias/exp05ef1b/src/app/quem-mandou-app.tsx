import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, TextButton, Toast } from "@edu/ui/ds-unoochat";
import { api, classificar, concluir, enviarEstado, reportarErro } from "../lib/api";
import {
  INTERVALO_DO_GATE_MS,
  MS_DA_DESPEDIDA,
  MS_DO_AVISO,
  VISTA_INICIAL,
  alternarSelecao,
  gateDoPasso,
  gateMudou,
  grupoChegaEmSequencia,
  marcaComoVista,
  mensagensDoMural,
  mesclarSessao,
  mesmaAtividade,
  telaDe,
  type Vista,
} from "../lib/regras";
import { telemetria, type GateVisto } from "../lib/telemetria";
import { TEXTOS } from "../lib/textos";
import type { ClasseDeFalha, Estado, Gate, Pergunta, RespostaEnviada, Sessao } from "../lib/tipos";
import { EXP_ID } from "../lib/tipos";
import {
  ChatDasPerguntas,
  ChatDoConvite,
  GrupoDaTurma,
  ListaDeConversas,
  MuralDaTurma,
  type EtapaDoMural,
} from "./telas-do-clone";
import { TelaConcluida } from "./telas-da-escola";

/**
 * A casca da missão: uma máquina de telas sobre o que o SERVIDOR diz.
 *
 * Três regras valem para tudo aqui:
 *
 * 1. **O passo é do servidor** (`passoEfetivo(latches, fase)`), e a tela é
 *    `telaDe(passo, vista)`. A vista (lista ou chat da Nina, grupo ou Mural, a
 *    confirmação da regra, a despedida) é o que só esta aba sabe — e nada dela
 *    vale como estado: um F5 cai sempre na tela certa do passo.
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
  const [perguntas, setPerguntas] = useState<Record<string, Pergunta>>({});
  const [respondidas, setRespondidas] = useState<Record<string, string>>({});

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
   * turma") zera tudo o que a aba sabia: a vista, as perguntas carregadas e as
   * respostas desta aba eram de outro grupo.
   */
  const recarregar = useCallback(async () => {
    try {
      const nova = await api.get<Sessao>("/quem-mandou-isso/sessao");
      deuCerto();
      if (!mesmaAtividade(atual.current.atividade, nova.atividade)) {
        setVista(VISTA_INICIAL);
        setPerguntas({});
        setRespondidas({});
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

  /* Desenhou os crachás (revelação ou síntese): quando a turma for para a
     reflexão, a casca pode tomar a tela direto. A `revelacao-atrasada` NÃO
     marca sozinha — é o "Continuar" dela que marca. */
  useEffect(() => {
    if (marcaComoVista(tela)) setVista((v) => (v.viuRevelacao ? v : { ...v, viuRevelacao: true }));
  }, [tela]);

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

  const continuarDaRevelacao = useCallback(() => setVista((v) => ({ ...v, viuRevelacao: true })), []);

  /* As perguntas da evidência: carregadas UMA vez por aba (cada GET embaralha
     de novo, e a ordem não pode trocar na frente da criança). Falhou? Tenta de
     novo no próximo ciclo. */
  const idsDasPerguntas = sessao.textos.perguntas.map((p) => p.perguntaId);
  const faltaCarregar = idsDasPerguntas.filter((id) => !perguntas[id]).join(",");
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (tela !== "perguntas" || !faltaCarregar) return;
    let vivo = true;
    void (async () => {
      for (const id of faltaCarregar.split(",")) {
        try {
          const p = await api.get<Pergunta>(`/evidencias/${EXP_ID}/perguntas/${encodeURIComponent(id)}`);
          if (!vivo) return;
          deuCerto();
          setPerguntas((atuais) => (atuais[id] ? atuais : { ...atuais, [id]: p }));
        } catch (erro) {
          if (!vivo) return;
          tratarFalhaDeLeitura(erro);
          window.setTimeout(() => vivo && setTentativa((t) => t + 1), INTERVALO_DO_GATE_MS);
          return;
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [tela, faltaCarregar, tentativa, deuCerto]);

  /**
   * Uma resposta de P1/P2. O recibo é sempre `{ enviada: true }` — a criança
   * não sabe, pela resposta, se acertou nem se já tinha respondido. Um 409
   * (`sem-atividade-em-andamento`) é quem já concluiu ou mudou de rodada: relê.
   */
  const responder = useCallback(
    async (perguntaId: string, alternativaId: string) => {
      setOcupado(true);
      try {
        await api.post<RespostaEnviada>(
          `/evidencias/${EXP_ID}/perguntas/${encodeURIComponent(perguntaId)}/resposta`,
          { alternativaId },
        );
        deuCerto();
        setRespondidas((r) => ({ ...r, [perguntaId]: alternativaId }));
      } catch (erro) {
        tratarFalhaDeAcao(erro, true);
      } finally {
        setOcupado(false);
      }
    },
    [deuCerto, tratarFalhaDeAcao],
  );

  /**
   * Respondeu as duas: a despedida da Nina aparece e o `POST /concluir` sai
   * JUNTO — a missão fecha no servidor antes da casca, e fechar a aba no meio
   * da despedida não perde nada. A casca "Missão Concluída" entra depois de
   * `MS_DA_DESPEDIDA`, para a despedida ser lida.
   */
  const todasRespondidas = idsDasPerguntas.length > 0 && idsDasPerguntas.every((id) => id in respondidas);
  useEffect(() => {
    if (!todasRespondidas || sessao.passo !== "perguntas" || concluindo.current) return;
    concluindo.current = true;
    void (async () => {
      try {
        const estado = await api.post<Estado>("/quem-mandou-isso/concluir");
        setVista((v) => ({ ...v, segurandoDespedida: true }));
        aplicar(estado);
        telemetria.concluiu();
        concluir({});
        window.setTimeout(() => setVista((v) => ({ ...v, segurandoDespedida: false })), MS_DA_DESPEDIDA);
      } catch (erro) {
        tratarFalhaDeAcao(erro, false);
        /* Sem rede: a despedida continua na tela e a próxima tentativa sai no
           ciclo seguinte (o `concluir` é idempotente no servidor). */
        window.setTimeout(() => {
          concluindo.current = false;
          setTentativa((t) => t + 1);
        }, INTERVALO_DO_GATE_MS);
      }
    })();
  }, [todasRespondidas, sessao.passo, tentativa, aplicar, tratarFalhaDeAcao]);

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
      case "sintese":
      case "revelacao-atrasada": {
        if (!pacote) return null;
        const etapa: EtapaDoMural =
          tela === "mural" ? "revisao" : tela === "revelacao-atrasada" ? "atrasada" : tela;
        return (
          <MuralDaTurma
            etapa={etapa}
            mensagens={mensagensDoMural(pacote.mensagens, sessao.selecao)}
            todas={pacote.mensagens}
            motivos={opcoes.motivos}
            motivo={sessao.motivo}
            revelacao={sessao.revelacao}
            conectado={conectado}
            ocupado={ocupado}
            aoRevisar={revisar}
            aoConfirmar={() => void confirmarMural()}
            aoVotar={(m) => void votar(m)}
            aoContinuar={continuarDaRevelacao}
          />
        );
      }

      case "perguntas":
        return (
          <ChatDasPerguntas
            falas={textos.perguntas}
            perguntas={perguntas}
            respondidas={respondidas}
            despedida={textos.nina.encerramento}
            mostrarDespedida={todasRespondidas || sessao.passo === "concluida"}
            conectado={conectado}
            ocupado={ocupado}
            aoResponder={(p, a) => void responder(p, a)}
          />
        );

      case "concluida":
        return <TelaConcluida />;
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
