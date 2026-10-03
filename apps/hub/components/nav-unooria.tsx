"use client";

import { usePathname, useRouter } from "next/navigation";
import { Icon, SideBar, type SideBarItemData } from "@edu/ui/ds";

/**
 * Navegação da área da Unooria (ADR-88).
 *
 * Quatro itens: o interruptor da rede (ADR-87), a torneira da IA (ADR-105), os
 * cadastros de interesse do site público (ADR-107) e as experiências
 * arquivadas (ADR-116). A
 * barra é o que diz "você está no painel da Unooria, não na área da escola" —
 * que é justamente a confusão que a ADR-88 quer evitar.
 *
 * `icon` é NÓ, não nome: passando a string, o item renderiza o texto cru e a
 * barra escreve "toggle_on" na lateral — o mesmo sintoma de fonte de ligadura
 * que não carregou, com a mesma cara de bug de CSS.
 */
const ITENS: Array<SideBarItemData & { href: string }> = [
  {
    id: "recursos",
    label: "Recursos",
    icon: <Icon name="toggle_on" />,
    href: "/unooria/recursos",
  },
  {
    id: "uso-de-ia",
    label: "Uso de IA",
    icon: <Icon name="data_usage" />,
    href: "/unooria/uso-de-ia",
  },
  {
    id: "prospeccao",
    label: "Prospecção",
    icon: <Icon name="contact_mail" />,
    href: "/unooria/prospeccao",
  },
  {
    id: "arquivados",
    label: "Arquivados",
    icon: <Icon name="archive" />,
    href: "/unooria/arquivados",
  },
];

export function NavUnooria() {
  const pathname = usePathname();
  const router = useRouter();
  const ativo = ITENS.find((item) => pathname.startsWith(item.href))?.id ?? "recursos";

  return (
    <SideBar
      theme="light"
      /* Sem painel de aplicativos nesta área: o botão "Iniciativas" abriria
         um painel vazio (H01.2.2, DS 0.2.15). */
      showApps={false}
      items={ITENS}
      activeId={ativo}
      onItemClick={(id) => {
        const item = ITENS.find((i) => i.id === id);
        if (item) router.push(item.href);
      }}
    />
  );
}
