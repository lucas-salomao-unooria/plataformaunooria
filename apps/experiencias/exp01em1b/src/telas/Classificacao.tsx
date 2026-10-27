import { useState } from "react";
import { AlertBox, Button, Card, CardContent, PuzzleBlock, PuzzleTrack } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { TEXTOS } from "../lib/textos";
import { COLUNAS, type Cartao, type ClassificacaoValor, type Coluna } from "../lib/tipos";

/**
 * E5-ALU-01 — Explicar, parte 1: os 6 cartões da sessão técnica entre "Dados
 * Fornecidos" e "Dados Observados" (`PuzzleTrack` + `PuzzleBlock` do DS, por
 * TOQUE: toca o cartão — `selected` — e depois a vaga da coluna, que o
 * `PuzzleTrack` torna acionável com `onSlotActivate` e chama "Colocar em …";
 * tocar um cartão já colocado o devolve à bandeja).
 *
 * - A vaga vazia de cada coluna mostra o texto (`showEmptySlotLabel`, DS
 *   0.2.23), como o Figma desenha: "[Solte o cartão aqui]" enquanto nenhum
 *   cartão está escolhido, e a ação "Colocar em …" com um escolhido — que é
 *   também o nome do botão.
 * - O cartão COLOCADO usa o rótulo curto do Figma ("Trilha Avançada",
 *   "Modelo Aparelho") e quebra só entre palavras: o `PuzzleBlock size="sm"`
 *   do DS 0.2.24 (até a 0.2.23, uma compensação no CSS).
 * - Com scaffolding: enquanto nada foi colocado, o 1º cartão leva a tag
 *   "Cartão 1". Incompleta: o aviso do PO no fim da tela.
 * - **Não há botão de concluir** (o Figma não tem): a classificação FECHA
 *   sozinha quando o sexto cartão é colocado — em qualquer coluna, certo ou
 *   errado; a tela não sabe a coluna certa (regra 3). O servidor grava e
 *   devolve se a tabela causal aparece (`classificacao.cadeiaCausal`), e ela
 *   aparece NESTA tela, sob as colunas (E5-ALU-01 "sem scaffolding"). O
 *   despachante (`App.tsx`) segura a tela fechada o tempo de ler a tabela
 *   antes do painel do algoritmo.
 * - Com equipe (E5-ALU-01 "por aparelho"): "Toque para Selecionar e Alocar"
 *   é o botão secundário no fim, como no Figma; ele escolhe o próximo cartão
 *   da bandeja (o segundo toque, na vaga, aloca).
 */
export function Classificacao({ ctx, fechada = false }: { ctx: Contexto; fechada?: boolean }) {
  const { estado, sessao, executar } = ctx;
  const [alocacao, setAlocacao] = useState<ClassificacaoValor>(() => ({ ...(estado.classificacao?.cartoes ?? {}) }));
  const [selecionado, setSelecionado] = useState<Cartao | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cartoes = sessao.material.cartoes;
  const rotulo = (id: Cartao) => cartoes.find((c) => c.id === id)?.rotulo ?? id;
  const colocados = cartoes.filter((c) => alocacao[c.id]).length;
  const naBandeja = cartoes.filter((c) => !alocacao[c.id]);
  const comScaffolding = colocados === 0;
  const travada = fechada || enviando || ctx.naFila("cartoes");
  const cadeiaCausal = estado.classificacao?.cadeiaCausal === true;

  function colocar(coluna: Coluna) {
    if (!selecionado || travada) return;
    const nova = { ...alocacao, [selecionado]: coluna };
    setAlocacao(nova);
    setSelecionado(null);
    if (cartoes.every((c) => nova[c.id])) void fechar(nova);
  }

  function devolver(id: Cartao) {
    if (travada) return;
    setAlocacao((a) => {
      const nova = { ...a };
      delete nova[id];
      return nova;
    });
  }

  /** O sexto cartão fecha a classificação: grava no servidor, que devolve a tabela causal. */
  async function fechar(valor: ClassificacaoValor) {
    setEnviando(true);
    await executar(() => api.cartoes(valor), "cartoes");
    setEnviando(false);
  }

  /** "Toque para Selecionar e Alocar" (equipe): escolhe o próximo cartão da bandeja. */
  function proximoDaBandeja() {
    if (naBandeja.length === 0) return;
    const i = selecionado ? naBandeja.findIndex((c) => c.id === selecionado) : -1;
    setSelecionado(naBandeja[(i + 1) % naBandeja.length]!.id);
  }

  return (
    <Casca equipe={estado.equipe}>
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
                    <PuzzleBlock
                      key={c.id}
                      label={TEXTOS.e5.rotuloCurto[c.id] ?? c.rotulo}
                      state="placed"
                      size="sm"
                      aria-disabled={travada || undefined}
                      theme="light"
                      onClick={() => devolver(c.id)}
                    />
                  )),
                  ...(naBandeja.length > 0 ? [null] : []),
                ]}
                emptySlotLabel={() => (selecionado ? TEXTOS.e5.colocarEm(nome) : TEXTOS.e5.solte)}
                showEmptySlotLabel
                onSlotActivate={() => colocar(coluna)}
                slotsDisabled={!selecionado || travada}
              />
            </div>
          );
        })}
      </div>

      {naBandeja.length > 0 && (
        <section aria-label={TEXTOS.e5.cartoes} className="escola__lista">
          <h2 className="escola__subtitulo">{TEXTOS.e5.cartoes}</h2>
          <ul className="bandeja">
            {naBandeja.map((c, i) => (
              <li key={c.id}>
                <PuzzleBlock
                  label={c.rotulo}
                  description={comScaffolding && i === 0 ? TEXTOS.e5.cartao1 : undefined}
                  state="idle"
                  theme="light"
                  selected={selecionado === c.id}
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

      {naBandeja.length === 0 && cadeiaCausal && (
        <Card variant="outlined">
          <CardContent>
            <p className="escola__texto" role="status" data-testid="tabela-causal">
              <strong>{TEXTOS.e5.tabelaCausalTitulo}</strong> {TEXTOS.e5.tabelaCausal}
            </p>
          </CardContent>
        </Card>
      )}

      {estado.equipe && naBandeja.length > 0 && (
        <Button variant="secondary" size="lg" fullWidth disabled={travada} onClick={proximoDaBandeja}>
          {TEXTOS.e5.selecione}
        </Button>
      )}
      <span className="so-leitor" aria-live="polite">
        {selecionado ? rotulo(selecionado) : ""}
      </span>
    </Casca>
  );
}
