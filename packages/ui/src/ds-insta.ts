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
 * ONDE USAR: apenas a superfície do aluno (experiência exp-01-instanooria).
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
