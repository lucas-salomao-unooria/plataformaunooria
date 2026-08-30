import { Icon, MobileTabBar } from "@edu/ui/ds-unootube";

import type { Tela } from "../../lib/tipos";

interface Props {
  tela: Tela;
  rankingDesbloqueado: boolean;
  aoIrParaFeed: () => void;
  aoAbrirPlaylists: () => void;
  aoAbrirRanking: () => void;
  aoAbrirPerfil: () => void;
}

/**
 * Barra de abas do rodapé (`MobileTabBar`, 0.1.14). Não há `CreateButton` aqui
 * de propósito: o estudante não publica nada nesta missão, e um botão de criar no
 * meio da barra prometeria uma ação que não existe.
 */
export function NavMobile({
  tela,
  rankingDesbloqueado,
  aoIrParaFeed,
  aoAbrirPlaylists,
  aoAbrirRanking,
  aoAbrirPerfil,
}: Props) {
  return (
    <MobileTabBar className="unootube-nav-mobile" aria-label="Navegação móvel">
      <MobileTabBar.Item
        icon={<Icon name={tela === "feed" ? "exploreFill" : "explore"} size="lg" />}
        label="Shorts"
        active={tela === "feed"}
        onClick={aoIrParaFeed}
      />
      <MobileTabBar.Item
        icon={<Icon name={tela === "playlists" ? "libraryFill" : "library"} size="lg" />}
        label="Playlists"
        active={tela === "playlists"}
        onClick={aoAbrirPlaylists}
      />
      {rankingDesbloqueado && (
        <MobileTabBar.Item
          icon={<Icon name={tela === "ranking" ? "likedFill" : "likedOutline"} size="lg" />}
          label="Ranking"
          active={tela === "ranking"}
          onClick={aoAbrirRanking}
        />
      )}
      <MobileTabBar.Item
        icon={<Icon name={tela === "perfil" ? "subscriptionsFill" : "subscriptions"} size="lg" />}
        label="Perfil"
        active={tela === "perfil"}
        onClick={aoAbrirPerfil}
      />
    </MobileTabBar>
  );
}
