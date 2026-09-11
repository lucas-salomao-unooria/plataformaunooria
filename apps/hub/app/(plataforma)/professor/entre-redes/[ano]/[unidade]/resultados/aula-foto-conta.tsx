"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FeedbackAlert, MetricCard, Modal, Tag } from "@edu/ui/ds";
import {
  ROTULO_DA_COMPLEXIDADE,
  ROTULO_DO_TEMA,
  type ComplexidadeDaFoto,
  type PacoteDaTurmaDoHub,
  type PainelDaFoto,
  type ProjecaoDaFoto,
  type TemaDaFoto,
} from "@/lib/foto-conta-tipos";

/**
 * O painel VIVO da aula da exp-04 — client-side pela mesma razão dos gates da
 * exp-07: o professor aperta no meio da aula e as 30 telas precisam andar na
 * hora, sem recarregar página. As guardas de papel estão na api.
 *
 * Polling de ~5s no dashboard (o mesmo ritmo do gate do o-eco-no-grupo); os
 * tablets fazem o polling deles direto na api (3s). Não há WebSocket em lugar
 * nenhum — ADR-94.
 *
 * As imagens da projeção são os placeholders vetoriais do banco padrão,
 * copiados em `public/entre-redes/foto-conta/` — pendência declarada: quando
 * as fotografias reais subirem para o bucket de assets, este caminho passa a
 * apontar para lá (os TEXTOS já vêm todos da api).
 */

function urlDaFotoNoHub(fotoId: string): string {
  return `/entre-redes/foto-conta/${fotoId}.svg`;
}

const TEMAS: TemaDaFoto[] = ["recreio", "nossa_horta", "sala_de_aula", "parquinho"];
const COMPLEXIDADES: ComplexidadeDaFoto[] = ["nivel_1", "nivel_2"];

