'use client';

/**
 * Ponte para a seção **UnooriaAI** do `@unooria/design-system` (desde a 0.2.11).
 *
 * Existe pelo mesmo motivo das outras pontes: o pacote usa hooks mas não
 * publica a diretiva 'use client' no bundle, e reexportar por aqui marca a
 * seção inteira de uma vez.
 *
 * O UnooriaAI é o cliente de conversa com IA de identidade PRÓPRIA — paleta
 * roxa, Open Sans e Material Symbols da plataforma — e é uma cópia ESTRUTURAL
 * do `chatgpt`: os mesmos 25 componentes, as mesmas props, as mesmas medidas.
 * Existe para que a missão não reproduza a identidade visual de um aplicativo
 * de terceiros (ADR-138). As diferenças de API são três: o `GPTCard` virou
 * `AssistantCard`; o `Icon` é `<span>` de LIGADURA (mesmos 13 nomes do
 * `chatgpt` e mais seis, entre eles `arrowForward` e `close`); e não há mapa
 * de glifos tipográficos — o `gptGlyphs.arrowRight` vira
 * `<Icon name="arrowForward" />`. Os textos padrão dos componentes são pt-BR.
 *
 * A importação é pelo SUBCAMINHO (`@unooria/design-system/unooriaai`): preserva
 * o tree-shaking e devolve os nomes já desambiguados — `Icon`, `Avatar`,
 * `Badge`, `Button`, `Tag` e `Modal` colidem com os da plataforma, e quem
 * importa daqui sabe que está no clone.
 *
 * ONDE USAR: a superfície da exp02em1b, do briefing ao resultado. Ela NÃO tem
 * revelação no software, então nunca troca para a seção da plataforma. A
 * exp08ef4b continua no `@edu/ui/ds-chatgpt`.
 *
 * ONDE NÃO USAR: o agente de IA do professor. Ele é a Unooria falando com o
 * professor, e as peças dele são da seção `unooria` (`@edu/ui/ds`), não desta.
 *
 * ⚠️ **A seção não publica cor PRIMITIVA**, só semântica (`--uai-bg-*`,
 * `--uai-text-*`, `--uai-status-*`…). Onde a missão precisava de uma cor sem
 * significado — as duas Equipes — ela usa o token semântico mais próximo, e
 * nunca hexadecimal nem o `--gpt-color-*` da outra seção.
 *
 * ⚠️ **A folha de fonte é obrigatória** (`/fonts/unooriaai.css`): o `Icon` é
 * ligadura do Material Symbols, e sem a família a tela escreve o NOME do ícone
 * no lugar dele.
 *
 * DUAS RÉGUAS NO MESMO PACOTE, e elas não se substituem (o próprio
 * `components/index.d.ts` avisa): `SidebarRow` não é `NavItem`, `WebSidebar`
 * não é `Sidebar`, `Composer` não é `ChatInput`, `PlanTag` não é `Badge`. A
 * missão usa a régua do CLIENTE WEB, e é ela que vem em primeiro plano aqui.
 *
 * FICAM DE FORA, até terem consumidor: `Logo` (o app disfarçado não mostra
 * marca dentro do iframe; a institucional é chrome do hub), `Sidebar`,
 * `NavItem`, `ChatInput`, `Input` e `SearchInput` (a outra régua) e `PlanTag`
 * (não há o que assinar aqui).
 */

/** Cromo da conversa: a barra lateral do cliente web e suas linhas. */
export { WebSidebar, SidebarRow } from '@unooria/design-system/unooriaai';

/**
 * O campo de escrever, com a doca que o ancora no rodapé.
 *
 * `hideLeadingActions` é o que a missão usa: anexar imagem e entrada de voz não
 * existem nesta conversa, e um alvo que não faz nada ensina o estudante a
 * desconfiar da tela.
 */
export { Composer } from '@unooria/design-system/unooriaai';

/** As falas. `role="user" | "assistant"` — sem terceiro papel. */
export { ChatBubble } from '@unooria/design-system/unooriaai';

/**
 * As perguntas prontas que aparecem quando o estudante trava: uma coluna de
 * tópico com sugestões clicáveis.
 */
export { TopicColumn, PromptSuggestion } from '@unooria/design-system/unooriaai';

/** Átomos: ação, identidade, etiqueta e separador. */
export { Button, IconButton, Avatar, Badge, Tag, Divider, Toggle } from '@unooria/design-system/unooriaai';

/** Superfícies compostas: o diálogo e os cartões. */
export { Modal, AssistantCard, FeatureCard, SettingsRow } from '@unooria/design-system/unooriaai';

/** A enquete de escolha única (0.2.19): as perguntas de evidência da exp02em1b (ADR-154). */
export { ChoicePoll } from '@unooria/design-system/unooriaai';

/** O separador de sessão na conversa (0.2.22): "--- Sessão 2/3: Beatriz (23h45) ---" na bateria de testes da exp01em1b. */
export { SessionDivider } from '@unooria/design-system/unooriaai';

/**
 * Ícones da seção. `uaiIcons` é o registro (nome → ligadura do Material
 * Symbols) e `uaiIconNames` serve de fonte para o `UaiIconName`.
 */
export { Icon, uaiIcons, uaiIconNames } from '@unooria/design-system/unooriaai';

export type {
  UaiAssistantCardProps,
  UaiAvatarProps,
  UaiBadgeProps,
  UaiButtonProps,
  UaiButtonSize,
  UaiButtonVariant,
  UaiChoicePollOption,
  UaiChoicePollProps,
  UaiSessionDividerProps,
  UaiChatBubbleProps,
  UaiChatBubbleRole,
  UaiComposerDockProps,
  UaiComposerProps,
  UaiDividerProps,
  UaiFeatureCardProps,
  UaiIconButtonProps,
  UaiIconName,
  UaiIconProps,
  UaiIconSize,
  UaiModalBodyProps,
  UaiModalFooterProps,
  UaiModalHeaderProps,
  UaiModalProps,
  UaiPromptSuggestionProps,
  UaiSettingsRowProps,
  UaiSidebarRowProps,
  UaiTagProps,
  UaiToggleProps,
  UaiTopicColumnProps,
  UaiWebSidebarNewChatProps,
  UaiWebSidebarProps,
  UaiWebSidebarSectionProps,
} from '@unooria/design-system/unooriaai';
