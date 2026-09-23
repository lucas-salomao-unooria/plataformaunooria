'use client';

/**
 * Ponte para a seção **ChatGPT** do `@unooria/design-system`.
 *
 * Existe pelo mesmo motivo de `ds.ts`, `ds-insta.ts` e `ds-unootube.ts`: o
 * pacote usa hooks mas não publica a diretiva 'use client' no bundle, e
 * reexportar por aqui marca a seção inteira de uma vez.
 *
 * A importação é pelo SUBCAMINHO (`@unooria/design-system/chatgpt`), nunca pelo
 * namespace `ChatGPTUI`: o subcaminho preserva o tree-shaking (o namespace
 * arrasta a seção inteira, e com ela os 560 KB de base64 do `Logo`) e devolve
 * os nomes já desambiguados — `Icon`, `Avatar`, `Badge`, `Button`, `Tag` e
 * `Modal` colidem com os da plataforma, e quem importa daqui sabe que está no
 * clone.
 *
 * ONDE USAR: a superfície da exp02em1b, do briefing ao resultado.
 *
 * ONDE NÃO USAR: em qualquer tela da plataforma. E note a diferença desta
 * missão para a exp04ef1b: lá a linha era a REVELAÇÃO, e as telas pós-virada
 * usavam `@edu/ui/ds`. **Aqui não há revelação no software** — a Lacuna de cada
 * fonte é deliberadamente o material do debate do professor, não uma tela. Por
 * isso a exp02em1b é 100% desta seção, e não importa `unooria.css` nenhum: a marca
 * institucional entra só como chrome do HUB, desenhada acima do iframe.
 *
 * DUAS RÉGUAS NO MESMO PACOTE, e elas não se substituem (o próprio
 * `components/index.d.ts` avisa): o bloco "Design system" e o bloco "ChatGPT UI
 * Kit", derivado das telas `New chat - V1 - A`. `SidebarRow` não é `NavItem`,
 * `WebSidebar` não é `Sidebar`, `Composer` não é `ChatInput`. A missão usa a
 * régua do CLIENTE WEB, e é ela que vem em primeiro plano aqui.
 *
 * TRÊS COMPONENTES FICAM DE FORA DE PROPÓSITO, e não por esquecimento:
 *   - `Logo` reproduz a marca da OpenAI. A experiência é um clone para fins
 *     pedagógicos, não uma falsificação de marca.
 *   - `Sidebar`/`NavItem`/`ChatInput` são a régua da página de documentação do
 *     Figma. Misturá-los com a régua do cliente web produz uma tela que não
 *     existe em nenhum dos dois desenhos.
 *   - `PlanTag` anuncia assinatura paga. Não há o que assinar aqui.
 */

/** Cromo da conversa: a barra lateral do cliente web e suas linhas. */
export { WebSidebar, SidebarRow } from '@unooria/design-system/chatgpt';

/**
 * O campo de escrever, com a doca que o ancora no rodapé.
 *
 * `hideLeadingActions` é o que a missão usa: anexar imagem e entrada de voz não
 * existem nesta conversa, e um alvo que não faz nada ensina o estudante a
 * desconfiar da tela.
 */
export { Composer } from '@unooria/design-system/chatgpt';

/** As falas. `role="user" | "assistant"` — sem terceiro papel. */
export { ChatBubble } from '@unooria/design-system/chatgpt';

/**
 * As perguntas prontas que aparecem quando o estudante trava: uma coluna de tópico
 * com sugestões clicáveis. É o destravamento do ADR-0008 do projeto de origem.
 */
export { TopicColumn, PromptSuggestion } from '@unooria/design-system/chatgpt';

/** Átomos: ação, identidade, etiqueta e separador. */
export { Button, IconButton, Avatar, Badge, Tag, Divider, Toggle } from '@unooria/design-system/chatgpt';

/** Superfícies compostas: o diálogo e os cartões. */
export { Modal, GPTCard, FeatureCard, SettingsRow } from '@unooria/design-system/chatgpt';

/**
 * Ícones da seção. `gptIconNames` serve de fonte para o `GptIconName`, e
 * `gptGlyphs` é o mapa de glifos que os componentes aceitam em `iconNode`.
 */
export { Icon, gptIcons, gptIconNames, gptGlyphs } from '@unooria/design-system/chatgpt';

export type {
  GptAvatarProps,
  GptBadgeProps,
  GptButtonProps,
  GptButtonSize,
  GptButtonVariant,
  GptCardProps,
  GptChatBubbleProps,
  GptChatBubbleRole,
  GptComposerDockProps,
  GptComposerProps,
  GptDividerProps,
  GptFeatureCardProps,
  GptIconName,
  GptIconProps,
  GptIconSize,
  GptModalBodyProps,
  GptModalFooterProps,
  GptModalHeaderProps,
  GptModalProps,
  GptPromptSuggestionProps,
  GptSidebarRowProps,
  GptTagProps,
  GptTopicColumnProps,
  GptWebSidebarNewChatProps,
  GptWebSidebarProps,
  GptWebSidebarSectionProps,
} from '@unooria/design-system/chatgpt';
