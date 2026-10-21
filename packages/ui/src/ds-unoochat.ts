'use client';

/**
 * Ponte para a seção **Unoochat** do `@unooria/design-system` (desde a 0.2.9).
 *
 * Existe pelo mesmo motivo das outras pontes: o pacote usa hooks mas não
 * publica a diretiva 'use client' no bundle, e reexportar por aqui marca a
 * seção inteira de uma vez.
 *
 * O Unoochat é o mensageiro com identidade PRÓPRIA — paleta roxa, Open Sans e
 * Material Symbols da plataforma — e é uma cópia ESTRUTURAL do `whatsappmobile`:
 * os mesmos 39 componentes, as mesmas props, as mesmas medidas (mais o
 * `TypingIndicator` da 0.2.17, que o `whatsappmobile` não tem). Existe para que
 * a missão não reproduza a identidade visual de um aplicativo de terceiros
 * (ADR-134). As diferenças de API são só quatro, e nenhuma morde a exp05ef1b:
 * `TabBar.tone` só aceita `'accent'`; o `Icon` é `<span>` de LIGADURA (nomes
 * novos: `pin`, `tickDouble`, `poll`…; `radioOn`/`radioOff` saíram); os textos
 * padrão são pt-BR; o `ChatWallpaper` repete um ladrilho de 320px.
 *
 * A importação é pelo SUBCAMINHO (`@unooria/design-system/unoochat`): preserva
 * o tree-shaking e devolve os nomes já desambiguados — `Icon`, `Avatar`,
 * `Badge`, `Dialog`, `Menu`, `ListItem`, `Checkbox`, `Radio`, `TopBar` e
 * `Button` colidem com os da plataforma, e quem importa daqui sabe que está no
 * clone.
 *
 * ONDE USAR: o grupo da turma da exp05ef1b (do convite da Nina à síntese, e de
 * volta ao chat da Nina nas perguntas finais), inclusive os erros diegéticos
 * ("Conectando..."), e o `MessageBubble` da mensagem encaminhada na gaveta do
 * Jornal da Escola (exp04ef1b, ADR-136). A exp06ef2b continua no
 * `@edu/ui/ds-whatsapp`.
 *
 * ONDE NÃO USAR: as telas da escola dentro da mesma missão. Ali quem fala é a
 * escola, e a ponte é `@edu/ui/ds`. **A linha é a REVELAÇÃO, não o arquivo.**
 *
 * ⚠️ **DOIS temas**, `data-unc-theme="light" | "dark"`, com `:root` = claro. Ao
 * contrário do `whatsappmobile`, o par é legítimo: cada valor é um degrau
 * nomeado da paleta da Unooria. Derivar um terceiro por cálculo continua
 * proibido.
 *
 * ⚠️ **A folha de fonte é obrigatória** (`/fonts/unoochat.css`): o `Icon` é
 * ligadura do Material Symbols, e sem a família a tela escreve o NOME do ícone
 * no lugar do desenho — o mesmo modo de falhar da seção `unooria`.
 *
 * ⚠️ **`PhoneFrame` NÃO entra na experiência**: quem desenha o aparelho é o hub,
 * pelo `viewport` do `public/experiencia.json`.
 */

/** Cromo do aparelho e da conversa. */
export { StatusBar, TopBar, ChatHeader, ChatWallpaper, TabBar } from '@unooria/design-system/unoochat';

/** As falas, com `.Media`, `.Document`, `.LinkPreview` e `.Invite`. */
export { MessageBubble } from '@unooria/design-system/unoochat';

/** O campo de escrever. A exp05ef1b o mantém INERTE (não há digitação livre no grupo). */
export { MessageComposer } from '@unooria/design-system/unoochat';

/** Listas e linhas. */
export { ListItem, ChatListItem, SectionLabel, DateChip } from '@unooria/design-system/unoochat';

/** Escolha exclusiva e múltipla. O `Radio` é desenhado em CSS (não há glifo). */
export { Radio, Checkbox } from '@unooria/design-system/unoochat';

/**
 * O chip de filtro da busca em conversas: um `<button>` com `aria-pressed`
 * (`selected`). Na exp05ef1b é o montador do alerta do grupo — o interruptor
 * NÃO, os chips Falsa/Emocional e os conectores E/OU (0.6.0).
 */
export { FilterChip } from '@unooria/design-system/unoochat';

/** Átomos: ação, identidade, etiqueta. */
export { TextButton, Avatar, Badge, Fab } from '@unooria/design-system/unoochat';

/** Superfícies compostas. */
export { Dialog, Menu, AttachmentSheet, EncryptionNotice } from '@unooria/design-system/unoochat';

/** Ícones da seção — ligaduras do Material Symbols Rounded (peso 300). */
export { Icon, uncIcons, uncIconNames } from '@unooria/design-system/unoochat';

/**
 * As dez EXTENSÕES de conversa em grupo, as mesmas do `whatsappmobile` 0.2.4 a
 * 0.2.6, com o mesmo contrato: `ForwardButton` com `exhausted` (esmaece e
 * CONTINUA respondendo), `MessageBubble.Media` com `onClick`/`actionLabel`,
 * `Poll` controlado de ponta a ponta. O `Button` colide no NOME com o da
 * plataforma: numa tela que use as duas seções, o alias é obrigatório.
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
} from '@unooria/design-system/unoochat';

/**
 * O "digitando…" e a cor por remetente (0.2.17, ADR-145): o `TypingIndicator`
 * é o balão recebido com três pontos (parados com movimento reduzido), e o
 * `senderTone` (1 a 8) do `MessageBubble` e dele dá a cada nome a sua cor. Sem
 * `senderTone`, o nome continua no acento. O tom 1 É o acento.
 */
export { TypingIndicator } from '@unooria/design-system/unoochat';

/** Tokens, para o CSS local não escrever cor à mão. */
export {
  uncColorTokens,
  uncSpacing,
  uncRadii,
  uncSurfaceColors,
  uncTextColors,
  uncIconColors,
} from '@unooria/design-system/unoochat';

export type {
  UncTheme,
  UncSenderTone,
  UncTypingIndicatorProps,
  UncAvatarProps,
  UncBadgeProps,
  UncChatHeaderProps,
  UncCheckboxProps,
  UncFilterChipProps,
  UncDialogProps,
  UncIconName,
  UncIconProps,
  UncListItemProps,
  UncMessageBubbleProps,
  UncMessageDelivery,
  UncMessageDirection,
  UncMessageMediaProps,
  UncMessageComposerProps,
  UncRadioProps,
  UncStatusBarProps,
  UncTextButtonProps,
  UncTopBarProps,
  UncAdminOnlyNoticeProps,
  UncBottomSheetProps,
  UncButtonProps,
  UncButtonSize,
  UncButtonVariant,
  UncChatBannerProps,
  UncForwardButtonProps,
  UncMediaViewerProps,
  UncMessageInviteProps,
  UncMessageLinkPreviewProps,
  UncMessageTagProps,
  UncPollOption,
  UncPollProps,
  UncSystemMessageProps,
  UncToastProps,
} from '@unooria/design-system/unoochat';
