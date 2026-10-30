import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { concluir, enviarEstado, nina, reportarErro, tipoDaFalha } from "../lib/api";
import { gateMudou, telaVisivel, type Segurada } from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import { E3, GLOBAL } from "../lib/textos";
import {
  POLLING_DO_GATE_MS,
  SUPORTES,
  type Carimbo,
  type CartaoDaInspecao,
  type CartaoDoCaso,
  type Estado,
  type FichaMontada,
  type PassoDaSimulacao,
  type PedidoDoFiltro,
  type Sessao,
} from "../lib/tipos";
import type { Conexao } from "./conexao";
import { enderecoDaImagem } from "./comum/midia";
import { AvisoDeConexao } from "./jornal/avisos";
import { Espera } from "./mecanica/espera";
import { Indisponivel } from "./mecanica/indisponivel";
import { TelaDosCarimbos } from "./telas/carimbos";
import { TelaDoCaso } from "./telas/caso";
import { TelaDoDesfecho } from "./telas/desfecho";
import { TelaDaEscolha } from "./telas/escolha";
import { TelaDaFicha } from "./telas/ficha";
import { TelaDoFiltro } from "./telas/filtro";
import { TelaDoFim } from "./telas/fim";
import { TelaDaGaleria } from "./telas/galeria";
import { TelaDaOmissao } from "./telas/omissao";
import { TelaDaPonte } from "./telas/ponte";
import { TelaDoReparo } from "./telas/reparo";
import { TelaDaRotina } from "./telas/rotina";

/**
 * A casca da missão: uma máquina de telas sobre o que o SERVIDOR diz. Molde:
 * `exp06ef1b/src/app/juri-app.tsx`. Quatro regras:
 *
 * 1. **`sessao.passo`, nunca `passoDoEstudante`**: o primeiro já vem
 *    reconciliado com a etapa da turma (`passoEfetivo` da api).
 * 2. **A tela só anda quando a api responde.** Nenhum latch é otimista. A
 *    única coisa local é a tela SEGURADA (`Segurada`): o servidor já andou o
 *    passo (o terceiro selo, a ficha aberta, a rotina válida) e a criança
 *    ainda não tocou "Avançar"/"Ir para o Caso Novo".
 * 3. **Toda chamada passa por `conexao.executar`** (repete a de rede e a de
 *    sessão com o aviso "Sem sinal"). O polling do portão não: ele já se
 *    repete a cada 3 s.
 * 4. **409/400 relêem a sessão** (latch já gravado, turma pausada, rodada
 *    nova). 403 na abertura é a porta fechada; 403 no meio
 *    (`etapa-nao-liberada`) é o relógio da turma, e também relê.
 */
