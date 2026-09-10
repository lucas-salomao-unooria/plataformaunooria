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
 * ONDE USAR: apenas a superfície do estudante (experiência exp-01-instanooria).
 * É o inverso de `ds.ts`, que vale só para as superfícies da plataforma.
 * Os dois nunca se cruzam.
 */
import { InstanooriaUI } from '@unooria/design-system';

/** Anotação explícita: sem ela o tsc infere um tipo que referencia o
 *  @types/react interno do pacote e falha com TS2742 (não-portável). */
type IconeInstanooria = typeof InstanooriaUI.Icon;

/** Catálogo de glifos exportado do Figma; inclui os pares preenchidos. */
export const Glifo: IconeInstanooria = InstanooriaUI.Icon;

export type NomeDeGlifo = Parameters<typeof Glifo>[0]['name'];

/**
 * Componentes do clone destruturados para a exp-04 (e as próximas do
 * Instanooria). Os nomes que NÃO colidem com a plataforma saem como estão;
 * os que colidem (Button, Avatar, Badge — o motivo de a seção viver num
 * namespace) ganham o sufixo `Insta`, nunca um alias criativo: quem procura
 * no Storybook precisa achar pelo nome do catálogo.
 */
/* Anotações explícitas pelo mesmo motivo do Glifo: sem elas o tsc infere um
 * tipo que referencia o @types/react interno do pacote e falha com TS2742. */
export const PostCard: typeof InstanooriaUI.PostCard = InstanooriaUI.PostCard;
export const TopBar: typeof InstanooriaUI.TopBar = InstanooriaUI.TopBar;
export const ButtonInsta: typeof InstanooriaUI.Button = InstanooriaUI.Button;
export const AvatarInsta: typeof InstanooriaUI.Avatar = InstanooriaUI.Avatar;
export const BadgeInsta: typeof InstanooriaUI.Badge = InstanooriaUI.Badge;
