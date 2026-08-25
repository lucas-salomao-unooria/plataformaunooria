import type { Tela } from "../../lib/tipos";

interface Props {
  tela: Tela;
  rankingDesbloqueado: boolean;
  aoIrParaFeed: () => void;
  aoAbrirPlaylists: () => void;
  aoAbrirRanking: () => void;
}

export function Sidebar({ tela, rankingDesbloqueado, aoIrParaFeed, aoAbrirPlaylists, aoAbrirRanking }: Props) {
  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <button className="nav-item" type="button" onClick={aoIrParaFeed}>
        <span className="home-glyph" aria-hidden="true">⌂</span>Início
      </button>
      <button className={`nav-item ${tela === "feed" ? "active" : ""}`} type="button" onClick={aoIrParaFeed}>
        <span className="shorts-glyph" aria-hidden="true">▶</span>Shorts
      </button>
      <button className={`nav-item ${tela === "playlists" ? "active" : ""}`} type="button" onClick={aoAbrirPlaylists}>
        <span className="library-glyph" aria-hidden="true">▣</span>Playlists
      </button>
      {rankingDesbloqueado && (
        <button className={`nav-item ${tela === "ranking" ? "active" : ""}`} type="button" onClick={aoAbrirRanking}>
          <span className="ranking-glyph" aria-hidden="true">▤</span>Ranking
        </button>
      )}
    </aside>
  );
}
