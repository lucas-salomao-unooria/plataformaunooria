import { LogoUjn, TagUjn } from "@edu/ui/ds-unoojornal";
import { CABECALHO } from "../../lib/textos";

/**
 * O topo do Unoojornal: a marca, a etiqueta da edição à esquerda e uma
 * etiqueta de estado à direita (a equipe, o filtro ativo, a pilha da rotina).
 * Só `@edu/ui/ds-unoojornal` — é o jornal falando.
 *
 * `destaque` pinta a da direita com preenchimento (o "Ficha corrigida com
 * sucesso!" da E4-04 e o "Investigação concluída!"), sem cor de acerto: é o
 * `accent` da própria seção.
 */
export function Cabecalho({
  edicao,
  direita,
  destaque = false,
  apagado = false,
}: {
  edicao?: string;
  direita?: React.ReactNode;
  destaque?: boolean;
  apagado?: boolean;
}) {
  return (
    <header className={`jornal-topo${apagado ? " jornal-topo--apagado" : ""}`}>
      <LogoUjn height={26} title={CABECALHO.jornal} />
      {edicao ? (
        <TagUjn variant="neutral" size="sm" className="jornal-topo__edicao">
          {edicao}
        </TagUjn>
      ) : null}
      <span className="jornal-topo__vao" />
      {direita ? (
        <TagUjn variant={destaque ? "accent" : "outline"} size="md" className="jornal-topo__direita">
          {direita}
        </TagUjn>
      ) : null}
    </header>
  );
}
