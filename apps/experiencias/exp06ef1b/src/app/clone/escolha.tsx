import type { ReactNode } from "react";
import { AvatarUnv, IconUnv, ListItem } from "@edu/ui/ds-unoovista";

/**
 * Uma lista de escolha ÚNICA no clone — a cédula, a revisão do voto e os
 * cartões do caso Mariana.
 *
 * O Unoovista não publica rádio (o app real não tem): a linha é o `ListItem`
 * do DS como botão, com o glifo `check` à direita na escolhida — a marca não
 * depende só da cor —, e a semântica de rádio vai nos atributos (`radiogroup`,
 * `radio`, `aria-checked`). Nada aqui desenha controle: é composição de peças
 * do pacote.
 */
export interface OpcaoDeEscolha {
  id: string;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** A miniatura à esquerda (o estande), quando houver. */
  imagem?: { src: string; alt: string };
}

export function Escolha({
  rotulo,
  opcoes,
  valor,
  desabilitada = false,
  aoEscolher,
}: {
  rotulo: string;
  opcoes: readonly OpcaoDeEscolha[];
  valor: string | null;
  desabilitada?: boolean;
  aoEscolher: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="escolha">
      {opcoes.map((o) => {
        const marcada = o.id === valor;
        return (
          <ListItem
            key={o.id}
            role="radio"
            aria-checked={marcada}
            aria-disabled={desabilitada || undefined}
            className={marcada ? "escolha__opcao escolha__opcao--marcada" : "escolha__opcao"}
            leading={o.imagem ? <AvatarUnv src={o.imagem.src} alt="" size="md" /> : undefined}
            title={o.titulo}
            subtitle={o.subtitulo}
            trailing={marcada ? <IconUnv name="check" size="md" tone="link" title="Escolhido" /> : undefined}
            onClick={() => {
              if (!desabilitada) aoEscolher(o.id);
            }}
          />
        );
      })}
    </div>
  );
}
