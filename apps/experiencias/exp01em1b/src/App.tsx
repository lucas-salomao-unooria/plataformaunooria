import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Espera, Expirada, Offline, type QualEspera } from "./componentes/Janelas";
import type { Contexto, Executar } from "./contexto";
import { api, concluirNaPlataforma, ehRetentavel, naAtividade, reportarErro, statusDoErro } from "./lib/api";
import { FilaDeEnvio } from "./lib/fila";
import { telemetria } from "./lib/telemetria";
import { faseAlcancou, type Estado, type Medidor, type Sessao } from "./lib/tipos";
import { Algoritmo } from "./telas/Algoritmo";
import { Aposta, ApostaTravada } from "./telas/Aposta";
import { Auditoria } from "./telas/Auditoria";
import { BoasVindas } from "./telas/BoasVindas";
import { Classificacao } from "./telas/Classificacao";
import { Concluida } from "./telas/Concluida";
import { Criterios } from "./telas/Criterios";
import { FundoDeEspera, SemPacote } from "./telas/Espera";
import { Funcoes } from "./telas/Funcoes";
import { Publicacao } from "./telas/Publicacao";
import { Reteste } from "./telas/Reteste";
import { Simulacao } from "./telas/Simulacao";

/** A fila em memória tenta de novo neste ritmo enquanto houver jogada pendente. */
const REENVIO_MS = 3000;

/**
 * Quanto a tela dos cartões fica, já fechada, depois do sexto cartão — o tempo
 * de ler a tabela causal que o servidor devolveu (E5-ALU-01 "sem scaffolding")
 * antes do painel do algoritmo. O Figma não tem botão de concluir.
 */
export const LEITURA_DA_TABELA_MS = 6000;

type Falha = "rede" | "sessao" | null;

/**
 * O despachante da missão. O PASSO vem do servidor (derivado dos carimbos e da
 * fase da turma, `regras/passos.ts` da api); a tela só escolhe quem o desenha.
 * F5 em qualquer ponto reidrata pelo `GET /assistente-invisivel/sessao`.
 *
 * As travas do professor NÃO mudam o passo: o servidor manda
 * `aguardandoProfessor` e o despachante põe a camada de espera por cima
 * (trava 0 na E1, as pausas `debate-1`/`debate-2`, a Trava 1 depois das
 * fichas e a Trava 2 depois do reteste). A aposta travada à espera de
 * "Liberar Início da Simulação" não é camada: é o próprio estado "travado" da
 * E3 ("Iniciando Simulação de Chat…"). Nenhum estado local segura tela além
 * do passo — com UMA exceção, de tempo: o sexto cartão fecha a classificação e
 * a tela dos cartões fica `LEITURA_DA_TABELA_MS` à vista, já fechada, com a
 * tabela causal (o servidor já está no algoritmo; F5 vai direto a ele).
 * Marcar passos do algoritmo não resolve o painel (só "Pular Etapa",
 * `POST /algoritmo/concluir`), então o passo não foge da tela no meio.
 */
