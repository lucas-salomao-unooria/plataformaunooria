import { useCallback, useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { Avisos } from "./app/avisos";
import { useConexao } from "./app/conexao";
import { Indisponivel, NaoAbriu } from "./app/escola/indisponivel";
import { JornalApp } from "./app/jornal-app";
import { definirExperiencia, reportarErro, rotas, tipoDaFalha } from "./lib/api";
import { ligarTelemetria } from "./lib/telemetria";
import { EXP_ID, EXP_VERSION, type Sessao } from "./lib/tipos";

type Falha = "bloqueada" | "outra";

/**
 * Handshake com o hub e primeira leitura do estado — na ordem em que acontecem:
 *
 * 1. `createExperiencia` troca `exp:ready`/`hub:init` por postMessage e recebe
 *    o token, o estudante e o `config` (o fuso inclusive). Fora do hub ele
 *    nunca resolve: abra por `/exp/exp04ef1b` ou pela bancada
 *    `/dev-embed?src=http://localhost:5174`.
 * 2. `GET /jornal-escola/sessao` — o estado da criança, reconciliado com a
 *    etapa da turma, e as oito notícias da mesa. É ela que CRIA o gate, o
 *    pacote (o banco padrão, se o professor não homologou outro) e a sessão na
 *    primeira entrada, e é pelo funil dela que passa a guarda de liberação
 *    (ADR-69): o 403 chega aqui.
 *
 * A primeira leitura já passa pela `conexao`: sem rede ou sem token válido, a
 * tela mostra o aviso na voz da redação e repete sozinha.
 */
export function Bootstrap() {
  const conexao = useConexao();
  const { executar } = conexao;
  const [pronto, setPronto] = useState(false);
  const [inicial, setInicial] = useState<Sessao | null>(null);
  const [falha, setFalha] = useState<Falha | null>(null);

  const carregar = useCallback(async () => {
    setFalha(null);
    try {
      setInicial(await executar(() => rotas.sessao()));
    } catch (erro) {
      const tipo = tipoDaFalha(erro);
      setFalha(tipo === "bloqueada" ? "bloqueada" : "outra");
      // A abertura que falhou DEPOIS do handshake tem token e deixa rastro (ADR-84).
      if (tipo !== "bloqueada") reportarErro(erro);
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
        if (vivo) setPronto(true);
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

  if (falha === "bloqueada") return <Indisponivel />;
  if (falha) return <NaoAbriu aoTentar={pronto ? () => void carregar() : undefined} />;

  if (!inicial) {
    /* O esqueleto da própria redação — o topo, sem conteúdo —, e não um
       "carregando" genérico. */
    return (
      <div className="app jornal" aria-busy="true">
        <div className="esqueleto__topo" />
        <Avisos aviso={conexao.aviso} etapa="E1" aoRevalidar={conexao.revalidar} />
      </div>
    );
  }

  return <JornalApp inicial={inicial} conexao={conexao} />;
}
