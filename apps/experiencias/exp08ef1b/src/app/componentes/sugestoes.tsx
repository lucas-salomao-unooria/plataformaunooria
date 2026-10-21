import { ButtonUnv } from '@edu/ui/ds-unoovista';

import type { PerfilCliente } from '../../lib/tipos';

import { AvatarPerfil } from './avatar-perfil';

/**
 * Módulo "Sugestões para você" (doc 03 §4): carrossel de cards 150×190.
 * Os perfis vêm do lado dominante — seguir de volta é sinal fortíssimo.
 *
 * O Unoovista não tem cartão de sugestão: o módulo é um cartão do feed
 * (`surface`, `radius-l`) com cartões menores dentro, montados com o `Avatar` e
 * o `Button` do DS — medida e disposição, que é o que cabe à experiência.
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
    <section className="rounded-cartao bg-surface py-4">
      <div className="flex items-center justify-between px-4 pb-3">
        <h2 className="m-0 text-[15px] font-semibold text-ink">Sugestões para você</h2>
        <span className="text-[13px] font-semibold text-link">Ver tudo</span>
      </div>

      <div className="sem-scrollbar flex gap-2 overflow-x-auto px-4">
        {perfis.map((perfil) => {
          const seguindo = seguidos.has(perfil.authorId ?? '');
          return (
            <article
              key={perfil.authorId ?? perfil.handle}
              className="flex h-[190px] w-[150px] shrink-0 flex-col items-center justify-center gap-2 rounded-cartao bg-canvasAlt px-3"
            >
              <AvatarPerfil seed={perfil.avatarSeed} tamanho={64} />
              <p className="m-0 w-full truncate text-center text-[13px] font-semibold text-ink">
                {perfil.handle.replace(/^@/, '')}
              </p>
              <p className="m-0 w-full truncate text-center text-[12px] text-muted">{perfil.displayName}</p>
              <ButtonUnv
                block
                size="sm"
                variant={seguindo ? 'secondary' : 'primary'}
                onClick={() => aoSeguir(perfil, !seguindo)}
              >
                {seguindo ? 'Seguindo' : 'Seguir'}
              </ButtonUnv>
            </article>
          );
        })}
      </div>
    </section>
  );
}
