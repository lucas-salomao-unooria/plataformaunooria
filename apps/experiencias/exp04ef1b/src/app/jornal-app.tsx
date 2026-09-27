import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { concluir, enviarEstado, reportarErro, rotas, tipoDaFalha, type CorpoDaPublicacao } from "../lib/api";
import { chaveDaPista, ETAPA_DA_TELA, gateMudou, INTERVALO_DO_GATE_MS, segundosDesde, TELA_DO_PASSO } from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import type {
  Estado,
  FaseDaPista,
  IdDeBloco,
  IdDeNoticia,
  Motivo,
  PassoPedido,
  Sessao,
  TentativaDaChave,
  TipoDePista,
} from "../lib/tipos";
import { Avisos } from "./avisos";
import { useCarga } from "./carga";
import type { Conexao } from "./conexao";
import { DesafioFinal } from "./escola/desafio-final";
import { Indisponivel } from "./escola/indisponivel";
import { useInatividade } from "./inatividade";
import { Abertura } from "./redacao/abertura";
import { TelaDaChave } from "./redacao/chave";
import { TelaDoComparativo } from "./redacao/comparativo";
import { PrimeiraEdicao, SegundaEdicao } from "./redacao/edicoes";
import { Espera } from "./redacao/espera";
import { ModoLeitura } from "./redacao/leitura";
import { TelaDeMotivo } from "./redacao/motivo";
import { TelaDeResultado } from "./redacao/resultado";

/**
 * A casca da missão: uma máquina de telas sobre o que o SERVIDOR diz.
 *
 * Quatro regras valem para tudo aqui (as mesmas da exp07ef1b):
 *
 * 1. **`sessao.passo`, nunca `passoDoEstudante`.** O primeiro já vem
 *    reconciliado com a etapa da turma (`regras/passos.ts#passoEfetivo` da
 *    api); o segundo é o cru.
 * 2. **A tela só anda quando a api responde.** Nenhum toque troca a tela
 *    otimisticamente: o passo novo é o que o `POST` devolve. É o que torna os
 *    dois latches à prova de rede ruim.
 * 3. **Toda chamada passa por `conexao.executar`**, que repete a de rede e a de
 *    sessão com o aviso aceso. As exceções são o polling do gate (que já se
 *    repete a cada 5 s), a diagramação (que tem reserva) e as perguntas finais
 *    (que pulam para a síntese).
 * 4. **409 e 400 relêem a sessão.** O relógio da turma andou, a rodada mudou,
 *    o latch já estava fechado: quem resolve é ler de novo.
 *
 * **F5 é só um `GET sessao`**: ele devolve o passo, as edições publicadas, o
 * motivo, a Chave e as pistas abertas COM o texto — a tela se reconstrói daí.
 * O que a api não guarda (a página em montagem) vive na memória da aba.
 */
