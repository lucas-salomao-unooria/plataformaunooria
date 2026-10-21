import { useState } from 'react';

import { IconUnv, ListItem } from '@edu/ui/ds-unoovista';

import { experiencia } from '../../lib/api';

import { Sheet } from './sheet';

/**
 * Menu do perfil — o caminho de saída do estudante.
 *
 * Existe por dois motivos práticos de sala de aula: o mesmo aparelho passa de
 * mão em mão (o próximo estudante precisa entrar com o login dele) e quem precisa
 * sair no meio não pode ficar preso. A gramática é a de um app real: ☰ no
 * perfil → "Sair da conta". Nenhuma palavra sobre a atividade (regra de ouro 1).
 *
 * A SESSÃO É DO HUB (cookie httpOnly, fora do alcance do iframe — e o sandbox
 * não permite navegar o topo). Então a experiência PEDE a saída via
 * `exp:estado { acao: "sair" }` e o hub executa o signOut + redirect. No
 * origem isto era um fetch de logout + navegação do window.top.
 */
export function MenuPerfil({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [saindo, setSaindo] = useState(false);

  const sair = () => {
    setSaindo(true);
    experiencia().enviarEstado({ acao: 'sair' });
    // O hub troca a página inteira; se demorar (rede), o botão fica em "Saindo…".
  };

  return (
    <Sheet aberto={aberto} aoFechar={aoFechar} altura="auto" titulo="Sua conta">
      {/* A lista encosta nas bordas da folha, como no menu do perfil do Storybook.
          Saindo, a linha deixa de ser botão (sem `onClick`, a `ListItem` é texto). */}
      <ul className="m-0 list-none p-0 [margin-inline:calc(var(--unv-gutter)*-1)]">
        <li>
          <ListItem
            size="sm"
            leading={<IconUnv name="external" />}
            title={saindo ? 'Saindo…' : 'Sair da conta'}
            onClick={saindo ? undefined : sair}
          />
        </li>
        <li>
          <ListItem size="sm" leading={<IconUnv name="close" tone="secondary" />} title="Cancelar" onClick={aoFechar} />
        </li>
      </ul>
    </Sheet>
  );
}
