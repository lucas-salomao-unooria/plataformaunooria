import { useCallback, useEffect, useRef, useState } from "react";
import { api, concluir, enviarEstado } from "../lib/api";
import { INTERVALO_DO_GATE_MS, telaDoPasso } from "../lib/regras";
import { telemetria } from "../lib/telemetria";
import type {
  Estado,
  IdDeBloco,
  IdDeOpcao,
  Mensagem,
  RespostaAuditoria,
  RespostaDecisao,
  RespostaGate,
  RespostaSessao,
} from "../lib/tipos";
import {
  TelaConcluida,
  TelaDasCurvas,
  TelaDeContexto,
  TelaDeEspera,
  TelaDoConstrutor,
  TelaDoMapa,
  TelaDoPercurso,
} from "./componentes/telas-da-escola";
import {
  FeedDaConversa,
  ListaDeConversas,
  TelaDaDecisao,
} from "./componentes/telas-do-clone";

/**
 * A casca da missão: uma máquina de estados sobre o que o SERVIDOR diz.
 *
 * Duas regras que valem para tudo aqui:
 *
 * 1. **`estado.passo`, nunca `passoDoEstudante`.** O primeiro já vem
 *    reconciliado com a etapa da turma; o segundo é o cru. Usar o cru faria a
 *    tela discordar do servidor exatamente no momento em que a professora
 *    fecha a Aula 1 — e trinta estudantes veriam o mapa antes do debate.
 * 2. **Nenhuma comparação com a letra da resposta.** A tela usa
 *    `estado.desfecho`, que a api devolve DEPOIS do envio. Um `opcao === "B"`
 *    aqui iria legível para o bundle, e a resposta certa estaria no DevTools
 *    antes de a criança responder (regra 3).
 */
