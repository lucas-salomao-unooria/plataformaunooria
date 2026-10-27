import { Aviso } from "../componentes/Aviso";
import type { Contexto } from "../contexto";
import { textoDe } from "../lib/textos";

/**
 * O FIM (`E5-ALU-02`, foto salva): "FOTO GUARDADA NO ÁLBUM!" e "MISSÃO
 * CUMPRIDA!". O "Colocar no álbum" conclui a missão (ADR-186: a etapa 6 saiu);
 * a conversa que vem depois — ENQUADRAMENTO, AUTORIA, O QUE FICOU DE FORA — é
 * do professor, oral. Sem botão: não há para onde ir.
 */
export function Concluida({ ctx }: { ctx: Contexto }) {
  const { sessao } = ctx;
  return (
    <section className="concluida">
      <Aviso aberto icone="check" titulo={textoDe(sessao.textos, "e5", "guardada")}>
        <p className="concluida__fim">{textoDe(sessao.textos, "e5", "fim")}</p>
        <p className="aviso__texto">{textoDe(sessao.textos, "e5", "fimTexto")}</p>
      </Aviso>
    </section>
  );
}
