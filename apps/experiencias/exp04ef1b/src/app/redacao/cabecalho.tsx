import type { ReactNode } from "react";
import { SectionHeader, Tag } from "@edu/ui/ds";

/**
 * O topo de toda tela da redação: o nome da tela e, quando houver, o selo de
 * estado ("Em Edição", a Chave fixada). É o `SectionHeader` da seção `unooria`
 * na variante de celular — a redação é da Unooria (ADR-117), sem cromo de app.
 */
export function Cabecalho({ titulo, selo, icone }: { titulo: ReactNode; selo?: string; icone?: string }) {
  return (
    <SectionHeader
      className="tela__topo"
      variant="mobile"
      divider
      title={titulo}
      badge={
        selo ? (
          <Tag variant="brand" size="sm" pill leftIcon={icone}>
            {selo}
          </Tag>
        ) : undefined
      }
    />
  );
}
