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
          <div className="saved-subscriber-summary" aria-label={`Seu canal tem ${props.inscritos.toLocaleString("pt-BR")} inscritos`}>
            <span className="saved-summary-avatar" aria-hidden="true">{props.avatar}</span>
            <span className="saved-summary-copy">
              <small>Seu canal</small>
              <span><ContadorInscritos valor={props.inscritos} /> inscritos</span>
              {props.fontesConfiaveis !== null && <em>Fontes confiáveis: {props.fontesConfiaveis}/{limite}</em>}
            </span>
          </div>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Tipos de vídeos guardados">
        <button role="tab" aria-selected={aba === "salvos"} className={aba === "salvos" ? "active" : ""} onClick={() => props.aoTrocarAba("salvos")}>
          Salvos <span>{salvos.length}/{limite}</span>
        </button>
        <button role="tab" aria-selected={aba === "curtidos"} className={aba === "curtidos" ? "active" : ""} onClick={() => props.aoTrocarAba("curtidos")}>
          Curtidos <span>{curtidos.length}</span>
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="empty-state">
          <span className="empty-illustration"><i className="bookmark-glyph" /></span>
          <h2>{aba === "salvos" ? "Sua playlist está vazia" : "Você ainda não curtiu nenhum vídeo"}</h2>
          <p>{aba === "salvos" ? `Volte aos Shorts e salve até ${limite} fontes.` : "Use o coração quando um vídeo chamar sua atenção."}</p>
        </div>
      ) : (
        <div className="video-grid">
          {lista.map((video) => (
            <article className="library-video" key={video.id}>
              <PreviaVideo className="library-preview" video={video} aoAssistir={props.aoAssistir} />
              <div className="library-card-copy">
                <span className="library-channel"><i className={video.accent}>{video.avatar}</i>{video.handle} · {video.inscritosRotulo}</span>
                <h2>{video.titulo}</h2>
                <div className="card-actions">
                  <button type="button" onClick={() => props.aoAssistir(video.id)}>Assistir de novo</button>
                  <button
                    className="remove-link"
                    type="button"
                    onClick={() => (aba === "salvos" ? props.aoRemoverSalvo(video.id) : props.aoRemoverCurtida(video.id))}
                  >
                    {aba === "salvos" ? "Remover dos salvos" : "Remover curtida"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <button className="back-to-feed" type="button" onClick={props.aoVoltar}>← Voltar aos Shorts</button>
    </section>
  );
}
