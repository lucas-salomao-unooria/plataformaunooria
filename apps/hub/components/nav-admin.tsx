"use client";

import { usePathname, useRouter } from "next/navigation";
import { Icon, SideBar, type SideBarItemData } from "@edu/ui/ds";
import type { Papel } from "@/lib/papeis";

/**
 * Navegação da área administrativa. Três lugares, e é tudo o que o gestor faz
 * aqui: as pessoas, as turmas em que elas estão, e a porta por onde entram.
 *
 * `icon` é NÓ, não nome: passando a string, o item renderiza o texto cru e a
 * barra escreve "group", "school", "upload_file" na lateral — o mesmo sintoma
 * de quando a fonte de ligadura não carrega, com a mesma cara de bug de CSS.
 */
/**
 * `admin-contrato` tem um item a mais: as escolas da rede. Escola é *tenant*, e
 * criar um inquilino novo não é operação de quem administra uma unidade.
 *
 * A restrição vive FORA do item, num conjunto de ids. `SideBarItemData` tem
 * índice aberto (`[key: string]: unknown`) e o DS espalha o que não conhece no
 * elemento — um campo meu ali dentro virava atributo camelCase no DOM, com o
 * React reclamando em toda tela da área.
 */
const SO_ADMIN_DO_CONTRATO = new Set(["escolas"]);

const ITENS: Array<SideBarItemData & { href: string }> = [
  { id: "escolas", label: "Escolas", icon: <Icon name="apartment" />, href: "/admin/escolas" },
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

export function NavAdmin({ papel }: { papel: Papel }) {
  const pathname = usePathname();
  const router = useRouter();
  const itens = ITENS.filter(
    (i) => !SO_ADMIN_DO_CONTRATO.has(String(i.id)) || papel === "admin-contrato",
  );
  const ativo = itens.find((item) => pathname.startsWith(item.href))?.id ?? "usuarios";

  return (
    <SideBar
      theme="light"
      items={itens}
      activeId={ativo}
      onItemClick={(id) => {
        const item = itens.find((i) => i.id === id);
        if (item) router.push(item.href);
      }}
    />
  );
}
