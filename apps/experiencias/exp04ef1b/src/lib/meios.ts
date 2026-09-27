import type { NewsArticleMedium, NewsMedium } from "@edu/ui/ds";
import type { IdDeBloco, Meio, TipoDePista } from "./tipos";

/**
 * O vocabulário da api traduzido para o do design system — num lugar só, e
 * EXAUSTIVO: `Record<Meio, …>` faz o `tsc` recusar um meio novo na api que
 * não tenha desenho aqui.
 *
 * `rede_social` e `mensagem` têm `NewsMedium` (o CARTÃO compacto da mesa os
 * mostra), mas não `NewsArticleMedium`: a matéria ORIGINAL deles não é da
 * seção `unooria` — é o `PostCard` do Instanooria e o `MessageBubble` do
 * WhatsApp Mobile (ADR-117, `app/redacao/materia-original.tsx`).
 */
export const MEIO_PARA_MEDIUM: Record<Meio, NewsMedium> = {
  jornal: "newspaper",
  radio: "radio",
  tv: "tv",
  blog: "blog",
  portal: "portal",
  rede_social: "social",
  mensagem: "message",
  mural: "bulletin",
};

/** A peça que desenha a matéria original de cada meio, e em que seção do DS ela mora. */
export type PecaDaMateria = { secao: "unooria"; medium: NewsArticleMedium } | { secao: "instanooria" } | { secao: "whatsappmobile" };

export const PECA_DO_MEIO: Record<Meio, PecaDaMateria> = {
  jornal: { secao: "unooria", medium: "newspaper" },
  radio: { secao: "unooria", medium: "radio" },
  tv: { secao: "unooria", medium: "tv" },
  blog: { secao: "unooria", medium: "blog" },
  portal: { secao: "unooria", medium: "portal" },
  rede_social: { secao: "instanooria" },
  mensagem: { secao: "whatsappmobile" },
  mural: { secao: "unooria", medium: "bulletin" },
};

/**
 * O glifo de cada pista (ligadura do Material Symbols Rounded, a do `Icon` da
 * seção). É o que a copy escreve como emoji (`🏛️ Fonte`, `📅 Data`,
 * `✍️ Autoria`): o `RevealClue` desenha o ícone ao lado do rótulo, e o texto
 * continua sendo o nome da pista — a redundância `texto+ícone` da copy.
 */
export const ICONE_DA_PISTA: Record<TipoDePista, string> = {
  fonte: "account_balance",
  data: "calendar_month",
  autoria: "history_edu",
};

/**
 * O glifo de cada bloco da Chave, em ORDEM ALFABÉTICA de propósito: agrupar os
 * pilares no topo seria escrever no bundle quais três abrem a Chave. Os três
 * pilares repetem o glifo da pista — é a mesma pergunta que a criança fez na
 * gaveta, e reconhecê-la é a descoberta, não um vazamento.
 */
export const ICONE_DO_BLOCO: Record<IdDeBloco, string> = {
  autoria: "history_edu",
  compartilhada: "share",
  data: "calendar_month",
  fonte: "account_balance",
  foto: "photo_camera",
  urgencia: "campaign",
};
