import { useEffect, useState } from "react";
import { AlertBox, Button, Card, CardContent, RadioGroup, Tag, Toggle } from "@edu/ui/ds";
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
 * marcada). "▶ Comece aqui" no bloco 1.
 *
 * "Publicar Transparência e Comunicado" é SEMPRE habilitado (o LATCH 2): com
 * bloco em branco, só o aviso do PO. Não há aviso de bloco "desconexo" — ele
 * entregaria o gabarito. Com os 4 escolhidos, o texto montado aparece com os
 * trechos escolhidos sublinhados.
 */
export function Publicacao({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const [paginaAtiva, setPaginaAtiva] = useState(false);
  const [comunicado, setComunicado] = useState<ComunicadoValor>({});
  const [enviando, setEnviando] = useState(false);
  const blocos = sessao.material.blocos;
  const preenchidos = blocos.filter((b) => comunicado[b.id]).length;
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

  return (
    <Casca etapas={{ atual: 6, janela: [4, 5, 6] }} equipe={estado.equipe}>
      <p className="escola__instrucao">{estado.equipe ? TEXTOS.e6.instrucaoDaEquipe : TEXTOS.e6.instrucao}</p>
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
      {blocos.map((b, i) => (
        <section key={b.id} className="bloco" aria-label={b.titulo}>
          <div className="bloco__topo">
            <h3 className="bloco__titulo">{b.titulo}</h3>
            {i === 0 && (
              <Tag variant="brand" size="sm">
                {TEXTOS.e6.comeceAqui}
              </Tag>
            )}
          </div>
          <RadioGroup
            name={`bloco-${b.id}`}
            label={b.inicio}
            theme="light"
            value={comunicado[b.id] ?? ""}
            onChange={(v) => escolher(b.id, String(v))}
            options={b.opcoes.map((o) => ({ value: o.id, label: o.texto }))}
          />
        </section>
      ))}
      {preenchidos === blocos.length && (
        <Card variant="outlined">
          <CardContent>
            <div className="comunicado" aria-live="polite">
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
      )}
      {preenchidos > 0 && preenchidos < blocos.length && (
        <AlertBox variant="warning" device="mobile" theme="light" description={TEXTOS.e6.incompleto} />
      )}
      <Button variant="primary" size="lg" fullWidth isLoading={enviando || ctx.naFila("publicar")} onClick={() => void publicar()}>
        {TEXTOS.e6.publicar}
      </Button>
    </Casca>
  );
}
