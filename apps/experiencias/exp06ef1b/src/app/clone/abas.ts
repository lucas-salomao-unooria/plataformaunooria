import type { UnvTabItem } from "@edu/ui/ds-unoovista";
import { E2 } from "../../lib/textos";

/**
 * A barra de abas do Unoovista (E2-ALU-01): Início, Busca, Notificações e
 * Jurado — as quatro da copy. O que cada uma faz é decidido para caber na
 * ficção SEM abrir fluxo novo (ver `feed.tsx`):
 *
 * - **Início**: o feed da mostra.
 * - **Busca**: fechada pela comissão durante o julgamento — responde com o
 *   aviso, como comentar e compartilhar. A busca é a ferramenta da Galeria
 *   Oculta, DEPOIS do voto; abri-la aqui deixaria a criança furar a bolha antes
 *   de o feed ter chance de formá-la, e a aposta não seria comprometida.
 * - **Notificações**: a notificação que a criança já recebeu (o crachá da
 *   comissão). Nenhuma informação nova.
 * - **Jurado**: o perfil do crachá `@jurado_oficial`, com o mandato.
 */
export type IdDaAba = "inicio" | "busca" | "notificacoes" | "jurado";

export const ABAS: UnvTabItem[] = [
  { id: "inicio", label: E2.abaInicio, icon: "home", activeIcon: "home" },
  { id: "busca", label: E2.abaBusca, icon: "search", activeIcon: "searchFilled" },
  { id: "notificacoes", label: E2.abaNotificacoes, icon: "heart", activeIcon: "heartFilled" },
  { id: "jurado", label: E2.abaJurado, icon: "verified", activeIcon: "verified" },
];
