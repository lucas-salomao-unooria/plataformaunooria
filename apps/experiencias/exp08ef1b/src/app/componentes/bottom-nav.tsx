import { TabBar, type UnvTabItem } from '@edu/ui/ds-unoovista';

import { retratoDe } from './avatar-perfil';

export type Aba = 'feed' | 'busca' | 'criar' | 'notificacoes' | 'perfil';

/**
 * Navegação: a doca flutuante do Unoovista (`TabBar`), em cápsula, afastada das
 * bordas. A aba ativa vira cápsula com o glifo preenchido e o rótulo; as
 * inativas mostram só o glifo, e o nome acessível está sempre presente — são
 * esses nomes ("Início", "Buscar", "Criar", "Notificações", "Meu perfil") que a
 * suíte de ponta a ponta procura.
 *
 * A ordem: início · busca · criar · notificações · perfil. "Criar" não é aba —
 * abre o compositor e a doca continua onde estava (quem decide é a casca).
 *
 * A doca é `fixed` na base da coluna do aparelho: o componente não se posiciona
 * sozinho (no DS ele vive dentro do `PhoneFrame`), e o feed reserva a altura
 * dela embaixo (`pb-doca`) para o último post não ficar escondido atrás.
 * `withHomeIndicatorInset={false}` pelo mesmo motivo da barra de status do
 * `TopBar`: dentro do iframe, o indicador do aparelho é do hub.
 */
export function BottomNav({
  ativa,
  aoTrocar,
  avatarDoEstudante,
  naoLidas,
}: {
  ativa: Aba;
  aoTrocar: (aba: Aba) => void;
  avatarDoEstudante?: string;
  naoLidas: number;
}) {
  const itens: UnvTabItem[] = [
    { id: 'feed', label: 'Início', icon: 'home' },
    { id: 'busca', label: 'Buscar', icon: 'search', activeIcon: 'searchFilled' },
    { id: 'criar', label: 'Criar', icon: 'add' },
    {
      id: 'notificacoes',
      label: 'Notificações',
      // "Notificações" não cabe na cápsula ativa (o DS corta em 120px); o rótulo
      // curto é o do próprio Unoovista. O nome acessível continua inteiro.
      shortLabel: 'Atividade',
      icon: 'heart',
      activeIcon: 'heartFilled',
      hasNotification: naoLidas > 0,
    },
    { id: 'perfil', label: 'Meu perfil', shortLabel: 'Perfil', avatarSrc: retratoDe(avatarDoEstudante ?? '').src },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-phone">
      <TabBar
        items={itens}
        activeId={ativa}
        withHomeIndicatorInset={false}
        onChange={(id) => aoTrocar(id as Aba)}
      />
    </div>
  );
}
