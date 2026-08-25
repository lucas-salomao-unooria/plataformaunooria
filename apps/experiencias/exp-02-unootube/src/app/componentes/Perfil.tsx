import type { VideoPublico } from "../../lib/tipos";
import { PreviaVideo } from "./PreviaVideo";

interface Props {
  nome: string;
  avatar: string;
  inscritos: number;
  fontesConfiaveis: number | null;
  salvos: VideoPublico[];
  limite: number;
  aoAssistir: (id: string) => void;
  aoRemoverSalvo: (id: string) => void;
  aoVoltar: () => void;
  aoPedirReinicio: () => void;
}

/** "@handle" derivado do nome real do aluno (no origem era a persona fixa "Lia"). */
export function handleDoNome(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `@${base || "aluno"}`;
}

export function Perfil(props: Props) {
  const { salvos, limite } = props;
  return (
    <section className="content-view profile-view">
      <div className="profile-hero">
        <div className="student-avatar">{props.avatar}</div>
        <div>
          <span className="eyebrow">SEU CANAL</span>
          <h1>{props.nome}</h1>
          <p>{handleDoNome(props.nome)}</p>
        </div>
        <div className="subscriber-stat">
          <strong>{props.inscritos.toLocaleString("pt-BR")}</strong>
          <span>inscritos</span>
          {props.fontesConfiaveis !== null && <em>Fontes confiáveis: {props.fontesConfiaveis}/{limite}</em>}
        </div>
      </div>

      <div className="profile-saved-heading">
        <div><h2>Meus {limite} salvos</h2><p>As fontes que você escolheu para esta missão.</p></div>
        <span>{salvos.length}/{limite}</span>
      </div>

      <div className="profile-slots">
        {Array.from({ length: limite }, (_, i) => {
          const video = salvos[i];
          return video ? (
            <article className="profile-video" key={video.id}>
              <PreviaVideo className="profile-video-preview" video={video} aoAssistir={props.aoAssistir} />
              <div><b>{video.titulo}</b><small>{video.handle}</small></div>
              <button className="remove-link" type="button" onClick={() => props.aoRemoverSalvo(video.id)}>Remover</button>
            </article>
          ) : (
            <div className="empty-slot" key={`vazio-${i}`}><i className="bookmark-glyph" /><span>Espaço {i + 1}</span></div>
          );
        })}
      </div>

      <div className="profile-actions">
        <button className="back-to-feed" type="button" onClick={props.aoVoltar}>← Voltar aos Shorts</button>
        <button className="reset-mission" type="button" onClick={props.aoPedirReinicio}>Reiniciar missão</button>
      </div>
    </section>
  );
}
