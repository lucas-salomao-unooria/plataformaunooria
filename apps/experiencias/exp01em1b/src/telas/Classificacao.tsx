import { useState } from "react";
import { AlertBox, Button, PuzzleBlock, PuzzleTrack } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { TEXTOS } from "../lib/textos";
import { COLUNAS, type Cartao, type ClassificacaoValor, type Coluna } from "../lib/tipos";

/**
 * E5-ALU-01 — Explicar, parte 1: os 6 cartões da sessão técnica entre "Dados
 * Fornecidos" e "Dados Observados" (`PuzzleTrack` + `PuzzleBlock` do DS, por
 * TOQUE: toca o cartão, depois "Colocar em …"; tocar um cartão já colocado o
 * devolve à bandeja).
 *
 * - Com scaffolding: enquanto nada foi colocado, o 1º cartão leva a tag
 *   "Cartão 1" e a coluna da esquerda diz "[Solte o cartão aqui]".
 * - Incompleta: o aviso do PO; o envio segue (a régua só registra).
 * - A tela NÃO sabe a coluna certa (regra 3): manda a alocação e o servidor
 *   devolve se a tabela causal aparece (`classificacao.cadeiaCausal`), que a
 *   tela seguinte mostra.
 */
export function Classificacao({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const [alocacao, setAlocacao] = useState<ClassificacaoValor>(() => ({ ...(estado.classificacao?.cartoes ?? {}) }));
  const [selecionado, setSelecionado] = useState<Cartao | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cartoes = sessao.material.cartoes;
  const rotulo = (id: Cartao) => cartoes.find((c) => c.id === id)?.rotulo ?? id;
  const colocados = cartoes.filter((c) => alocacao[c.id]).length;
  const naBandeja = cartoes.filter((c) => !alocacao[c.id]);
  const comScaffolding = colocados === 0;

  function colocar(coluna: Coluna) {
    if (!selecionado) return;
    setAlocacao((a) => ({ ...a, [selecionado]: coluna }));
    setSelecionado(null);
  }

  function devolver(id: Cartao) {
    setAlocacao((a) => {
      const nova = { ...a };
      delete nova[id];
      return nova;
    });
  }

  async function concluir() {
    setEnviando(true);
    await executar(() => api.cartoes(alocacao), "cartoes");
    setEnviando(false);
  }

  return (
    <Casca etapas={{ atual: 5, janela: [3, 4, 5, 6] }} equipe={estado.equipe}>
      <p className="escola__instrucao">{estado.equipe ? TEXTOS.e5.instrucaoDaEquipe : TEXTOS.e5.instrucao}</p>
      <div className="trilhas">
        {COLUNAS.map((coluna) => {
          const nestes = cartoes.filter((c) => alocacao[c.id] === coluna);
          const nome = TEXTOS.e5.colunas[coluna];
          return (
            <div key={coluna} className="trilhas__coluna">
              <PuzzleTrack
                label={TEXTOS.e5.colunaComTotal(nome, nestes.length)}
                theme="light"
                slots={[
                  ...nestes.map((c) => (
                    <PuzzleBlock key={c.id} label={c.rotulo} state="placed" theme="light" onClick={() => devolver(c.id)} />
                  )),
                  null,
                ]}
                emptySlotLabel={() => TEXTOS.e5.solte}
                status={comScaffolding && coluna === "fornecidos" ? TEXTOS.e5.solte : undefined}
              />
              {/* (b) COMPENSAÇÃO de interação: a vaga do `PuzzleTrack` não é tocável nem recebe soltura; o alvo do toque é este botão. */}
              <Button variant="outline" size="sm" fullWidth disabled={!selecionado} onClick={() => colocar(coluna)}>
                {TEXTOS.e5.colocarEm(nome)}
              </Button>
            </div>
          );
        })}
      </div>

      {naBandeja.length > 0 && (
        <section aria-label={TEXTOS.e5.cartoes} className="escola__lista">
          <h2 className="escola__subtitulo">{TEXTOS.e5.cartoes}</h2>
          {estado.equipe && <p className="escola__dica">{TEXTOS.e5.selecione}</p>}
          <ul className="bandeja">
            {naBandeja.map((c, i) => (
              <li key={c.id}>
                <PuzzleBlock
                  label={c.rotulo}
                  description={comScaffolding && i === 0 ? TEXTOS.e5.cartao1 : undefined}
                  state="idle"
                  theme="light"
                  aria-pressed={selecionado === c.id}
                  className={selecionado === c.id ? "bandeja__selecionado" : undefined}
                  onClick={() => setSelecionado((s) => (s === c.id ? null : c.id))}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {colocados > 0 && colocados < cartoes.length && (
        <AlertBox variant="warning" device="mobile" theme="light" description={TEXTOS.e5.incompleta} />
      )}
      <Button variant="primary" size="lg" fullWidth isLoading={enviando || ctx.naFila("cartoes")} onClick={() => void concluir()}>
        {TEXTOS.e5.concluir}
      </Button>
      <span className="so-leitor" aria-live="polite">
        {selecionado ? rotulo(selecionado) : ""}
      </span>
    </Casca>
  );
}
