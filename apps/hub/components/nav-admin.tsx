"use client";

import { usePathname, useRouter } from "next/navigation";
import { Icon, SideBar, type SideBarItemData } from "@edu/ui/ds";

/**
 * Navegação da área administrativa. Três lugares, e é tudo o que o gestor faz
 * aqui: as pessoas, as turmas em que elas estão, e a porta por onde entram.
 *
 * `icon` é NÓ, não nome: passando a string, o item renderiza o texto cru e a
 * barra escreve "group", "school", "upload_file" na lateral — o mesmo sintoma
 * de quando a fonte de ligadura não carrega, com a mesma cara de bug de CSS.
 */
const ITENS: Array<SideBarItemData & { href: string }> = [
  { id: "usuarios", label: "Usuários", icon: <Icon name="group" />, href: "/admin/usuarios" },
  { id: "turmas", label: "Turmas", icon: <Icon name="school" />, href: "/admin/turmas" },
  { id: "importar", label: "Importar", icon: <Icon name="upload_file" />, href: "/admin/importar" },
  {
    id: "periodos",
    label: "Ano letivo",
    icon: <Icon name="calendar_month" />,
    href: "/admin/periodos-letivos",
  },
];

export function NavAdmin() {
  const pathname = usePathname();
  const router = useRouter();
  const ativo = ITENS.find((item) => pathname.startsWith(item.href))?.id ?? "usuarios";

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
