import { Sidebar as SidebarDS, SidebarMenuItem } from "@edu/ui/ds-unootube";

import type { Tela } from "../../lib/tipos";

interface Props {
  tela: Tela;
  rankingDesbloqueado: boolean;
  aoIrParaFeed: () => void;
  aoAbrirPlaylists: () => void;
  aoAbrirRanking: () => void;
}

/**
 * Barra lateral do DS. O `SidebarMenuItem` marca o item ativo do jeito que o
 * arquivo de origem marca — trocando o glifo de contorno pelo PREENCHIDO, e
 * não mudando a cor do texto. Por isso cada linha declara `icon` e
 * `activeIcon`; os glifos vazados eram justamente o que os `▶ ▣ ▤` literais do
 * código antigo tentavam imitar.
 *
 * `asButton` porque aqui nada navega: são trocas de tela dentro da experiência.
 */
export function Sidebar({ tela, rankingDesbloqueado, aoIrParaFeed, aoAbrirPlaylists, aoAbrirRanking }: Props) {
  return (
    <SidebarDS className="unootube-sidebar" label="Navegação principal">
      <SidebarDS.Section divider={false}>
        <SidebarMenuItem
          asButton
          icon="home"
          activeIcon="homeFill"
          menuLabel="Início"
          /* Leva ao mesmo lugar que "Shorts", mas quem marca o feed é o Shorts:
             duas linhas acesas ao mesmo tempo não diriam onde o estudante está. */
          onClick={aoIrParaFeed}
        />
        <SidebarMenuItem
          asButton
          icon="explore"
          activeIcon="exploreFill"
          menuLabel="Shorts"
          active={tela === "feed"}
          onClick={aoIrParaFeed}
        />
        <SidebarMenuItem
          asButton
          icon="library"
          activeIcon="libraryFill"
          menuLabel="Playlists"
          active={tela === "playlists"}
          onClick={aoAbrirPlaylists}
        />
        {rankingDesbloqueado && (
          <SidebarMenuItem
            asButton
            icon="likedOutline"
            activeIcon="likedFill"
            menuLabel="Ranking"
            active={tela === "ranking"}
            onClick={aoAbrirRanking}
          />
        )}
      </SidebarDS.Section>
    </SidebarDS>
  );
}
