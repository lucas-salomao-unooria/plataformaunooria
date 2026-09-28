import { useState } from "react";
import { Button, RadioGroup, ScrollBar } from "@edu/ui/ds";
import { MOTIVO, REDACAO } from "../../lib/textos";
import { MOTIVOS, type Motivo } from "../../lib/tipos";
import { Cabecalho } from "./cabecalho";

/**
 * A pergunta de motivo — DEPOIS do latch da 1ª edição, e antes de a criança
 * ver o resultado (decisão de 2026-09-25).
 *
 * No PRD ela morava dentro do modal de publicar. Saiu de lá porque perguntar
 * "vocês escolheram pelas fotos ou checaram?" ANTES de publicar anteciparia a
 * descoberta (PDF §4: "também não perguntamos se ele escolheu pela beleza ou
 * pela confiabilidade"). Depois do latch ela não muda a edição — só registra
 * como a dupla ACHA que escolheu, e é isso que o painel do professor agrega.
 * Antes do resultado, senão a resposta sai contaminada pela consequência.
 *
 * Uma vez só: a api responde 409 na segunda, e a casca relê a sessão.
 */
export function TelaDeMotivo({ enviando, aoEnviar }: { enviando: boolean; aoEnviar: (motivo: Motivo) => void }) {
  const [escolha, setEscolha] = useState<Motivo | null>(null);
  return (
    <div className="tela">
      <Cabecalho titulo={REDACAO.nome} />
      <ScrollBar className="rolagem" autoHide>
        <div className="tela__corpo opcoes-amplas">
          <RadioGroup
            name="motivo"
            label={MOTIVO.pergunta}
            size="lg"
            value={escolha ?? ""}
            disabled={enviando}
            options={MOTIVOS.map((m) => ({ value: m, label: MOTIVO.opcoes[m] }))}
            onChange={(v) => setEscolha(v === "visual" || v === "checagem" ? v : null)}
          />
        </div>
      </ScrollBar>
      <div className="tela__acao">
        <Button
          size="lg"
          fullWidth
          className="acao-crianca"
          disabled={escolha === null}
          isLoading={enviando}
          onClick={() => {
            if (escolha) aoEnviar(escolha);
          }}
        >
          {MOTIVO.enviar}
        </Button>
      </div>
    </div>
  );
}