export function App({ inicial }: { inicial: Sessao }) {
  const [sessao, setSessao] = useState<Sessao>(inicial);
  const [estado, setEstado] = useState<Estado>(inicial);
  const [medidor, setMedidor] = useState<Medidor>(inicial.medidor);
  const [falha, setFalha] = useState<Falha>(null);
  const [tentando, setTentando] = useState(false);
  const [lendoTabela, setLendoTabela] = useState(false);
  const primeiraVez = useRef(inicial.passo === "boas-vindas");
  const passoAnterior = useRef(inicial.passo);

  const fila = useMemo(() => new FilaDeEnvio(ehRetentavel, (erro) => reportarErro(erro)), []);

  const cair = useCallback((erro: unknown) => {
    const status = statusDoErro(erro);
    const tipo: Falha = status === 401 ? "sessao" : "rede";
    setFalha((atual) => {
      if (atual !== tipo) telemetria.erro(tipo === "sessao" ? "sessao-expirada" : "sem-sinal");
      return tipo;
    });
  }, []);

  const reler = useCallback(async () => {
    try {
      const nova = await api.sessao();
      setSessao(nova);
      setEstado(nova);
      setMedidor(nova.medidor);
      if (fila.pendentes === 0) setFalha(null);
    } catch (erro) {
      if (ehRetentavel(erro)) cair(erro);
      else reportarErro(erro);
    }
  }, [fila, cair]);

  /* A atividade do GESTO, lida no toque — o reenvio da fila leva a dela, não a da tela de agora (`lib/api.ts#naAtividade`). */
  const atividadeDaTela = useRef(estado.atividade);
  atividadeDaTela.current = estado.atividade;

  const executar: Executar = useCallback(
    async <T extends Estado>(chamada: () => Promise<T>, chaveDaFila?: string) => {
      const doGesto = atividadeDaTela.current;
      try {
        const novo = await naAtividade(doGesto, chamada);
        setEstado(novo);
        if (fila.pendentes === 0) setFalha(null);
        return novo;
      } catch (erro) {
        if (ehRetentavel(erro)) {
          cair(erro);
          if (chaveDaFila) {
            fila.enfileirar(chaveDaFila, async () => {
              const novo = await naAtividade(doGesto, chamada);
              setEstado(novo);
            });
          }
        } else if (statusDoErro(erro) === 409) {
          await reler();
        } else {
          reportarErro(erro);
        }
        return null;
      }
    },
    [fila, reler, cair],
  );

  /** "Tentar Reconectar Agora" / "Entrar Novamente": a fila e a sessão, AGORA. */
  const tentarJa = useCallback(async () => {
    setTentando(true);
    await fila.tentar();
    await reler();
    setTentando(false);
  }, [fila, reler]);

  /* A fila em memória: tenta de novo enquanto houver pendência; a janela apaga quando ela esvazia. */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (fila.pendentes === 0) return;
      void fila.tentar().then(() => {
        if (fila.pendentes === 0) setFalha(null);
      });
    }, REENVIO_MS);
    return () => window.clearInterval(id);
  }, [fila]);

  /* O gate: polling HTTP curto (nunca WebSocket — ADR-93/94). Libera, trava, zera e põe o pacote no ar. */
  useEffect(() => {
    const id = window.setInterval(() => {
      void api
        .gate()
        .then((g) => {
          if (fila.pendentes === 0) setFalha(null);
          setMedidor(g.medidor);
          const mudou =
            g.passo !== estado.passo ||
            g.fase !== estado.fase ||
            g.preparada !== estado.preparada ||
            g.aguardandoProfessor !== estado.aguardandoProfessor ||
            (g.atividade?.pacoteId ?? null) !== (estado.atividade?.pacoteId ?? null) ||
            (g.atividade?.rodada ?? null) !== (estado.atividade?.rodada ?? null);
          if (mudou) void reler();
        })
        .catch((erro: unknown) => {
          if (ehRetentavel(erro)) cair(erro);
        });
    }, sessao.tempos.pollingMs || 3000);
    return () => window.clearInterval(id);
  }, [estado.passo, estado.fase, estado.preparada, estado.aguardandoProfessor, estado.atividade, sessao.tempos.pollingMs, reler, fila, cair]);

  /* Os marcos da trilha: a telemetria de etapa, o zerar do professor e o LATCH 2. */
  useEffect(() => {
    const anterior = passoAnterior.current;
    if (anterior === estado.passo) return;
    passoAnterior.current = estado.passo;
    telemetria.etapa(estado.passo);
    if (estado.passo === "boas-vindas") {
      /* O professor zerou (ADR-155): a rodada recomeça da boas-vindas. */
      fila.limpar();
    }
    if (estado.passo === "concluida" && anterior !== "concluida") {
      telemetria.concluiu();
      concluirNaPlataforma();
    }
  }, [estado.passo, fila]);

  /* A leitura da tabela causal: a passagem classificação → algoritmo VISTA nesta tela (não a de um F5)
     segura a tela dos cartões, já fechada, por `LEITURA_DA_TABELA_MS`. Detectada no render (o padrão
     do React para "o valor anterior"), para o painel do algoritmo não piscar antes; vale também
     quando a jogada saiu da fila depois de a rede voltar. */
  const [passoVisto, setPassoVisto] = useState(inicial.passo);
  if (estado.passo !== passoVisto) {
    setPassoVisto(estado.passo);
    if (passoVisto === "classificacao" && estado.passo === "algoritmo") setLendoTabela(true);
  }
  useEffect(() => {
    if (!lendoTabela) return;
    const id = window.setTimeout(() => setLendoTabela(false), LEITURA_DA_TABELA_MS);
    return () => window.clearTimeout(id);
  }, [lendoTabela]);

  const naFila = useCallback((chave: string) => fila.tem(chave), [fila]);
  const ctx: Contexto = { sessao, estado, medidor, executar, naFila };
  const { tela, espera } = escolherTela(ctx, primeiraVez.current, lendoTabela);
  const chave = `${estado.atividade?.pacoteId ?? "-"}:${estado.atividade?.rodada ?? 0}`;

  return (
    <div className="app">
      <div key={chave} className="app__tela">
        {tela}
      </div>
      {espera && !falha && <Espera qual={espera} />}
      {falha === "rede" && <Offline tentando={tentando} aoReconectar={() => void tentarJa()} />}
      {falha === "sessao" && <Expirada tentando={tentando} aoEntrar={() => void tentarJa()} />}
    </div>
  );
}

