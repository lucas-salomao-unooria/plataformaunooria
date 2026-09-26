'use client';

/**
 * Ponte para o Design System da Plataforma Unooria.
 *
 * O pacote `@unooria/design-system` usa hooks mas não publica a diretiva
 * 'use client' no bundle; reexportar por aqui marca esses componentes como
 * client components de uma vez, e Server Components podem importá-los.
 *
 * ONDE USAR: superfícies da plataforma no hub (login, /professor/**, /admin/**)
 * e as telas pós-revelação do estudante. NÃO usar no feed do estudante: lá a fidelidade
 * é ao padrão de interface do clone — valem `@edu/ui/ds-insta` e os tokens do
 * clone da própria experiência.
 */
export {
  AlertBox,
  // 0.2.7: o player de áudio longo (o podcast de recapitulação da exp07ef1b, na aula do professor).
  AudioPlayer,
  Avatar,
  AvatarGroup,
  Badge,
  BottomBar,
  BottomBarItem,
  Breadcrumb,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardMedia,
  CardProgress,
  CardTitle,
  Checkbox,
  CheckboxGroup,
  Collapse,
  EmptyState,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  RadioButton,
  RadioGroup,
  SideBar,
  SideBarItem,
} from '@unooria/design-system';

/**
 * Componentes que só existem a partir da 0.1.6 do pacote. Antes deles, cada um
 * destes papéis era resolvido com marcação e CSS à mão — `plataforma.css`
 * tinha compensações para o que o pacote não cobria.
 */
export {
  /** Marca oficial: wordmark, lockup, símbolo e ícone de app. */
  Logo,
  LogoAppIcon,
  LogoLockup,
  LogoSymbol,
  /** Progresso determinado e indeterminado — feedback da geração de conteúdo. */
  ProgressBar,
  CircularProgressBar,
  /** Etapas do fluxo de criação da atividade. */
  Stepper,
  /** Avisos transitórios (salvo, regenerado, publicado). */
  Snackbar,
  /** Rótulos de estado e classificação nos cards de post. */
  Tag,
  /** Cabeçalho de seção com título, apoio e ações à direita. */
  SectionHeader,
  /**
   * Menu do avatar do header — a tira que expande da DIREITA para a ESQUERDA,
   * com o logoff no item colado no gatilho. Publicado na 0.1.19 (Figma
   * `Menu Desk`, 21765:12693) e é o que substituiu o `<Avatar>` seco + botão
   * "Sair" solto do `header-plataforma.tsx`.
   */
  HeaderMenu,
  /** Campos de formulário do DS, em vez de <input> com classes soltas. */
  TextField,
  TextArea,
  PasswordInput,
  SearchInput,
  /** Ícones da plataforma (Material Symbols Rounded, via a fonte do DS). */
  Icon,
  Toggle,
  Tooltip,
  Tab,
  /** Componente mestre das abas; `Tab` sozinho é só o botão de uma aba. */
  Tabs,
  Table,
  Pagination,
  ListSectionItem,
} from '@unooria/design-system';

/**
 * Restante do catálogo institucional — a política é o pacote em COMPLETUDE:
 * componente com equivalente no DS nunca é reimplementado no hub.
 */
export {
  Calendar,
  Cropper,
  DatePicker,
  NumberButton,
  Outline,
  RichTextEditor,
  ScrollBar,
  Selection,
  TimePicker,
  /** Upload com fila e progresso — usado na importação de usuários por CSV. */
  FileUpload,
  UploadFileModal,
} from '@unooria/design-system';

/**
 * Data viz do DS — insumo do dossiê: donut de proporção final, barras
 * empilhadas por bloco, linha da escalada de intensidade, top-5 de dwell.
 */
export {
  AreaChart,
  BarChart,
  DataVizTooltip,
  DonutChart,
  LineChart,
  MetricCard,
  PieChart,
  PositiveNegativeBarChart,
  RadarChart,
  RadialBarChart,
  RankingCard,
  SemiDonutChart,
  StackedProgressBar,
  UNOORIA_DATAVIZ_PALETTE,
} from '@unooria/design-system';

/** Tokens em TS (cores, tipografia, espaçamento) para cálculos e SVGs. */
export { tokens } from '@unooria/design-system';

export type {
  AlertBoxProps,
  AudioPlayerProps,
  HeaderMenuItem,
  HeaderMenuProps,
  AvatarProps,
  BadgeProps,
  ButtonProps,
  CardProps,
  EmptyStateProps,
  ModalProps,
  SideBarItemData,
  SideBarProps,
  TableColumn,
  UnooriaTheme,
  UploadFileItem,
} from '@unooria/design-system';
