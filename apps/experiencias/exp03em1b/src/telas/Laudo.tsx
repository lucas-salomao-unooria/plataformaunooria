import { useEffect, useRef, useState } from "react";
import { Button, Card, CardContent, CardHeader, Collapse, Icon, MetricCard, ScrollBar, Slider, Tag } from "@edu/ui/ds";
import { REGUA, descricaoDoGrafico, fatorDeMentira, formatarFator, numeroBr, valorDaDemonstracao } from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { SessaoPreparada } from "../lib/tipos";
import { GraficoDoBoletim } from "./GraficoDoBoletim";

const CICLO_MS = 2400;
const CICLOS = 2;

/**
 * E5-ALU-01 — o laudo de auditoria. Aqui quem fala é a ESCOLA (`@edu/ui/ds`, a
 * seção `unooria`), não o mensageiro: é a revelação formal, e a tela não
 * importa nada do clone (`contrato.test.ts`).
 *
 * A desmontagem (TC-20/21), o Fator de Mentira "≈ 6,3" (`MetricCard`), a
 * fórmula dobrada (`Collapse`, ~46,7% ÷ ~7,37%) e a régua do eixo (`Slider`,
 * 0 a 80) que redesenha o MESMO gráfico do boletim e recalcula LF(o) =
 * 95 / (95 − o). A demonstração do gesto (2 ciclos, [D0-5]) corre ao abrir e
 * para no primeiro toque; com `prefers-reduced-motion`, não corre.
 */
export function Laudo({ sessao, ocupado, aoAvancar }: { sessao: SessaoPreparada; ocupado: boolean; aoAvancar: () => void }) {
  const t = sessao.textos.laudo;
  const serie = sessao.conteudo.servico.serie;
  const barras = serie.map((p) => ({ rotulo: p.periodo, valor: p.valor }));
  const primeiro = serie[0]?.valor ?? 95;
  const [origem, setOrigem] = useState<number>(REGUA.minimo);
  const [demonstrando, setDemonstrando] = useState(false);
  const quadro = useRef<number | null>(null);

  useEffect(() => {
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduzido) return;
    setDemonstrando(true);
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = agora - inicio;
      setOrigem(valorDaDemonstracao(t, CICLO_MS, CICLOS));
      if (t < CICLO_MS * CICLOS) quadro.current = requestAnimationFrame(passo);
      else setDemonstrando(false);
    };
    quadro.current = requestAnimationFrame(passo);
    return () => {
      if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    };
  }, []);

  const mover = (v: number) => {
    if (demonstrando && quadro.current !== null) {
      cancelAnimationFrame(quadro.current);
      setDemonstrando(false);
    }
    setOrigem(v);
  };

  const fator = formatarFator(fatorDeMentira(origem, primeiro));

  return (
    <ScrollBar className="escola" height="100%" autoHide theme="light">
      <div className="escola__pilha" data-tela="laudo">
        <Card variant="outlined">
          <CardHeader
            icon={<Icon name="fact_check" />}
            tag={<Tag variant="brand" size="sm">{TEXTOS.laudo.marca}</Tag>}
            title={t.titulo}
          />
          <CardContent>
            <p className="escola__fala">{t.desmontagem}</p>
          </CardContent>
        </Card>

        <MetricCard
          title={TEXTOS.laudo.metrica}
          value={t.fator}
          description={TEXTOS.laudo.metricaDescricao(t.variacaoVisual, t.variacaoReal)}
        />

        <Collapse title={TEXTOS.laudo.comoCalcula} variant="bordered">
          <p className="escola__fala">{t.fatorDeMentira}</p>
        </Collapse>

        <Card variant="outlined">
          <CardContent>
            <div className="regua">
              <figure className="regua__grafico" role="img" aria-label={descricaoDoGrafico(barras, origem, 100, "%")}>
                <GraficoDoBoletim barras={barras} origem={origem} teto={100} />
              </figure>
              <Slider
                label={t.regua.instrucao}
                value={origem}
                onChange={mover}
                min={REGUA.minimo}
                max={REGUA.maximo}
                step={REGUA.passo}
                origin={REGUA.minimo}
                minLabel={t.regua.minimo}
                maxLabel={t.regua.maximo}
                ticks={[0, 80]}
                formatValue={TEXTOS.laudo.valorDaRegua}
              />
              <p className="escola__comando" aria-live="polite" data-fator={fator}>
                {TEXTOS.laudo.leitura(numeroBr(origem), fator)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Button variant="primary" size="lg" fullWidth disabled={ocupado} onClick={aoAvancar}>
          {t.acao}
        </Button>
      </div>
    </ScrollBar>
  );
}
