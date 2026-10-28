import { Card } from "@edu/ui/ds";
import { E3 } from "../../lib/textos";

/**
 * A "Meta de Nina" (E3-ALU-02): as três coberturas da feira em molduras —
 * as encontradas "✔ Presente", a que o filtro deixou de fora TRACEJADA
 * ("Notícia não encontrada"). E o quadro "Sua escolha travada" ao lado.
 *
 * (b) COMPENSAÇÃO — sem par no DS: a moldura é recuo e fio (sólido ou
 * tracejado) com tokens `--unooria-*` (`.moldura`); a forma do fio diz
 * presente/ausente sem depender de cor. `Card` da seção em volta.
 */
export function MetaDaNina({ coberturas }: { coberturas: readonly { nome: string; presente: boolean }[] }) {
  return (
    <Card variant="outlined" className="meta">
      <h2 className="rotulo-de-secao">{E3.metaDaNina}</h2>
      <ul className="meta__molduras">
        {coberturas.map((c) => (
          <li key={c.nome} className={`moldura${c.presente ? "" : " moldura--ausente"}`}>
            <strong>{c.nome}</strong>
            <span>{c.presente ? `✔ ${E3.presente}` : E3.naoEncontrada}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function SuaEscolha({ quantas, nomes }: { quantas: number; nomes: string }) {
  return (
    <Card variant="outlined" className="sua-escolha">
      <h2 className="rotulo-de-secao">{E3.suaEscolha}</h2>
      <p className="sua-escolha__contagem">
        <span aria-hidden="true" className="sua-escolha__bolinhas">
          {Array.from({ length: quantas }, (_, i) => (
            <span key={i} className="sua-escolha__bolinha" />
          ))}
        </span>
        {E3.prometidas(quantas)}
      </p>
      <p className="sua-escolha__nomes">{nomes}</p>
    </Card>
  );
}
