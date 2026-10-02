import { IconUnv, ListItem, TopBar, type UnvIconName } from "@edu/ui/ds-unoovista";
import { E2, FIM } from "../../lib/textos";
import type { Categoria } from "../../lib/tipos";
import { Cracha } from "./credencial";

/**
 * E6-ALU-03 — o encerramento: o MESMO crachá da entrada, agora homologado, e o
 * infográfico opcional para a leitura silenciosa enquanto a turma termina.
 *
 * Fica no CLONE inteiro: quem homologa a credencial e entrega a leitura é a
 * comissão — uma tela tem uma voz só. O infográfico é texto e ícone (`ListItem`
 * + `IconUnv`), sem imagem: nenhum asset binário no bundle, e o leitor de tela
 * lê tudo. Não há botão: a missão acabou, e o hub já recebeu o `concluir`.
 */
export function Fim({ tema, categorias }: { tema: string; categorias: readonly Categoria[] }) {
  return (
    <div className="tela">
      <h1 className="so-leitor">{FIM.cracha}</h1>
      <TopBar title={E2.topo} withStatusBarInset={false} />
      <div className="rolagem rolagem--sem-barra fim">
        <p className="fim__carimbo" role="status">
          <IconUnv name="check" size={20} tone="link" /> {FIM.cracha}
        </p>
        <Cracha tema={tema} categorias={categorias} homologado />
        <p className="fim__leitura">{FIM.leitura}</p>
        <section className="infografico" aria-labelledby="infografico-titulo">
          <h2 id="infografico-titulo" className="infografico__titulo">
            {FIM.infografico}
          </h2>
          <ol className="infografico__passos">
            {FIM.passos.map((p) => (
              <ListItem
                key={p.titulo}
                as="li"
                className="infografico__passo"
                leading={<IconUnv name={p.icone as UnvIconName} size="lg" tone="link" />}
                title={p.titulo}
                subtitle={p.texto}
              />
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
