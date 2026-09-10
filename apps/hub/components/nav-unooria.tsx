"use client";

import { usePathname, useRouter } from "next/navigation";
import { Icon, SideBar, type SideBarItemData } from "@edu/ui/ds";

/**
 * Navegação da área da Unooria (ADR-88).
 *
 * UM item hoje, e a barra existe assim mesmo: ela é o que diz "você está no
 * painel da Unooria, não na área da escola" — que é justamente a confusão que a
 * ADR-88 quer evitar. O segundo item chega com a fixação de versão por escopo.
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
];

export function NavUnooria() {
  const pathname = usePathname();
  const router = useRouter();
  const ativo = ITENS.find((item) => pathname.startsWith(item.href))?.id ?? "recursos";

  return (
    <SideBar
      theme="light"
      items={ITENS}
      activeId={ativo}
      onItemClick={(id) => {
        const item = ITENS.find((i) => i.id === id);
        if (item) router.push(item.href);
      }}
    />
  );
}
