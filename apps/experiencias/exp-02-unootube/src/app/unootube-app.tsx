import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, codigoDoErro, experiencia } from "../lib/api";
import { embaralhar, evitarMesmaAbertura } from "../lib/embaralhar";
import { telemetria } from "../lib/telemetria";
import type {
  AbaPlaylists,
  EstadoMissao,
  ModoRanking,
  RespostaEstado,
  RespostaRanking,
  RespostaSessao,
  Tela,
  VideoPublico,
} from "../lib/tipos";
import { Topbar } from "./componentes/Topbar";
import { Sidebar } from "./componentes/Sidebar";
import { NavMobile } from "./componentes/NavMobile";
import { Feed } from "./componentes/Feed";
import { Playlists } from "./componentes/Playlists";
import { Ranking } from "./componentes/Ranking";
import { Perfil } from "./componentes/Perfil";
import { DialogoMissaoConcluida, DialogoReiniciar } from "./componentes/Dialogos";
import { Toast } from "./componentes/Toast";
import { aplicarAparencia, guardarAparencia, lerAparencia, type Aparencia } from "../lib/tema";

/**
 * Orquestrador — a máquina de telas do `page.tsx` do origem, com o estado da
 * missão vindo da api. Salvar/curtir são OTIMISTAS: aplicam localmente,
 * disparam a chamada e revertem com toast se ela falhar. O cálculo de
 * inscritos/fontes é sempre o do servidor (regra 3).
 */

const LIMITE = 3;
let ultimoPrimeiroVideo: string | null = null;

interface Props {
  sessaoInicial: RespostaSessao;
}

