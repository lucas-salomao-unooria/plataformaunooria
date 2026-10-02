'use client';

/**
 * Ponte para a seção **WhatsApp Mobile** do `@unooria/design-system`.
 *
 * Existe pelo mesmo motivo de `ds.ts`, `ds-insta.ts`, `ds-unootube.ts` e
 * `ds-chatgpt.ts`: o pacote usa hooks mas não publica a diretiva 'use client'
 * no bundle, e reexportar por aqui marca a seção inteira de uma vez.
 *
 * A importação é pelo SUBCAMINHO (`@unooria/design-system/whatsappmobile`),
 * nunca pelo namespace `WhatsAppMobileUI`: o subcaminho preserva o
 * tree-shaking e devolve os nomes já desambiguados — `Icon`, `Avatar`, `Badge`,
 * `Dialog`, `Menu`, `ListItem`, `Checkbox`, `Radio` e `TopBar` colidem com os
 * da plataforma, e quem importa daqui sabe que está no clone.
 *
 * ONDE USAR: o mensageiro da exp06ef2b, inclusive os estados de erro, que
 * falam na voz do app ("Conectando..."). A exp05ef1b saiu daqui para o
 * `@edu/ui/ds-unoochat` (ADR-134), e o `MessageBubble` da gaveta do Jornal da
 * Escola também (ADR-136).
 *
 * ONDE NÃO USAR: as telas da plataforma dentro da mesma missão — o breakpoint
 * entre as aulas, o podcast, os três cards de sistematização e o "Meu percurso".
 * Ali quem fala é a escola, e a ponte é `@edu/ui/ds`. **A linha é a
 * REVELAÇÃO, não o arquivo**: o disfarce vale enquanto o estudante está dentro
 * do grupo; depois que ele sai do mensageiro, a marca institucional assume.
 *
 * ⚠️ **TEMA ESCURO, e só ele.** A seção publica `WaTheme = 'dark'` e o CSS traz
 * `:root, [data-wa-theme=dark]` — não há bloco claro. Derivar uma paleta clara
 * aqui é proibido (é a mesma regra do `unitube`): a fidelidade do clone é ao que
 * o pacote publica, e uma paleta inventada seria um WhatsApp que não existe. Os
 * wireframes da missão descrevem balões verdes sobre fundo claro; o que está em
 * produção é o escuro, e o contraste dele (#D3DAE0 sobre #101D25, ~11:1) passa
 * o AA que o RNF de acessibilidade pede com folga.
 *
 * ⚠️ **`PhoneFrame` NÃO entra na experiência.** Ele existe no pacote para o
 * Storybook e para telas soltas; dentro da plataforma quem desenha o aparelho é
 * o hub, pelo `DispositivoFrame`, a partir do `viewport` do
 * `public/experiencia.json`. Empilhar os dois daria um celular dentro de outro.
 */

/** Cromo do aparelho e da conversa. */
export { StatusBar, TopBar, ChatHeader, ChatWallpaper, TabBar } from '@unooria/design-system/whatsappmobile';

/**
 * As falas. `direction="out" | "in"`, `delivery`, `time`, `starred` e os
 * subcomponentes `MessageBubble.Media` (imagem) e `MessageBubble.Document`.
 *
 * O balão aceita `children`, e é por ali que entram as três composições que a
 * missão precisa e o pacote ainda não publica: o selo de encaminhada, o player
 * de voz com transcrição e o card de citação. Ver o `AGENTS.md` da experiência.
 */
export { MessageBubble } from '@unooria/design-system/whatsappmobile';

/** O campo de escrever. A missão o mantém INIBIDO: não há digitação livre no
 *  grupo, e um alvo que não faz nada ensina o estudante a desconfiar da tela. */
export { MessageComposer } from '@unooria/design-system/whatsappmobile';

/** Listas e linhas: a lista de conversas, o action sheet das 3 opções. */
export { ListItem, ChatListItem, SectionLabel, DateChip } from '@unooria/design-system/whatsappmobile';

/** Escolha exclusiva e múltipla — o sheet de intervenção e o "Meu percurso"
 *  ainda dentro do disfarce. */
export { Radio, Checkbox } from '@unooria/design-system/whatsappmobile';

