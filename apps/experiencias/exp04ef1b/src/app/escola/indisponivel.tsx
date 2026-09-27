import { AlertBox, Button } from "@edu/ui/ds";
import { ERROS, ESCOLA } from "../../lib/textos";

/**
 * 403 — a guarda de liberação (ADR-69) ou o interruptor da rede (ADR-87). O
 * SDK não entrega o corpo do erro e os dois 403 chegam iguais; a frase serve
 * aos dois: a criança não fez nada de errado, e a saída é o professor.
 */
export function Indisponivel() {
  return (
    <div className="tela tela--centrada">
      <AlertBox
        variant="info"
        theme="light"
        device="mobile"
        role="status"
        title={ESCOLA.indisponivelTitulo}
        description={ESCOLA.indisponivelCorpo}
      />
    </div>
  );
}

/** A abertura que falhou por um motivo que não é a rede (a rede se repete sozinha). */
export function NaoAbriu({ aoTentar }: { aoTentar?: () => void }) {
  return (
    <div className="tela tela--centrada">
      <AlertBox variant="warning" theme="light" device="mobile" role="status" title={ERROS.naoAbriu} />
      {aoTentar && (
        <Button variant="outline" size="lg" className="acao-crianca" onClick={aoTentar}>
          {ERROS.tentarNovamente}
        </Button>
      )}
    </div>
  );
}
