import type { Tela } from "../../lib/tipos";

interface Props {
  tela: Tela;
  rankingDesbloqueado: boolean;
  aoIrParaFeed: () => void;
  aoAbrirPlaylists: () => void;
  aoAbrirRanking: () => void;
  aoAbrirPerfil: () => void;
}

export function NavMobile({ tela, rankingDesbloqueado, aoIrParaFeed, aoAbrirPlaylists, aoAbrirRanking, aoAbrirPerfil }: Props) {
  return (
    <nav className="mobile-nav" aria-label="Navegação móvel">
      <button className={tela === "feed" ? "active" : ""} type="button" onClick={aoIrParaFeed}><span>▶</span>Shorts</button>
      <button className={tela === "playlists" ? "active" : ""} type="button" onClick={aoAbrirPlaylists}><span>▣</span>Playlists</button>
      {rankingDesbloqueado && (
        <button className={tela === "ranking" ? "active" : ""} type="button" onClick={aoAbrirRanking}><span>▤</span>Ranking</button>
      )}
      <button className={tela === "perfil" ? "active" : ""} type="button" onClick={aoAbrirPerfil}><span>●</span>Perfil</button>
    </nav>
  );
}