export function RastroApp({ inicial }: { inicial: RespostaSessao }) {
  const [estado, setEstado] = useState<Estado>(inicial);
  const [chatAberto, setChatAberto] = useState<string | null>(null);
  const [viuOMapa, setViuOMapa] = useState(false);
  const [erroDoCiclo, setErroDoCiclo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [reflexao, setReflexao] = useState<string | null>(inicial.reflexao?.texto ?? null);
  const { catalogo, estudante } = inicial;

  /** O último passo enviado ao hub, para o `exp:estado` não repetir. */
  const ultimoAvisado = useRef<string>("");

  useEffect(() => {
    if (ultimoAvisado.current === estado.passo) return;
    ultimoAvisado.current = estado.passo;
    enviarEstado({ passo: estado.passo });
  }, [estado.passo]);

  /**
   * O polling do gate da aula.
   *
   * Compara só o `passoEfetivo`; quando ele diverge, relê a sessão inteira.
   * **Falha de rede aqui é silenciosa de propósito** — um alerta a cada 5 s
   * sobre algo que não afeta o estudante seria pior que o silêncio.
   *
   * Para quando a missão fecha: um estudante em `fim` não tem mais gate que o
   * alcance, e continuar batendo na api seria trabalho para ninguém.
   */
  useEffect(() => {
    if (estado.passo === "fim") return;
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const gate = await api.get<RespostaGate>(
            `/rastro-boato/gate?passo=${estado.passoDoEstudante}`,
          );
          if (gate.passoEfetivo !== estado.passo) {
            const sessao = await api.get<RespostaSessao>("/rastro-boato/sessao");
            setEstado(sessao);
            setReflexao(sessao.reflexao?.texto ?? null);
          }
        } catch {
          /* Silêncio deliberado: ver o comentário acima. */
        }
      })();
    }, INTERVALO_DO_GATE_MS);
    return () => window.clearInterval(id);
  }, [estado.passo, estado.passoDoEstudante]);

  useEffect(() => {
    if (estado.passo === "breakpoint") telemetria.esperouALargada();
    if (estado.passo === "decisao") telemetria.criseChegou();
  }, [estado.passo]);

  const entrar = useCallback(async () => {
    telemetria.entrouNoApp();
    setEstado(await api.post<Estado>("/rastro-boato/entrar"));
  }, []);

  const auditar = useCallback(async (mensagem: Mensagem, segundosLendo: number) => {
    const r = await api.post<RespostaAuditoria>("/rastro-boato/auditoria", {
      mensagemId: mensagem.id,
      tempoLeituraS: segundosLendo,
    });
    if (r.novo) telemetria.inspecionouMetadados(mensagem.id, r.totalAuditadas);
    setEstado(r);
    /* A crise chega no chat da turma. Sair do feed atual é o que faz a
       notificação ser vista: ficar no grupo do bairro esconderia o pico. */
    if (r.passoDoEstudante === "decisao") setChatAberto(null);
  }, []);

  const decidir = useCallback(
    async (opcao: IdDeOpcao, latenciaSeg: number, hesitou: boolean) => {
      telemetria.decidiu(opcao, latenciaSeg);
      const r = await api.post<RespostaDecisao>("/rastro-boato/decisao", {
        opcao,
        latenciaSeg,
        houveInacao90s: hesitou,
      });
      setEstado(r);
    },
    [],
  );

  const confirmarCiclo = useCallback(async (ordem: IdDeBloco[]) => {
    setErroDoCiclo(null);
    try {
      const r = await api.post<Estado>("/rastro-boato/modelagem", { ordemBlocos: ordem });
      telemetria.montouOCiclo(r.coerente === true);
      setEstado(r);
    } catch {
      setErroDoCiclo("Encaixe os quatro blocos na ordem do ciclo para validar o modelo.");
    }
  }, []);

  const salvarPercurso = useCallback(async (texto: string) => {
    setSalvando(true);
    try {
      const r = await api.post<Estado>("/rastro-boato/reflexao", { texto });
      telemetria.entregouPercurso(texto.length);
      setReflexao(texto);
      setEstado(r);
      /* O `score` NÃO é calculado aqui: quem pontua é a api. O que vai ao hub é
         o que ela devolveu, e o número não aparece em tela nenhuma. */
      concluir({ opcao: r.opcao, coerente: r.coerente, auditadas: r.totalAuditadas });
    } finally {
      setSalvando(false);
    }
  }, []);

  const tela = telaDoPasso(estado.passo, chatAberto !== null, viuOMapa);

  switch (tela) {
    case "contexto":
      return <TelaDeContexto nome={estudante.nome} aoEntrar={() => void entrar()} />;

    case "conversas":
      return (
        <ListaDeConversas
          conversas={catalogo.conversas}
          mensagens={catalogo.mensagens}
          estado={estado}
          aoAbrir={(id) => {
            telemetria.abriuChat(id);
            setChatAberto(id);
          }}
        />
      );

    case "feed": {
      const conversa = catalogo.conversas.find((c) => c.id === chatAberto);
      if (!conversa) return <div className="app" />;
      return (
        <FeedDaConversa
          conversa={conversa}
          mensagens={catalogo.mensagens}
          estado={estado}
          aoVoltar={() => setChatAberto(null)}
          aoAuditar={(m, s) => void auditar(m, s)}
          aoOuvirAudio={(id) => telemetria.ouviuAudio(id)}
        />
      );
    }

    case "crise":
      return (
        <TelaDaDecisao
          convocacao={catalogo.convocacao}
          opcoes={catalogo.opcoes}
          aoDecidir={(o, l, h) => void decidir(o, l, h)}
          aoHesitar={() => telemetria.hesitou()}
        />
      );

    case "espera":
      return <TelaDeEspera />;

    case "curvas":
      return (
        <TelaDasCurvas
          curvas={catalogo.curvas}
          aoVerOMapa={(s) => {
            telemetria.viuOMapa(s);
            setViuOMapa(true);
          }}
        />
      );

    case "mapa":
      /* `topologia` só existe depois do envio; sem ela a tela não pode ser
         desenhada, e cair nas curvas é o comportamento certo. */
      return estado.topologia ? (
        <TelaDoMapa
          topologia={estado.topologia}
          aoVoltar={() => setViuOMapa(false)}
          aoAvancar={() => setEstado({ ...estado, passo: "ciclo" })}
        />
      ) : (
        <TelaDasCurvas curvas={catalogo.curvas} aoVerOMapa={() => setViuOMapa(true)} />
      );

    case "construtor":
      return (
        <TelaDoConstrutor
          blocos={catalogo.blocos}
          erro={erroDoCiclo}
          aoConfirmar={(ordem) => void confirmarCiclo(ordem)}
        />
      );

    case "percurso":
      return (
        <TelaDoPercurso
          pergunta={catalogo.perguntaDoPercurso}
          teto={catalogo.tetoDaReflexao}
          podcast={catalogo.podcast}
          salvando={salvando}
          aoSalvar={(t) => void salvarPercurso(t)}
        />
      );

    case "concluida":
      return <TelaConcluida texto={reflexao} />;
  }
}
