import { useState } from 'react';

import { AvatarUnv } from '@edu/ui/ds-unoovista';

import { iniciaisDe } from '../../lib/avatar';
import { IDS_DE_AVATAR, urlDoAvatar } from '../../lib/avatares';

type Anel = 'none' | 'story' | 'live' | 'seen';

/**
 * O retrato de um `seed`, na forma que os componentes do Unoovista recebem
 * (`avatarSrc` + `initials`). Duas naturezas, e a escolha é automática:
 *
 * - **Avatar escolhido** (`seed` é um id do catálogo, ex. `capivara`): a imagem
 *   ilustrada gerada uma vez em `public/avatares/`.
 * - **Persona do feed** (`seed` é um handle, ex. `@fatos.da.coroa`): só as
 *   iniciais, estáveis por handle — o fundo é o do `Avatar` do DS.
 */
export function retratoDe(seed: string): { src?: string; initials: string } {
  const iniciais = iniciaisDe(seed || '?');
  return IDS_DE_AVATAR.includes(seed) ? { src: urlDoAvatar(seed), initials: iniciais } : { initials: iniciais };
}

/**
 * Avatar do estudante ou de uma persona, pelo `Avatar` do Unoovista.
 *
 * Se a imagem falhar — arquivo não gerado, rede da escola caindo — cai nas
 * iniciais. O `Avatar` do DS não tem essa queda (ele mostraria a imagem
 * quebrada), então ela mora aqui: o `error` do `<img>` interno chega pelo
 * `onErrorCapture`, porque o React propaga o evento pela árvore dele. Um avatar
 * que não carrega não pode deixar buraco na interface.
 */
export function AvatarPerfil({
  seed,
  tamanho = 32,
  anel = 'none',
  className = '',
}: {
  seed: string;
  tamanho?: number;
  anel?: Anel;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const { src, initials } = retratoDe(seed);

  return (
    <AvatarUnv
      src={falhou ? undefined : src}
      alt=""
      initials={initials}
      size={tamanho}
      ring={anel}
      aria-hidden
      onErrorCapture={() => setFalhou(true)}
      className={`shrink-0 ${className}`}
    />
  );
}
