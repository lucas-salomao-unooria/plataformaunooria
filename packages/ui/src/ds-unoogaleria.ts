'use client';

/**
 * Ponte para a seção **Unoogaleria** do `@unooria/design-system` (0.2.27).
 *
 * Existe pelo mesmo motivo de `ds.ts` e das outras pontes: o pacote usa hooks
 * mas não publica a diretiva 'use client' no bundle, e reexportar por aqui marca
 * a seção inteira de uma vez.
 *
 * A Unoogaleria é a galeria de fotos e vídeos de celular com a identidade da
 * Unooria (paleta roxa, Open Sans, Material Symbols): biblioteca em grade
 * (`MediaGrid`, `MediaThumbnail`, `SectionHeader`), álbuns e destaques
 * (`AlbumCard`, `HighlightCard`), o visualizador imersivo (`MediaViewer`,
 * `Filmstrip`, `InfoPanel`, `VideoControls`), o editor (`PhotoEditor`,
 * `FilterPicker`, `Slider`), as folhas e diálogos (`BottomSheet`, `ActionMenu`,
 * `ShareSheet`, `ConfirmDialog`) e o app montado (`GalleryApp`, com o
 * `uglGalleryReducer`). Tokens `--ugl-*`, classes `ugl-`, tema por
 * `data-ugl-theme` (`light` | `dark`); o visualizador e o editor ficam numa
 * superfície escura invariante, que não muda com o tema.
 *
 * ⚠️ **A folha de fonte é obrigatória** (`/fonts/unoogaleria.css`, além de
 * `/unoogaleria.css`): o `Icon` é ligadura do Material Symbols, e sem a folha o
 * NOME do glifo aparece como texto.
 *
 * ⚠️ **`PhoneFrame` NÃO entra na experiência**: quem desenha o aparelho é o hub,
 * pelo `viewport` do `public/experiencia.json`. Por isso ele fica fora da ponte.
 *
 * A importação é pelo SUBCAMINHO (`@unooria/design-system/unoogaleria`): o
 * subcaminho preserva o tree-shaking.
 *
 * ONDE USAR: ainda sem consumidor no repositório. A candidata é a Galeria de
 * Fotos de O Detetive da Foto Misteriosa (exp01ef1b nova, do gerador de
 * missões). A tela da escola e o que vem depois da revelação continuam na
 * `@edu/ui/ds`; as seções não se misturam fora de exceção registrada em ADR.
 *
 * Os nomes que COLIDEM com a plataforma (`ds.ts`) ganham o sufixo `Ugl`, o
 * prefixo dos tipos da própria seção (`UglIconName`), pela mesma regra do
 * `Unv` em `ds-unoovista.ts` e do `Ujn` em `ds-unoojornal.ts`: nunca um alias
 * criativo, porque quem procura no Storybook precisa achar pelo nome do catálogo.
 */
export {
  Avatar as AvatarUgl,
  BottomSheet as BottomSheetUgl,
  Button as ButtonUgl,
  EmptyState as EmptyStateUgl,
  Icon as IconUgl,
  SectionHeader as SectionHeaderUgl,
  Slider as SliderUgl,
  TextField as TextFieldUgl,
} from '@unooria/design-system/unoogaleria';

export {
  ActionMenu,
  AlbumCard,
  Chip,
  ConfirmDialog,
  Filmstrip,
  FilterPicker,
  GalleryApp,
  HighlightCard,
  IconButton,
  InfoPanel,
  ListGroup,
  ListRow,
  MediaGrid,
  MediaThumbnail,
  MediaViewer,
  PhotoEditor,
  SearchField,
  SegmentedControl,
  SelectionBar,
  ShareSheet,
  TabBar,
  Toast,
  TopBar,
  VideoControls,
} from '@unooria/design-system/unoogaleria';

/** Hooks da seção: o foco dos modais, o estado controlável e a reprodução de vídeo. */
export { useControllableState, useModalFocus, useVideoPlayback } from '@unooria/design-system/unoogaleria';

/** Ícones — ligaduras do Material Symbols Rounded. */
export { uglIconFontFamily, uglIconNames, uglIconSizes, uglIcons } from '@unooria/design-system/unoogaleria';

/** Tokens, para o CSS local não escrever cor à mão. */
export {
  uglAvatarSizes,
  uglBlurBar,
  uglColorCssVars,
  uglColorGroups,
  uglColorThemes,
  uglColorTokens,
  uglContrastPairs,
  uglElevation,
  uglFontFamily,
  uglFontWeights,
  uglGradients,
  uglInvariantColors,
  uglLayout,
  uglMotion,
  uglRadii,
  uglSpacing,
  uglSpacingOrder,
  uglTypography,
  uglTypographyOrder,
  uglZIndex,
} from '@unooria/design-system/unoogaleria';

