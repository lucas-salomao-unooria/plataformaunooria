import { AvatarPerfil } from './avatar-perfil';
import { Glifo } from '@edu/ui/ds-insta';

export type Aba = 'feed' | 'busca' | 'criar' | 'notificacoes' | 'perfil';

/**
 * Barra de navegação, medida no Figma (node 0:1724 — "Tab Bar"): 5 abas de 75px,
 * altura de 50px, fundo #FAFAFA e divisória superior de 0.33px (#A6A6AA).
 * Ícones de ~23px, centralizados.
 *
 * A ordem é a do arquivo: início · busca · criar · notificações · perfil.
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
  const cor = (aba: Aba) => (ativa === aba ? '#262626' : '#8E8E93');
  const avatar = avatarDoEstudante ?? '';

  return (
    <nav className="sticky bottom-0 z-30 flex h-bottomnav items-stretch bg-canvas shadow-[0px_-0.33px_0px_0px_theme(colors.hairlineBarra)]">
      <button
        type="button"
        aria-label="Início"
        aria-current={ativa === 'feed' ? 'page' : undefined}
        onClick={() => aoTrocar('feed')}
        className="flex flex-1 items-center justify-center active:opacity-50"
      >
        <Glifo name="home" size={23} style={{ color: cor('feed') }} />
      </button>

      <button
        type="button"
        aria-label="Buscar"
        aria-current={ativa === 'busca' ? 'page' : undefined}
        onClick={() => aoTrocar('busca')}
        className="flex flex-1 items-center justify-center active:opacity-50"
      >
        <Glifo name={ativa === 'busca' ? 'searchFilled' : 'search'} size={23} style={{ color: cor('busca') }} />
      </button>

      <button
        type="button"
        aria-label="Criar"
        onClick={() => aoTrocar('criar')}
        className="flex flex-1 items-center justify-center active:opacity-50"
      >
        <Glifo name="add" size={23} style={{ color: cor('criar') }} />
      </button>

      <button
        type="button"
        aria-label="Notificações"
        aria-current={ativa === 'notificacoes' ? 'page' : undefined}
        onClick={() => aoTrocar('notificacoes')}
        className="relative flex flex-1 items-center justify-center active:opacity-50"
      >
        <Glifo name={ativa === 'notificacoes' ? 'heartFilled' : 'heart'} size={23} style={{ color: cor('notificacoes') }} />
        {naoLidas > 0 ? (
          <span className="absolute right-[22px] top-[8px] flex h-4 min-w-4 items-center justify-center rounded-full bg-like px-1 text-[10px] font-semibold text-white">
            {naoLidas}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        aria-label="Meu perfil"
        aria-current={ativa === 'perfil' ? 'page' : undefined}
        onClick={() => aoTrocar('perfil')}
        className="flex flex-1 items-center justify-center active:opacity-50"
      >
        <span className={`inline-block rounded-full ${ativa === 'perfil' ? 'ring-[1.5px] ring-ink' : ''}`}>
          <AvatarPerfil seed={avatar} tamanho={23} />
        </span>
      </button>
    </nav>
  );
}
