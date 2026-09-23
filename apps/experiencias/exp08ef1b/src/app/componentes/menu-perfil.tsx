import { useState } from 'react';

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
      <ul className="flex flex-col px-1 pb-6">
        <li>
          <button
            type="button"
            className="w-full px-4 py-4 text-left text-[15px] text-ink active:opacity-60"
            onClick={sair}
            disabled={saindo}
          >
            {saindo ? 'Saindo…' : 'Sair da conta'}
          </button>
        </li>
        <li>
          <button
            type="button"
            className="w-full px-4 py-4 text-left text-[15px] text-muted active:opacity-60"
            onClick={aoFechar}
          >
            Cancelar
          </button>
        </li>
      </ul>
    </Sheet>
  );
}
