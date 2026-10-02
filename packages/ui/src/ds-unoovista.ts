'use client';

/**
 * Ponte para a seção **Unoovista** do `@unooria/design-system`.
 *
 * Existe pelo mesmo motivo de `ds.ts` e das outras pontes: o pacote usa hooks
 * mas não publica a diretiva 'use client' no bundle, e reexportar por aqui marca
 * a seção inteira de uma vez.
 *
 * O Unoovista é a rede social visual com a identidade da Unooria (paleta roxa,
 * Open Sans, Material Symbols), criado na 0.2.11 como cópia ESTRUTURAL da seção
 * `instanooria`: os mesmos 31 componentes, os mesmos nomes e as mesmas props, com
 * a composição própria (doca flutuante, ações em pílula sobre a mídia, squircle
 * para quem tem história). As diferenças de API estão na seção 12.3 do
 * `AGENTS.md` do `storybook-unooria`; as que pesam aqui: `theme` não tem padrão
 * (herda `data-unv-theme` do contêiner), o `Icon` é ligadura do Material Symbols
 * (sem a folha de fonte, o NOME do glifo aparece como texto) e `igtv` virou
 * `longVideo`.
 *
 * A importação é pelo SUBCAMINHO (`@unooria/design-system/unoovista`), nunca
 * pelo namespace `UnoovistaUI`: o subcaminho preserva o tree-shaking.
 *
 * ONDE USAR: a superfície disfarçada da exp08ef1b. A `instanooria` continua viva
 * e intacta para quem ainda a usa (a exp07ef1b, o clone da exp01ef1b e o
 * `PostCard` da exp04ef1b) — as duas seções coexistem e não se misturam.
 *
 * Os nomes que COLIDEM com a plataforma (`ds.ts`) ganham o sufixo `Unv`, o
 * prefixo dos tipos da própria seção (`UnvIconName`), pela mesma regra do
 * `Insta` em `ds-insta.ts`: nunca um alias criativo, porque quem procura no
 * Storybook precisa achar pelo nome do catálogo.
 */
export {
  Avatar as AvatarUnv,
  Badge as BadgeUnv,
  BottomSheet as BottomSheetUnv,
  Button as ButtonUnv,
  Icon as IconUnv,
  Logo as LogoUnv,
  Snackbar as SnackbarUnv,
  TextField as TextFieldUnv,
} from '@unooria/design-system/unoovista';

export {
  Chip,
  ListItem,
  MediaGrid,
  NotificationItem,
  PostCard,
  ProfileHeader,
  SearchField,
  StoriesTray,
  StoryBubble,
  StoryComposer,
  StoryViewer,
  TabBar,
  TopBar,
} from '@unooria/design-system/unoovista';

export type {
  UnvIconName,
  UnvMediaItem,
  UnvProfileStat,
  UnvStoryBubbleState,
  UnvTabItem,
} from '@unooria/design-system/unoovista';
