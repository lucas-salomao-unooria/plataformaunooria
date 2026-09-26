import { useEffect, useRef, useState } from "react";
import { Avatar, Icon, PlayerGlyph, ShortsActionRail, ShortsPlayer } from "@edu/ui/ds-unootube";

import { dicaDoFeed } from "../../lib/dicas";
import { useTelaEstreita } from "../../lib/largura";
import type { VideoPublico } from "../../lib/tipos";
import { urlDoVideo } from "../../lib/videos";
import { aoMudarVisibilidade, estaVisivel } from "../../lib/visibilidade";
import { Descricao } from "./Descricao";
import { IndicadorCarregando, VideoIndisponivel } from "./IndicadorCarregando";

interface Props {
  videos: VideoPublico[];
  ativoId: string;
  somLigado: boolean;
  salvos: string[];
  curtidos: string[];
  descricaoExpandida: string | null;
  indiceAtivo: number;
  limite: number;
  aoMudarAtivo: (id: string) => void;
  aoAlternarSom: () => void;
  aoSalvar: (id: string) => void;
  aoCurtir: (id: string) => void;
  aoExpandirDescricao: (id: string | null) => void;
  aoMover: (direcao: number) => void;
}

/**
 * Scroll-snap vertical de `ShortsPlayer` do DS.
 *
 * A divisão de trabalho é esta: o DS entrega o REPRODUTOR (o `<video>`, o véu,
 * o toque para pausar, a linha do tempo, a trilha de ações) e a experiência
 * entrega o CARROSSEL — o contêiner com scroll-snap e o IntersectionObserver
 * que elege o vídeo ativo. O DS não publica carrossel de Shorts, e essa é a
 * única parte do palco que continua sendo daqui.
 *
 * `variant` acompanha a largura porque as duas apresentações do arquivo de
 * origem são justamente as que esta tela sempre teve: trilha AO LADO na área
 * de trabalho, trilha SOBRE o vídeo no celular.
 *
 * Autoplay só funciona porque começa mudo e porque o hub delega
 * `allow="autoplay"` no iframe.
 *
 * As peças de orientação do wireframe moram aqui: o contador "Favoritos
 * salvos" no topo da trilha, o chip "Vídeo N de M" sobre o quadro e a dica sob
 * ele. Nenhuma delas comenta a escolha — ver `lib/dicas.ts`.
 */
