"use client";

import { useCallback, useEffect, useState } from "react";

import { AlertBox, Button, Card, Stepper, Toggle } from "@edu/ui/ds";
import { CONTROLE_DO_PROFESSOR, type EtapaDaTurma } from "@/lib/insta-tipos";

/**
 * O relógio da aula: onde a turma está e o que o próximo botão faz.
 *
 * Três decisões de UX que valem explicação, porque todas nasceram de imaginar o
 * professor com 30 estudantes olhando para ele:
 *
 * 1. **O botão principal é a PRÓXIMA ação, com o nome do que ela faz.** Não é um
 *    seletor de etapa — é um único caminho para frente. Ninguém escolhe "etapa 4"
 *    no meio de uma aula.
 * 2. **Uma linha embaixo diz a consequência.** Trocar a tela de 30 estudantes é
 *    irreversível na prática: eles já viram. Saber antes de clicar é o mínimo.
 * 3. **O passo do stepper não é clicável.** Pular momento por toque acidental,
 *    com a sala inteira olhando, é o pior erro possível aqui. Voltar existe, mas
 *    como ação secundária e discreta.
 */
const ROTULO_DA_FASE: Record<string, string> = {
  onboarding: "entrando",
  feed: "no feed",
  encerramento: "encerrando",
  conclusao: "respondendo",
  debate: "no debate",
  explicabilidade: "vendo a explicação",
  perdidos: "vendo o que perdeu",
  reflexao: "escrevendo a reflexão",
  fim: "terminou",
};

interface Estado {
  etapa: EtapaDaTurma;
  porFase: Record<string, number>;
  total: number;
  iaAoVivo: boolean;
}

