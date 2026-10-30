import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { TelaAbertura, TelaConcluida, TelaConversa, TelaEspera, TelaExplicar, TelaRevelacao, TelaSemPacote } from "./app/telas/telas";
import { api, concluirNaPlataforma, reportarErro, statusDoErro } from "./lib/api";
import { semearFalasVistas } from "./lib/falas";
import { etapaDoPasso } from "./lib/regras";
import { telemetria } from "./lib/telemetria";
import type { Sessao } from "./lib/tipos";

/** O polling das travas: HTTP curto, nunca WebSocket (ADR-93). O `GET sessao` é read-only. */
const INTERVALO_MS = 3000;

export type Executar = (chamada: () => Promise<Sessao>) => Promise<Sessao | null>;

/**
 * O despachante da missão. O PASSO vem do servidor (derivado dos carimbos e
 * das três travas da turma); a tela só escolhe quem o desenha. Toda jogada
 * passa por `executar`: rede caída acende a faixa de conexão, e um 409 (a
 * turma andou, a tela ficou velha) relê o estado inteiro.
 */
export function App({ inicial }: { inicial: Sessao }) {
  /* O histórico que chega no handshake (o F5 no meio da aula) não anima: só o que é novo daqui em diante. */
  const [s, setS] = useState<Sessao>(() => {
    semearFalasVistas(inicial.chat.mensagens);
    return inicial;
  });
  const [semRede, setSemRede] = useState(false);
  const passoAnterior = useRef<string | null>(null);
  const concluiu = useRef(inicial.concluido);

  const reler = useCallback(async () => {
    try {
      setS(await api.sessao());
      setSemRede(false);
    } catch (erro) {
      if (statusDoErro(erro) === null) setSemRede(true);
      else reportarErro(erro);
    }
  }, []);

  const executar: Executar = useCallback(
    async (chamada) => {
      try {
        const nova = await chamada();
        setS(nova);
        setSemRede(false);
        return nova;
      } catch (erro) {
        const status = statusDoErro(erro);
        if (status === null) setSemRede(true);
        else if (status === 409) await reler();
        else reportarErro(erro);
        return null;
      }
    },
    [reler],
  );

  /* O polling corre nas esperas (as travas) e enquanto não há pacote; nas telas ativas, a jogada já devolve o estado. */
  const esperando = !s.preparada || s.passo === "espera1" || s.passo === "espera2" || (s.passo === "revelacao" && !s.revotoAberto);
  useEffect(() => {
    if (!esperando) return;
    const id = window.setInterval(() => void reler(), INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [esperando, reler]);

  useEffect(() => {
    if (passoAnterior.current === s.passo) return;
    passoAnterior.current = s.passo;
    telemetria.etapa(etapaDoPasso(s.passo));
  }, [s.passo]);

  useEffect(() => {
    if (semRede) telemetria.erro("sem-sinal");
  }, [semRede]);

  /* O fim, uma vez: a plataforma marca a missão concluída (sem score — a régua é do servidor). */
  useEffect(() => {
    if (!s.concluido || concluiu.current) return;
    concluiu.current = true;
    telemetria.concluiu();
    concluirNaPlataforma();
  }, [s.concluido]);

  let tela: ReactElement;
  if (!s.preparada) tela = <TelaSemPacote s={s} semRede={semRede} />;
  else if (s.passo === "abertura") tela = <TelaAbertura s={s} semRede={semRede} executar={executar} />;
  else if (s.passo === "conversa") tela = <TelaConversa s={s} semRede={semRede} executar={executar} />;
  else if (s.passo === "espera1" || s.passo === "espera2") tela = <TelaEspera s={s} semRede={semRede} />;
  else if (s.passo === "revelacao") tela = <TelaRevelacao s={s} semRede={semRede} executar={executar} />;
  else if (s.passo === "explicar") tela = <TelaExplicar s={s} semRede={semRede} executar={executar} />;
  else tela = <TelaConcluida s={s} semRede={semRede} />;

  return (
    <div className="app" data-passo={s.passo}>
      {tela}
    </div>
  );
}
