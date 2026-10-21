import { useCallback, useEffect, useState } from "react";
import { createExperiencia, type ExperienciaHandle } from "@edu/sdk";
import { ButtonUnv } from "@edu/ui/ds-unoovista";
import { Avisos } from "./app/avisos";
import { useConexao } from "./app/conexao";
import { Indisponivel } from "./app/escola/telas-da-escola";
import { JuriApp } from "./app/juri-app";
import { api, definirExperiencia, reportarErro, tipoDaFalha } from "./lib/api";
import { ligarTelemetria, telemetria } from "./lib/telemetria";
import { GLOBAL } from "./lib/textos";
import { EXP_ID, EXP_VERSION, ROTA, type Sessao } from "./lib/tipos";

type Falha = "bloqueada" | "sem-turma" | "outra";

/**
 * Handshake com o hub e primeira leitura do estado — na ordem em que acontecem
 * (molde: `exp07ef1b/src/bootstrap.tsx`):
 *
 * 1. `createExperiencia` troca `exp:ready`/`hub:init` por postMessage e recebe
 *    o token, o estudante e o `config`. Fora do hub ele nunca resolve: abra por
 *    `/exp/exp06ef1b` ou pela bancada `/dev-embed?src=http://localhost:5185`.
 * 2. `GET /juri-estadual/sessao` — o estado da criança, reconciliado com a etapa
 *    da turma. É ela que CRIA a sessão na primeira entrada (o polling não
 *    escreve), e é pelo funil dela que passa a guarda de liberação (ADR-69):
 *    o 403 de missão fechada (`missao-nao-liberada`) e o da turma sem
 *    atividade em andamento (`atividade-nao-preparada`) chegam aqui.
 *
 * A primeira leitura já passa pela `conexao` da missão: sem rede ou sem token
 * válido, a tela mostra o aviso diegético e repete sozinha.
 *
 * **A espera e o erro falam a língua do app** (o esqueleto da barra do topo,
 * "Não foi possível carregar a mostra agora"), menos o 403, que é a escola
 * falando: a criança não fez nada de errado, e quem resolve é o professor.
 */
export function Bootstrap() {
  const conexao = useConexao();
  const { executar } = conexao;
  const [pronto, setPronto] = useState(false);
  const [inicial, setInicial] = useState<Sessao | null>(null);
  const [falha, setFalha] = useState<Falha | null>(null);
  const iconesProntos = useFonteDeIcones();

  const carregar = useCallback(async () => {
    setFalha(null);
    try {
      const sessao = await executar(() => api.get<Sessao>(`${ROTA}/sessao`));
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

  if (falha === "bloqueada") return <Indisponivel />;

  if (falha) {
    return (
      <div className="app app--centrado">
        <p className="aviso-de-abertura">{falha === "sem-turma" ? GLOBAL.semTurma : GLOBAL.naoAbriu}</p>
        {pronto && falha === "outra" && (
          <ButtonUnv variant="secondary" size="md" onClick={() => void carregar()}>
            {GLOBAL.tentarNovamente}
          </ButtonUnv>
        )}
      </div>
    );
  }

  if (!inicial || !iconesProntos) {
    /* O esqueleto do próprio app — a barra do topo, sem conteúdo —, e não um
       "carregando" genérico: ele denunciaria que algo está sendo montado. */
    return (
      <div className="app" aria-busy="true">
        <div className="esqueleto__topo" />
        <Avisos aviso={conexao.aviso} voz="clone" aoRevalidar={conexao.revalidar} />
      </div>
    );
  }

  return <JuriApp inicial={inicial} conexao={conexao} />;
}

/** Teto da espera pela fonte: passou disso, a tela abre de qualquer jeito. */
const ESPERA_MAXIMA_DOS_ICONES_MS = 2500;

/**
 * O `Icon` do Unoovista é ligadura do Material Symbols, e a folha do DS declara
 * a fonte com `font-display: swap`: até o arquivo chegar, o navegador desenha o
 * NOME do glifo, cortado na caixa do ícone ("ve" no lugar do selo `verified`).
 * O crachá é a primeira tela, então é ele que cai nessa janela. A abertura
 * espera a fonte (com teto) e mostra o esqueleto enquanto isso.
 */
function useFonteDeIcones(): boolean {
  const [pronta, setPronta] = useState(false);
  useEffect(() => {
    let vivo = true;
    const liberar = () => {
      if (vivo) setPronta(true);
    };
    const teto = window.setTimeout(liberar, ESPERA_MAXIMA_DOS_ICONES_MS);
    const fontes = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fontes?.load) liberar();
    else void fontes.load('24px "Material Symbols Rounded"', "verified").then(liberar, liberar);
    return () => {
      vivo = false;
      window.clearTimeout(teto);
    };
  }, []);
  return pronta;
}
