import { useCallback, useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { ButtonUjn } from "@edu/ui/ds-unoojornal";
import { useConexao } from "./app/conexao";
import { AvisoDeConexao } from "./app/jornal/avisos";
import { Indisponivel } from "./app/mecanica/indisponivel";
import { NinaApp } from "./app/nina-app";
import { definirExperiencia, nina, reportarErro, tipoDaFalha } from "./lib/api";
import { ligarTelemetria, telemetria } from "./lib/telemetria";
import { GLOBAL } from "./lib/textos";
import { EXP_ID, EXP_VERSION, type Sessao } from "./lib/tipos";

type Falha = "bloqueada" | "outra";

/**
 * Handshake com o hub e primeira leitura do estado (molde:
 * `exp06ef1b/src/bootstrap.tsx`):
 *
 * 1. `createExperiencia` troca `exp:ready`/`hub:init` por postMessage e recebe
 *    o token, o estudante e o `config`. Fora do hub ele nunca resolve: abra por
 *    `/exp/exp03ef1b` ou pela bancada `/dev-embed?src=http://localhost:5189`.
 * 2. `GET /nina-noticia/sessao` — o estado da criança, já reconciliado com a
 *    etapa da turma. É a sessão que passa pelo funil da guarda de liberação
 *    (ADR-69): o 403 de missão fechada chega aqui e vira a tela da ESCOLA.
 *
 * A espera e o erro falam a língua do jornal (o topo vazio, "Não deu para
 * abrir o jornal agora"); só o 403 fala pela escola.
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
      const sessao = await executar(() => nina.sessao());
      setInicial(sessao);
      telemetria.entrou(sessao.passo);
    } catch (erro) {
      const tipo = tipoDaFalha(erro);
      setFalha(tipo === "bloqueada" ? "bloqueada" : "outra");
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

  if (falha) {
    return (
      <div className="app app--centrado">
        <p className="aviso-de-abertura">{GLOBAL.naoAbriu}</p>
        {pronto ? (
          <ButtonUjn variant="secondary" size="lg" onClick={() => void carregar()}>
            {GLOBAL.tentarNovamente}
          </ButtonUjn>
        ) : null}
      </div>
    );
  }

  if (!inicial) {
    /* O esqueleto do próprio jornal — a barra do topo, sem conteúdo. */
    return (
      <div className="app" aria-busy="true">
        <div className="esqueleto__topo" />
        <AvisoDeConexao aviso={conexao.aviso} aoReconectar={conexao.revalidar} />
      </div>
    );
  }

  return <NinaApp inicial={inicial} conexao={conexao} />;
}
