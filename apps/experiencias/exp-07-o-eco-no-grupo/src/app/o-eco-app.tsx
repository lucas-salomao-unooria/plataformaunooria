import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, codigoDoErro, concluir, enviarEstado, statusDoErro } from "../lib/api";
import {
  deveCutucar,
  digitando as quemDigita,
  duracaoDaCascata,
  oQueFaltaParaEnviar,
  reacoesVisiveis,
  superficieDo,
} from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import type {
  Estado,
  FalaDeAmara,
  Reacao,
  RespostaAmara,
  RespostaGate,
  RespostaIntervencao,
  RespostaReflexao,
  RespostaSessao,
} from "../lib/tipos";
import {
  ChatDeAmara,
  ConversaComAmara,
  Desfazer,
  ErroDiegetico,
  FeedDoGrupo,
  SheetDeIntervencao,
  TelaDeBloqueio,
} from "./componentes/telas-do-clone";
import {
  Breakpoint,
  CardsDeSintese,
  DebateCongelado,
  MeuPercurso,
  MissaoCumprida,
  Podcast,
} from "./componentes/telas-da-escola";
import { ReportagemCompleta } from "./componentes/reportagem";

/**
 * A missão inteira, orquestrada.
 *
 * O estado que MANDA é o do servidor: `estado.passo` já chega reconciliado com
 * a etapa da turma, e é ele que escolhe a tela. O que é local aqui é só o que
 * não sobrevive a um F5 por natureza — o modal aberto, a opção ainda não
 * enviada, o cronômetro da cascata.
 *
 * `useState` e nada mais: sem Redux, sem Zustand. Um `useReducer` também não —
 * as transições que importam já são do servidor, e um segundo lugar decidindo
 * "o que vem depois" seria a tela discordando da api.
 */

/** De quanto em quanto tempo se pergunta pela etapa da turma. */
const POLLING_DO_GATE_MS = 5_000;

/** Frequência do relógio da cascata. 100ms é o suficiente para a cadência de
 *  2s/3s/2s parecer contínua, e barato o bastante para um Chromebook. */
const TIQUE_DA_CASCATA_MS = 100;

