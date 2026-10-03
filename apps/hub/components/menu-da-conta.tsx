"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { HeaderMenu, type HeaderMenuItem } from "@edu/ui/ds";
import { ModalDaAjuda } from "@/components/ajuda/modal-da-ajuda";

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
 * **Só os itens que levam a algum lugar.** O componente aceita vários, e a
 * tentação é preencher com "Meu perfil" e "Configurações" — telas que não
 * existem. Item de menu que não leva a lugar nenhum é pior que menu curto.
 *
 * **"Trocar senha"** (H01.4.1) leva a `/trocar-senha`, que desde então aceita a
 * troca voluntária de quem já passou do primeiro acesso. Quando a conta vier do
 * login da rede (WSO2, H01.5.1), a senha deixa de ser nossa e este item precisa
 * sumir para essas contas.
 *
 * **"Ajuda" (ADR-132)** abre o atendente em vídeo, num `Modal` — não é rota,
 * é a mesma janela em qualquer tela. Fica ANTES do "Sair" (a ação destrutiva
 * continua colada no avatar) e só aparece com `comAjuda`: o header decide pelo
 * papel (nunca estudante) e pelo interruptor do produto `ajuda`.
 */
export function MenuDaConta({ nome, apoio, comAjuda = false }: { nome: string; apoio: string; comAjuda?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const router = useRouter();

  const itens: HeaderMenuItem[] = [
    ...(comAjuda
      ? [
          {
            key: "ajuda",
            label: "Ajuda",
            // `help` é a interrogação do Material Symbols, já usada no pacote.
            icon: "help",
            onClick: () => {
              setAberto(false);
              setAjudaAberta(true);
            },
          } satisfies HeaderMenuItem,
        ]
      : []),
    {
      key: "trocar-senha",
      label: "Trocar senha",
      // `lock_reset` é o cadeado com a seta de refazer, do Material Symbols.
      icon: "lock_reset",
      onClick: () => {
        setAberto(false);
        router.push("/trocar-senha");
      },
    },
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
      {comAjuda ? <ModalDaAjuda aberto={ajudaAberta} aoFechar={() => setAjudaAberta(false)} /> : null}
    </div>
  );
}
