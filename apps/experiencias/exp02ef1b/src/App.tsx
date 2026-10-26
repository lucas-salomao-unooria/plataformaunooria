import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Casca } from "./componentes/Casca";
import type { Contexto, Executar } from "./contexto";
import { api, concluirNaPlataforma, reportarErro, statusDoErro } from "./lib/api";
import { FilaDeEnvio } from "./lib/fila";
import { urlDaImagem } from "./lib/geometria";
import { telemetria } from "./lib/telemetria";
import type { Estado, Imagem, Sessao } from "./lib/tipos";
import { Bancada } from "./telas/Bancada";
import { Decidir } from "./telas/Decidir";
import { Espera } from "./telas/Espera";
import { Explicar } from "./telas/Explicar";
import { Feed } from "./telas/Feed";
import { Mural } from "./telas/Mural";
import { Transferencia } from "./telas/Transferencia";
import { Virada } from "./telas/Virada";

/** A fila em memória tenta de novo neste ritmo enquanto houver jogada pendente. */
const REENVIO_MS = 3000;
const BASE = import.meta.env.BASE_URL;

/**
 * O despachante da missão. O PASSO vem do servidor (derivado dos carimbos e da
 * fase da turma); a tela só escolhe quem o desenha. F5 em qualquer ponto
 * reidrata pelo `GET /enigma-capa/sessao` — é o checkpoint do one-pager §8.
 *
 * Dois estados locais, e só dois, seguram uma tela além do passo do servidor —
 * os dois são transições que a criança precisa VER, e um F5 os pula de
 * propósito (ela já viu):
 * - `rascunhoAberto`: depois do crachá o servidor já está em `lupa`, mas a
 *   criança ainda vê o mural com o Bento aflito até tocar no rascunho;
 * - `segurarFeed`: quem publica DEPOIS da virada pularia direto da capa à
 *   busca; a tela mostra a visitante antes (contrato: "a tela mostra a
 *   visitante antes").
 */
export function App({ inicial }: { inicial: Sessao }) {
  const [sessao, setSessao] = useState<Sessao>(inicial);
  const [estado, setEstado] = useState<Estado>(inicial);
  const [semSinal, setSemSinal] = useState(false);
  const [rascunhoAberto, setRascunhoAberto] = useState(inicial.passo !== "cracha");
  const [segurarFeed, setSegurarFeed] = useState(false);
  const passoAnterior = useRef(inicial.passo);

  const fila = useMemo(
    () =>
      new FilaDeEnvio(
        (erro) => statusDoErro(erro) === null,
        (erro) => reportarErro(erro),
      ),
    [],
  );

  const reler = useCallback(async () => {
    try {
      const nova = await api.sessao();
      setSessao(nova);
      setEstado(nova);
      setSemSinal(fila.pendentes > 0);
    } catch (erro) {
      if (statusDoErro(erro) === null) setSemSinal(true);
      else reportarErro(erro);
    }
  }, [fila]);

  const executar: Executar = useCallback(
    async <T extends Estado>(chamada: () => Promise<T>, chaveDaFila?: string) => {
      try {
        const novo = await chamada();
        setEstado(novo);
        setSemSinal(fila.pendentes > 0);
        return novo;
      } catch (erro) {
        const status = statusDoErro(erro);
        if (status === null) {
          setSemSinal(true);
          telemetria.rede();
          if (chaveDaFila) {
            fila.enfileirar(chaveDaFila, async () => {
              const novo = await chamada();
              setEstado(novo);
            });
          }
        } else if (status === 409) {
          await reler();
        } else {
          reportarErro(erro);
        }
        return null;
      }
    },
    [fila, reler],
  );

  /* A fila em memória: tenta de novo enquanto houver pendência; a faixa apaga quando ela esvazia. */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (fila.pendentes === 0) return;
      void fila.tentar().then(() => setSemSinal(fila.pendentes > 0));
    }, REENVIO_MS);
    return () => window.clearInterval(id);
  }, [fila]);

  /* O gate: polling HTTP curto (nunca WebSocket — ADR-93/94). A virada, o zerar e o pacote posto no ar. */
  useEffect(() => {
    const id = window.setInterval(() => {
      void api
        .gate()
        .then((g) => {
          setSemSinal(fila.pendentes > 0);
          const mudou =
            g.passo !== estado.passo ||
            g.fase !== estado.fase ||
            g.preparada !== estado.preparada ||
            (g.atividade?.pacoteId ?? null) !== (estado.atividade?.pacoteId ?? null) ||
            (g.atividade?.rodada ?? null) !== (estado.atividade?.rodada ?? null);
          if (mudou) void reler();
        })
        .catch((erro: unknown) => {
          if (statusDoErro(erro) === null) setSemSinal(true);
        });
    }, sessao.tempos.pollingMs || 3000);
    return () => window.clearInterval(id);
  }, [estado.passo, estado.fase, estado.preparada, estado.atividade, sessao.tempos.pollingMs, reler, fila]);

  /* Os marcos da trilha: a telemetria de etapa, o zerar do professor e o LATCH 2. */
  useEffect(() => {
    const anterior = passoAnterior.current;
    if (anterior === estado.passo) return;
    passoAnterior.current = estado.passo;
    telemetria.etapa(estado.passo);
    if (estado.passo === "cracha") {
      /* O professor zerou (ADR-155): a rodada recomeça do mural. */
      setRascunhoAberto(false);
      setSegurarFeed(false);
      fila.limpar();
    }
    if (estado.passo === "concluida" && anterior !== "concluida") {
      telemetria.concluiu();
      concluirNaPlataforma();
    }
  }, [estado.passo, fila]);

  const verFeed = useCallback(() => setSegurarFeed(false), []);
  const url = useCallback((imagem: Imagem) => urlDaImagem(imagem, BASE), []);
  const cracha = sessao.material.crachas.find((c) => c.id === estado.cracha) ?? null;
  const naFila = useCallback((chave: string) => fila.tem(chave), [fila]);
  const ctx: Contexto = { sessao, estado, executar, naFila, url, cracha };
  const chave = `${estado.atividade?.pacoteId ?? "-"}:${estado.atividade?.rodada ?? 0}`;
  const p = estado.passo;

  let tela: ReactElement;
  if (!estado.preparada || !sessao.cena) {
    tela = <Espera />;
  } else if (p === "cracha" || (p === "lupa" && !rascunhoAberto)) {
    tela = <Mural ctx={ctx} aoAbrir={() => setRascunhoAberto(true)} />;
  } else if (p === "lupa") {
    tela = <Bancada ctx={ctx} />;
  } else if (p === "decidir") {
    tela = <Decidir ctx={ctx} aoPublicar={() => setSegurarFeed(true)} />;
  } else if (p === "feed" || (segurarFeed && p === "invariantes")) {
    tela = <Feed ctx={ctx} aoVer={verFeed} />;
  } else if (p === "invariantes" || p === "slider" || p === "fora") {
    tela = <Virada ctx={ctx} />;
  } else if (p === "pares" || p === "segunda-foto") {
    tela = <Explicar ctx={ctx} />;
  } else {
    tela = <Transferencia ctx={ctx} />;
  }

  return (
    <div className="app" data-unv-theme="light">
      <Casca cracha={cracha} semSinal={semSinal}>
        <div key={chave} className="app__tela">
          {tela}
        </div>
      </Casca>
    </div>
  );
}
