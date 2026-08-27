'use client';

/**
 * Ponte para a seção **Unootube** do `@unooria/design-system`.
 *
 * Existe pelo mesmo motivo de `ds.ts` e `ds-insta.ts`: o pacote usa hooks mas
 * não publica a diretiva 'use client' no bundle, e reexportar por aqui marca a
 * seção inteira de uma vez.
 *
 * Ao contrário de `ds-insta.ts`, aqui a importação é pelo SUBCAMINHO
 * (`@unooria/design-system/unootube`) e não pelo namespace `UnootubeUI`. O
 * pacote publica os dois, e o subcaminho é melhor por duas razões: preserva o
 * tree-shaking (o namespace arrasta a seção inteira) e devolve os nomes já
 * desambiguados — `Icon`, `Avatar`, `Button` e `Logo` colidem com os da
 * plataforma, e quem importa daqui sabe que está no clone.
 *
 * ONDE USAR: a superfície disfarçada da exp-02-unootube — feed de Shorts,
 * cromo (barra superior, barra lateral, abas), playlists e canal do aluno.
 * NÃO usar nas telas pós-revelação (ranking, diálogo de conclusão): lá vale
 * `@edu/ui/ds`, porque a virada da missão é justamente sair do disfarce.
 * É a mesma divisão que `ds.ts` já descreve, um nível abaixo.
 */

/** Cromo do app: barra superior, busca, perfil e barra lateral. */
export {
  TopBar,
  SearchBox,
  ProfileCompact,
  ProfileExpanded,
  Sidebar,
  SidebarMenuItem,
  SidebarMenuTitle,
  FooterItem,
} from '@unooria/design-system/unootube';

/** Faixa de pílulas de categoria — as abas de "Salvos"/"Curtidos". */
export { TopMenuBar, TopMenuItem, TopMenuIcon } from '@unooria/design-system/unootube';

/** Cromo móvel: a barra de abas do rodapé abaixo de 760px. */
export {
  MobileTopBar,
  MobileTabBar,
  MobileHeader,
  MobileChannelHeader,
} from '@unooria/design-system/unootube';

/**
 * Família Shorts (0.1.14). O `ShortsPlayer` monta um `<video>` REAL quando
 * recebe `src`/`sources` — é o que permitiu a exp-02 parar de manter o seu.
 * `videoRef` é o que liga o reprodutor ao IntersectionObserver do feed.
 */
export { ShortsPlayer, ShortsActionRail, ShortsCard, ShortsShelf, ShortsLogo } from '@unooria/design-system/unootube';

/** Vitrine e canal: cartões, prateleiras e cabeçalho do canal do aluno. */
export {
  ThumbnailImage,
  VideoCard,
  VideoCardSmall,
  VideoCardSidebar,
  VideoDescription,
  ChannelHeader,
  Playlist,
} from '@unooria/design-system/unootube';

/**
 * Átomos: glifos, marca, avatar e botões do clone.
 *
 * `PlayerGlyph` é o segundo conjunto de glifos da seção — os do cromo do
 * reprodutor (som, legenda, qualidade, tela cheia). Não estão no `Icon`, que
 * cobre navegação e ações; quem precisa do alto-falante precisa deste.
 */
export { Icon, PlayerGlyph, Logo, Avatar, Button, SubscribeButton } from '@unooria/design-system/unootube';

/**
 * Peças de estrutura que a seção passou a publicar na 0.1.17 — e que até então
 * eram compensação local nesta plataforma. Existirem AQUI é o que permite ao
 * clone ter toast, diálogo, tabela e estado vazio sem puxar os institucionais,
 * que entregariam o exercício antes da revelação.
 */
export { Snackbar, Modal, Table, EmptyState } from '@unooria/design-system/unootube';

/** Utilidades de reprodução, para quem precisa dirigir o `<video>` de fora. */
export { useVideoPlayback, formatPlaybackTime } from '@unooria/design-system/unootube';

export type {
  UniAvatarProps,
  UniButtonProps,
  UniChannelHeaderProps,
  UniIconName,
  UniIconProps,
  UniShortsActionRailItemProps,
  UniShortsActionRailProps,
  UniShortsCardProps,
  UniShortsPlayerProps,
  UniShortsShelfProps,
  UniSidebarMenuItemProps,
  UniTopBarProps,
  UniTopMenuOption,
  UniVideoControls,
  UniVideoState,
} from '@unooria/design-system/unootube';
