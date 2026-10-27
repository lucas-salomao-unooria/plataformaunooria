import { useState } from "react";
import { Button, Card, CardContent } from "@edu/ui/ds";
import { Casca, Zara } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { TEXTOS } from "../lib/textos";

/**
 * E1-ALU-01 — Desafiar: a Zara apresenta o UnooriaAI em teste e o
 * job-to-be-done da comissão. A configuração B-B-A já está no ar (no
 * servidor); nada de regra ou critério aparece aqui.
 *
 * "Primeira vez" (borda de destaque, "1EM · Homologação", "Zara (Comissão
 * Estudantil)") é quem chega à missão nesta aba; "padrão" é quem volta a ela.
 * A trava 0 (E1-PROF-01 "Liberar Início dos Testes") é a camada de espera
 * por cima, do despachante — o botão fica atrás dela.
 */
export function BoasVindas({ ctx, primeiraVez }: { ctx: Contexto; primeiraVez: boolean }) {
  const { estado, executar } = ctx;
  const [enviando, setEnviando] = useState(false);

  async function abrir() {
    setEnviando(true);
    await executar(() => api.iniciar(), "iniciar");
    setEnviando(false);
  }

  return (
    <Casca
      cabecalho={{ titulo: TEXTOS.e1.cabecalho, tag: primeiraVez ? TEXTOS.e1.tagPrimeiraVez : TEXTOS.e1.tagPadrao }}
      equipe={estado.equipe}
    >
      <Card variant={primeiraVez ? "elevated" : "outlined"} className={primeiraVez ? "cartao-destaque" : undefined}>
        <CardContent>
          <Zara rotulo={estado.equipe ? TEXTOS.geral.zaraDaEquipe : primeiraVez ? TEXTOS.geral.zaraDaComissao : TEXTOS.geral.zara}>
            {TEXTOS.e1.fala}
          </Zara>
          <p className="escola__texto">{TEXTOS.e1.instrucao}</p>
        </CardContent>
      </Card>
      <Button variant="primary" size="lg" fullWidth isLoading={enviando || ctx.naFila("iniciar")} onClick={() => void abrir()}>
        {TEXTOS.e1.abrir}
      </Button>
    </Casca>
  );
}
