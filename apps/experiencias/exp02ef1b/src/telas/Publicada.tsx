import { Aviso } from "../componentes/Aviso";
import type { Contexto } from "../contexto";
import { textoDe } from "../lib/textos";

/**
 * "CAPA PUBLICADA!" (`E3-ALU-02`): o aviso entre o LATCH 1 e o feed. O passo do
 * servidor já é `feed` (ou `invariantes`, se a turma já virou); quem segura
 * esta tela até o toque em IR PARA O FEED é o despachante — um F5 a pula, de
 * propósito: a capa já foi.
 */
export function Publicada({ ctx, aoIr }: { ctx: Contexto; aoIr: () => void }) {
  const { sessao } = ctx;
  return (
    <section className="publicada">
      <Aviso
        aberto
        icone="check"
        titulo={textoDe(sessao.textos, "e3", "publicada")}
        texto={textoDe(sessao.textos, "e3", "publicadaTexto")}
        acao={`${textoDe(sessao.textos, "e3", "irParaOFeed")} ▶`}
        aoAgir={aoIr}
      />
    </section>
  );
}
