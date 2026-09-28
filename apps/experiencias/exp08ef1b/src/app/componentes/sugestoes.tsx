import type { PerfilCliente } from '../../lib/tipos';

import { AvatarPerfil } from './avatar-perfil';

/**
 * Módulo "Sugestões para você" (doc 03 §4): carrossel de cards 150×190.
 * Os perfis vêm do lado dominante — seguir de volta é sinal fortíssimo.
 */
export function ModuloSugestoes({
  perfis,
  seguidos,
  aoSeguir,
}: {
  perfis: PerfilCliente[];
  seguidos: Set<string>;
  aoSeguir: (perfil: PerfilCliente, seguindo: boolean) => void;
}) {
  return (
    <section className="border-b border-hairline bg-surface py-3">
      <div className="flex items-center justify-between px-3 pb-3">
        <h2 className="text-[14px] font-semibold text-ink">Sugestões para você</h2>
        <span className="text-[12px] font-semibold text-action">Ver tudo</span>
      </div>

      <div className="sem-scrollbar flex gap-2 overflow-x-auto px-3">
        {perfis.map((perfil) => {
          const seguindo = seguidos.has(perfil.authorId ?? '');
          return (
            <article
              key={perfil.authorId ?? perfil.handle}
              className="flex h-[190px] w-[150px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-hairline px-3"
            >
              <AvatarPerfil seed={perfil.avatarSeed} tamanho={64} />
              <p className="w-full truncate text-center text-[13px] font-semibold text-ink">
                {perfil.handle.replace(/^@/, '')}
              </p>
              <p className="w-full truncate text-center text-[11px] text-muted">{perfil.displayName}</p>
              <button
                type="button"
                className={`mt-1 w-full rounded-lg py-1.5 text-[13px] font-semibold ${
                  seguindo ? 'border border-hairline text-ink' : 'bg-action text-white'
                }`}
                onClick={() => aoSeguir(perfil, !seguindo)}
              >
                {seguindo ? 'Seguindo' : 'Seguir'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