async function chamarBff<T>(caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`/api/plataforma/foto-conta/${caminho}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo ?? {}),
  });
  if (!r.ok) {
    const erro = (await r.json().catch(() => ({}))) as { mensagem?: string };
    throw new Error(erro.mensagem ?? "A chamada falhou.");
  }
  return (await r.json()) as T;
}

export function AulaFotoConta({
  painelInicial,
  projecaoInicial,
}: {
  painelInicial: PainelDaFoto;
  projecaoInicial: ProjecaoDaFoto;
}) {
  const router = useRouter();
  const [painel, setPainel] = useState(painelInicial);
  const [projecao, setProjecao] = useState(projecaoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const turmaId = painel.turma.id;

  /* ------------------------------ preparação ------------------------------ */
  const [tema, setTema] = useState<TemaDaFoto>(painelInicial.tema);
  const [complexidade, setComplexidade] = useState<ComplexidadeDaFoto>(
    painelInicial.complexidade,
  );
  const [gerando, setGerando] = useState(false);
  const [preview, setPreview] = useState<{ pacote: PacoteDaTurmaDoHub; daIa: boolean } | null>(
    null,
  );
  const [aprovando, setAprovando] = useState(false);

  /* ------------------------------- ao vivo -------------------------------- */
  const [liberando, setLiberando] = useState(false);
  const [zerarAberto, setZerarAberto] = useState(false);
  const [zerando, setZerando] = useState(false);

  const atualizar = useCallback(() => {
    fetch(`/api/plataforma/foto-conta/turmas/${encodeURIComponent(turmaId)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as PainelDaFoto) : null))
      .then((p) => {
        if (p) setPainel(p);
      })
      .catch(() => undefined);
    fetch(`/api/plataforma/foto-conta/turmas/${encodeURIComponent(turmaId)}/projecao`)
      .then(async (r) => (r.ok ? ((await r.json()) as ProjecaoDaFoto) : null))
      .then((p) => {
        if (p) setProjecao(p);
      })
      .catch(() => undefined);
  }, [turmaId]);

  useEffect(() => {
    const t = setInterval(atualizar, 5_000);
    return () => clearInterval(t);
  }, [atualizar]);

  async function gerar() {
    setGerando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await chamarBff<{ pacote: PacoteDaTurmaDoHub; daIa: boolean }>(
        `turmas/${encodeURIComponent(turmaId)}/gerar-conteudo`,
        { tema, complexidade },
      );
      setPreview(r);
      if (!r.daIa) {
        setAviso(
          "A geração com IA não respondeu agora — o preview abaixo é o banco curado padrão. Você pode aprová-lo, ou tentar gerar de novo.",
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para gerar agora.");
    } finally {
      setGerando(false);
    }
  }

  async function aprovar() {
    if (!preview) return;
    setAprovando(true);
    setErro(null);
    try {
      await chamarBff(`turmas/${encodeURIComponent(turmaId)}/aprovar-pacote`, {
        pacote: preview.pacote,
        daIa: preview.daIa,
      });
      setAviso("Pacote aprovado — é o que a turma vai ver na aula.");
      setPreview(null);
      atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para aprovar agora.");
    } finally {
      setAprovando(false);
    }
  }

  async function liberar() {
    setLiberando(true);
    setErro(null);
    try {
      const r = await chamarBff<{ tabletsNoLatch: number }>(
        `turmas/${encodeURIComponent(turmaId)}/destravar-latch`,
      );
      setAviso(
        `Reflexão final liberada — ${r.tabletsNoLatch} ${r.tabletsNoLatch === 1 ? "tablet estava" : "tablets estavam"} na Roda.`,
      );
      atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para liberar agora.");
    } finally {
      setLiberando(false);
    }
  }

  const [, transicionar] = useTransition();
  async function zerar() {
    setZerando(true);
    setErro(null);
    try {
      await chamarBff(`turmas/${encodeURIComponent(turmaId)}/reset`);
      setZerarAberto(false);
      setAviso("Turma reiniciada — as publicações anteriores ficaram arquivadas.");
      transicionar(() => router.refresh());
      atualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para reiniciar agora.");
    } finally {
      setZerando(false);
    }
  }

  const { resumo } = painel;

  return (
    <div className="flex flex-col gap-6">
      {erro ? <FeedbackAlert type="error">{erro}</FeedbackAlert> : null}
      {aviso ? <FeedbackAlert type="info">{aviso}</FeedbackAlert> : null}

      {/* ------------------------- preparação da aula ------------------------ */}
      <Card variant="elevated">
        <div className="flex flex-col gap-3 p-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-bold text-unooria-neutral-950">
              Configuração da Missão — O Que a Foto Conta
            </h2>
            <Tag variant={painel.statusPacote === "pronto" ? "success" : "neutral"} size="sm" pill>
              {painel.statusPacote === "pronto"
                ? painel.pacoteDaIa
                  ? "Pacote aprovado (gerado com IA)"
                  : "Pacote aprovado"
                : "Sem pacote aprovado — o banco padrão assume"}
            </Tag>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-unooria-neutral-800">
              Selecione o espaço escolar para a atividade da turma:
              <select
                value={tema}
                onChange={(e) => setTema(e.target.value as TemaDaFoto)}
                className="min-w-[240px] rounded-md border border-unooria-neutral-300 bg-white px-3 py-2 text-[14px] font-normal"
              >
                {TEMAS.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_DO_TEMA[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-unooria-neutral-800">
              Nível de leitura das legendas:
              <select
                value={complexidade}
                onChange={(e) => setComplexidade(e.target.value as ComplexidadeDaFoto)}
                className="min-w-[240px] rounded-md border border-unooria-neutral-300 bg-white px-3 py-2 text-[14px] font-normal"
              >
                {COMPLEXIDADES.map((c) => (
                  <option key={c} value={c}>
                    {ROTULO_DA_COMPLEXIDADE[c]}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="primary" disabled={gerando} onClick={() => void gerar()}>
              {gerando ? "Criando enquadramentos e pares pedagógicos..." : "Gerar Proposta com IA"}
            </Button>
          </div>

          {preview ? (
            <div className="flex flex-col gap-3 rounded-lg border border-unooria-neutral-200 p-3">
              <h3 className="text-[14px] font-bold">Conferência do Pacote da Turma</h3>
              <p className="text-[13px] text-unooria-neutral-700">
                Verifique o isolamento de contraste entre o plano geral e o detalhe antes de
                aprovar. Os comentários abaixo são a reação que cada combinação produz — material
                seu, nunca mostrado antes da publicação.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {preview.pacote.legendas.map((l) => (
                  <p key={l.id} className="text-[13px]">
                    <strong>{l.id === "legenda_1" ? "Legenda do detalhe" : "Legenda do geral"}:</strong>{" "}
                    {l.texto}
                  </p>
                ))}
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-unooria-neutral-700">
                {preview.pacote.comentarios.map((c) => (
                  <li key={`${c.fotoId}-${c.legendaId}`}>
                    {c.fotoId === "par_b" ? "Foto do detalhe" : "Foto do geral"} +{" "}
                    {c.legendaId === "legenda_1" ? "legenda do detalhe" : "legenda do geral"} → Leo:
                    “{c.leo}” · Sofia: “{c.sofia}”
                  </li>
                ))}
              </ul>
              <div>
                <Button variant="primary" disabled={aprovando} onClick={() => void aprovar()}>
                  {aprovando ? "Aprovando..." : "Aprovar e Liberar para a Turma"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* --------------------------- o termômetro ---------------------------- */}
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard title="Estudantes conectados agora" value={String(resumo.conectados)} />
        <MetricCard title="Já publicaram" value={String(resumo.publicaram)} />
        <MetricCard title="Na Roda (tablets congelados)" value={String(resumo.noLatch)} />
        <MetricCard title="Concluíram a missão" value={String(resumo.concluiram)} />
      </section>

      {resumo.publicaram > 0 ? (
        <Card>
          <div className="flex flex-col gap-2 p-1">
            <h3 className="text-[14px] font-bold">Escolha de enquadramento</h3>
            <p className="text-[13px] text-unooria-neutral-700">
              {resumo.porFoto["par_b"] ?? 0} escolheram o detalhe ·{" "}
              {resumo.porFoto["par_a"] ?? 0} escolheram o plano geral —{" "}
              {resumo.porLegenda["legenda_1"] ?? 0} com a legenda do detalhe,{" "}
              {resumo.porLegenda["legenda_2"] ?? 0} com a do geral.
            </p>
          </div>
        </Card>
      ) : null}

      {painel.hesitando.length > 0 ? (
        <FeedbackAlert type="warning">
          Estudantes em hesitação de leitura (mais de 60s na decisão):{" "}
          {painel.hesitando.map((h) => h.nome).join(", ")} — sente ao lado, toque o áudio das
          legendas junto e devolva a escolha à criança.
        </FeedbackAlert>
      ) : null}

      {/* ------------------------ a projeção da Roda ------------------------- */}
      <Card variant="elevated">
        <div className="flex flex-col gap-4 p-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold text-unooria-neutral-950">
              Projeção para a Roda de Conversa
            </h2>
            <Button
              variant="primary"
              disabled={liberando || painel.latchLiberado}
              onClick={() => void liberar()}
            >
              {painel.latchLiberado ? "Reflexão final liberada" : "LIBERAR REFLEXÃO FINAL"}
            </Button>
          </div>
          {resumo.noLatch > 0 || painel.latchLiberado ? null : (
            <p className="text-[13px] text-unooria-neutral-500">
              Quando a turma chegar à Roda, os tablets congelam sozinhos — o contador acima mostra
              quantos já chegaram.
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <figure className="m-0 flex flex-col gap-2">
              <img
                src={urlDaFotoNoHub(projecao.fotoBId)}
                alt="Foto do plano detalhe"
                className="w-full rounded-lg"
              />
              <figcaption className="text-center text-[18px] font-bold">
                {projecao.rotulos.meio}
              </figcaption>
            </figure>
            <figure className="m-0 flex flex-col gap-2">
              <img
                src={urlDaFotoNoHub(projecao.fotoAId)}
                alt="Foto do plano geral"
                className="w-full rounded-lg"
              />
              <figcaption className="text-center text-[18px] font-bold">
                {projecao.rotulos.fora}
              </figcaption>
            </figure>
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-[14px] font-bold">Perguntas da Roda</h3>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-[14px] text-unooria-neutral-700">
              {projecao.perguntas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </div>
        </div>
      </Card>

      {/* ------------------------------- zerar -------------------------------- */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-1">
          <p className="max-w-2xl text-[13px] text-unooria-neutral-700">
            Zerar arquiva as publicações desta rodada (nada é apagado) e recomeça a missão do
            crachá, com a Roda rearmada. Na reaplicação, troque o tema do pacote — repetir o
            cenário mede memória, não leitura de imagem.
          </p>
          <Button variant="secondary" onClick={() => setZerarAberto(true)}>
            Zerar e Reiniciar Turma
          </Button>
        </div>
      </Card>

      <Modal
        isOpen={zerarAberto}
        onClose={() => setZerarAberto(false)}
        title="Zerar e Reiniciar Turma?"
      >
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-unooria-neutral-700">
            Atenção: redefinir a turma apagará as escolhas em andamento nos tablets para
            reiniciar a missão. As publicações da rodada atual ficam arquivadas — nenhum
            histórico é perdido.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" disabled={zerando} onClick={() => void zerar()}>
              {zerando ? "Reiniciando..." : "Zerar e Reiniciar"}
            </Button>
            <Button variant="secondary" onClick={() => setZerarAberto(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
