import { AssistantCard, ChatBubble, SessionDivider } from "@edu/ui/ds-unooriaai";
import type { Fala } from "../lib/roteiro";
import type { ConteudoDoPacote, Funcao } from "../lib/tipos";

/**
 * As PEÇAS do UnooriaAI que aparecem dentro de telas da escola (ADR-117 e
 * ADR-173: a peça imitada fala na voz de onde veio, e SÓ a peça importa a
 * ponte do clone). O cromo em volta — a casca, o cabeçalho, os botões — é
 * `unooria`; aqui não entra barra, composer nem fundo do app.
 *
 * - `PreviaDoAssistente` (E2-ALU-01): a prévia ESTÁTICA de cada função no
 *   UnooriaAI, com o conteúdo do pacote da turma. Sem pista de triagem.
 * - `Falas`: as falas roteirizadas (a simulação inteira e o efeito do reteste).
 *
 * A seção lê `data-uai-theme` na raiz (o `main.tsx` põe "light").
 */
export function Falas({ falas }: { falas: readonly Fala[] }) {
  return (
    <>
      {falas.map((f, i) => {
        if (f.tipo === "separador") {
          return <SessionDivider key={i} label={f.texto} />;
        }
        if (f.tipo === "cartao") {
          return <AssistantCard key={i} name={f.titulo} description={f.texto} initial="U" block />;
        }
        return (
          <ChatBubble key={i} role={f.tipo === "estudante" ? "user" : "assistant"}>
            {f.texto}
          </ChatBubble>
        );
      })}
    </>
  );
}

export function PreviaDoAssistente({ funcao, conteudo, rotulo }: { funcao: Funcao; conteudo: ConteudoDoPacote | null; rotulo: string }) {
  return (
    <figure className="previa-uai" aria-label={rotulo}>
      <figcaption className="previa-uai__rotulo">UnooriaAI</figcaption>
      {conteudo && funcao === "exercicios" && (
        <>
          <AssistantCard name={conteudo.trilhaAvancada.titulo} description={conteudo.trilhaAvancada.enunciado} initial="A" block />
          <AssistantCard name={conteudo.reforcoBasico.titulo} description={conteudo.reforcoBasico.enunciado} initial="B" block />
        </>
      )}
      {conteudo && funcao === "duvidas" && (
        <>
          <ChatBubble role="user">{conteudo.duvidas.lucas}</ChatBubble>
          <ChatBubble role="assistant">{conteudo.respostas.lucas}</ChatBubble>
        </>
      )}
      {conteudo && funcao === "sugestoes" && <AssistantCard name={conteudo.leitura.titulo} description={conteudo.leitura.resumo} initial="L" block />}
    </figure>
  );
}
