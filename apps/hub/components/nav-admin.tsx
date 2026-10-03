"use client";

import { usePathname, useRouter } from "next/navigation";
import { Icon, SideBar, type SideBarItemData } from "@edu/ui/ds";
import { ehDoContrato } from "@/lib/papeis";
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
 * `gestor_contrato` tem um item a mais: as escolas da rede. Escola é *tenant*, e
 * criar um inquilino novo não é operação de quem administra uma unidade.
 *
 * A restrição vive FORA do item, num conjunto de ids. `SideBarItemData` tem
 * índice aberto (`[key: string]: unknown`) e o DS espalha o que não conhece no
 * elemento — um campo meu ali dentro virava atributo camelCase no DOM, com o
 * React reclamando em toda tela da área.
 */
const SO_ADMIN_DO_CONTRATO = new Set(["regionais", "escolas", "recursos"]);

/**
 * O panorama só aparece para quem tem MAIS DE UMA lotação — o supervisor de uma
 * diretoria. Com uma escola ele seria uma tela de uma linha, e um item de menu
 * que não leva a nada é pior que item nenhum.
 */
const SO_COM_VARIAS_ESCOLAS = new Set(["minhas-escolas"]);

/**
 * O relatório é DA DIRETORIA: quem cobre uma regional e quem enxerga o
 * contrato. Professor e gestor de uma escola não entram — para eles a tela
 * seria a própria escola com um título errado.
 */
const SO_DA_DIRETORIA = new Set(["relatorios"]);

const ITENS: Array<SideBarItemData & { href: string }> = [
  /* Regionais ANTES de Escolas: é a ordem da hierarquia (rede → regional →
     escola), e quem chega pela primeira vez lê a lateral de cima para baixo.
     As duas eram uma tela só até 2026-09-08 (ADR-79). */
  {
    id: "regionais",
    label: "Regionais",
    icon: <Icon name="account_balance" />,
    href: "/admin/regionais",
  },
  { id: "escolas", label: "Escolas", icon: <Icon name="apartment" />, href: "/admin/escolas" },
  {
    id: "minhas-escolas",
    label: "Minhas escolas",
    icon: <Icon name="account_tree" />,
    href: "/admin/minhas-escolas",
  },
  {
    id: "relatorios",
    label: "Relatório",
    icon: <Icon name="insights" />,
    href: "/admin/relatorios",
  },
  /* O HISTÓRICO do painel da Unooria (ADR-89), em leitura. A rede não liga nem
     desliga nada — o que ela vê aqui é por que o produto dela mudou de estado. */
  {
    id: "recursos",
    label: "Recursos",
    icon: <Icon name="toggle_on" />,
    href: "/admin/recursos",
  },
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

export function NavAdmin({ papel, escolas }: { papel: Papel; escolas: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const itens = ITENS.filter(
    (i) =>
      (!SO_ADMIN_DO_CONTRATO.has(String(i.id)) || ehDoContrato(papel)) &&
      /* O `gestor_regional` vê o panorama SEMPRE, mesmo com uma escola só: para
         ele a tela não é "minhas lotações", é a DIRETORIA — o escopo do papel
         dele. Para quem chega por lotação a regra segue valendo: com uma escola
         a tela é de uma linha, e item de menu que não leva a nada é pior que
         item nenhum. */
      (!SO_COM_VARIAS_ESCOLAS.has(String(i.id)) ||
        escolas > 1 ||
        papel === "gestor_regional") &&
      (!SO_DA_DIRETORIA.has(String(i.id)) ||
        papel === "gestor_regional" ||
        ehDoContrato(papel)),
  );
  const ativo = itens.find((item) => pathname.startsWith(item.href))?.id ?? "usuarios";

  return (
    <SideBar
      theme="light"
      /* Sem painel de aplicativos nesta área: o botão "Iniciativas" abriria
         um painel vazio (H01.2.2, DS 0.2.15). */
      showApps={false}
      items={itens}
      activeId={ativo}
      onItemClick={(id) => {
        const item = itens.find((i) => i.id === id);
        if (item) router.push(item.href);
      }}
    />
  );
}
