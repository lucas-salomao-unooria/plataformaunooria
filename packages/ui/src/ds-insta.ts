'use client';

/**
 * Ponte para a seção **Instanooria** do `@unooria/design-system`.
 *
 * Existe por dois motivos:
 *
 * 1. O pacote não publica a diretiva 'use client' no bundle — reexportar aqui
 *    marca os componentes como client de uma vez (mesmo padrão de `ds.ts`).
 * 2. A seção Instanooria só é exposta pelo namespace `InstanooriaUI`, porque
 *    vários nomes (Icon, Avatar, Badge, Button, Logo, TextField) colidem com os
 *    da plataforma. Sem destruturar aqui, cada arquivo do feed teria que
 *    escrever `InstanooriaUI.Icon` e o bundler perderia o tree-shaking.
 *
 * ONDE USAR: a superfície do estudante das experiências que imitam o
 * Instagram — a exp07ef1b e as telas do CLONE da exp01ef1b (E2–E4; a
 * casca dela fala pela escola e usa `ds.ts`). É o inverso de `ds.ts`, que vale
 * só para as superfícies da plataforma. Os dois nunca se cruzam.
 *
 * DUAS FORMAS DE IMPORTAÇÃO COEXISTEM AQUI, e a diferença é histórica, não
 * intencional: o `Glifo` abaixo veio do namespace `InstanooriaUI` (a forma da
 * época) e FICA assim — ele é consumido pela exp08ef1b inteira, e migrá-lo é uma
 * mudança com risco próprio. Tudo que entrar DAQUI EM DIANTE importa do
 * SUBCAMINHO `@unooria/design-system/instanooria`, como `ds-chatgpt.ts`
 * documenta: o subcaminho preserva o tree-shaking (o namespace arrasta a seção
 * inteira, com os 560 KB de base64 do `Logo`) e devolve os nomes já prontos.
 */
import { InstanooriaUI } from '@unooria/design-system';

/** Anotação explícita: sem ela o tsc infere um tipo que referencia o
 *  @types/react interno do pacote e falha com TS2742 (não-portável). */
type IconeInstanooria = typeof InstanooriaUI.Icon;

/** Catálogo de glifos exportado do Figma; inclui os pares preenchidos. */
export const Glifo: IconeInstanooria = InstanooriaUI.Icon;

export type NomeDeGlifo = Parameters<typeof Glifo>[0]['name'];

/**
 * Componentes do clone para a exp01ef1b (e as próximas do Instanooria), pelo
 * SUBCAMINHO (ver o cabeçalho). Os nomes que NÃO colidem com a plataforma
 * saem como estão; os que colidem (Button, Avatar, Badge) ganham o sufixo
 * `Insta`, nunca um alias criativo: quem procura no Storybook precisa achar
 * pelo nome do catálogo.
 */
export { PostCard, TopBar } from '@unooria/design-system/instanooria';
export {
  Button as ButtonInsta,
  Avatar as AvatarInsta,
  Badge as BadgeInsta,
  Icon as IconInsta,
} from '@unooria/design-system/instanooria';

/**
 * As extensões da 0.2.4/0.2.5, nascidas para a exp07ef1b (A Seleção): a DM da
 * Amara (`DirectThread` + `MessageBubble` + `DmPoll`), o alerta irreversível
 * da publicação (`ConfirmDialog`), a ficha técnica sobre o Story
 * (`BottomSheet` não modal), a pílula "Ir para aba Salvos"
 * (`FloatingButton`), o compositor da legenda (`StoryComposer`) e as variantes
 * de `MediaGrid` (seleção) e `StoryViewer` (camada e rodapé). `TabBar` e
 * `SegmentedTabs` são da seção desde a 0.1.x e só não tinham consumidor aqui.
 */
export {
  BottomSheet,
  ConfirmDialog,
  DirectThread,
  DmPoll,
  FloatingButton,
  MediaGrid,
  MessageBubble,
  SegmentedTabs,
  StoryComposer,
  StoryViewer,
  TabBar,
} from '@unooria/design-system/instanooria';
export type {
  InstaDmPollOption,
  InstaIconName,
  InstaMediaItem,
  InstaSegmentItem,
  InstaTabItem,
} from '@unooria/design-system/instanooria';

/**
 * A segunda leva, da 0.2.7 — as compensações que a exp07ef1b deixou abertas:
 * a faixa de dica sob a barra (`InlineHint`), a demonstração do gesto de rolar
 * (`GestureHint`) e o aviso passageiro de conexão. O `Snackbar` do clone
 * COLIDE com o da plataforma (`ds.ts`) e sai como `SnackbarInsta`, pela mesma
 * regra do sufixo acima. A mesma versão trouxe o `wrap` do `BadgeInsta`, o
 * contador do `StoryComposer` em code points e o `errorDescription` do
 * `PostCard.Media`, que não precisam de export novo.
 */
export { GestureHint, InlineHint, Snackbar as SnackbarInsta } from '@unooria/design-system/instanooria';
