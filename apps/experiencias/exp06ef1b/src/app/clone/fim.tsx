import { Card, CardContent, CardDescription, CardHeader, CardTitle, Icon } from "@edu/ui/ds";
import { IconUnv } from "@edu/ui/ds-unoovista";
import { FIM } from "../../lib/textos";
import { Cabecalho } from "./cabecalho";

/**
 * E6-ALU-03 — a conclusão. Duas vozes, e a fronteira entre elas é VISÍVEL
 * (PRD §10.1):
 *
 * - **a comissão, no Unoovista** (casca móvel): o carimbo, o título e o
 *   subtítulo de repouso;
 * - **a Unooria** (`@edu/ui/ds`): o infográfico silencioso, um `Card` da
 *   plataforma numa faixa própria (`.fim__escola`, fundo e fonte da seção
 *   `unooria`), abaixo da comissão. Não é a plataforma vestida de app: é a
 *   escola tomando a palavra depois que a ficção encerrou — a mesma regra da
 *   tela da regra SE … ENTÃO, que leva até aqui.
 *
 * Não há botão: a missão acabou, e o hub já recebeu o `concluir`.
 */
export function Fim() {
  return (
    <div className="tela">
      <h1 className="so-leitor">{FIM.titulo}</h1>
      <Cabecalho />
      <div className="rolagem rolagem--sem-barra fim">
        <div className="fim__comissao" role="status">
          <IconUnv name="verified" size={56} tone="link" />
          <p className="fim__titulo">{FIM.titulo}</p>
          <p className="fim__subtitulo">{FIM.subtitulo}</p>
        </div>
        <section className="fim__escola" aria-label={FIM.infograficoTitulo}>
          <Card variant="outlined" theme="light">
            <CardHeader icon={<Icon name="lightbulb" />} />
            <CardContent>
              <CardTitle as="h2" size="md">
                {FIM.infograficoTitulo}
              </CardTitle>
              <CardDescription>{FIM.infograficoCorpo}</CardDescription>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