export function NinaApp({ inicial, conexao }: { inicial: Sessao; conexao: Conexao }) {
  const [sessao, setSessao] = useState<Sessao>(inicial);
  const [segurada, setSegurada] = useState<Segurada | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [bloqueada, setBloqueada] = useState(false);
  const { executar, sinalizar } = conexao;

  const sessaoRef = useRef(sessao);
  useLayoutEffect(() => {
    sessaoRef.current = sessao;
  }, [sessao]);

  const aplicarSessao = useCallback((nova: Sessao) => {
    const atual = sessaoRef.current;
    // Rodada nova ("Zerar Turma") ou outra atividade: nada do que estava segurado vale.
    if (atual.rodada !== nova.rodada || atual.pacoteId !== nova.pacoteId) setSegurada(null);
    setSessao(nova);
  }, []);

  const recarregar = useCallback(async () => {
    try {
      aplicarSessao(await executar(() => nina.sessao()));
    } catch (erro) {
      if (tipoDaFalha(erro) === "bloqueada") setBloqueada(true);
      else reportarErro(erro);
    }
  }, [executar, aplicarSessao]);

  const aplicarEstado = useCallback((estado: Estado) => {
    setSessao((s) => ({ ...s, ...estado }));
  }, []);

  /** Uma jogada: ocupa a tela, executa, relê a sessão. Falha recusada relê; a de rede já foi repetida. */
  const jogar = useCallback(
    async <T,>(chamada: () => Promise<T>): Promise<T | null> => {
      setOcupado(true);
      try {
        const resposta = await executar(chamada);
        return resposta;
      } catch (erro) {
        const tipo = tipoDaFalha(erro);
        if (tipo === "invalida") reportarErro(erro);
        if (tipo === "rede" || tipo === "sessao") reportarErro(erro);
        await recarregar();
        return null;
      } finally {
        setOcupado(false);
      }
    },
    [executar, recarregar],
  );

  // ────────────────────────────────────────── efeitos da casca

  useEffect(() => {
    enviarEstado({ passo: sessao.passo });
    telemetria.passou(sessao.passo);
  }, [sessao.passo]);

  /**
   * O portão da turma, por HTTP a cada 3 s (nunca WebSocket): a professora
   * libera o filtro, a inspeção, pausa e retoma, ou zera a turma. A pausa só
   * acende a flag; o resto relê a sessão. Sessão concluída não pergunta mais.
   * A primeira falha é silenciosa (o SDK já reenviou o GET); da segunda em
   * diante, o aviso acende.
   */
  useEffect(() => {
    if (sessao.concluida) return;
    let falhas = 0;
    let vivo = true;
    const relogio = window.setInterval(() => {
      void (async () => {
        try {
          const gate = await nina.gate();
          if (!vivo) return;
          if (falhas >= 2) sinalizar(null);
          falhas = 0;
          const atual = sessaoRef.current;
          if (gateMudou(atual, gate)) {
            aplicarSessao(await nina.sessao());
          } else if (atual.pausada !== gate.pausada) {
            setSessao((s) => ({ ...s, pausada: gate.pausada }));
          }
        } catch (erro) {
          if (!vivo) return;
          const tipo = tipoDaFalha(erro);
          if (tipo === "bloqueada") return;
          falhas += 1;
          if (falhas >= 2 && (tipo === "rede" || tipo === "sessao")) sinalizar(tipo);
        }
      })();
    }, POLLING_DO_GATE_MS);
    return () => {
      vivo = false;
      window.clearInterval(relogio);
    };
  }, [sessao.concluida, sinalizar, aplicarSessao]);

  // ────────────────────────────────────────── as jogadas

  const selar = async (id: string) => {
    const selos = [...new Set([...sessao.selos, id])];
    const r = await jogar(() => nina.selos(selos));
    if (!r) return;
    telemetria.confirmouCartaz(r.selos.length);
    setSessao((s) => ({ ...s, ...r, selos: r.selos }));
    if (r.selos.length >= SUPORTES.length) setSegurada("galeria");
  };

  const travar = async (itens: string[]) => {
    const r = await jogar(() => nina.previsao(itens));
    if (!r) return;
    telemetria.travouEscolha(itens.length);
    setSessao((s) => ({ ...s, ...r, previsao: { itens, travada: true } }));
    await recarregar();
  };

  const buscar = async (pedido: PedidoDoFiltro): Promise<number> => {
    const r = await jogar(() => nina.filtro(pedido));
    if (!r) return 0;
    telemetria.buscou(pedido.campo, r.total);
    if (r.total > 0) await recarregar();
    else aplicarEstado(r);
    return r.total;
  };

  const confrontar = async () => {
    const r = await jogar(() => nina.passo("ficha"));
    if (!r) return;
    telemetria.confrontou();
    await recarregar();
  };

  const abrirFicha = async (dica: boolean) => {
    const r = await jogar(() => nina.ficha(dica));
    if (!r) return;
    setSessao((s) => ({ ...s, ...r, ficha: { ...r.ficha, aberta: true } }));
    setSegurada("ficha");
  };

  const carimbarE4 = async (carimbos: Record<CartaoDaInspecao, Carimbo>) => {
    const r = await jogar(() => nina.carimbos({ etapa: "e4", carimbos }));
    if (!r) return;
    telemetria.carimbou("e4");
    setSegurada(null);
    await recarregar();
  };

  const reparar = async (ficha: FichaMontada) => {
    const r = await jogar(() => nina.reparo(ficha));
    if (!r) return;
    telemetria.concluiuReparo(r.desfecho);
    await recarregar();
  };

  const pedirPasso = async (para: "ponte" | "rotina") => {
    const r = await jogar(() => nina.passo(para));
    if (!r) return;
    await recarregar();
  };

  const testarRotina = async (sequencia: string[]): Promise<{ valida: boolean; simulacao: PassoDaSimulacao[] | null } | null> => {
    const r = await jogar(() => nina.rotina(sequencia));
    if (!r) return null;
    telemetria.testouRotina(r.valida);
    if (r.valida) {
      setSegurada("rotina");
      void recarregar();
    }
    return { valida: r.valida, simulacao: r.simulacao };
  };

  const carimbarE6 = async (carimbos: Record<CartaoDoCaso, Carimbo>) => {
    const r = await jogar(() => nina.carimbos({ etapa: "e6", carimbos }));
    if (!r) return;
    telemetria.carimbou("e6");
    const fim = await jogar(() => nina.concluir());
    if (!fim) return;
    telemetria.concluiu();
    await recarregar();
    concluir({ testesDaRotina: fim.resumo.automacao.testes, reparoValido: fim.resumo.reparo.desfecho === "sucesso" });
  };

  // ────────────────────────────────────────── a tela

  if (bloqueada) return <Indisponivel />;

  const tela = telaVisivel(sessao.passo, segurada);
  const { jornal } = sessao;
  const telao = jornal.reportagens.find((r) => r.suporte === "telao") ?? jornal.reportagens[2];

  let conteudo: React.ReactNode = null;
  switch (tela) {
    case "galeria":
      conteudo = (
        <TelaDaGaleria
          jornal={jornal}
          selos={sessao.selos}
          ocupado={ocupado}
          aoSelar={(id) => void selar(id)}
          aoAvancar={() => {
            setSegurada(null);
            if (sessao.passo === "galeria") void recarregar();
          }}
        />
      );
      break;
    case "aposta":
      conteudo = <TelaDaEscolha reportagens={jornal.reportagens} previsao={sessao.previsao} ocupado={ocupado} aoTravar={(i) => void travar(i)} />;
      break;
    case "filtro":
      conteudo = <TelaDoFiltro ocupado={ocupado} aoBuscar={buscar} />;
      break;
    case "omissao":
      conteudo = (
        <TelaDaOmissao
          reportagens={jornal.reportagens}
          escolhidas={sessao.previsao.itens}
          encontradas={sessao.filtro?.encontradas ?? []}
          aguardando={sessao.aguardandoOProfessor}
          ocupado={ocupado}
          aoConfrontar={() => void confrontar()}
        />
      );
      break;
    case "ficha":
      conteudo = telao ? (
        <TelaDaFicha
          telao={telao}
          ficha={sessao.ficha?.ficha ?? null}
          jaAberta={Boolean(sessao.ficha?.aberta) || segurada === "ficha"}
          ocupado={ocupado}
          aoAbrir={(dica) => void abrirFicha(dica)}
          aoAvancar={() => setSegurada(null)}
        />
      ) : null;
      break;
    case "carimbos":
      conteudo = (
        <TelaDosCarimbos
          fotoDoTelao={telao ? enderecoDaImagem(telao.imagem, "telao") : ""}
          ocupado={ocupado}
          aoEnviar={(c) => void carimbarE4(c)}
        />
      );
      break;
    case "reparo":
      conteudo = sessao.reparo ? <TelaDoReparo etiquetas={sessao.reparo.etiquetas} ocupado={ocupado} aoConcluir={(f) => void reparar(f)} /> : null;
      break;
    case "desfecho":
      conteudo = sessao.reparo?.desfecho ? (
        <TelaDoDesfecho desfecho={sessao.reparo.desfecho} reportagens={jornal.reportagens} ocupado={ocupado} aoContinuar={() => void pedirPasso("ponte")} />
      ) : null;
      break;
    case "ponte":
      conteudo = <TelaDaPonte ocupado={ocupado} aoContinuar={() => void pedirPasso("rotina")} />;
      break;
    case "rotina":
      conteudo = sessao.rotina ? (
        <TelaDaRotina
          key={`${sessao.rodada}`}
          blocos={sessao.rotina.blocos}
          simulacaoSalva={segurada === "rotina" ? null : sessao.rotina.valida ? sessao.rotina.simulacao : null}
          ocupado={ocupado}
          aoTestar={testarRotina}
          aoIrParaCaso={() => setSegurada(null)}
        />
      ) : null;
      break;
    case "caso":
      conteudo = sessao.caso ? <TelaDoCaso caso={sessao.caso} ocupado={ocupado} aoEnviar={(c) => void carimbarE6(c)} /> : null;
      break;
    case "fim":
      conteudo = sessao.fim ? <TelaDoFim resumo={sessao.fim.resumo} /> : null;
      break;
  }

  return (
    <div className="app" aria-busy={ocupado || undefined}>
      <div className="app__tela" inert={sessao.pausada || undefined}>
        {conteudo}
      </div>
      {sessao.pausada ? <Espera titulo={E3.conversar} apoio={GLOBAL.pausa} /> : null}
      <AvisoDeConexao aviso={conexao.aviso} aoReconectar={conexao.revalidar} />
    </div>
  );
}
