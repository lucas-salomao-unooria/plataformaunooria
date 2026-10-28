import { AlertBox } from "@edu/ui/ds";
import { GLOBAL } from "../../lib/textos";

/** 403 na abertura: a missão não está aberta nesta turma. Fala a ESCOLA, não o jornal. */
export function Indisponivel() {
  return (
    <div className="app app--centrado">
      <AlertBox variant="info" theme="light" device="desktop" role="status" title={GLOBAL.indisponivelTitulo} description={GLOBAL.indisponivelTexto} />
    </div>
  );
}
