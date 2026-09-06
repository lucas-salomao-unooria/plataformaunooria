"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AlertBox, Button, Card, FeedbackAlert, Tag } from "@edu/ui/ds";

interface EstudanteNaLista {
  username: string;
  displayName: string;
  dominante: string;
  rotulo: string;
  margem: number;
  origemDoPerfil: "jogo" | "professor" | "ausente";
  /** Medido sob uma versão anterior do mapeamento da Vila. Reimportar resolve. */
  mapeamentoDesatualizado: boolean;
  lado: "A" | "B" | null;
  ladoOrigem: "perfil" | "sorteio" | "redistribuido" | "projetado";
  jaComecou: boolean;
}


interface Distribuicao {
  temAfinidade: boolean;
  afinidade: {
    abertura: "A" | "B";
    autopromocao: "A" | "B";
    por_que_abertura: string;
    por_que_autopromocao: string;
  } | null;
  estudantes?: EstudanteNaLista[];
  contagem: { A: number; B: number };
  semLado: number;
  desequilibrio: number;
  tolerancia: number;
  precisaRedistribuir: boolean;
}

/** O que `POST atividades/:id/perfis/da-vila` devolve. `descartados` vem NOMEADO
 *  de propósito: uma resposta que só diz "23 importados" faria o professor achar
 *  que a turma inteira entrou. */
interface ResultadoDaVila {
  importados: number;
  semPartida: number;
  descartados: Array<{ nome: string; motivo: string }>;
}

const ORIGEM_DO_PERFIL: Record<EstudanteNaLista["origemDoPerfil"], string> = {
  jogo: "do jogo",
  professor: "manual",
  ausente: "sem perfil",
};

const ORIGEM_DO_LADO: Record<EstudanteNaLista["ladoOrigem"], string> = {
  perfil: "pelo perfil",
  sorteio: "sorteado",
  redistribuido: "redistribuído",
  projetado: "projetado",
};

/**
 * A tela que o professor vê ANTES da turma começar (doc 07, doc 04 §3.1).
 *
 * Existe porque a distribuição de perfis varia por sala: uma turma pode ter muita
 * Autotranscendência e pouca Conservação, e aí os lados nascem desequilibrados.
 * Não é defeito do sistema, é a turma — mas o professor precisa saber antes, não
 * descobrir no meio da aula.
 */
