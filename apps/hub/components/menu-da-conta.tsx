"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { HeaderMenu, type HeaderMenuItem } from "@edu/ui/ds";

/**
 * A identidade de quem está logado e o menu do avatar — onde o "Sair" mora.
 *
 * Era um `<Avatar>` seco ao lado de um `<Button variant="ghost">Sair</Button>`:
 * a ação mais destrutiva da barra ficava a um clique de distância, do lado do
 * nome da pessoa, competindo em peso visual com a marca. Agora é o `HeaderMenu`
 * do DS (0.1.19, do `Menu Desk` do Figma): o avatar é o gatilho e a tira
 * expande da direita para a esquerda, com o logoff no item colado nele.
 *
 * O gatilho é o padrão do DS, não um `children` nosso — o Avatar de 40px com o
 * anel de gradiente É o desenho publicado. Plugar um avatar de 32px aqui para
 * "não mudar nada" seria recriar a divergência que este trabalho veio fechar.
 *
 * **Por que o nome e o papel moram AQUI, e não no header.**
 * COMPENSAÇÃO LOCAL, com lacuna nomeada: a tira do `HeaderMenu` é um overlay
 * ancorado à esquerda do gatilho, e o componente assume que ali há espaço
 * vazio. No header da plataforma NÃO há: ali ficam o nome e a linha de apoio.
 * Integrado ingenuamente, o item "Sair" abre DESENHADO EM CIMA das letras —
 * verificado na tela, não deduzido. Então a identidade e o menu passam a ser a
 * mesma peça, e ela cede o espaço enquanto a tira está aberta: é o que o Figma
 * mostra (a tira ocupa o espaço à esquerda do avatar) e o que o componente
 * espera encontrar.
 *
 * Isto é posicionamento, não componente novo — a fronteira que o `AGENTS.md`
 * da raiz define. Morre no dia em que o `HeaderMenu` souber empurrar o
 * conteúdo à esquerda em vez de cobri-lo (pedido no `storybook-unooria`).
 *
 * **Um item só, de propósito.** O componente aceita vários, e a tentação é
 * preencher com "Meu perfil" e "Configurações" — telas que não existem. Item de
 * menu que não leva a lugar nenhum é pior que menu curto. O candidato real,
 * "Trocar senha", também está fora: `middleware.ts` redireciona quem já trocou
 * para fora de `/trocar-senha`, então o item seria um link morto até o produto
 * ganhar troca voluntária de senha.
 */
export function MenuDaConta({ nome, apoio }: { nome: string; apoio: string }) {
  const [aberto, setAberto] = useState(false);

  const itens: HeaderMenuItem[] = [
    {
      key: "sair",
      label: "Sair",
      // `exit_to_app` é o ícone que o `Menu Desk` do Figma usa no item de saída.
      icon: "exit_to_app",
      danger: true,
      onClick: () => void signOut({ callbackUrl: "/login" }),
    },
  ];

  return (
    <div className="flex items-center gap-3">
      {/* `invisible`, e não desmontado: o bloco continua ocupando o lugar, então
          o avatar não escorrega para a direita quando a tira abre. Tirar do
          fluxo faria o gatilho se mover embaixo do cursor. */}
      <div
        className={`hidden text-right sm:block ${aberto ? "invisible" : ""}`}
        aria-hidden={aberto}
      >
        <p className="text-[13px] font-semibold text-unooria-neutral-950">{nome}</p>
        <p className="text-[12px] text-unooria-neutral-500">{apoio}</p>
      </div>

      <HeaderMenu
        items={itens}
        avatarName={nome}
        triggerLabel={`Conta de ${nome}`}
        open={aberto}
        onOpenChange={setAberto}
      />
    </div>
  );
}