export function JornalApp({ inicial, conexao }: { inicial: Sessao; conexao: Conexao }) {
  const [sessao, setSessao] = useState<Sessao>(inicial);
  const [bloqueada, setBloqueada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  /** A Chave acabou de se formar: a tela dela fica de pé até "Abrir a Mesa de Revisão". */
  const [chaveNaTela, setChaveNaTela] = useState(false);
  /** A releitura trouxe outra sessão (409 `rodada-mudou`, ou o polling viu o zerar): o aviso da redação. */
  const [rodadaNova, setRodadaNova] = useState(false);
  const { executar, sinalizar } = conexao;

  const sessaoRef = useRef(sessao);
  useLayoutEffect(() => {
    sessaoRef.current = sessao;
  }, [sessao]);

  // ─────────────────────────────────────────── ler e aplicar o servidor

  const recarregar = useCallback(async () => {
    try {
      setSessao(await executar(() => rotas.sessao()));
    } catch (erro) {
      if (tipoDaFalha(erro) === "bloqueada") setBloqueada(true);
      else reportarErro(erro);
    }
  }, [executar]);

  /** O estado que uma rota devolveu. Sessão OUTRA (zerar, pacote novo) = a mesa na tela é velha: relê tudo. */
  const aplicar = useCallback(
    (estado: Estado) => {
      if (estado.sessaoId !== sessaoRef.current.sessaoId) {
        void recarregar();
        return;
      }
      setSessao((atual) => ({ ...atual, ...estado }));
    },
    [recarregar],
  );

  const tratarFalha = useCallback(
    (erro: unknown) => {
      const tipo = tipoDaFalha(erro);
      if (tipo === "bloqueada") {
        setBloqueada(true);
        return;
      }
      if (tipo === "invalida") reportarErro(erro);
      void recarregar();
    },
    [recarregar],
  );

  // ────────────────────────────────────────────────── a tela e a etapa

  const tela = chaveNaTela && sessao.passo === "revisao" ? "chave" : TELA_DO_PASSO[sessao.passo];
  const etapa = ETAPA_DA_TELA[tela];

  const porId = useMemo(() => new Map(sessao.pacote.noticias.map((n) => [n.id, n])), [sessao.pacote.noticias]);
  const pistas = useMemo(
    () => new Map(sessao.pistasAbertas.map((p) => [chaveDaPista(p.noticiaId, p.tipo), p.texto])),
    [sessao.pistasAbertas],
  );

  // EVT-U01 uma vez, na primeira tela.
  useEffect(() => {
    telemetria.iniciou(inicial.passo !== "desafio", ETAPA_DA_TELA[TELA_DO_PASSO[inicial.passo]]);
  }, [inicial.passo]);

  /*
   * O 409 `rodada-mudou` — o professor zerou a turma (ou aprovou outro pacote)
   * no meio de uma publicação ou da Chave. O SDK não entrega o corpo, então ele
   * se reconhece pelo EFEITO: a releitura trouxe outra sessão. A tela já está na
   * mesa nova; o aviso só diz à criança por quê.
   */
  const sessaoMostrada = useRef(inicial.sessaoId);
  useEffect(() => {
    if (sessao.sessaoId === sessaoMostrada.current) return;
    sessaoMostrada.current = sessao.sessaoId;
    setChaveNaTela(false);
    setRodadaNova(true);
    telemetria.viuErro("rodada-mudou", ETAPA_DA_TELA[TELA_DO_PASSO[sessao.passo]]);
  }, [sessao.sessaoId, sessao.passo]);

  // EVT-U02 a cada etapa nova.
  useEffect(() => {
    telemetria.entrouNaEtapa(etapa);
  }, [etapa]);

  // O chrome opcional do hub acompanha o passo (`exp:estado`).
  useEffect(() => {
    enviarEstado({ passo: sessao.passo });
  }, [sessao.passo]);

  useInatividade(etapa, !sessao.aguardandoOProfessor && tela !== "leitura");

  /**
   * O polling do gate da turma (ADR-93: HTTP de 5 s, nunca WebSocket) — SÓ
   * enquanto a criança espera o professor (a espera depois do motivo e o
   * resultado, que espera a revisão). Antes de publicar, a etapa não a toca; da
   * Chave em diante, o passo é dela. Bater na api fora disso seria trabalho
   * para ninguém, trinta vezes por sala.
   *
   * A falha é silenciosa na primeira vez (o SDK já reenviou o GET uma vez); da
   * segunda seguida em diante o aviso acende, e apaga no primeiro sucesso.
   */
  useEffect(() => {
    if (!sessao.aguardandoOProfessor) return;
    let falhas = 0;
    const relogio = window.setInterval(() => {
      void (async () => {
        try {
          const gate = await rotas.gate();
          if (falhas >= 2) sinalizar(null);
          falhas = 0;
          if (!gateMudou(sessaoRef.current, gate)) return;
          setSessao(await rotas.sessao());
        } catch (erro) {
          const tipo = tipoDaFalha(erro);
          if (tipo === "bloqueada") {
            setBloqueada(true);
            return;
          }
          falhas += 1;
          if (falhas >= 2 && (tipo === "rede" || tipo === "limite" || tipo === "sessao")) sinalizar(tipo);
        }
      })();
    }, INTERVALO_DO_GATE_MS);
    return () => window.clearInterval(relogio);
  }, [sessao.aguardandoOProfessor, sinalizar]);

  // ─────────────────────────────────────── as leituras de cada tela

  const chaveDaTela = `${sessao.sessaoId}:${tela}`;
  const resultado = useCarga(tela === "resultado" ? chaveDaTela : null, () => executar(() => rotas.resultado()), tratarFalha);
  const revisao = useCarga(tela === "revisao" ? chaveDaTela : null, () => executar(() => rotas.revisao()), tratarFalha);
  const comparativo = useCarga(
    tela === "comparativo" ? chaveDaTela : null,
    () => executar(() => rotas.comparativo()),
    tratarFalha,
  );

  useEffect(() => {
    if (resultado) telemetria.viuOResultado(resultado.edicao1.verificadas, resultado.edicao1.percentual);
  }, [resultado]);

  // ─────────────────────────────────────────────────────── as ações

  const pedirPasso = useCallback(
    async (para: PassoPedido) => {
      setOcupado(true);
      try {
        aplicar(await executar(() => rotas.passo(para)));
      } catch (erro) {
        tratarFalha(erro);
      } finally {
        setOcupado(false);
      }
    },
    [aplicar, executar, tratarFalha],
  );

  /**
   * Abrir uma pista. O registro é da api, uma vez por par EM CADA FASE, e as
   * `pistasAbertas` dizem a fase de cada registro: par já registrado NESTA fase
   * (nesta aba ou antes do F5) reabre aberto e não volta à api. Na revisão, o
   * primeiro toque num par lido na mesa vai ao `POST pista` mesmo com o texto
   * já conhecido — é a consulta da fase 2 que a EF04CO08 e o professor leem
   * ("o aluno reabre as publicações, consulta as pistas", PDF §9). O texto
   * conhecido aparece na hora; a resposta só confirma o registro.
   */
  const pistaJaRegistrada = useCallback(
    (noticiaId: IdDeNoticia, tipo: TipoDePista, fase: FaseDaPista): boolean =>
      sessaoRef.current.pistasAbertas.some((p) => p.noticiaId === noticiaId && p.tipo === tipo && p.fase === fase),
    [],
  );

  const revelar = useCallback(
    async (noticiaId: IdDeNoticia, tipo: TipoDePista, fase: FaseDaPista): Promise<boolean> => {
      const atual = sessaoRef.current;
      if (pistaJaRegistrada(noticiaId, tipo, fase)) {
        telemetria.inspecionou(noticiaId, tipo, fase, atual.pistasAbertas.length);
        return true;
      }
      try {
        const pista = await executar(() => rotas.pista(noticiaId, tipo));
        setSessao((s) => ({
          ...s,
          pistasAbertas: [
            ...s.pistasAbertas.filter((p) => !(p.noticiaId === pista.noticiaId && p.tipo === pista.tipo && p.fase === pista.fase)),
            { noticiaId: pista.noticiaId, tipo: pista.tipo, fase: pista.fase, texto: pista.texto },
          ],
        }));
        telemetria.inspecionou(noticiaId, tipo, fase, pista.abertas);
        return true;
      } catch (erro) {
        tratarFalha(erro);
        return false;
      }
    },
    [executar, pistaJaRegistrada, tratarFalha],
  );

  const publicar = useCallback(
    async (edicao: 1 | 2, corpo: CorpoDaPublicacao): Promise<boolean> => {
      setOcupado(true);
      try {
        const estado = await executar(() => (edicao === 1 ? rotas.publicar(corpo) : rotas.republicar(corpo)));
        telemetria.publicou(edicao, corpo.slots);
        aplicar(estado);
        return true;
      } catch (erro) {
        tratarFalha(erro);
        return false;
      } finally {
        setOcupado(false);
      }
    },
    [aplicar, executar, tratarFalha],
  );

  const responderMotivo = useCallback(
    async (motivo: Motivo) => {
      setOcupado(true);
      try {
        aplicar(await executar(() => rotas.motivo(motivo)));
      } catch (erro) {
        tratarFalha(erro);
      } finally {
        setOcupado(false);
      }
    },
    [aplicar, executar, tratarFalha],
  );

  /**
   * Uma tentativa da Chave, com o NÚMERO dela: o que a api já contou
   * (`estado.chaveTentativas`, que vem em toda resposta e no F5) + 1, calculado
   * UMA vez antes da repetição — a repetição da rede leva o mesmo número e a api
   * não conta de novo. O estado da resposta atualiza a contagem para o próximo.
   */
  const tentarChave = useCallback(
    async (blocos: IdDeBloco[]): Promise<TentativaDaChave | null> => {
      const numero = sessaoRef.current.chaveTentativas + 1;
      try {
        const tentativa = await executar(() => rotas.chave(blocos, numero));
        telemetria.tentouAChave(tentativa.sucesso, tentativa.tentativas);
        if (tentativa.sucesso) setChaveNaTela(true);
        aplicar(tentativa.estado);
        return tentativa;
      } catch (erro) {
        tratarFalha(erro);
        return null;
      }
    },
    [aplicar, executar, tratarFalha],
  );

  const concluirMissao = useCallback(
    async (respondidas: number) => {
      setOcupado(true);
      try {
        const estado = await executar(() => rotas.concluir());
        aplicar(estado);
        /* Indicativo: `iniciadaEm` é do relógio do servidor e o `Date.now()` é o
           da máquina da escola (que atrasa) — `segundosDesde` nunca dá negativo. */
        const inicio = Date.parse(estado.iniciadaEm);
        telemetria.concluiu(Number.isNaN(inicio) ? 0 : segundosDesde(inicio, Date.now()));
        /* Sem `score`: a missão não pontua criança. O nível das habilidades é
           do servidor (a ficha da E14), e nenhum desses números aparece em tela. */
        concluir({ publicouAPrimeira: estado.edicao1 !== null, publicouASegunda: estado.edicao2 !== null, respondidas });
      } catch (erro) {
        tratarFalha(erro);
      } finally {
        setOcupado(false);
      }
    },
    [aplicar, executar, tratarFalha],
  );

  const falhouMidia = useCallback(() => telemetria.viuErro("midia-indisponivel", etapa), [etapa]);

  // ─────────────────────────────────────────────────────── a tela

  if (bloqueada) return <Indisponivel />;

  const desenhar = () => {
    switch (tela) {
      case "abertura":
        return <Abertura indo={ocupado} aoExplorar={() => void pedirPasso("mesa")} />;

      case "mesa":
        return (
          <PrimeiraEdicao
            key={sessao.sessaoId}
            sessaoId={sessao.sessaoId}
            noticias={sessao.pacote.noticias}
            pistas={pistas}
            publicando={ocupado}
            aoRevelar={(id, tipo) => revelar(id, tipo, 1)}
            abertaDeInicio={(id, tipo) => pistaJaRegistrada(id, tipo, 1)}
            aoPublicar={(corpo) => publicar(1, corpo)}
            aoFalharMidia={falhouMidia}
          />
        );

      case "motivo":
        return <TelaDeMotivo enviando={ocupado} aoEnviar={(m) => void responderMotivo(m)} />;

      case "espera":
        return <Espera edicao={sessao.edicao1} porId={porId} />;

      case "resultado":
        return <TelaDeResultado resultado={resultado} porId={porId} />;

      case "chave":
        return sessao.blocos ? (
          <TelaDaChave
            key={sessao.sessaoId}
            blocos={sessao.blocos}
            tamanho={sessao.limites.chave}
            aoTentar={tentarChave}
            aoIrParaRevisao={() => setChaveNaTela(false)}
          />
        ) : (
          <div className="tela" aria-busy="true" />
        );

      case "revisao":
        return (
          <SegundaEdicao
            key={sessao.sessaoId}
            sessaoId={sessao.sessaoId}
            noticias={sessao.pacote.noticias}
            pistas={pistas}
            publicando={ocupado}
            primeira={sessao.edicao1?.slots ?? []}
            revisao={revisao}
            aoRevelar={(id, tipo) => revelar(id, tipo, 2)}
            abertaDeInicio={(id, tipo) => pistaJaRegistrada(id, tipo, 2)}
            aoPublicar={(corpo) => publicar(2, corpo)}
            aoFalharMidia={falhouMidia}
          />
        );

      case "comparativo":
        return (
          <TelaDoComparativo
            comparativo={comparativo}
            porId={porId}
            indo={ocupado}
            aoAvancar={() => void pedirPasso("transferencia")}
          />
        );

      case "desafio-final":
        return (
          <DesafioFinal
            key={sessao.sessaoId}
            sessaoId={sessao.sessaoId}
            concluindo={ocupado}
            aoConcluir={(n) => void concluirMissao(n)}
          />
        );

      case "leitura":
        return <ModoLeitura edicao1={sessao.edicao1} edicao2={sessao.edicao2} porId={porId} />;
    }
  };

  return (
    <div className="app jornal" data-tela={tela}>
      {desenhar()}
      <Avisos
        aviso={conexao.aviso}
        etapa={etapa}
        rodadaNova={rodadaNova}
        aoRevalidar={conexao.revalidar}
        aoFecharRodada={() => setRodadaNova(false)}
      />
    </div>
  );
}
