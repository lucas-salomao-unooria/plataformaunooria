import { useCallback, useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { ButtonUnv } from "@edu/ui/ds-unoovista";
import { Avisos } from "./app/avisos";
import { useConexao } from "./app/conexao";
import { Indisponivel } from "./app/escola/telas-da-escola";
import { SelecaoApp } from "./app/selecao-app";
import { api, definirExperiencia, reportarErro, tipoDaFalha } from "./lib/api";
import { INTERVALO_DO_GATE_MS } from "./lib/regras";
import { ligarTelemetria, telemetria } from "./lib/telemetria";
import { GLOBAL } from "./lib/textos";
import { EXP_ID, EXP_VERSION, type RespostaSessao } from "./lib/tipos";

type Falha = "bloqueada" | "sem-turma" | "outra";

/**
 * Handshake com o hub e primeira leitura do estado — na ordem em que acontecem:
 *
 * 1. `createExperiencia` troca `exp:ready`/`hub:init` por postMessage e recebe
 *    o token, o estudante e o `config`. Fora do hub ele nunca resolve: abra por
 *    `/exp/exp07ef1b` ou pela bancada `/dev-embed?src=http://localhost:5179`.
 * 2. `GET /a-selecao/sessao` — o estado da criança, reconciliado com a etapa da
 *    turma, e os 12 posts da cobertura. É ela que CRIA a sessão e o gate na
 *    primeira entrada (o polling não escreve), e é pelo funil dela que passa a
 *    guarda de liberação (ADR-69): o 403 chega aqui.
 *
 * A primeira leitura já passa pela `conexao` da missão: sem rede ou sem token
 * válido, a tela mostra o aviso diegético e repete sozinha — a criança não
 * precisa saber que existe um F5.
 *
 * **A tela de espera e a de erro falam a língua de um app de verdade** (o
 * esqueleto do cromo, "Não foi possível carregar o feed agora"), menos o 403,
 * que é a escola falando: a criança não fez nada de errado, e quem resolve é a
 * professora.
 */
export function Bootstrap() {
  const conexao = useConexao();
  const { executar } = conexao;
  const [pronto, setPronto] = useState(false);
  const [inicial, setInicial] = useState<RespostaSessao | null>(null);
  const [falha, setFalha] = useState<Falha | null>(null);

  const carregar = useCallback(async () => {
    setFalha(null);
    try {
      const sessao = await executar(() => api.get<RespostaSessao>("/a-selecao/sessao"));
      setInicial(sessao);
      telemetria.entrou(sessao.passo);
    } catch (erro) {
      const tipo = tipoDaFalha(erro);
      setFalha(tipo === "bloqueada" ? "bloqueada" : tipo === "conflito" ? "sem-turma" : "outra");
      // A abertura que falhou DEPOIS do handshake tem token e deixa rastro (ADR-84).
      if (tipo !== "bloqueada" && tipo !== "conflito") reportarErro(erro);
    }
  }, [executar]);

  useEffect(() => {
    let vivo = true;
    let exp: ExperienciaHandle | null = null;
    void (async () => {
      try {
        exp = await createExperiencia({ expId: EXP_ID, expVersion: EXP_VERSION });
        definirExperiencia(exp);
        ligarTelemetria(exp);
        if (!vivo) return;
        setPronto(true);
      } catch (erro) {
        // Antes do handshake não há token: o sinal é a ausência de `exp:ready`,
        // que o hub observa. Depois dele, o SDK reporta (ADR-84).
        exp?.reportarErro(erro);
        if (vivo) setFalha("outra");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (pronto) void carregar();
  }, [pronto, carregar]);

  /* A porta fechada NÃO é terminal (ADR-146). O 403 da abertura é a guarda de
     liberação ou a turma sem atividade em andamento — e as duas se resolvem
     com um clique da professora, que a criança não vê. Antes, quem entrou
     cedo ficava em "ainda não está aberta" até recarregar a página. Agora a
     tela pergunta de novo no ritmo do gate (ADR-93: HTTP, nunca WebSocket),
     só com a aba visível, e entra sozinha quando abrir. Silenciosa: falha
     de rede aqui não acende aviso — a criança já está numa tela de espera. */
  useEffect(() => {
    if (falha !== "bloqueada") return;
    let vivo = true;
    const relogio = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          const sessao = await api.get<RespostaSessao>("/a-selecao/sessao");
          if (!vivo) return;
          setInicial(sessao);
          setFalha(null);
          telemetria.entrou(sessao.passo);
        } catch {
          /* continua fechada, ou sem rede: a próxima volta pergunta de novo */
        }
      })();
    }, INTERVALO_DO_GATE_MS);
    return () => {
      vivo = false;
      window.clearInterval(relogio);
    };
  }, [falha]);

  if (falha === "bloqueada") return <Indisponivel />;

  if (falha) {
    return (
      <div className="app app--centrado" data-unv-theme="light">
        <p className="aviso-de-abertura">{falha === "sem-turma" ? GLOBAL.semTurma : GLOBAL.naoAbriu}</p>
        {pronto && falha === "outra" && (
          <ButtonUnv variant="secondary" size="md" onClick={() => void carregar()}>
            {GLOBAL.tentarNovamente}
          </ButtonUnv>
        )}
      </div>
    );
  }

  if (!inicial) {
    /* O esqueleto do próprio app — a barra do topo, sem conteúdo —, e não um
       "carregando" genérico: ele denunciaria que algo está sendo montado. */
    return (
      <div className="app" aria-busy="true">
        <div className="esqueleto__topo" />
        <Avisos aviso={conexao.aviso} voz="clone" aoRevalidar={conexao.revalidar} />
      </div>
    );
  }

  return <SelecaoApp inicial={inicial} conexao={conexao} />;
}
