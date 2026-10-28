import { useState } from "react";
import { Button, Card, CardContent, Tag } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import { Falas } from "../componentes/PecasDoAssistente";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { roteiroDoReteste } from "../lib/roteiro";
import { TEXTOS } from "../lib/textos";

/**
 * E5-ALU-04 — o resultado do reteste, que o SERVIDOR calculou
 * (`ultimoReteste`): "Homologação Aprovada" leva a "Avançar para Homologação
 * e Transparência"; o "Alerta de Viés Mantido" oferece "Revisar Critérios"
 * (volta ao banco) ou "Avançar para Publicação" (segue com o viés — o Canal A
 * registra). Depois de avançar, a Trava 2 (E5-SIS-01) é do despachante.
 *
 * O efeito no chat (Beatriz avançada / Thiago livre) é a PEÇA do UnooriaAI
 * (`Falas`), dentro da tela da escola, e vem DEPOIS dos botões: o Figma tem
 * só o resultado e os botões, que ficam à vista em 375×812 (antes o efeito os
 * empurrava para baixo da dobra).
 *
 * "Avançar para Homologação e Transparência" é o `Button` `md` (1.0.5): no
 * `lg` (18px) o rótulo tem quase 343px e encostava nas bordas do botão, sem
 * o recuo; o `md` (16px) é o tamanho do Figma e mantém o recuo do DS.
 */
export function Reteste({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const [enviando, setEnviando] = useState<"revisar" | "avancar" | null>(null);
  const r = estado.ultimoReteste;
  const aprovado = r?.equidade === "total";

  async function revisar() {
    setEnviando("revisar");
    await executar(() => api.revisarReteste(), "reteste-revisar");
    setEnviando(null);
  }

  async function avancar() {
    setEnviando("avancar");
    await executar(() => api.avancarReteste(), "reteste-avancar");
    setEnviando(null);
  }

  return (
    <Casca cabecalho={{ titulo: TEXTOS.e5.reteste, tag: aprovado ? TEXTOS.e5.resultado : TEXTOS.e5.atencao }} equipe={estado.equipe}>
      <Card variant="outlined">
        <CardContent>
          <div className="escola__pilha-curta" role="status">
            <Tag variant={aprovado ? "success" : "warning"} size="sm">
              {aprovado ? TEXTOS.e5.homologada : TEXTOS.e5.alerta}
            </Tag>
            <p className="escola__destaque">{aprovado ? TEXTOS.e5.aprovada : TEXTOS.e5.alertaTexto}</p>
            {aprovado && <p className="escola__texto escola__texto--suave">{TEXTOS.e5.semRestricao}</p>}
          </div>
        </CardContent>
      </Card>
      {aprovado ? (
        <Button variant="primary" size="md" fullWidth isLoading={enviando === "avancar"} onClick={() => void avancar()}>
          {TEXTOS.e5.avancarAprovado}
        </Button>
      ) : (
        <>
          <Button variant="secondary" size="lg" fullWidth isLoading={enviando === "revisar"} disabled={enviando !== null} onClick={() => void revisar()}>
            {TEXTOS.e5.revisar}
          </Button>
          <Button variant="ghost" size="lg" fullWidth isLoading={enviando === "avancar"} disabled={enviando !== null} onClick={() => void avancar()}>
            {TEXTOS.e5.avancarComAlerta}
          </Button>
        </>
      )}
      {r && sessao.pacote && (
        <section className="efeito-no-chat" aria-label={TEXTOS.e5.efeitoNoChat}>
          <h2 className="escola__subtitulo">{TEXTOS.e5.efeitoNoChat}</h2>
          <div className="previa-uai">
            <Falas falas={roteiroDoReteste(sessao.pacote.conteudo, sessao.material, r)} />
          </div>
        </section>
      )}
    </Casca>
  );
}
