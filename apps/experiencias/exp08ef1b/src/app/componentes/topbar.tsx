import { LogoUnv, TopBar as TopBarUnv } from '@edu/ui/ds-unoovista';

/**
 * Barra superior do feed: o `TopBar` do Unoovista, com o logotipo à esquerda
 * (o título grande da composição do DS) e as ações circulares de 44px à
 * direita — câmera (abre o compositor), vídeos e mensagens.
 *
 * Vídeos e mensagens não existem neste app: tocar devolve o "disponível em
 * breve" de sempre. O ponto de novidade dos vídeos acende com notificação não
 * lida; o das mensagens fica aceso, como o contador "3" do clone antigo — é
 * cenário, a caixa de entrada que todo mundo tem.
 *
 * `withStatusBarInset={false}`: dentro do iframe não há barra de status do
 * aparelho para reservar — quem desenha o aparelho é o hub.
 */
export function TopBar({
  aoAbrirCompositor,
  aoTocarEmBreve,
  naoLidas,
}: {
  aoAbrirCompositor: () => void;
  aoTocarEmBreve: () => void;
  naoLidas: number;
}) {
  return (
    <TopBarUnv
      className="sticky top-0 z-30"
      withStatusBarInset={false}
      title={<LogoUnv height={24} title="Unoovista" />}
      trailing={
        <>
          <TopBarUnv.Action icon="camera" label="Câmera" onClick={aoAbrirCompositor} />
          <TopBarUnv.Action icon="longVideo" label="Vídeos" hasNotification={naoLidas > 0} onClick={aoTocarEmBreve} />
          <TopBarUnv.Action icon="share" label="Mensagens" hasNotification onClick={aoTocarEmBreve} />
        </>
      }
    />
  );
}
