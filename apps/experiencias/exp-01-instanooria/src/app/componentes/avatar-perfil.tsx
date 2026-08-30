import { useState } from 'react';

import { avatarProcedural } from '../../lib/avatar';
import { IDS_DE_AVATAR, urlDoAvatar } from '../../lib/avatares';

/**
 * Avatar do estudante ou de uma persona.
 *
 * Duas naturezas, e a escolha é automática:
 *
 * - **Avatar escolhido** (`seed` é um id do catálogo, ex. `capivara`): a imagem
 *   ilustrada gerada uma vez em `public/avatares/`.
 * - **Persona do feed** (`seed` é um handle, ex. `@fatos.da.coroa`): o avatar
 *   procedural de iniciais sobre gradiente, estável por handle.
 *
 * Se a imagem falhar — arquivo não gerado, rede da escola caindo — cai no
 * procedural. Um avatar que não carrega não pode deixar buraco na interface.
 */
export function AvatarPerfil({
  seed,
  tamanho = 32,
  className = '',
}: {
  seed: string;
  tamanho?: number;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const doCatalogo = IDS_DE_AVATAR.includes(seed);

  if (doCatalogo && !falhou) {
    return (
       
      <img
        src={urlDoAvatar(seed)}
        alt=""
        width={tamanho}
        height={tamanho}
        loading="lazy"
        onError={() => setFalhou(true)}
        className={`inline-block shrink-0 rounded-full object-cover ${className}`}
        style={{ width: tamanho, height: tamanho }}
        aria-hidden
      />
    );
  }

  const { gradiente, iniciais } = avatarProcedural(seed);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: tamanho,
        height: tamanho,
        background: gradiente,
        fontSize: Math.max(9, Math.round(tamanho * 0.36)),
      }}
      aria-hidden
    >
      {iniciais}
    </span>
  );
}