/** Átomos: ação, identidade, etiqueta. */
export { TextButton, Avatar, Badge, Fab } from '@unooria/design-system/whatsappmobile';

/** Superfícies compostas. `Dialog` é o modal da matéria completa. */
export { Dialog, Menu, AttachmentSheet, EncryptionNotice } from '@unooria/design-system/whatsappmobile';

/**
 * Ícones da seção. Dois deles sustentam não-negociáveis de ofício e por isso
 * merecem nome: `forward` é o selo "Encaminhada com frequência" (as duas setas)
 * e o tone `pin` é o alfinete com que o Admin fixa a contraprova no topo.
 */
export { Icon, waIcons, waIconNames } from '@unooria/design-system/whatsappmobile';

/**
 * As EXTENSÕES da 0.2.4 — peças de conversa em grupo que o arquivo de origem
 * do Figma não publica e que o `storybook-unooria` desenhou só com tokens e
 * glifos da seção (primeiro consumidor: a exp05ef1b). Cada uma substitui uma
 * compensação que as missões anteriores faziam à mão:
 *
 * - `Button` — o botão preenchido/contornado (`filled | outline`, `md | lg`,
 *   `block`). Colide no NOME com o `Button` da plataforma: quem importa daqui
 *   está no clone, e numa tela que use as duas seções o alias é obrigatório.
 * - `ForwardButton` — a seta de encaminhar ao lado do balão; `selected` vira o
 *   tique (`aria-pressed`). Desabilitado, 30% — e ENGOLE o toque, porque é um
 *   `<button disabled>`.
 * - `BottomSheet` — a folha inferior genérica ("Encaminhar para..."), com véu,
 *   foco preso e ESC.
 * - `MediaViewer` — a mídia em tela cheia, com a legenda embaixo.
 * - `ChatBanner` — a faixa fixa sob o cabeçalho (a mensagem fixada), com
 *   `trailing` para um contador.
 * - `AdminOnlyNotice` — a barra "só administradores" no lugar do compositor,
 *   com o cadeado.
 * - `SystemMessage` — a pílula de aviso de sistema da conversa.
 * - `Poll` — a enquete, CONTROLADA: ela devolve o `id` e não sabe qual opção é
 *   "certa". Vive dentro de um `MessageBubble`.
 * - `MessageTag` — a etiqueta presa a uma mensagem; pictograma + rótulo, nunca
 *   só cor.
 * - `Toast` — o aviso rápido na base da tela (região viva sempre montada).
 *
 * E o `MessageBubble` ganhou, na mesma versão, `sender`, `forwardedLabel`,
 * `.LinkPreview`, `.Invite` e `.Media` sem `src` (a mídia DESENHADA, com
 * `children` + `alt`).
 */
export {
  Button,
  ForwardButton,
  BottomSheet,
  MediaViewer,
  ChatBanner,
  AdminOnlyNotice,
  SystemMessage,
  Poll,
  MessageTag,
  Toast,
} from '@unooria/design-system/whatsappmobile';

/** Tokens, para o CSS local não escrever cor à mão. */
export {
  waColorTokens,
  waSpacing,
  waRadii,
  waSurfaceColors,
  waTextColors,
  waIconColors,
} from '@unooria/design-system/whatsappmobile';

export type {
  WaAvatarProps,
  WaBadgeProps,
  WaChatHeaderProps,
  WaCheckboxProps,
  WaDialogProps,
  WaIconName,
  WaIconProps,
  WaListItemProps,
  WaMessageBubbleProps,
  WaMessageDelivery,
  WaMessageDirection,
  WaMessageMediaProps,
  WaMessageComposerProps,
  WaRadioProps,
  WaStatusBarProps,
  WaTextButtonProps,
  WaTopBarProps,
  WaAdminOnlyNoticeProps,
  WaBottomSheetProps,
  WaButtonProps,
  WaButtonSize,
  WaButtonVariant,
  WaChatBannerProps,
  WaForwardButtonProps,
  WaMediaViewerProps,
  WaMessageInviteProps,
  WaMessageLinkPreviewProps,
  WaMessageTagProps,
  WaPollOption,
  WaPollProps,
  WaSystemMessageProps,
  WaToastProps,
} from '@unooria/design-system/whatsappmobile';