export function OEcoApp({ inicial }: { inicial: RespostaSessao }) {
  const { catalogo, midia } = inicial;

  const [estado, setEstado] = useState<Estado>(inicial);
  const [reacoes, setReacoes] = useState<Reacao[]>(inicial.reacoes ?? []);
  const [falasDeAmara, setFalasDeAmara] = useState<FalaDeAmara[]>(inicial.amara);
  const [devolutiva, setDevolutiva] = useState<string | null>(inicial.reflexao?.devolutiva ?? null);

  const [materiaAberta, setMateriaAberta] = useState(false);
  const [opcaoMarcada, setOpcaoMarcada] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cutucao, setCutucao] = useState(false);
  /**
   * A resposta enviada, mostrada ANTES de a api responder.
   *
   * A geração das reações leva alguns segundos, e sem isto a criança aperta
   * "enviar" e não acontece nada visível — no pico da missão. Num mensageiro
   * real a mensagem aparece na hora e o "digitando" vem depois; é o mesmo
   * otimismo do `salvar` da exp-02, e o servidor continua sendo a autoridade.
   */
  const [respostaOtimista, setRespostaOtimista] = useState<string | null>(null);

  /**
   * A tela de bloqueio com o push não lido — E1-ALU-01.
   *
   * É estado LOCAL, e não um passo do servidor: "ainda não tocou na
   * notificação" não é dado da missão, não sobrevive a um F5 por natureza e
   * não muda nada do que o professor lê. Quem já entrou no grupo não a vê de
   * novo, porque o passo dela no servidor já andou.
   */
  const [notificacaoAberta, setNotificacaoAberta] = useState(estado.passo !== "chat_amara");

  /** Quando a cascata começou. `null` = não está animando (F5 depois dela). */
  const [cascataEm, setCascataEm] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const abertoEm = useRef(Date.now());
  const ultimaAcao = useRef(Date.now());
  const urls = midia.urls;

  // --------------------------------------------------------------- efeitos

  /** O hub desenha chrome opcional a partir daqui. Efeito, não setter: o passo
   *  muda por várias portas (ação, gate, F5), e cada uma teria de lembrar. */
  useEffect(() => {
    enviarEstado({ passo: estado.passo, etapa: estado.turma.etapa });
  }, [estado.passo, estado.turma.etapa]);

  /**
   * O polling do gate — é o que deixa a professora conduzir 30 telas.
   *
   * Só o `passoEfetivo` é comparado: quando ele diverge do que está na tela, a
   * turma andou (ou congelou) e a sessão inteira é relida. Perguntar a cada 5 s
   * é leve porque a rota não carrega catálogo nem mídia.
   */
  useEffect(() => {
    if (estado.passo === "fim") return;
    const id = setInterval(() => {
      void (async () => {
        try {
          const gate = await api.get<RespostaGate>(
            `/o-eco-no-grupo/gate?passo=${encodeURIComponent(estado.passoDoEstudante)}`,
          );
          if (gate.passoEfetivo !== estado.passo || gate.etapa !== estado.turma.etapa) {
            const sessao = await api.get<RespostaSessao>("/o-eco-no-grupo/sessao");
            setEstado(sessao);
            setReacoes(sessao.reacoes ?? []);
          }
        } catch {
          // Silêncio de propósito: queda de rede no polling não é evento para o
          // estudante. Ele volta a valer no próximo tique, e o que ele veria é
          // um alerta a cada 5 s sobre algo que não o afeta.
        }
      })();
    }, POLLING_DO_GATE_MS);
    return () => clearInterval(id);
  }, [estado.passo, estado.passoDoEstudante, estado.turma.etapa]);

  /** O relógio da cascata. Só existe enquanto ela corre. */
  useEffect(() => {
    if (cascataEm === null) return;
    const total = duracaoDaCascata(reacoes);
    const id = setInterval(() => {
      setAgora(Date.now());
      if (Date.now() - cascataEm >= total) {
        setCascataEm(null);
        telemetria.viuOAlfinete();
      }
    }, TIQUE_DA_CASCATA_MS);
    return () => clearInterval(id);
  }, [cascataEm, reacoes]);

  /** O cutucão de Amara, depois de 4 minutos de tela parada na investigação. */
  useEffect(() => {
    if (estado.passo !== "grupo") return;
    const id = setInterval(() => {
      if (!cutucao && deveCutucar(estado, Date.now() - ultimaAcao.current)) {
        setCutucao(true);
        telemetria.cutucao();
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [estado, cutucao]);

  // ----------------------------------------------------------------- ações

  const registrar = useCallback(() => {
    ultimaAcao.current = Date.now();
  }, []);

  /**
   * Toda mutação passa por aqui: um lock só, uma tradução de erro só.
   *
   * O `ocupado` é `useRef` na prática (o `setOcupado` não vale a tempo para o
   * segundo toque), e é ele que impede a criança ansiosa de mandar a mesma
   * resposta duas vezes — a api também recusa, mas o feedback local é imediato.
   */
  const emCurso = useRef(false);
  async function mutar<T extends Estado>(chamada: () => Promise<T>, aoOk?: (r: T) => void) {
    if (emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    setErro(null);
    registrar();
    try {
      const r = await chamada();
      setEstado(r);
      aoOk?.(r);
    } catch (falha) {
      setErro(fraseDoErro(falha));
    } finally {
      emCurso.current = false;
      setOcupado(false);
    }
  }

  function acao(nome: string) {
    return mutar(() => api.post<Estado>("/o-eco-no-grupo/acao", { acao: nome }));
  }

  function abrirMateria() {
    setMateriaAberta(true);
    setCutucao(false);
    registrar();
    telemetria.inspecionouMateria();
    if (!estado.inspecionouMateria) void acao("inspecionar-materia");
  }

  function fecharMateria() {
    setMateriaAberta(false);
    telemetria.fechouMateria(Math.round((Date.now() - abertoEm.current) / 1000));
  }

  function enviarResposta() {
    if (!opcaoMarcada) return;
    const latenciaSeg = Math.round((Date.now() - abertoEm.current) / 1000);
    telemetria.enviouResposta(opcaoMarcada, latenciaSeg);
    setRespostaOtimista(catalogo.opcoes.find((o) => o.id === opcaoMarcada)?.texto ?? null);
    void mutar<RespostaIntervencao>(
      () => api.post("/o-eco-no-grupo/intervencao", { opcao: opcaoMarcada, latenciaSeg }),
      (r) => {
        setReacoes(r.reacoes);
        setCascataEm(Date.now());
        setAgora(Date.now());
        setOpcaoMarcada(null);
      },
    );
  }

  function desfazer() {
    const anterior = estado.opcao ?? "";
    telemetria.desfez(anterior);
    void mutar(() => api.post<Estado>("/o-eco-no-grupo/desfazer"), () => {
      setReacoes([]);
      setCascataEm(null);
      setRespostaOtimista(null);
    });
  }

  function entregarPercurso(estrategias: string[], justificativa: string) {
    void mutar<RespostaReflexao>(
      () => api.post("/o-eco-no-grupo/reflexao", { estrategias, justificativa }),
      (r) => {
        setDevolutiva(r.devolutiva);
        telemetria.entregouPercurso(r.score);
        // O `score` vem da api — quem corrige é o servidor. Ele não aparece em
        // tela nenhuma desta experiência: existe para o hub e para o painel.
        concluir(r.score, { percursoSalvo: true });
      },
    );
  }

  async function falarComAmara(texto: string) {
    if (emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    setErro(null);
    const turno = falasDeAmara.filter((f) => f.papel === "estudante").length + 1;
    setFalasDeAmara((atual) => [...atual, { papel: "estudante", texto }]);
    try {
      const r = await api.postLento<RespostaAmara>("/o-eco-no-grupo/amara", { texto });
      setFalasDeAmara((atual) => [...atual, { papel: "amara", texto: r.texto }]);
      telemetria.falouComAmara(turno);
    } catch (falha) {
      setErro(fraseDoErro(falha));
    } finally {
      emCurso.current = false;
      setOcupado(false);
    }
  }

  // ---------------------------------------------------------------- derivados

  const decorrido = cascataEm === null ? Number.MAX_SAFE_INTEGER : agora - cascataEm;
  const visiveis = reacoesVisiveis(reacoes, decorrido);
  const digitando = quemDigita(reacoes, decorrido);
  const respostaEnviada = useMemo(
    () =>
      estado.opcao
        ? (catalogo.opcoes.find((o) => o.id === estado.opcao)?.texto ?? null)
        : respostaOtimista,
    [estado.opcao, catalogo.opcoes, respostaOtimista],
  );
  // `desfecho`, nunca a letra: ver o comentário em `tipos.ts`.
  const acalmou = estado.desfecho === "checada";
  const cascataTerminou = cascataEm === null;
  const podeDesfazer = estado.passo === "desfecho" && !acalmou && cascataTerminou;
  const fixada =
    estado.passo === "desfecho" && acalmou && cascataTerminou
      ? "Marcos Admin fixou uma mensagem"
      : null;
  const turnosRestantes = 3 - falasDeAmara.filter((f) => f.papel === "estudante").length;

  // ------------------------------------------------------------------ telas

  if (!notificacaoAberta) {
    return (
      <TelaDeBloqueio
        aoAbrir={() => {
          setNotificacaoAberta(true);
          registrar();
          telemetria.abriuChat("amara");
        }}
      />
    );
  }

  if (materiaAberta) {
    return (
      <ReportagemCompleta
        materia={catalogo.materia}
        url={urls[catalogo.materia.fotoDaMateria] ?? null}
        aoFechar={fecharMateria}
      />
    );
  }

  if (superficieDo(estado.passo) === "plataforma") {
    return (
      <>
        {erro && <ErroDiegetico mensagem={erro} />}
        {telaDaEscola()}
      </>
    );
  }

  return (
    <>
      {erro && <ErroDiegetico mensagem={erro} />}
      {telaDoClone()}
    </>
  );

  function telaDaEscola() {
    if (estado.passo === "breakpoint") return <Breakpoint />;

    if (estado.passo === "podcast") {
      return (
        <Podcast
          url={urls["podcast-recapitulacao"] ?? null}
          jaOuviu={estado.ouviuPodcast}
          aoConcluir={() => {
            telemetria.ouviuPodcast();
            void acao("ouvir-podcast");
          }}
          aoAvancar={() => void acao("ouvir-podcast")}
        />
      );
    }

    if (estado.passo === "sintese") {
      /*
       * Com o debate aberto, TODOS veem a tela de espera — inclusive quem
       * ainda não terminou os cards.
       *
       * "Congelar as telas" só quer dizer alguma coisa se elas ficarem
       * iguais: com cada estudante num card diferente, a professora estaria
       * conduzindo uma conversa contra trinta telas distintas. Quem congela
       * cedo demais desfaz reabrindo a Aula 2, e os cards voltam de onde
       * pararam — `cardsLidos` não é perdido.
       */
      if (estado.turma.etapa === "debate") return <DebateCongelado />;
      return (
        <CardsDeSintese
          cards={catalogo.cards}
          lidos={estado.cardsLidos}
          aoAvancar={() => {
            telemetria.leuCard(estado.cardsLidos + 1);
            void acao("avancar-card");
          }}
          aoConcluir={() => {
            telemetria.leuCard(catalogo.cards.length);
            void acao("avancar-card").then(() => acao("abrir-reflexao"));
          }}
        />
      );
    }

    if (estado.passo === "reflexao") {
      return (
        <MeuPercurso
          estrategias={catalogo.estrategias}
          justificativas={catalogo.justificativas}
          aoEnviar={entregarPercurso}
          enviando={ocupado}
          erro={erro}
        />
      );
    }

    return <MissaoCumprida devolutiva={devolutiva} />;
  }

  function telaDoClone() {
    if (estado.passo === "chat_amara") {
      return (
        <ChatDeAmara
          falas={["Entra lá no grupo e investiga de onde saiu essa história antes que a confusão aumente."]}
          audioUrl={urls["amara-alerta"] ?? null}
          transcricao="O pessoal tá apavorado no grupo Voz do Bairro. Repassaram um print dizendo que a prefeitura cancelou o festival por desordem. Meu tio tava lá e disse que correu tudo em paz!"
          cta="Entrar no Grupo Comunidade Alerta"
          aoOuvirAudio={() => telemetria.ouviuAudio("amara-alerta")}
          aoTocarCta={() => {
            telemetria.abriuChat("grupo");
            void acao("entrar-no-grupo");
          }}
        />
      );
    }

    // Depois do alfinete, Amara chama no privado — e é ali que a conversa livre
    // existe. Antes disso ela está em silêncio, e o servidor recusa.
    if (estado.passo === "desfecho" && acalmou && cascataTerminou && falasDeAmara.length > 0) {
      return (
        <ChatDeAmara
          falas={[catalogo.amaraCelebra]}
          audioUrl={null}
          transcricao={null}
          cta="Ver a síntese"
          aoOuvirAudio={() => {}}
          aoTocarCta={() => void acao("avancar-card").then(() => api.post("/o-eco-no-grupo/sintese"))}
          conversa={
            <ConversaComAmara
              falas={falasDeAmara}
              turnosRestantes={turnosRestantes}
              aoEnviar={(t) => void falarComAmara(t)}
              ocupado={ocupado}
              erro={erro}
            />
          }
        />
      );
    }

    const podeIntervir = estado.passo === "intervencao";
    const faltando = oQueFaltaParaEnviar(estado, opcaoMarcada);

    return (
      <FeedDoGrupo
        catalogo={catalogo}
        midia={urls}
        reacoes={reacoes}
        visiveis={visiveis}
        digitando={digitando}
        respostaEnviada={respostaEnviada}
        fixada={fixada}
        cutucao={cutucao ? catalogo.amaraCutucao : null}
        aoAbrirMateria={abrirMateria}
        aoOuvirAudio={(id) => {
          telemetria.ouviuAudio(id);
          void acao("ouvir-audio");
        }}
        aoRetomar={() => {
          setCutucao(false);
          registrar();
        }}
        composer={
          podeIntervir ? (
            <SheetDeIntervencao
              opcoes={catalogo.opcoes}
              marcada={opcaoMarcada}
              aoMarcar={(id) => {
                setOpcaoMarcada(id);
                registrar();
                telemetria.marcouOpcao(id);
              }}
              aoEnviar={enviarResposta}
              bloqueio={faltando}
              enviando={ocupado}
            />
          ) : podeDesfazer ? (
            <Desfazer aoDesfazer={desfazer} ocupado={ocupado} />
          ) : estado.passo === "desfecho" && acalmou && cascataTerminou ? (
            <div style={{ padding: 14, background: "var(--wa-color-surface-sheet)" }}>
              <button
                type="button"
                onClick={() => {
                  telemetria.abriuChat("amara");
                  setFalasDeAmara((atual) =>
                    atual.length > 0 ? atual : [{ papel: "amara", texto: catalogo.amaraCelebra }],
                  );
                }}
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "var(--wa-color-surface-elevated)",
                  color: "var(--wa-color-text-primary)",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <strong style={{ display: "block" }}>Amara</strong>
                Nova mensagem no privado
              </button>
            </div>
          ) : undefined
        }
      />
    );
  }
}

/**
 * A frase que o estudante lê quando a api recusa.
 *
 * Cada uma fala de dentro do app, e nenhuma diz "erro", "403" ou "atividade".
 * As duas de espera (a aula não começou, o debate está em curso) precisam soar
 * como "está tudo certo, aguarde" — um "acesso negado" ali faria a criança
 * achar que perdeu a missão.
 */
function fraseDoErro(falha: unknown): string {
  const status = statusDoErro(falha);
  if (status === 409) return "Isso não dá para fazer agora. Espere um instante.";
  if (status === 429) return "Amara ficou sem sinal por hoje. Seu percurso está registrado.";
  if (status === 503) return "Amara não conseguiu responder agora. Tente falar de novo.";
  if (codigoDoErro(falha) === "rede") {
    return "Conectando… Sem conexão com a internet. Suas ações serão sincronizadas assim que o sinal voltar.";
  }
  return "Não deu para enviar agora.";
}
