import { TabBar, type InstaTabItem } from "@edu/ui/ds-insta";
import { E2 } from "../../lib/textos";

export type Aba = "feed" | "salvos";

/**
 * A barra inferior do app, com DUAS abas — e a ausência das outras três é
 * decisão, não esquecimento.
 *
 * O Instagram real tem cinco (início, busca, criar, atividade, perfil), e a
 * spec desta missão declara as ausências (§5): sem busca (ela deixaria a
 * criança filtrar por "protesto" ou "prefeitura" e furar a amostragem do feed),
 * sem aba Explorar, sem criar publicação livre. Desenhar os três ícones mudos
 * seria pôr na tela alvos que não fazem nada — e alvo mudo ensina a
 * desconfiar da tela, que é o contrário do que o disfarce precisa. Ficam o
 * Feed e os Salvos, que é a navegação que a missão tem.
 */
const ABAS: InstaTabItem[] = [
  { id: "feed", label: E2.abaFeed, icon: "home", activeIcon: "home" },
  { id: "salvos", label: E2.abaSalvos, icon: "bookmark", activeIcon: "bookmarkFilled" },
];

export function BarraDeAbas({ ativa, aoTrocar }: { ativa: Aba; aoTrocar: (aba: Aba) => void }) {
  return (
    <TabBar
      items={ABAS}
      activeId={ativa}
      ariaLabel={E2.navegacao}
      withHomeIndicatorInset={false}
      onChange={(id) => {
        if (id !== ativa && (id === "feed" || id === "salvos")) aoTrocar(id);
      }}
    />
  );
}
