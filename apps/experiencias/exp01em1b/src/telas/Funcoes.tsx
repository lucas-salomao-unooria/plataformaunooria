import { useState } from "react";
import { Button, Collapse } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import { PreviaDoAssistente } from "../componentes/PecasDoAssistente";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { TEXTOS } from "../lib/textos";
import { FUNCOES, type Funcao } from "../lib/tipos";

/**
 * E2-ALU-01 — Navegar: as três funções do assistente em `Collapse`, cada uma
 * com a descrição LONGA e a prévia estática no UnooriaAI (a peça do clone,
 * `PreviaDoAssistente`). A função vista ganha "✓" no título e, RECOLHIDA,
 * o resumo do Figma sob ele (E2-ALU-01 "habilitado"); aberta, vale a
 * descrição longa do corpo.
 *
 * "Ir para Bateria de Testes" só acende depois de pelo menos UMA função
 * expandida (recolhido → expandido → habilitado). Com equipe, a mesma regra.
 */
export function Funcoes({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const [abertas, setAbertas] = useState<Set<Funcao>>(() => new Set(estado.funcoesAbertas));
  /** As que estão ABERTAS agora (o resumo só aparece com a função recolhida). */
  const [abertasAgora, setAbertasAgora] = useState<Set<Funcao>>(() => new Set());
  const [enviando, setEnviando] = useState(false);

  function alternar(funcao: Funcao, aberta: boolean) {
    setAbertasAgora((atual) => {
      const nova = new Set(atual);
      if (aberta) nova.add(funcao);
      else nova.delete(funcao);
      return nova;
    });
    if (!aberta) return;
    setAbertas((atual) => (atual.has(funcao) ? atual : new Set(atual).add(funcao)));
  }

  async function ir() {
    setEnviando(true);
    await executar(() => api.navegar(FUNCOES.filter((f) => abertas.has(f))), "navegar");
    setEnviando(false);
  }

  return (
    <Casca equipe={estado.equipe}>
      <p className="escola__instrucao">{TEXTOS.e2.instrucao}</p>
      <div className="escola__lista">
        {FUNCOES.map((f) => (
          <Collapse
            key={f}
            variant="bordered"
            size="md"
            theme="light"
            titleAs="h2"
            title={abertas.has(f) ? `${TEXTOS.e2.titulos[f]} ✓` : TEXTOS.e2.titulos[f]}
            subtitle={abertas.has(f) && !abertasAgora.has(f) ? TEXTOS.e2.resumos[f] : undefined}
            onToggle={(aberta) => alternar(f, aberta)}
          >
            <p className="escola__texto">{TEXTOS.e2.descricoes[f]}</p>
            <PreviaDoAssistente funcao={f} conteudo={sessao.pacote?.conteudo ?? null} rotulo={TEXTOS.e2.previa[f]} />
          </Collapse>
        ))}
      </div>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={abertas.size === 0}
        isLoading={enviando || ctx.naFila("navegar")}
        onClick={() => void ir()}
      >
        {TEXTOS.e2.ir}
      </Button>
    </Casca>
  );
}
