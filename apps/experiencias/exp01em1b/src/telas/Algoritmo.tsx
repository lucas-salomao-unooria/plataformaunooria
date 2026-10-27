import { useState } from "react";
import { Button, Card, CardContent, Checkbox, Collapse, Tag } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { otimizacao, TEXTOS } from "../lib/textos";
import type { PassoDoAlgoritmo } from "../lib/tipos";

/**
 * E5-ALU-02 — Explicar, parte 2 (OPCIONAL, EM13CO03): o `Collapse`
 * "[Opcional / Aprofundamento] …" com os 5 passos do algoritmo em `Checkbox`.
 *
 * - Abrir o painel é o PQ-04 (`POST /algoritmo/abrir`).
 * - Ao marcar, o passo marcado ganha "(Inferência dispensável)" e o não
 *   marcado "(Essencial)": é o rótulo DO ESTUDANTE, não o gabarito. A linha
 *   "Otimização: de 5 para N passos essenciais" usa N = 5 − marcados.
 * - "Pular Etapa" fecha o painel (o pedido do Vinicius de poder pular).
 *
 * No topo, a tabela causal que a classificação abriu (quando o servidor diz
 * `cadeiaCausal`).
 */
export function Algoritmo({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const [marcados, setMarcados] = useState<PassoDoAlgoritmo[]>(() => [...estado.algoritmo.marcados]);
  const [enviando, setEnviando] = useState(false);
  const algumMarcado = marcados.length > 0;

  function alternarPainel(aberto: boolean) {
    if (aberto && !estado.algoritmo.aberto) void executar(() => api.abrirAlgoritmo(), "algoritmo-abrir");
  }

  function marcar(id: PassoDoAlgoritmo, marcado: boolean) {
    const novos = (marcado ? [...marcados, id] : marcados.filter((m) => m !== id)).sort((a, b) => a - b);
    setMarcados(novos);
    void executar(() => api.marcarAlgoritmo(novos), "algoritmo-marcar");
  }

  async function pular() {
    setEnviando(true);
    await executar(() => api.concluirAlgoritmo(), "algoritmo-concluir");
    setEnviando(false);
  }

  return (
    <Casca cabecalho={{ titulo: TEXTOS.geral.unooria, tag: TEXTOS.e5.etapaChip }} equipe={estado.equipe}>
      {estado.classificacao?.cadeiaCausal && (
        <Card variant="outlined">
          <CardContent>
            <p className="escola__texto">{TEXTOS.e5.tabelaCausal}</p>
          </CardContent>
        </Card>
      )}
      <Collapse
        variant="bordered"
        size="md"
        theme="light"
        titleAs="h2"
        defaultOpen={estado.algoritmo.aberto}
        leadingIcon={<span aria-hidden="true">{algumMarcado ? "🧩" : "⚙️"}</span>}
        title={TEXTOS.e5.opcional}
        onToggle={alternarPainel}
      >
        <p className="escola__texto">{TEXTOS.e5.marqueAsInstrucoes}</p>
        <div className="escola__lista">
          {sessao.material.passosDoAlgoritmo.map((p) => {
            const marcado = marcados.includes(p.id);
            /* "(Ação enviesada)" só para o passo que o SERVIDOR diz (`enviesados`, já marcado): o bundle não sabe qual é. */
            const rotuloDoMarcado = estado.algoritmo.enviesados.includes(p.id) ? TEXTOS.e5.enviesada : TEXTOS.e5.dispensavel;
            const sufixo = algumMarcado ? ` ${marcado ? rotuloDoMarcado : TEXTOS.e5.essencial}` : "";
            return (
              <Checkbox
                key={p.id}
                theme="light"
                checked={marcado}
                onChange={(v) => marcar(p.id, v)}
                label={`${TEXTOS.e5.iconesDosPassos[p.id] ?? ""} ${TEXTOS.e5.passo(p.id, p.rotulo)}${sufixo}`}
              />
            );
          })}
        </div>
        {algumMarcado && (
          <Tag variant="brand" size="sm">
            {otimizacao(marcados.length)}
          </Tag>
        )}
      </Collapse>
      <Button variant="outline" size="lg" fullWidth isLoading={enviando || ctx.naFila("algoritmo-concluir")} onClick={() => void pular()}>
        {TEXTOS.e5.pular}
      </Button>
    </Casca>
  );
}
