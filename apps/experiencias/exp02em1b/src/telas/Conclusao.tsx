import { TEXTOS } from "../lib/textos";

/**
 * O fim (seção `unooria`): a escola fala de novo. Sem etapa de transferência e
 * sem perguntas (decisão do PO, 2026-10-22); o podcast de recapitulação é
 * tocado pelo professor na aula, depois do debate.
 */
export function Conclusao() {
  return (
    <main className="app app--centrado escola">
      <div className="cartao">
        <h1 className="cartao__titulo">{TEXTOS.conclusao.titulo}</h1>
        <p className="cartao__texto">{TEXTOS.conclusao.mensagem}</p>
      </div>
    </main>
  );
}