export function PainelPerfis({
  activityId,
  ladoALabel,
  ladoBLabel,
  turma,
  somenteLeitura = false,
}: {
  activityId: string;
  ladoALabel: string;
  ladoBLabel: string;
  /** Atividade encerrada: o painel ainda EXPLICA de onde veio o lado de cada
   *  estudante (é o que o professor lê junto do relatório), mas não age. */
  somenteLeitura?: boolean;
  /** A turma da atividade. `null` = atividade anterior à coluna `turma_id`, que
   *  vale para a escola inteira — e o painel PRECISA dizer isso, senão o
   *  professor lê uma lista de estudantes que não são dele achando que é a sala. */
  turma: { id: string; nome: string; serie: string } | null;
}) {
  const [dados, setDados] = useState<Distribuicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [redistribuindo, setRedistribuindo] = useState(false);
  const [ultimaAcao, setUltimaAcao] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoDaVila, setResultadoDaVila] = useState<ResultadoDaVila | null>(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await fetch(`/api/plataforma/atividades/${activityId}/distribuicao`, {
        cache: "no-store",
      });
      if (!resposta.ok) throw new Error("indisponível");
      setDados((await resposta.json()) as Distribuicao);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar a distribuição da turma.");
    }
  }, [activityId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Traz os perfis da Vila do Lume (exp-70) para esta atividade — o "Ato 1" que
   * a ficha da missão sempre descreveu como um jogo fora da plataforma.
   *
   * O DISPARO É DO PROFESSOR, não automático: importar sozinho desfaria em
   * silêncio uma redistribuição que ele já tinha feito. (O servidor preserva
   * `ladoForcado` de qualquer jeito — mas quem decide QUANDO trocar a base é
   * ele, porque a partida pode acontecer depois de a atividade ter começado.)
   */
  async function importarDaVila() {
    setImportando(true);
    setResultadoDaVila(null);
    try {
      const resposta = await fetch(`/api/plataforma/atividades/${activityId}/perfis/da-vila`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const corpo = (await resposta.json().catch(() => null)) as ResultadoDaVila | null;
      if (!resposta.ok || !corpo) {
        setErro("Não foi possível importar os perfis da Vila do Lume agora.");
        return;
      }
      setResultadoDaVila(corpo);
      await carregar();
    } finally {
      setImportando(false);
    }
  }

  async function redistribuir() {
    setRedistribuindo(true);
    setUltimaAcao(null);
    try {
      const resposta = await fetch(`/api/plataforma/atividades/${activityId}/redistribuir`, {
        method: "POST",
      });
      const corpo = (await resposta.json().catch(() => null)) as {
        movidos?: { displayName: string; perfil: string; margem: number }[];
        mensagem?: string;
        bloqueados?: number;
      } | null;

      if (!resposta.ok) {
        setErro(corpo?.mensagem ?? "Não foi possível redistribuir agora.");
        return;
      }

      const movidos = corpo?.movidos ?? [];
      setUltimaAcao(
        movidos.length === 0
          ? (corpo?.mensagem ?? "A turma já está equilibrada.")
          : `${movidos.length} estudante(s) movido(s), começando pelos de perfil menos decidido: ${movidos
              .map((m) => `${m.displayName} (${m.perfil}, margem ${m.margem})`)
              .join(" · ")}`,
      );
      await carregar();
    } finally {
      setRedistribuindo(false);
    }
  }

  if (!dados) {
    return (
      <Card variant="outlined" className="plataforma-largura-cheia">
        <p className="text-[13px] text-unooria-neutral-500">
          {erro ?? "Carregando a distribuição da turma…"}
        </p>
      </Card>
    );
  }

  const listaEstudantes = dados.estudantes ?? [];
  const total = dados.contagem.A + dados.contagem.B;
  const comPerfil = listaEstudantes.filter((a) => a.origemDoPerfil !== "ausente").length;
  const desatualizados = listaEstudantes.filter((a) => a.mapeamentoDesatualizado).length;
  const rotuloDoLado = (lado: "A" | "B" | null) =>
    lado === "A" ? ladoALabel : lado === "B" ? ladoBLabel : "—";

  return (
    <div className="flex flex-col gap-4">
      {erro ? (
        <AlertBox theme="light" variant="error" device="auto" description={erro} />
      ) : null}

      {/*
        DE QUE SALA ESTE PAINEL FALA. Sem turma, a atividade vale para a escola
        inteira — era o comportamento único antes da coluna `turma_id`, e sem
        dizê-lo o professor lê uma lista com estudantes que não são dele achando que
        é a sala.
      */}
      {turma ? (
        <p className="text-[13px] text-unooria-neutral-500">
          Turma <strong className="text-unooria-neutral-800">{turma.nome}</strong> ·{" "}
          {turma.serie} — {listaEstudantes.length} estudante(s).
        </p>
      ) : (
        <FeedbackAlert
          type="info"
          title="Esta atividade não tem turma"
          description={`Ela vale para a escola inteira, e a lista abaixo tem ${listaEstudantes.length} estudante(s) de todas as turmas. Atividades criadas a partir de agora podem escolher a turma.`}
        />
      )}

      {!dados.temAfinidade ? (
        <AlertBox
          theme="light"
          variant="warning"
          device="auto"
          title="Ainda não há afinidade aprovada"
          description="Aprove a pergunta e os dois lados. É a afinidade que decide em que lado cada estudante começa."
        />
      ) : null}

      {dados.afinidade ? (
        <Card
          variant="outlined"
          title="Quem começa de cada lado"
          className="plataforma-largura-cheia"
        >
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-unooria-neutral-700">
              O perfil de valores de cada estudante define seu lado inicial. Perfis
              opostos vão para lados opostos, então sempre saem dois perfis por
              lado.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-unooria-neutral-200 p-3">
                <p className="text-[13px] font-semibold text-unooria-neutral-950">
                  Abertura → lado {dados.afinidade.abertura} ·{" "}
                  {rotuloDoLado(dados.afinidade.abertura)}
                </p>
                <p className="mt-1 text-[12px] text-unooria-neutral-500">
                  {dados.afinidade.por_que_abertura}
                </p>
                <p className="mt-2 text-[12px] text-unooria-neutral-700">
                  Conservação fica com o outro lado.
                </p>
              </div>
              <div className="rounded-lg border border-unooria-neutral-200 p-3">
                <p className="text-[13px] font-semibold text-unooria-neutral-950">
                  Autopromoção → lado {dados.afinidade.autopromocao} ·{" "}
                  {rotuloDoLado(dados.afinidade.autopromocao)}
                </p>
                <p className="mt-1 text-[12px] text-unooria-neutral-500">
                  {dados.afinidade.por_que_autopromocao}
                </p>
                <p className="mt-2 text-[12px] text-unooria-neutral-700">
                  Autotranscendência fica com o outro lado.
                </p>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card
        variant="outlined"
        title="Perfis do Ato 1"
        className="plataforma-largura-cheia"
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
            O perfil de valores vem da{" "}
            <Link
              href="/professor/entre-redes/vila-do-lume"
              className="font-semibold text-unooria-navy-900 underline"
            >
              Vila do Lume
            </Link>
            , a missão transversal do Entre Redes. Traga os perfis de quem já
            jogou — quem não tiver perfil entra no sorteio balanceado, e você
            pode completar à mão. Reimportar não desfaz quem você já moveu de
            lado.
          </p>

          {/*
            QUANTOS JÁ TÊM PERFIL, antes de clicar. A `/distribuicao` já traz
            `origemDoPerfil` por estudante, então isto é agregação, não busca nova.
            Antes o professor só descobria depois de importar — e se a turma
            inteira estivesse sem partida, ele descobria com um "0 perfis
            importados" que parece erro do sistema.
          */}
          <p className="text-[13px] text-unooria-neutral-700">
            {comPerfil === 0
              ? `Nenhum dos ${listaEstudantes.length} estudantes tem perfil ainda — hoje todos cairiam no sorteio.`
              : `${comPerfil} de ${listaEstudantes.length} já têm perfil.`}
          </p>

          {/*
            O mapeamento da Vila é hipótese de design e MUDA. Quando ele muda, a
            Vila recalcula os perfis dela — mas a cópia que decide o lado aqui é
            de antes, e sem este aviso ela seguiria valendo em silêncio. Aviso,
            nunca bloqueio: um perfil de versão anterior ainda é melhor que o
            sorteio.
          */}
          {desatualizados > 0 ? (
            <FeedbackAlert
              type="warning"
              title="O mapeamento da Vila mudou desde a importação"
              description={`${desatualizados} perfil(is) foram medidos com uma versão anterior. Trazer os perfis de novo atualiza — e não desfaz quem você moveu de lado.`}
            />
          ) : null}

          <div>
            <Button
              variant="outline"
              size="sm"
              isLoading={importando}
              isDisabled={somenteLeitura}
              onClick={() => void importarDaVila()}
            >
              Trazer perfis da Vila do Lume
            </Button>
          </div>
          {resultadoDaVila ? (
            <div className="flex flex-col gap-1 rounded-lg border border-unooria-neutral-200 p-3">
              <p className="text-[13px] font-semibold text-unooria-neutral-950">
                {resultadoDaVila.importados}{" "}
                {resultadoDaVila.importados === 1 ? "perfil importado" : "perfis importados"}
                {resultadoDaVila.semPartida > 0
                  ? ` · ${resultadoDaVila.semPartida} ainda não jogaram`
                  : ""}
              </p>
              {resultadoDaVila.descartados.length > 0 ? (
                <>
                  {/* Nomeados, e com o motivo: a partida curta não sustenta
                      leitura, e o professor precisa saber de quem para decidir
                      se completa à mão ou pede para jogar de novo. */}
                  <p className="text-[12px] text-unooria-neutral-700">
                    Ficaram de fora ({resultadoDaVila.descartados.length}):
                  </p>
                  <ul className="flex list-disc flex-col gap-0.5 pl-5 text-[12px] text-unooria-neutral-500">
                    {resultadoDaVila.descartados.map((d) => (
                      <li key={d.nome}>
                        {d.nome} — {d.motivo}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <Card variant="elevated" className="plataforma-largura-cheia">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Tag variant={dados.precisaRedistribuir ? "warning" : "success"} size="sm">
                {total > 0
                  ? `${Math.round((dados.contagem.A / total) * 100)}% / ${Math.round(
                      (dados.contagem.B / total) * 100,
                    )}%`
                  : "sem estudantes"}
              </Tag>
              <span className="text-[13px] text-unooria-neutral-700">
                {dados.contagem.A} em {ladoALabel} · {dados.contagem.B} em{" "}
                {ladoBLabel}
                {dados.semLado > 0 ? ` · ${dados.semLado} no sorteio` : ""}
              </span>
            </div>

            <Button
              variant={dados.precisaRedistribuir ? "primary" : "outline"}
              size="sm"
              isLoading={redistribuindo}
              onClick={() => void redistribuir()}
              isDisabled={!dados.temAfinidade || somenteLeitura}
            >
              Redistribuir a turma
            </Button>
          </div>

          {dados.precisaRedistribuir ? (
            <AlertBox
              theme="light"
              variant="warning"
              device="auto"
              title="A turma está concentrada num lado"
              description={`O desequilíbrio passou de ${Math.round(
                dados.tolerancia * 100,
              )}%. Redistribuir move primeiro os estudantes de perfil menos decidido — preserva a pedagogia onde o sinal é forte.`}
            />
          ) : null}

          {ultimaAcao ? (
            <AlertBox theme="light" variant="info" device="auto" description={ultimaAcao} />
          ) : null}

          <div className="tabela-rolavel">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-unooria-neutral-700">
                  <th className="p-2 font-semibold">Estudante</th>
                  <th className="p-2 font-semibold">Perfil</th>
                  <th className="p-2 font-semibold">Origem</th>
                  <th className="p-2 font-semibold">Margem</th>
                  <th className="p-2 font-semibold">Lado</th>
                  <th className="p-2 font-semibold">Por quê</th>
                </tr>
              </thead>
              <tbody>
                {listaEstudantes.map((estudante) => (
                  <tr
                    key={estudante.username}
                    className="border-t border-unooria-neutral-200"
                  >
                    <td className="p-2 text-unooria-neutral-950">
                      {estudante.displayName}
                      {estudante.jaComecou ? (
                        <span className="ml-2 text-[11px] text-unooria-neutral-500">
                          já começou
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2">{estudante.rotulo}</td>
                    <td className="p-2 text-unooria-neutral-500">
                      {ORIGEM_DO_PERFIL[estudante.origemDoPerfil]}
                    </td>
                    <td className="p-2 text-unooria-neutral-500">
                      {estudante.dominante === "misto"
                        ? "—"
                        : estudante.margem.toFixed(2)}
                    </td>
                    <td className="p-2">
                      {estudante.lado ? (
                        <Tag variant={estudante.lado === "A" ? "info" : "warning"} size="sm">
                          {rotuloDoLado(estudante.lado)}
                        </Tag>
                      ) : (
                        <span className="text-unooria-neutral-500">no sorteio</span>
                      )}
                    </td>
                    <td className="p-2 text-unooria-neutral-500">
                      {ORIGEM_DO_LADO[estudante.ladoOrigem]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            Era um parágrafo de quatro linhas. Virou uma linha e um `title`: quem
            já sabe não relê, e quem não sabe passa o mouse. Menos texto na tela
            era pedido explícito — e num painel que o professor usa em pé, na
            frente da turma, parágrafo é ruído.
          */}
          <p className="text-[12px] text-unooria-neutral-500">
            <abbr
              title="Distância entre o 1º e o 2º valor do perfil: quanto menor, menos decidido. A redistribuição move primeiro os de margem menor."
              className="cursor-help font-semibold no-underline"
            >
              Margem
            </abbr>{" "}
            mede o quanto o perfil está decidido. Quem já começou não é movido.
          </p>
        </div>
      </Card>
    </div>
  );
}