/**
 * O modelo de mídia da seção: o estado do `GalleryApp` (`uglGalleryReducer`),
 * os seletores da biblioteca, o agrupamento por dia/mês/ano, a busca, o editor
 * (filtros, ajustes, recorte) e os formatadores de data, duração e tamanho em
 * pt-BR. É lógica de APRESENTAÇÃO: o que a missão julga (gabarito, acerto,
 * nível) continua no servidor.
 */
export {
  UGL_DEFAULT_TIME_ZONE,
  UGL_TRASH_RETENTION_DAYS,
  uglAspectToRatio,
  uglCalendarDaysBetween,
  uglDayKey,
  uglDaysLeft,
  uglDefaultAdjustments,
  uglDefaultEdit,
  uglDefaultShareActions,
  uglEditToFilter,
  uglEditToTransform,
  uglEditedRatio,
  uglFilterToCss,
  uglFilters,
  uglFormatBytes,
  uglFormatCount,
  uglFormatDateTime,
  uglFormatDayLabel,
  uglFormatDuration,
  uglFormatDurationSpoken,
  uglFormatLongDate,
  uglFormatMegapixels,
  uglFormatMonthLabel,
  uglFormatSelection,
  uglFormatTime,
  uglFormatYearLabel,
  uglGalleryReducer,
  uglGroupMedia,
  uglInitials,
  uglIsEdited,
  uglMediaLabel,
  uglNormalizeSearch,
  uglSearchMedia,
  uglSelectAlbumItems,
  uglSelectAlbums,
  uglSelectFavorites,
  uglSelectHidden,
  uglSelectLibrary,
  uglSelectSubtype,
  uglSelectTrash,
  uglSelectVideos,
  uglSortByDate,
  uglStraightenScale,
  uglSubtypeLabels,
  uglVignetteOpacity,
} from '@unooria/design-system/unoogaleria';

export type {
  UglActionMenuAction,
  UglActionMenuAnchor,
  UglActionMenuDivider,
  UglActionMenuItem,
  UglActionMenuPlacement,
  UglActionMenuProps,
  UglActionMenuVariant,
  UglAdjustmentKey,
  UglAdjustments,
  UglAlbum,
  UglAlbumCardProps,
  UglAlbumCardSize,
  UglAlbumKind,
  UglAspectRatio,
  UglAvatarProps,
  UglAvatarSize,
  UglBottomSheetHeight,
  UglBottomSheetProps,
  UglBottomSheetVariant,
  UglButtonProps,
  UglButtonSize,
  UglButtonVariant,
  UglChipProps,
  UglChipSize,
  UglChipVariant,
  UglColorKey,
  UglColorToken,
  UglColorValue,
  UglConfirmDialogProps,
  UglConfirmDialogTone,
  UglContrastPair,
  UglDateOptions,
  UglEditState,
  UglEmptyStateProps,
  UglEmptyStateVariant,
  UglFilmstripProps,
  UglFilterDefinition,
  UglFilterId,
  UglFilterPickerProps,
  UglGalleryAction,
  UglGalleryAppProps,
  UglGalleryCollection,
  UglGalleryFilter,
  UglGalleryLibraryView,
  UglGalleryState,
  UglGalleryTab,
  UglGroupBy,
  UglHighlightCardProps,
  UglHighlightCardSize,
  UglHighlightCardTile,
  UglIconButtonProps,
  UglIconButtonSize,
  UglIconButtonVariant,
  UglIconDefinition,
  UglIconName,
  UglIconProps,
  UglIconSize,
  UglIconTone,
  UglInfoPanelProps,
  UglInfoPanelVariant,
  UglInvariantColorKey,
  UglInvariantColorToken,
  UglListGroupProps,
  UglListRowProps,
  UglMediaGridProps,
  UglMediaGridThumbnailOverrides,
  UglMediaItem,
  UglMediaSection,
  UglMediaSubtype,
  UglMediaThumbnailAspect,
  UglMediaThumbnailProps,
  UglMediaType,
  UglMediaViewerProps,
  UglPerson,
  UglPhotoEditorProps,
  UglPhotoEditorTool,
  UglSearchFieldProps,
  UglSectionHeaderAction,
  UglSectionHeaderProps,
  UglSectionHeaderSize,
  UglSegmentedControlProps,
  UglSegmentedControlSize,
  UglSegmentedControlVariant,
  UglSegmentedOption,
  UglSelectionBarAction,
  UglSelectionBarProps,
  UglShareAction,
  UglShareSheetProps,
  UglSliderProps,
  UglSliderVariant,
  UglSpacingToken,
  UglTabBarItem,
  UglTabBarProps,
  UglTextFieldElement,
  UglTextFieldProps,
  UglTextFieldVariant,
  UglTheme,
  UglToastPosition,
  UglToastProps,
  UglTopBarProps,
  UglTopBarVariant,
  UglTypographyStyle,
  UglTypographyToken,
  UglVideoControlsProps,
  UglVideoControlsVariant,
  UglVideoPlayback,
  UglViewerZoom,
} from '@unooria/design-system/unoogaleria';