export function PainelEtapas({ activityId }: { activityId: string }) {
  const [mudandoIa, setMudandoIa] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [mudando, setMudando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  const buscar = useCallback(async () => {
    try {
      const resposta = await fetch(`/api/plataforma/atividades/${activityId}/etapa`, { cache: "no-store" });
      if (!resposta.ok) throw new Error("etapa indisponível");
      setEstado((await resposta.json()) as Estado);
      setErro(false);
    } catch {
      setErro(true);
    }
  }, [activityId]);

  useEffect(() => {
    void buscar();
    const intervalo = setInterval(() => void buscar(), 5000);
    return () => clearInterval(intervalo);
  }, [buscar]);

  const indiceAtual = CONTROLE_DO_PROFESSOR.findIndex((passo) => passo.etapa === estado?.etapa);
  // `!`: findIndex ≥ 0 garante o índice, e a lista do controle nunca é vazia
  // (noUncheckedIndexedAccess do monorepo).
  const atual = indiceAtual >= 0 ? CONTROLE_DO_PROFESSOR[indiceAtual]! : CONTROLE_DO_PROFESSOR[0]!;
  const proximo = CONTROLE_DO_PROFESSOR[indiceAtual + 1];
  const anterior = indiceAtual > 0 ? CONTROLE_DO_PROFESSOR[indiceAtual - 1] : null;

  const mover = async (etapa: EtapaDaTurma, rotulo: string) => {
    setMudando(true);
    setAviso(null);
    try {
      const resposta = await fetch(`/api/plataforma/atividades/${activityId}/etapa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ etapa }),
      });
      const corpo = (await resposta.json()) as {
        movidos?: number;
        total?: number;
        foraDoAparelho?: number;
        reabertas?: number;
        mensagem?: string;
      };

      if (!resposta.ok) {
        setAviso(corpo.mensagem ?? "Não deu para mudar o momento agora.");
      } else {
        /**
         * "0 de 1 tela(s) mudaram" era a mensagem de SUCESSO mais comum, e lia
         * como falha: a api só conta quem trocou de fase, e quem já estava lá
         * não conta. No meio da aula, com a sala esperando, o professor lia isso
         * como "não funcionou" e apertava de novo.
         */
        const movidos = corpo.movidos ?? 0;
        const total = corpo.total ?? 0;
        const fora = corpo.foraDoAparelho ?? 0;
        const pendentes = fora > 0 ? ` ${fora} ainda não entraram no aparelho.` : "";
        /**
         * Voltar para a investigação REABRE o feed de quem já tinha sido
         * encerrado, e o relatório daquelas sessões passa a ser recalculado no
         * próximo encerramento (ADR-92). O professor precisa saber: é a
         * diferença entre "a turma voltou" e "a turma voltou e o relatório
         * daquela hora não existe mais".
         */
        const reabertas = corpo.reabertas ?? 0;
        const recomputo =
          reabertas > 0
            ? ` ${reabertas} sessão(ões) voltaram ao feed — o relatório delas é refeito quando você encerrar a investigação de novo.`
            : "";

        setAviso(
          total === 0
            ? `${rotulo}: ninguém entrou na atividade ainda.`
            : movidos === 0
              ? `${rotulo}: a turma já estava aí — nenhuma tela precisou mudar.${pendentes}${recomputo}`
              : movidos === total
                ? `${rotulo}: as ${total} tela(s) mudaram.${pendentes}${recomputo}`
                : `${rotulo}: ${movidos} de ${total} tela(s) mudaram.${pendentes}${recomputo}`,
        );
      }
      await buscar();
    } catch {
      setAviso("Não deu para mudar o momento agora. Tenta de novo.");
    } finally {
      setMudando(false);
    }
  };

  /** Onde a turma está agora, em linguagem de sala. */
  const distribuicao = Object.entries(estado?.porFase ?? {})
    .filter(([, quantos]) => quantos > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([fase, quantos]) => `${quantos} ${ROTULO_DA_FASE[fase] ?? fase}`);

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-semibold text-unooria-neutral-950">
            Momento da aula
          </h2>
          <span className="text-[12px] text-unooria-neutral-500">
            {estado ? `${estado.total} estudante(s) na atividade` : "carregando…"}
          </span>
        </div>

        {erro ? (
          <AlertBox
            theme="light"
            variant="warning"
            device="auto"
            description="Perdemos o contato com a atividade. Continuamos tentando."
          />
        ) : null}

        <Stepper
          orientation="horizontal"
          size="sm"
          clickable={false}
          currentStep={Math.max(0, indiceAtual)}
          steps={CONTROLE_DO_PROFESSOR.map((passo) => ({
            id: passo.etapa,
            label: passo.nome,
          }))}
        />

        <div className="rounded-lg border border-unooria-neutral-200 p-3">
          <p className="text-[12px] uppercase tracking-wide text-unooria-neutral-500">
            agora
          </p>
          <p className="text-[15px] font-semibold text-unooria-neutral-950">{atual.nome}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-unooria-neutral-600">
            {atual.descricao}
          </p>
          {distribuicao.length > 0 ? (
            <p className="mt-2 text-[12px] text-unooria-neutral-700">
              {distribuicao.join(" · ")}
            </p>
          ) : null}
        </div>

        {/*
          VOLTAR VIVE FORA DO `proximo`. Ele já morou dentro do bloco do botão
          principal, e na última etapa (`fim`) não existe próxima — então o
          único jeito de tirar a turma do fim era chamar a api na mão. A aula
          que terminou cedo demais é justamente quando voltar importa.
        */}
        <div className="flex flex-col gap-2">
          {proximo ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  disabled={mudando}
                  onClick={() => void mover(proximo.etapa, proximo.rotulo)}
                >
                  {mudando ? "mudando…" : proximo.rotulo}
                </Button>
                {anterior ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={mudando}
                    onClick={() => void mover(anterior.etapa, `Voltou para ${anterior.rotulo}`)}
                  >
                    voltar um momento
                  </Button>
                ) : null}
              </div>
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                {proximo.descricao}
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-unooria-neutral-600">
                A missão terminou. As respostas e as reflexões ficam na análise da turma.
              </p>
              {anterior ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={mudando}
                    onClick={() => void mover(anterior.etapa, `Voltou para ${anterior.rotulo}`)}
                  >
                    voltar um momento
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {aviso ? (
          <AlertBox theme="light" variant="info" device="auto" description={aviso} />
        ) : null}

        {/*
          A única chave desta tela que não é sobre tempo. As reações ao vivo são o
          único conteúdo que você não revisa antes — então o controle é sobre
          comportamento, e precisa estar à mão durante a aula.
        */}
        <div className="flex items-start justify-between gap-3 border-t border-unooria-neutral-200 pt-3">
          <div>
            <p className="text-[13px] font-semibold text-unooria-neutral-950">
              Perfis respondem ao estudante
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-unooria-neutral-600">
              Quando ele publica ou comenta, os perfis do feed reagem na hora. É o
              único texto que você não revisa antes — desligue se quiser.
            </p>
          </div>
          <Toggle
            checked={estado?.iaAoVivo ?? true}
            disabled={mudandoIa || !estado}
            aria-label="Perfis respondem ao estudante"
            onChange={async (ativo) => {
              setMudandoIa(true);
              try {
                await fetch(`/api/plataforma/atividades/${activityId}/ia`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ ativo }),
                });
                setAviso(
                  ativo
                    ? "Os perfis voltaram a responder."
                    : "Os perfis pararam de responder. O que já foi escrito continua lá.",
                );
                await buscar();
              } finally {
                setMudandoIa(false);
              }
            }}
          />
        </div>
      </div>
    </Card>
  );
}