/** Qual tela desenha o passo, e se a camada de espera vai por cima. Puro de efeito. */
export function escolherTela(
  ctx: Contexto,
  primeiraVez: boolean,
  lendoTabela = false,
): { tela: ReactElement; espera: QualEspera | null } {
  const { estado, sessao } = ctx;
  const p = estado.passo;
  const aguarda = estado.aguardandoProfessor;
  const fase = estado.fase;
  const pausa: QualEspera | null = fase === "debate-1" ? "debate-1" : fase === "debate-2" ? "debate-2" : null;

  if (!estado.preparada || !sessao.pacote) return { tela: <SemPacote />, espera: null };

  switch (p) {
    case "boas-vindas":
      return { tela: <BoasVindas ctx={ctx} primeiraVez={primeiraVez} />, espera: aguarda ? "inicio" : null };
    case "funcoes":
      return { tela: <Funcoes ctx={ctx} />, espera: aguarda ? "inicio" : null };
    case "aposta":
      return { tela: <Aposta ctx={ctx} />, espera: aguarda ? "inicio" : null };
    case "simulacao":
      if (!faseAlcancou(fase, "simulacao")) return { tela: <ApostaTravada ctx={ctx} />, espera: null };
      return { tela: <Simulacao ctx={ctx} />, espera: aguarda ? (pausa ?? "debate-1") : null };
    case "confronto":
    case "fichas":
      return { tela: <Auditoria ctx={ctx} />, espera: aguarda ? (pausa ?? "debate-1") : null };
    case "classificacao":
      if (aguarda) return { tela: <FundoDeEspera etapa={4} equipe={estado.equipe} />, espera: "debate-1" };
      return { tela: <Classificacao ctx={ctx} />, espera: null };
    case "algoritmo":
      if (lendoTabela && !aguarda) return { tela: <Classificacao ctx={ctx} fechada />, espera: null };
      return { tela: <Algoritmo ctx={ctx} />, espera: aguarda ? (pausa ?? "debate-2") : null };
    case "criterios":
      return { tela: <Criterios ctx={ctx} />, espera: aguarda ? (pausa ?? "debate-2") : null };
    case "reteste":
      return { tela: <Reteste ctx={ctx} />, espera: aguarda ? (pausa ?? "debate-2") : null };
    case "publicacao":
      if (aguarda) return { tela: <FundoDeEspera etapa={5} equipe={estado.equipe} />, espera: "debate-2" };
      return { tela: <Publicacao ctx={ctx} />, espera: null };
    case "concluida":
      return { tela: <Concluida ctx={ctx} />, espera: null };
  }
}
