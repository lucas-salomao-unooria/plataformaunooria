import { Avatar, Button, Icon, ShortsShelf, TopMenuBar } from "@edu/ui/ds-unootube";

import type { AbaPlaylists, VideoPublico } from "../../lib/tipos";
import { ContadorInscritos } from "./ContadorInscritos";
import { PreviaVideo } from "./PreviaVideo";

interface Props {
  aba: AbaPlaylists;
  aoTrocarAba: (aba: AbaPlaylists) => void;
  salvos: VideoPublico[];
  curtidos: VideoPublico[];
  limite: number;
  avatar: string;
  inscritos: number;
  fontesConfiaveis: number | null;
  aoAssistir: (id: string) => void;
  aoRemoverSalvo: (id: string) => void;
  aoRemoverCurtida: (id: string) => void;
  aoVoltar: () => void;
}

/**
 * Coleção do aluno. As abas são a faixa de pílulas do DS (`TopMenuBar`) e a
 * grade é a prateleira de Shorts (`ShortsShelf` em `grid`) — as duas peças que
 * o arquivo de origem publica para exatamente estes papéis.
 *
 * O estado vazio continua local: a seção Unootube não publica um, e esta ainda
 * é tela DE DENTRO do disfarce — puxar o `EmptyState` institucional aqui
 * entregaria o exercício antes do ranking.
 */
export function Playlists(props: Props) {
  const { aba, salvos, curtidos, limite } = props;
  const lista = aba === "salvos" ? salvos : curtidos;

  return (
    <section className="content-view library-view">
      <div className="library-topline">
        <div className="content-heading">
          <span className="eyebrow">PLAYLISTS</span>
          <h1>Sua coleção</h1>
          <p>Reveja suas escolhas e mude de ideia quando quiser.</p>
        </div>
        {aba === "salvos" && (
          <div
            className="saved-subscriber-summary"
            aria-label={`Seu canal tem ${props.inscritos.toLocaleString("pt-BR")} inscritos`}
          >
            <Avatar size="lg" initials={props.avatar} />
            <span className="saved-summary-copy">
              <small>Seu canal</small>
              <span>
                <ContadorInscritos valor={props.inscritos} /> inscritos
              </span>
              {props.fontesConfiaveis !== null && (
                <em>
                  Fontes confiáveis: {props.fontesConfiaveis}/{limite}
                </em>
              )}
            </span>
          </div>
        )}
      </div>

      <TopMenuBar
        className="unootube-abas"
        label="Tipos de vídeos guardados"
        showOverflow={false}
        activeId={aba}
        onSelect={(id) => props.aoTrocarAba(id as AbaPlaylists)}
        options={[
          { id: "salvos", label: `Salvos ${salvos.length}/${limite}` },
          { id: "curtidos", label: `Curtidos ${curtidos.length}` },
        ]}
      />

      {lista.length === 0 ? (
        <div className="empty-state">
          <span className="empty-illustration" aria-hidden="true">
            <Icon name={aba === "salvos" ? "save" : "likedOutline"} size="lg" />
          </span>
          <h2>{aba === "salvos" ? "Sua playlist está vazia" : "Você ainda não curtiu nenhum vídeo"}</h2>
          <p>
            {aba === "salvos"
              ? `Volte aos Shorts e salve até ${limite} fontes.`
              : "Use o coração quando um vídeo chamar sua atenção."}
          </p>
        </div>
      ) : (
        <ShortsShelf
          layout="grid"
          columnWidth={200}
          showLogo={false}
          label={aba === "salvos" ? "Vídeos salvos" : "Vídeos curtidos"}
        >
          {lista.map((video) => (
            <article className="library-video" key={video.id}>
              <PreviaVideo className="library-preview" video={video} aoAssistir={props.aoAssistir} />
              <div className="library-card-copy">
                <span className="library-channel">
                  <Avatar size="xs" initials={video.avatar} className={video.accent} />
                  {video.handle} · {video.inscritosRotulo}
                </span>
                <h2>{video.titulo}</h2>
                <div className="card-actions">
                  <Button onClick={() => props.aoAssistir(video.id)}>Assistir de novo</Button>
                  <Button
                    className="acao-remover"
                    onClick={() =>
                      aba === "salvos" ? props.aoRemoverSalvo(video.id) : props.aoRemoverCurtida(video.id)
                    }
                  >
                    {aba === "salvos" ? "Remover dos salvos" : "Remover curtida"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </ShortsShelf>
      )}

      <Button className="back-to-feed" icon="arrowLeft" onClick={props.aoVoltar}>
        Voltar aos Shorts
      </Button>
    </section>
  );
}