export function UnooTubeApp({ sessaoInicial }: Props) {
  const { catalogo, aluno, limiteSalvos } = sessaoInicial;
  const limite = limiteSalvos || LIMITE;

  const [estado, setEstado] = useState<EstadoMissao>(sessaoInicial.estado);
  const [derivados, setDerivados] = useState(sessaoInicial.derivados);
  const [ranking, setRanking] = useState<RespostaRanking | null>(sessaoInicial.ranking);

  const [tela, setTelaBruta] = useState<Tela>("feed");
  const [aba, setAba] = useState<AbaPlaylists>("salvos");
  const [modoRanking, setModoRanking] = useState<ModoRanking>("inscritos");
  const [videos, setVideos] = useState<VideoPublico[]>(catalogo.videos);
  const [ativoId, setAtivoId] = useState(catalogo.videos[0]?.id ?? "");
  const [somLigado, setSomLigado] = useState(false);
  const [toast, setToast] = useState("");
  const [toastCheio, setToastCheio] = useState(false);
  const [reiniciarAberto, setReiniciarAberto] = useState(false);
  const [missaoConcluidaAberta, setMissaoConcluidaAberta] = useState(false);
  const [descricaoExpandida, setDescricaoExpandida] = useState<string | null>(null);
  const [aparencia, setAparencia] = useState<Aparencia>(lerAparencia);
  const ocupado = useRef(false);

  const porId = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);
  const salvos = useMemo(() => estado.salvos.map((id) => porId.get(id)).filter((v): v is VideoPublico => Boolean(v)), [estado.salvos, porId]);
  const curtidos = useMemo(() => estado.curtidos.map((id) => porId.get(id)).filter((v): v is VideoPublico => Boolean(v)), [estado.curtidos, porId]);
  const indiceAtivo = Math.max(0, videos.findIndex((v) => v.id === ativoId));

  // Embaralha uma vez por abertura, evitando repetir o primeiro vídeo da abertura anterior.
  useEffect(() => {
    const ordenados = evitarMesmaAbertura(embaralhar(catalogo.videos), ultimoPrimeiroVideo);
    const primeiro = ordenados[0]?.id ?? "";
    ultimoPrimeiroVideo = primeiro;
    setVideos(ordenados);
    setAtivoId(primeiro);
    telemetria.abriu();
    experiencia().enviarEstado({ tela: "feed" });
    window.setTimeout(() => rolarPara(primeiro, "auto"), 30);
  }, [catalogo.videos]);

  // A aparência escolhida vale para o clone (`data-uni-theme`) E para a seção
  // da plataforma que desenha o ranking — `aplicarAparencia` escreve nas duas.
  useEffect(() => {
    aplicarAparencia(aparencia);
    guardarAparencia(aparencia);
  }, [aparencia]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast("");
      setToastCheio(false);
    }, toastCheio ? 5200 : 2600);
    return () => window.clearTimeout(timer);
  }, [toast, toastCheio]);

  function mostrarToast(mensagem: string, cheio = false) {
    setToast(mensagem);
    setToastCheio(cheio);
  }

  function setTela(nova: Tela) {
    setTelaBruta(nova);
    if (nova !== "feed") telemetria.trocouTela(nova);
    experiencia().enviarEstado({ tela: nova });
  }

  function aplicar(resposta: RespostaEstado) {
    setEstado(resposta.estado);
    setDerivados(resposta.derivados);
  }

  function rolarPara(id: string, comportamento: ScrollBehavior) {
    document.getElementById(`short-${id}`)?.scrollIntoView({ behavior: comportamento, block: "start" });
  }

  const irParaFeed = useCallback((id?: string) => {
    const alvo = id ?? ativoId;
    setAtivoId(alvo);
    setTelaBruta("feed");
    experiencia().enviarEstado({ tela: "feed" });
    window.setTimeout(() => rolarPara(alvo, "auto"), 30);
  }, [ativoId]);

  function moverFeed(direcao: number) {
    const alvo = Math.min(videos.length - 1, Math.max(0, indiceAtivo + direcao));
    const video = videos[alvo];
    if (video) rolarPara(video.id, "smooth");
  }

  function abrirPlaylists(qual: AbaPlaylists = "salvos") {
    setAba(qual);
    setTela("playlists");
  }

  async function carregarRanking() {
    try {
      const r = await api.get<RespostaRanking>("/unootube/ranking");
      setRanking(r);
    } catch (falha) {
      console.error("[unootube] ranking", falha);
      mostrarToast("Não deu para abrir o ranking agora.");
    }
  }

  function abrirRanking() {
    if (!estado.rankingDesbloqueado) return;
    if (!estado.credibilidadeAdicionada) setModoRanking("inscritos");
    setMissaoConcluidaAberta(false);
    setTela("ranking");
    if (!ranking) void carregarRanking();
  }

  async function alternarSalvo(id: string) {
    if (ocupado.current) return;
    const jaSalvo = estado.salvos.includes(id);
    if (!jaSalvo && estado.salvos.length >= limite) {
      mostrarToast("Sua playlist está cheia. Remova um vídeo para salvar outro.", true);
      return;
    }
    if (estado.credibilidadeAdicionada) {
      mostrarToast("Você já fechou sua playlist. Reinicie a missão no seu perfil para trocar.", false);
      return;
    }
    const anterior = estado;
    setEstado((atual) => ({
      ...atual,
      salvos: jaSalvo ? atual.salvos.filter((x) => x !== id) : [...atual.salvos, id],
    }));
    ocupado.current = true;
    try {
      const resposta = jaSalvo
        ? await api.post<RespostaEstado>(`/unootube/salvos/${id}/remover`)
        : await api.post<RespostaEstado>("/unootube/salvos", { videoId: id });
      aplicar(resposta);
      if (jaSalvo) {
        telemetria.removeuSalvo(id);
        mostrarToast("Vídeo removido dos salvos.");
        return;
      }
      telemetria.salvou(id);
      const total = resposta.estado.salvos.length;
      if (total === limite && !anterior.rankingDesbloqueado) {
        telemetria.completouSalvos(resposta.derivados);
        setModoRanking("inscritos");
        setMissaoConcluidaAberta(true);
        setToast("");
        void carregarRanking();
      } else if (total === limite) {
        setRanking(null); // salvos mudaram: o ranking será recarregado ao abrir
        mostrarToast(`Vídeo salvo! ${total} de ${limite} espaços usados.`);
      } else {
        setRanking(null);
        mostrarToast(`Vídeo salvo! ${total} de ${limite} espaços usados.`);
      }
    } catch (falha) {
      setEstado(anterior);
      const codigo = codigoDoErro(falha);
      if (codigo === "LIMITE_SALVOS") mostrarToast("Sua playlist está cheia. Remova um vídeo para salvar outro.", true);
      else if (codigo === "MISSAO_CONCLUIDA") mostrarToast("Você já fechou sua playlist. Reinicie a missão no seu perfil para trocar.");
      else mostrarToast("Não deu para salvar agora. Tenta de novo.");
    } finally {
      ocupado.current = false;
    }
  }

  async function alternarCurtida(id: string) {
    const curtido = estado.curtidos.includes(id);
    const anterior = estado;
    setEstado((atual) => ({
      ...atual,
      curtidos: curtido ? atual.curtidos.filter((x) => x !== id) : [...atual.curtidos, id],
    }));
    mostrarToast(curtido ? "Curtida removida." : "Vídeo curtido! Ele está na sua coleção.");
    try {
      aplicar(await api.post<RespostaEstado>(`/unootube/curtidos/${id}`));
      telemetria.curtiu(id, !curtido);
    } catch {
      setEstado(anterior);
      mostrarToast("Não deu para curtir agora. Tenta de novo.");
    }
  }

  async function adicionarCredibilidade() {
    try {
      const r = await api.post<RespostaEstado & { score: number }>("/unootube/credibilidade");
      aplicar(r);
      setModoRanking("confiaveis");
      // Conclusão pedagógica: score = fontes confiáveis, calculado no servidor.
      experiencia().concluir({
        score: r.score,
        dados: { salvos: r.estado.salvos, inscritos: r.derivados.inscritos, fontesConfiaveis: r.derivados.fontesConfiaveis },
      });
    } catch (falha) {
      const codigo = codigoDoErro(falha);
      mostrarToast(codigo === "RANKING_BLOQUEADO" ? "Salve 3 vídeos para liberar o ranking." : "Não deu agora. Tenta de novo.");
    }
  }

  async function reiniciarMissao() {
    setReiniciarAberto(false);
    try {
      aplicar(await api.post<RespostaEstado>("/unootube/reiniciar"));
      telemetria.reiniciou();
      setRanking(null);
      setModoRanking("inscritos");
      setMissaoConcluidaAberta(false);
      setDescricaoExpandida(null);
      setSomLigado(false);
      const primeiro = videos[0]?.id ?? "";
      setAtivoId(primeiro);
      setTela("feed");
      window.setTimeout(() => {
        rolarPara(primeiro, "auto");
        mostrarToast("Missão reiniciada. Você voltou ao primeiro Short.");
      }, 30);
    } catch {
      mostrarToast("Não deu para reiniciar agora. Tenta de novo.");
    }
  }

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        if (reiniciarAberto) return setReiniciarAberto(false);
        if (missaoConcluidaAberta) return setMissaoConcluidaAberta(false);
      }
      if (tela !== "feed") return;
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        moverFeed(1);
      }
      if (evento.key === "ArrowUp") {
        evento.preventDefault();
        moverFeed(-1);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [tela, reiniciarAberto, missaoConcluidaAberta, indiceAtivo, videos]);

  const rankingDesbloqueado = estado.rankingDesbloqueado;

  return (
    <main className={`app-shell view-${tela === "playlists" ? "library" : tela === "perfil" ? "profile" : tela}`}>
      <Topbar
        avatar={aluno.avatar}
        perfilSelecionado={tela === "perfil"}
        aoIrParaFeed={() => irParaFeed()}
        aoAbrirPerfil={() => setTela("perfil")}
        aoBuscar={() => {
          telemetria.buscaBloqueada();
          mostrarToast("A pesquisa está bloqueada durante esta missão.");
        }}
      />

      <Sidebar
        tela={tela}
        rankingDesbloqueado={rankingDesbloqueado}
        aoIrParaFeed={() => irParaFeed()}
        aoAbrirPlaylists={() => abrirPlaylists("salvos")}
        aoAbrirRanking={abrirRanking}
      />

      {tela === "feed" && (
        <Feed
            videos={videos}
            ativoId={ativoId}
            somLigado={somLigado}
            salvos={estado.salvos}
            curtidos={estado.curtidos}
            descricaoExpandida={descricaoExpandida}
            indiceAtivo={indiceAtivo}
            aoMudarAtivo={setAtivoId}
            aoAlternarSom={() => {
              setSomLigado((s) => {
                telemetria.som(!s);
                return !s;
              });
            }}
            aoSalvar={(id) => void alternarSalvo(id)}
            aoCurtir={(id) => void alternarCurtida(id)}
            aoExpandirDescricao={(id) => {
              if (id) telemetria.expandiuDescricao(id);
              setDescricaoExpandida(id);
            }}
          aoMover={moverFeed}
        />
      )}

      {tela === "playlists" && (
        <Playlists
          aba={aba}
          aoTrocarAba={setAba}
          salvos={salvos}
          curtidos={curtidos}
          limite={limite}
          avatar={aluno.avatar}
          inscritos={derivados.inscritos}
          fontesConfiaveis={rankingDesbloqueado ? derivados.fontesConfiaveis : null}
          aoAssistir={irParaFeed}
          aoRemoverSalvo={(id) => void alternarSalvo(id)}
          aoRemoverCurtida={(id) => void alternarCurtida(id)}
          aoVoltar={() => irParaFeed()}
        />
      )}

      {tela === "ranking" && rankingDesbloqueado && (
        <Ranking
          ranking={ranking}
          modo={modoRanking}
          credibilidadeAdicionada={estado.credibilidadeAdicionada}
          aparencia={aparencia}
          avatar={aluno.avatar}
          inscritos={derivados.inscritos}
          fontesConfiaveis={derivados.fontesConfiaveis}
          limite={limite}
          aoOrdenar={(m) => {
            telemetria.ordenou(m);
            setModoRanking(m);
          }}
          aoAdicionarCredibilidade={() => void adicionarCredibilidade()}
        />
      )}

      {tela === "perfil" && (
        <Perfil
          nome={aluno.nome}
          avatar={aluno.avatar}
          aparencia={aparencia}
          aoTrocarAparencia={setAparencia}
          inscritos={derivados.inscritos}
          fontesConfiaveis={rankingDesbloqueado ? derivados.fontesConfiaveis : null}
          salvos={salvos}
          limite={limite}
          aoAssistir={irParaFeed}
          aoRemoverSalvo={(id) => void alternarSalvo(id)}
          aoVoltar={() => irParaFeed()}
          aoPedirReinicio={() => setReiniciarAberto(true)}
        />
      )}

      <NavMobile
        tela={tela}
        rankingDesbloqueado={rankingDesbloqueado}
        aoIrParaFeed={() => irParaFeed()}
        aoAbrirPlaylists={() => abrirPlaylists("salvos")}
        aoAbrirRanking={abrirRanking}
        aoAbrirPerfil={() => setTela("perfil")}
      />

      {reiniciarAberto && (
        <DialogoReiniciar
          aparencia={aparencia}
          aoCancelar={() => setReiniciarAberto(false)}
          aoConfirmar={() => void reiniciarMissao()}
        />
      )}

      {missaoConcluidaAberta && (
        <DialogoMissaoConcluida
          aparencia={aparencia}
          inscritos={derivados.inscritos}
          fontesConfiaveis={derivados.fontesConfiaveis}
          limite={limite}
          aoVerRanking={abrirRanking}
          aoFechar={() => setMissaoConcluidaAberta(false)}
        />
      )}

      {toast && (
        <Toast
          mensagem={toast}
          cheio={toastCheio}
          aoAbrirPlaylist={() => {
            setToast("");
            abrirPlaylists("salvos");
          }}
        />
      )}
    </main>
  );
}
