import { useEffect, useState } from "react";
import { AlertBox, Button, Card, CardContent, Collapse, RadioGroup, Tag, Toggle } from "@edu/ui/ds";
import { Casca } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { useInatividade } from "../hooks/tela";
import { api } from "../lib/api";
import { telemetria } from "../lib/telemetria";
import { linhaDoBloco, TEXTOS } from "../lib/textos";
import type { Bloco, ComunicadoValor } from "../lib/tipos";

const INATIVIDADE_MS = 90_000;

/**
 * E6-ALU-01 — Refletir: a página pública de transparência (`Toggle`, nasce
 * DESLIGADO) e o comunicado da comissão em 4 blocos de opções fechadas
 * (`RadioGroup`, duas opções cada, na ordem FIXA do servidor — a certa não é
 * marcada).
 *
 * - O GUIA progressivo do Figma: o bloco 1 tem a borda de destaque e o
 *   "▶ Comece aqui"; os blocos 2–4 nascem esmaecidos e desabilitados até o
 *   bloco 1 ser escolhido.
 * - "Blocos preenchidos" (os 4 escolhidos): a tela vira o comunicado montado,
 *   com os trechos escolhidos sublinhados, e "Publicar…", como o quadro. A
 *   página e os blocos se RECOLHEM num `Collapse` fechado ("Revisar página e
 *   blocos", sob o botão) — saem do caminho sem prender quem quer trocar um
 *   bloco ou ligar a página depois.
 * - "Publicar Transparência e Comunicado" é SEMPRE habilitado (o LATCH 2): com
 *   bloco em branco, só o aviso do PO. Não há aviso de bloco "desconexo" — ele
 *   entregaria o gabarito.
 */
export function Publicacao({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const [paginaAtiva, setPaginaAtiva] = useState(false);
  const [comunicado, setComunicado] = useState<ComunicadoValor>({});
  const [enviando, setEnviando] = useState(false);
  const blocos = sessao.material.blocos;
  const preenchidos = blocos.filter((b) => comunicado[b.id]).length;
  const montado = blocos.length > 0 && preenchidos === blocos.length;
  const primeiroEscolhido = blocos.length > 0 && Boolean(comunicado[blocos[0]!.id]);
  const parado = useInatividade(INATIVIDADE_MS, true);

  useEffect(() => {
    if (parado) telemetria.inatividade("publicacao");
  }, [parado]);

  function escolher(bloco: Bloco, opcao: string) {
    setComunicado((c) => ({ ...c, [bloco]: opcao }));
  }

  async function publicar() {
    setEnviando(true);
    await executar(() => api.publicar(paginaAtiva, comunicado), "publicar");
    setEnviando(false);
  }

  const edicao = (
    <>
      <Card variant="outlined">
        <CardContent>
          <Toggle
            size="md"
            theme="light"
            checked={paginaAtiva}
            onChange={(v) => setPaginaAtiva(v)}
            label={TEXTOS.e6.pagina}
            description={TEXTOS.e6.garantia}
            labelPosition="left"
          />
        </CardContent>
      </Card>
      <h2 className="escola__subtitulo">{TEXTOS.e6.comunicado}</h2>
      {blocos.map((b, i) => {
        const espera = i > 0 && !primeiroEscolhido;
        return (
          <Card key={b.id} variant="outlined" className={i === 0 ? "cartao-destaque" : espera ? "bloco--espera" : undefined}>
            <CardContent>
              <section className="bloco" aria-label={b.titulo}>
                <div className="bloco__topo">
                  <h3 className="bloco__titulo">{b.titulo}</h3>
                  {i === 0 && (
                    <Tag variant="neutral" size="sm">
                      {TEXTOS.e6.comeceAqui}
                    </Tag>
                  )}
                </div>
                <RadioGroup
                  name={`bloco-${b.id}`}
                  label={b.inicio}
                  theme="light"
                  disabled={espera}
                  value={comunicado[b.id] ?? ""}
                  onChange={(v) => escolher(b.id, String(v))}
                  options={b.opcoes.map((o) => ({ value: o.id, label: o.texto }))}
                />
              </section>
            </CardContent>
          </Card>
        );
      })}
    </>
  );

  return (
    <Casca etapas={{ atual: 6, janela: [4, 5, 6] }} equipe={estado.equipe}>
      <p className="escola__instrucao">{estado.equipe ? TEXTOS.e6.instrucaoDaEquipe : TEXTOS.e6.instrucao}</p>
      {montado ? (
        <Card variant="outlined" className="cartao-destaque">
          <CardContent>
            <div className="comunicado" aria-live="polite" data-testid="comunicado-montado">
              {blocos.map((b, i) => {
                const opcao = b.opcoes.find((o) => o.id === comunicado[b.id])?.texto ?? "";
                const linha = linhaDoBloco(b.inicio, opcao, i);
                return (
                  <p key={b.id} className="comunicado__linha">
                    <strong>{TEXTOS.e6.rotuloCurto[b.id]}</strong> {linha.antes}
                    <span className="comunicado__trecho">{linha.trecho}</span>
                    {linha.fecho}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        edicao
      )}
      {preenchidos > 0 && !montado && <AlertBox variant="warning" device="mobile" theme="light" description={TEXTOS.e6.incompleto} />}
      <Button variant="primary" size="lg" fullWidth isLoading={enviando || ctx.naFila("publicar")} onClick={() => void publicar()}>
        {TEXTOS.e6.publicar}
      </Button>
      {montado && (
        <Collapse variant="bordered" size="md" theme="light" titleAs="h2" title={TEXTOS.e6.revisarBlocos}>
          <div className="escola__lista">{edicao}</div>
        </Collapse>
      )}
    </Casca>
  );
}
