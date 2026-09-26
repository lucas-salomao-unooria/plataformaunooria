import Link from "next/link";
import { Card, EmptyState } from "@edu/ui/ds";
import { PainelDeHabilidades } from "@/components/evidencias/painel-de-habilidades";
import { RotuloDaTrilha } from "@/components/trilha";
import {
  type CoberturasDaTurma,
  type MaterialDaSelecao,
  type PainelDaSelecao,
  type TurmaDaSelecao,
  type PodcastDaTurma,
} from "@/lib/a-selecao-tipos";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import type { MembroNoPainel } from "@/lib/equipe-no-painel";
import { equipesDaMissao } from "@/lib/equipes-servidor";
import { painelDeHabilidades } from "@/lib/evidencias-servidor";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { normalizarSerie } from "@/lib/series";
import type { TurmaResumo } from "@/lib/turmas-tipos";

import { PainelDaAulaASelecao } from "./painel-da-aula-a-selecao";
import { PodcastASelecao } from "./podcast-a-selecao";
import { PreparoASelecao } from "./preparo-a-selecao";
import { SeletorDeCobertura } from "./seletor-de-cobertura";
import { SeletorDeTurma } from "./seletor-de-turma";
import { ZerarTurmaASelecao } from "./zerar-turma-a-selecao";

const EXP_ID = "exp07ef1b";

/**
 * A aula de A SELEÇÃO: tudo o que a professora faz com a turma, numa página,
 * nesta ordem — (a) o preparo da cobertura, (b) o painel ao vivo com o botão
 * único, (c) a folha por computador, (d) o zerar e (e) o painel de
 * habilidades.
 *
 * A ORDEM é a da aula, e não a da importância: antes da aula a professora
 * prepara; durante, olha o botão e o "X de Y publicaram"; depois, lê a
 * habilidade. O preparo nasce FECHADO (a grade de posts só abre a pedido)
 * para não empurrar o botão para fora da tela no meio da aula.
 *
 * **Missão com ficha pedagógica (E14)**, a segunda depois de Quem mandou
 * isso? v2.2 — por isso o painel de habilidades mora aqui, e não só na tela de atividade do Instanooria. A
 * atividade é a COBERTURA (`atividadeId = coberturaId`) e a rodada é o
 * "Zerar"; `?cobertura=` escolhe qual, e o padrão é a em andamento.
 *
 * DEPOIS DA AULA, o podcast de recapitulação (`podcast-a-selecao.tsx`): do
 * professor, com o Bloco 2 no tema desta turma.
 *
 * A REGRA QUE ESTA TELA APLICA: nenhuma coluna de nível, nota ou acerto na
 * folha (`PROIBIDO_NO_PAINEL`, na api). O nível mora no painel de
 * habilidades, com a origem e o ajuste do professor — e a sugestão da IA sobre
 * a legenda chega lá, nunca aqui.
 *
 * O texto livre (legenda e reflexão) vem preenchido só para quem LECIONA a
 * turma — a api o devolve `null` para a coordenação (ADR-108), e a folha diz
 * "entregou" sem ramo por papel.
 */