export function Feed(props: Props) {
  const { videos, ativoId, somLigado, limite, aoMudarAtivo } = props;
  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const [carregando, setCarregando] = useState<Set<string>>(() => new Set(videos.map((v) => v.id)));
  const [falhos, setFalhos] = useState<Set<string>>(() => new Set());
  const [visivel, setVisivel] = useState(estaVisivel());
  const estreita = useTelaEstreita();
  const variante = estreita ? "immersive" : "card";
  const dica = dicaDoFeed({
    carregando: carregando.has(ativoId) && !falhos.has(ativoId),
    falhou: falhos.has(ativoId),
    salvos: props.salvos.length,
    limite,
  });

  useEffect(() => aoMudarVisibilidade(setVisivel), []);

  /*
   * O DS não escuta `error` no `<video>` — o motor dele deriva `waiting` só de
   * `waiting`/`playing`. Quando o mp4 volta 404 (bucket de assets sem a mídia
   * daquele contrato), o navegador emite `waiting` e depois `error`; `playing`
   * NUNCA chega, e sem este efeito `carregando` fica `true` para sempre. Isso
   * não deixava a tela só feia: `disabled={carregandoEste}` travava Salvar e
   * Curtir, e a missão ficava impossível de concluir. Enquanto a seção do DS
   * não publicar um estado de erro, ele mora aqui.
   */
  useEffect(() => {
    const desfazer: Array<() => void> = [];
    videoRefs.current.forEach((node, id) => {
      // O erro pode ter chegado antes deste efeito rodar: `node.error` é o que
      // sobra dele, e é a única pista de um 404 que já aconteceu.
      if (node.error) marcarFalho(id);
      const aoFalhar = () => marcarFalho(id);
      node.addEventListener("error", aoFalhar);
      desfazer.push(() => node.removeEventListener("error", aoFalhar));
    });
    return () => desfazer.forEach((f) => f());
  }, [videos]);

  /*
   * Rede que engasga sem nunca emitir `error` (o `stalled` que não vira nada):
   * o vídeo em foco não pode prender a missão para sempre. 15s é generoso de
   * propósito — laboratório de escola é lento, e marcar falha cedo demais tira
   * do estudante um vídeo que ia chegar.
   */
  useEffect(() => {
    if (!carregando.has(ativoId) || falhos.has(ativoId)) return;
    const id = setTimeout(() => marcarFalho(ativoId), 15_000);
    return () => clearTimeout(id);
  }, [ativoId, carregando, falhos]);

  useEffect(() => {
    const itens = feedRef.current?.querySelectorAll<HTMLElement>(".short-item") ?? [];
    const observer = new IntersectionObserver(
      (entradas) => {
        const maisVisivel = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const alvo = maisVisivel?.target as HTMLElement | undefined;
        if (alvo?.dataset.videoId) aoMudarAtivo(alvo.dataset.videoId);
      },
      { root: feedRef.current, threshold: [0.55, 0.75] },
    );
    itens.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [videos, aoMudarAtivo]);

  useEffect(() => {
    videoRefs.current.forEach((video, id) => {
      video.muted = !somLigado;
      if (visivel && id === ativoId) video.play().catch(() => undefined);
      else video.pause();
    });
  }, [ativoId, somLigado, visivel]);

  function marcarFalho(id: string) {
    setFalhos((atual) => (atual.has(id) ? atual : new Set(atual).add(id)));
  }

  function marcarCarregando(id: string, estado: boolean) {
    setCarregando((atual) => {
      if (atual.has(id) === estado) return atual;
      const proximo = new Set(atual);
      if (estado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  return (
    <>
      <div className="feed-scroll" ref={feedRef} aria-label="Feed de vídeos curtos">
        {videos.map((video, indice) => {
          const curtido = props.curtidos.includes(video.id);
          const salvo = props.salvos.includes(video.id);
          const falhouEste = falhos.has(video.id);
          // Vídeo que falhou não está "carregando": deixar os dois estados
          // juntos é o que travava Salvar e Curtir para sempre.
          const carregandoEste = carregando.has(video.id) && !falhouEste;
          const expandida = props.descricaoExpandida === video.id;
          return (
            <article
              className="short-item"
              id={`short-${video.id}`}
              data-video-id={video.id}
              key={video.id}
              aria-label={`Vídeo ${indice + 1} de ${videos.length}`}
            >
              <div className="short-stage">
                {/*
                 * "Vídeo N de M" saiu do rodapé da trilha e virou chip sobre o
                 * quadro (Figma `5:30`): no rodapé ele era um `3/21` discreto,
                 * e o que a criança precisa saber é que o feed TEM fim — sem
                 * isso, "assista com atenção" não tem tamanho.
                 */}
                <span className="posicao-do-video">
                  Vídeo {indice + 1} de {videos.length}
                </span>
                <ShortsPlayer
                  variant={variante}
                  src={urlDoVideo(video.arquivo)}
                  alt={video.titulo}
                  muted={!somLigado}
                  loop
                  preload={indice < 2 ? "auto" : "metadata"}
                  videoRef={(node) => {
                    if (node) videoRefs.current.set(video.id, node);
                    else videoRefs.current.delete(video.id);
                  }}
                  onStateChange={(estado) => marcarCarregando(video.id, estado.waiting)}
                  /*
                   * `showChannel={false}` e a faixa do canal composta aqui: o
                   * bloco pronto do DS traz um botão de INSCREVER-SE sempre
                   * visível, e nesta missão inscrever-se não existe — "inscritos"
                   * é o placar do estudante, não uma ação sobre o canal do vídeo. Um
                   * botão morto ali confundiria justamente a métrica que a
                   * missão quer ensinar a ler.
                   */
                  showChannel={false}
                  caption={
                    <>
                      <span className="canal-do-video">
                        <Avatar size="md" initials={video.avatar} className={video.accent} />
                        <strong>{video.handle}</strong>
                        <span>{video.inscritosRotulo}</span>
                      </span>
                      <span className="titulo-do-video">{video.titulo}</span>
                      {/*
                       * Popularidade à vista, sem nenhuma marcação de verdadeiro
                       * ou falso (nota `ETAPA 2`). São rótulos do catálogo, não
                       * contas: o gabarito continua no servidor.
                       */}
                      <span className="metricas-do-video">
                        {video.visualizacoesRotulo} · {video.curtidasRotulo}
                      </span>
                      <span className={`descricao-do-video ${expandida ? "expandida" : ""}`}>
                        <span className="descricao-texto">
                          <Descricao texto={video.descricao} />
                        </span>
                        <button
                          type="button"
                          aria-expanded={expandida}
                          aria-label={expandida ? "Mostrar menos da descrição" : "Mostrar descrição completa"}
                          onClick={() => props.aoExpandirDescricao(expandida ? null : video.id)}
                        >
                          {expandida ? "mostrar menos" : "…mais"}
                        </button>
                      </span>
                    </>
                  }
                  actions={
                    <ShortsActionRail
                      variant={estreita ? "overlay" : "standalone"}
                      aria-label="Ações do vídeo"
                      header={
                        <span className="contador-de-favoritos">
                          <small>Favoritos salvos</small>
                          <strong>
                            {props.salvos.length} de {limite}
                          </strong>
                        </span>
                      }
                    >
                      {/*
                       * Salvar vem primeiro e leva o peso de ação principal
                       * (`.acao-salvar`): é a única ação que decide a missão, e
                       * o wireframe a desenha como o botão cheio da trilha.
                       * Curtir fica abaixo, com a contagem do vídeo — visível,
                       * sem peso nenhum no resultado.
                       *
                       * Os dois ficam DESABILITADOS enquanto o vídeo carrega. A
                       * nota `ETAPA 2` diz por quê: para não salvar sem assistir.
                       */}
                      <ShortsActionRail.Item
                        className="acao-salvar"
                        icon={<Icon name="save" size={estreita ? 36 : 24} />}
                        label={salvo ? "Salvo!" : "Salvar"}
                        active={salvo}
                        disabled={carregandoEste}
                        aria-label={salvo ? "Remover dos salvos" : "Salvar vídeo"}
                        aria-pressed={salvo}
                        onClick={() => props.aoSalvar(video.id)}
                      />
                      <ShortsActionRail.Item
                        icon={<Icon name={curtido ? "likedFill" : "likedOutline"} size={estreita ? 36 : 24} />}
                        label={
                          <>
                            {curtido ? "Curtido" : "Curtir"}
                            <small className="curtidas-do-video">{video.curtidasRotulo}</small>
                          </>
                        }
                        active={curtido}
                        disabled={carregandoEste}
                        aria-label={curtido ? "Remover curtida" : "Curtir vídeo"}
                        aria-pressed={curtido}
                        onClick={() => props.aoCurtir(video.id)}
                      />
                      {/*
                       * O som é um item da trilha, e não um botão solto sobre o
                       * vídeo como antes. Motivo: a seção não publica glifo de
                       * MUDO — só o alto-falante do cromo do reprodutor. Como
                       * item, o estado aparece de duas formas que não dependem
                       * de desenhar um glifo novo: o realce de `active` do
                       * próprio DS e o rótulo, que diz em palavras se o som
                       * está ligado.
                       */}
                      <ShortsActionRail.Item
                        icon={<PlayerGlyph name="sound" height={estreita ? 28 : 20} />}
                        label={somLigado ? "Som" : "Mudo"}
                        active={somLigado}
                        aria-label={somLigado ? "Desativar som" : "Ativar som"}
                        aria-pressed={somLigado}
                        onClick={props.aoAlternarSom}
                      />
                    </ShortsActionRail>
                  }
                />
                {falhouEste ? (
                  <VideoIndisponivel />
                ) : (
                  carregandoEste && <IndicadorCarregando detalhado />
                )}
              </div>
              <p className="dica-do-feed">{dica}</p>
            </article>
          );
        })}
      </div>

      <div className="feed-arrows" aria-label="Navegar entre vídeos">
        <button
          type="button"
          aria-label="Vídeo anterior"
          disabled={props.indiceAtivo === 0}
          onClick={() => props.aoMover(-1)}
        >
          <Icon name="arrowTop" size="lg" />
        </button>
        <button
          type="button"
          aria-label="Próximo vídeo"
          disabled={props.indiceAtivo === videos.length - 1}
          onClick={() => props.aoMover(1)}
        >
          <Icon name="arrowBottom" size="lg" />
        </button>
      </div>
    </>
  );
}
