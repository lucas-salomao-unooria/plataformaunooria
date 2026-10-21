import { Button, ChatBubble } from "@edu/ui/ds-chatgpt";
import { CLONE } from "../../lib/textos";
import type { ClausulaPublica } from "../../lib/tipos";

/**
 * E3-ALU-01 — o PICO. **Seção `chatgpt`.**
 *
 * Teto estrito de cinco elementos na tela: a concessão da máquina, a instrução
 * e as quatro cláusulas. **Amara está 100% ausente** e não há barra de
 * progresso, dica nem tutorial — o silêncio é o não-negociável 3, e é o que faz
 * a escolha pesar.
 *
 * A exclusividade é do NAVEGADOR, não de JavaScript: quatro
 * `<input type="radio">` com o mesmo `name` dentro de `<label>`. Isso dá de
 * graça a cardinalidade 1, a navegação por seta e o anúncio "2 de 4" do leitor
 * de tela — três coisas que uma lista de `<div onClick>` teria de reimplementar,
 * e a terceira ninguém reimplementa.
 *
 * O cartão selecionável é compensação MARCADA (ver `globals.css`): a seção
 * `chatgpt` tem `GPTCard` para grade de agentes e `Tag` para etiqueta curta,
 * mas nenhum cartão com estado de seleção e corpo longo.
 */
export function Decisao({
  concessao,
  clausulas,
  selecionada,
  habilitado,
  enviando,
  aguardandoConfirmacao,
  onSelecionar,
  onSubmeter,
}: {
  concessao: string;
  clausulas: ClausulaPublica[];
  selecionada: string | null;
  habilitado: boolean;
  enviando: boolean;
  /** O caminho degenerado: clique em menos de 5s pede o segundo toque. */
  aguardandoConfirmacao: boolean;
  onSelecionar: (id: string) => void;
  onSubmeter: () => void;
}) {
  return (
    <div className="miolo">
      <div className="decisao">
        <ChatBubble role="assistant" avatarInitials="AI" className="fala--assistant">
          {concessao}
        </ChatBubble>

        {/* `fieldset` + `legend`: é o que faz o leitor de tela anunciar a
            pergunta antes das quatro opções. Um `<p>` acima do grupo seria lido
            uma vez e esquecido na navegação por seta. */}
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="seletor__instrucao" style={{ marginBottom: 12 }}>
            {CLONE.instrucaoDaClausula}
          </legend>

          <div className="decisao__grade">
            {clausulas.map((clausula) => (
              <label key={clausula.id} className="clausula" data-clausula={clausula.id}>
                <span className="clausula__cabeca">
                  <input
                    type="radio"
                    name="clausula"
                    value={clausula.id}
                    checked={selecionada === clausula.id}
                    onChange={() => onSelecionar(clausula.id)}
                  />
                  <span className="clausula__titulo">{clausula.tituloClausula}</span>
                </span>
                <span className="clausula__artigo">{clausula.artigoTexto}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/*
          A réplica provocativa do caminho degenerado "exploração mínima".

          O sistema ACEITA a escolha — não frustrar é regra da spec —, mas a
          máquina devolve uma provocação e pede o segundo toque. A escolha vale
          igual; o que muda é que a criança a fez duas vezes.
        */}
        {aguardandoConfirmacao && (
          <ChatBubble role="assistant" avatarInitials="AI" className="fala--assistant">
            {CLONE.provocacaoMinima}
          </ChatBubble>
        )}

        <div className="decisao__rodape">
          <Button
            variant="primary"
            disabled={!habilitado}
            onClick={onSubmeter}
            data-acao="submeter-clausula"
          >
            {enviando
              ? "Fixando diretriz…"
              : aguardandoConfirmacao
                ? CLONE.confirmarPrioridade
                : CLONE.submeterClausula}
          </Button>
        </div>
      </div>
    </div>
  );
}