export async function ResultadosASelecao({
  missao,
  turma,
  cobertura,
}: {
  missao: Missao;
  turma: string;
  /** `?cobertura=` — a atividade que o painel de habilidades lê. Vazio = a em andamento. */
  cobertura: string;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  const lista = await apiDoServidor<{ turmas: TurmaDaSelecao[] }>("/a-selecao/turmas");
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão, e
     o `map` concilia `serie: string | null` do contrato com o seletor, que a
     imprime na opção (a lição de `resultados-quem-mandou-isso.tsx`). */
  const turmas: TurmaResumo[] = (lista?.turmas ?? [])
    .filter((t) => normalizarSerie(t.serie) === "7EF")
    .map((t) => ({ ...t, serie: t.serie ?? "" }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 7º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const base = `/a-selecao/turmas/${encodeURIComponent(turma)}`;
  const [painel, coberturas, material, equipes, session, podcast] = turma
    ? await Promise.all([
        apiDoServidor<PainelDaSelecao>(`${base}/painel`),
        apiDoServidor<CoberturasDaTurma>(`${base}/coberturas`),
        /* Os gatilhos do botão (`prof.gatilho.*`) moram na api, junto do guia:
           a frase que diz QUANDO apertar muda sem republicar o hub. */
        apiDoServidor<MaterialDaSelecao>("/a-selecao/professor/material"),
        /* A linha desta api traz só o NOME da equipe; os membros vêm das
           equipes da missão, para a primeira célula dizer quem senta ali. */
        equipesDaMissao(turma, EXP_ID),
        auth(),
        /* O podcast de recapitulação (é do professor): o roteiro e se o áudio já existe. */
        apiDoServidor<PodcastDaTurma>(`${base}/podcast`),
      ])
    : [null, null, null, null, null, null];

  const membros: Record<string, MembroNoPainel[]> = Object.fromEntries(
    (equipes?.equipes ?? []).map((e) => [e.id, e.membros]),
  );

  /* A atividade do painel de habilidades: a pedida, se ela é DESTA turma, e
     senão a em andamento. Um id de outra turma (link velho, colado à mão) não
     chega à api como se fosse desta. */
  const historico = coberturas?.historico ?? [];
  const pedida = historico.find((h) => h.id === cobertura);
  const atividadeId = pedida?.id ?? coberturas?.ativa.id ?? painel?.cobertura.id ?? null;
  const habilidades =
    turma && atividadeId && missao.expId
      ? await painelDeHabilidades(turma, missao.expId, atividadeId)
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Esta missão chama a tela de "A aula e os resultados" (ela prepara a
          cobertura e conduz o Mural, não só relata): o rótulo do registro de
          rotas é o genérico e quem o corrige é a página. */}
      <RotuloDaTrilha valor="A aula e os resultados" />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          {missao.titulo}
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          A aula e os resultados
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          É daqui que você prepara a cobertura, abre o Mural e as fichas técnicas com o botão da
          aula, e lê o retrato da turma: não quem acertou, mas <strong>quem cada computador
          decidiu ouvir</strong> e com quem ele foi comparado.
        </p>
        {/* O guia à mão: é aqui que a professora está DURANTE a aula, e é daqui
            que ela relê o roteiro da Etapa 4 sem perder o painel de vista. */}
        {guia ? (
          <p className="text-[13px] font-semibold">
            <Link href={guia} className="text-unooria-navy-900 hover:text-unooria-neutral-950">
              Abrir o guia da aula
            </Link>
          </p>
        ) : null}
      </header>

      <SeletorDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. A cobertura, o Mural e as etapas são por turma, e valem só para a
            que você escolher.
          </p>
        </Card>
      ) : painel === null || coberturas === null ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos abrir esta turma"
          description="Confira se a turma é desta escola e tente de novo."
        />
      ) : (
        <>
          {/* A `key` NÃO é otimização: todo o preparo vive em `useState`, e o
              seletor troca de turma com `router.push` para esta MESMA rota.
              Sem ela o formulário da turma anterior fica na tela — e "Aprovar"
              publica na turma nova o lote da antiga (a lição registrada em
              `resultados-quem-mandou-isso.tsx`). */}
          <PreparoASelecao key={turma} turmaId={turma} inicial={coberturas} />

          <PainelDaAulaASelecao
            key={`aula-${turma}`}
            turmaId={turma}
            inicial={painel}
            gatilhos={material?.gatilhos ?? null}
            posts={coberturas.ativa.posts}
            membros={membros}
          />

          {/* Depois da aula: o podcast. A `key` é a turma, como no preparo — o
              laço do áudio vive em `useState`. */}
          {podcast ? <PodcastASelecao key={`podcast-${turma}`} turmaId={turma} inicial={podcast} /> : null}

          <ZerarTurmaASelecao turmaId={turma} nomeDaTurma={painel.turma.nome} tema={painel.cobertura.tema} />

          {/* O painel de habilidades (E14) — invisível sem ficha
              (`temFicha: false`), e só o `professor` confirma e ajusta: a
              coordenação lê. A `key` é a atividade: trocar de cobertura
              recomeça o recorte e a seleção dele. */}
          {habilidades?.temFicha && atividadeId ? (
            <div className="flex flex-col gap-3" data-habilidades-da-selecao>
              {historico.length > 1 ? (
                <div className="max-w-xl">
                  <SeletorDeCobertura
                    historico={historico}
                    coberturaId={atividadeId}
                    rotaBase={rotaBase}
                    turmaId={turma}
                  />
                </div>
              ) : null}
              <PainelDeHabilidades
                key={atividadeId}
                turmaId={turma}
                expId={EXP_ID}
                atividadeId={atividadeId}
                inicial={habilidades}
                podeEditar={session?.usuario.papel === "professor"}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
