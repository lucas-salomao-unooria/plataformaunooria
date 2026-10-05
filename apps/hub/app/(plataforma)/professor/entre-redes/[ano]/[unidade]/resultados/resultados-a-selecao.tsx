import Link from "next/link";
import { Badge, Card, EmptyState, FeedbackAlert } from "@edu/ui/ds";
import { UsarEstaAtividade } from "@/components/atividades/usar-esta-atividade";
import { EquipesDaAtividade } from "@/components/equipes/equipes-da-ficha";
import { PainelDeHabilidades } from "@/components/evidencias/painel-de-habilidades";
import { LinkButton } from "@/components/link-button";
import { RotuloDaTrilha } from "@/components/trilha";
import {
  type CoberturaDaAtividade,
  type CoberturasDaTurma,
  type MaterialDaSelecao,
  type PainelDaSelecao,
  type PodcastDaTurma,
  type TurmaDaSelecao,
} from "@/lib/a-selecao-tipos";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { ROTULO_DO_ESTADO, textoDasRodadas } from "@/lib/entre-redes/atividades";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import type { MembroNoPainel } from "@/lib/equipe-no-painel";
import { equipesDaMissao } from "@/lib/equipes-servidor";
import { painelDeHabilidades } from "@/lib/evidencias-servidor";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { normalizarSerie } from "@/lib/series";
import type { TurmaResumo } from "@/lib/turmas-tipos";

import { FaseDasImagens } from "../grade-da-cobertura";
import { ImagensDaCobertura } from "./imagens-da-cobertura";
import { PainelDaAulaASelecao } from "./painel-da-aula-a-selecao";
import { PodcastASelecao } from "./podcast-a-selecao";
import { SeletorDeTurma } from "./seletor-de-turma";
import { ZerarTurmaASelecao } from "./zerar-turma-a-selecao";

const EXP_ID = "exp07ef1b";

/**
 * A PÁGINA DE UMA ATIVIDADE de A SELEÇÃO (ADR-130) — a cobertura que a
 * professora criou, com tudo o que se faz com ela, nesta ordem: pô-la no ar
 * (se está pronta), as equipes, as imagens, a aula ao vivo com o botão único
 * (só a em andamento), o podcast e o painel de habilidades.
 *
 * A atividade vem de `?cobertura=` — o card da lista de atividades da ficha —,
 * e sem ele é a em andamento. A CRIAÇÃO não mora mais aqui: é o "Nova
 * atividade" da ficha (`atividades/nova`), porque criar não põe no ar e o
 * preparo de uma aula não pode trocar, por engano, a que está rodando.
 *
 * **Missão com ficha pedagógica (E14)**: a atividade é a COBERTURA
 * (`atividadeId = coberturaId`) e a rodada é o "Zerar". A REGRA QUE ESTA TELA
 * APLICA: nenhuma coluna de nível, nota ou acerto na folha (`PROIBIDO_NO_PAINEL`,
 * na api). O texto livre (legenda e reflexão) vem preenchido só para quem
 * LECIONA a turma — a api o devolve `null` para a coordenação (ADR-108).
 */
export async function ResultadosASelecao({
  missao,
  turma,
  cobertura,
  separar,
}: {
  missao: Missao;
  turma: string;
  /** `?cobertura=` — a atividade desta página. Vazio = a em andamento. */
  cobertura: string;
  /** `?separar=N` — vindo da criação com "Eu separo": as N equipes vazias já abrem. */
  separar: number | null;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;
  const ficha = turma ? `${rotaDaMissao(missao)}?turmaId=${encodeURIComponent(turma)}` : rotaDaMissao(missao);
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  const lista = await apiDoServidor<{ turmas: TurmaDaSelecao[] }>("/a-selecao/turmas");
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão, e
     o `map` concilia `serie: string | null` do contrato com o seletor. */
  const turmas: TurmaResumo[] = (lista?.turmas ?? [])
    .filter((t) => normalizarSerie(t.serie) === "7EF")
    .map((t) => ({ ...t, serie: t.serie ?? "" }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 7º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const base = `/a-selecao/turmas/${encodeURIComponent(turma)}`;
  const coberturas = turma ? await apiDoServidor<CoberturasDaTurma>(`${base}/coberturas`) : null;
  /* A atividade da página: a pedida, se ela é DESTA turma, e senão a em
     andamento. Um id de outra turma (link velho, colado à mão) não chega à api
     como se fosse desta. */
  const historico = coberturas?.historico ?? [];
  const atividadeId = historico.find((h) => h.id === cobertura)?.id ?? coberturas?.ativa?.id ?? null;
  const detalhe = atividadeId
    ? await apiDoServidor<CoberturaDaAtividade>(`${base}/coberturas/${encodeURIComponent(atividadeId)}`)
    : null;
  const emAndamento = detalhe?.ativa === true;

  const [painel, material, equipes, session, podcast, habilidades] =
    detalhe && atividadeId
      ? await Promise.all([
          emAndamento ? apiDoServidor<PainelDaSelecao>(`${base}/painel`) : Promise.resolve(null),
          /* Os gatilhos do botão (`prof.gatilho.*`) moram na api, junto do guia. */
          emAndamento ? apiDoServidor<MaterialDaSelecao>("/a-selecao/professor/material") : Promise.resolve(null),
          /* A linha do painel traz só o NOME da equipe; os membros vêm das
             equipes DESTA atividade, para a primeira célula dizer quem senta ali. */
          equipesDaMissao(turma, EXP_ID, atividadeId),
          auth(),
          apiDoServidor<PodcastDaTurma>(`${base}/podcast?coberturaId=${encodeURIComponent(atividadeId)}`),
          detalhe.rodadas > 0 || emAndamento ? painelDeHabilidades(turma, EXP_ID, atividadeId) : Promise.resolve(null),
        ])
      : [null, null, null, null, null, null];

  const membros: Record<string, MembroNoPainel[]> = Object.fromEntries(
    (equipes?.equipes ?? []).map((e) => [e.id, e.membros]),
  );
  const estado = ROTULO_DO_ESTADO[emAndamento ? "em-andamento" : "pronta"];

  return (
    <div className="flex flex-col gap-6">
      {detalhe ? <RotuloDaTrilha valor={`“${detalhe.tema}”`} /> : <RotuloDaTrilha valor="A aula e os resultados" />}

      <header className="flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">{missao.titulo}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
            {detalhe ? `“${detalhe.tema}”` : "A aula e os resultados"}
          </h1>
          {detalhe ? (
            <Badge variant={estado.variante} data-estado-da-atividade={emAndamento ? "em-andamento" : "pronta"}>
              {estado.rotulo}
            </Badge>
          ) : null}
        </div>
        {detalhe ? (
          <p className="text-[13px] text-unooria-neutral-600">
            {textoDasRodadas(detalhe.rodadas)}
            {emAndamento && detalhe.rodada ? ` · rodada ${detalhe.rodada} em andamento` : ""}
          </p>
        ) : null}
        <p className="flex flex-wrap gap-4 text-[13px] font-semibold">
          <Link href={ficha} className="text-unooria-navy-900 hover:text-unooria-neutral-950">
            Ver as atividades da turma
          </Link>
          {/* O guia à mão: é aqui que a professora está DURANTE a aula. */}
          {guia ? (
            <Link href={guia} className="text-unooria-navy-900 hover:text-unooria-neutral-950">
              Abrir o guia da aula
            </Link>
          ) : null}
        </p>
      </header>

      <SeletorDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. As atividades, o Mural e as etapas são por turma, e valem só para a que você
            escolher.
          </p>
        </Card>
      ) : coberturas === null ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos abrir esta turma"
          description="Confira se a turma é desta escola e tente de novo."
        />
      ) : !atividadeId || !detalhe ? (
        /* A plataforma não cria atividade (ADR-130): sem nenhuma em andamento, a
           turma vê a missão fechada, e o caminho é a lista da ficha. */
        <div className="flex flex-col gap-3" data-sem-atividade>
          <EmptyState
            variant="no-data"
            size="lg"
            bordered
            fullWidth
            title="Nenhuma atividade em andamento nesta turma"
            description="A turma vê a missão fechada até você criar uma atividade e pô-la no ar."
          />
          <div>
            <LinkButton href={ficha}>Ver as atividades da turma</LinkButton>
          </div>
        </div>
      ) : (
        <>
          {!detalhe.imagensAprovadasEm ? (
            /* A atividade parou na SEGUNDA fase da aprovação (ADR-146): os
               textos foram aprovados, as imagens não. É a mesma grade da
               criação, com o "Aprovar imagens" — e só depois dele o "Usar esta
               atividade agora" aparece. */
            <Card variant="outlined" title="Aprove as imagens antes de abrir a turma">
              <div className="flex flex-col gap-3" data-atividade-em-preparo>
                <FeedbackAlert
                  type="info"
                  description="Os textos desta atividade estão aprovados. Confira a imagem de cada post junto da legenda, gere outra para a que não servir e aprove: só então a atividade pode ir ao ar."
                />
                {session?.usuario.papel === "professor" ? (
                  <FaseDasImagens
                    key={`fase-das-imagens-${detalhe.id}`}
                    turmaId={turma}
                    coberturaId={detalhe.id}
                    posts={detalhe.posts}
                    imagensIniciais={detalhe.imagens}
                    comAprovacao
                  />
                ) : null}
              </div>
            </Card>
          ) : !emAndamento ? (
            <Card variant="outlined">
              <div className="flex flex-col gap-3" data-atividade-pronta>
                <FeedbackAlert
                  type="info"
                  title="Esta atividade está pronta, e a turma ainda não a vê"
                  description={
                    coberturas.ativa
                      ? `A turma está fazendo “${coberturas.ativa.tema}”. Quando for a vez desta, use o botão abaixo: quem estiver jogando passa para ela, numa rodada nova.`
                      : "Nenhuma atividade está em andamento: a turma vê a missão fechada. Prepare as equipes e as imagens, e use o botão abaixo quando a turma for fazer."
                  }
                />
                {session?.usuario.papel === "professor" ? (
                  <UsarEstaAtividade
                    expId={EXP_ID}
                    turmaId={turma}
                    atividadeId={detalhe.id}
                    titulo={detalhe.tema}
                    emAndamentoAgora={coberturas.ativa?.tema ?? null}
                    variante="primary"
                  />
                ) : null}
              </div>
            </Card>
          ) : null}

          <EquipesDaAtividade
            key={`equipes-${detalhe.id}`}
            turmaId={turma}
            expId={EXP_ID}
            atividadeId={detalhe.id}
            separarAoAbrir={separar}
          />

          {/* As aprovadas ANTES da ADR-146 podem ter post sem imagem: o laço
              antigo continua aqui para elas. As novas chegam completas. */}
          {detalhe.imagensAprovadasEm && detalhe.midia.prontas < detalhe.midia.total ? (
            <ImagensDaCobertura key={`imagens-${detalhe.id}`} turmaId={turma} coberturaId={detalhe.id} inicial={detalhe.midia} />
          ) : null}

          {emAndamento && painel ? (
            <>
              <PainelDaAulaASelecao
                key={`aula-${turma}-${detalhe.id}`}
                turmaId={turma}
                inicial={painel}
                gatilhos={material?.gatilhos ?? null}
                posts={detalhe.posts}
                membros={membros}
              />
              <ZerarTurmaASelecao turmaId={turma} nomeDaTurma={painel.turma.nome} tema={detalhe.tema} />
            </>
          ) : null}

          {/* Depois da aula: o podcast. A `key` é a atividade — o laço do áudio
              vive em `useState`. */}
          {podcast ? (
            <PodcastASelecao key={`podcast-${detalhe.id}`} turmaId={turma} coberturaId={detalhe.id} inicial={podcast} />
          ) : null}

          {/* O painel de habilidades (E14) — invisível sem ficha
              (`temFicha: false`), e só o `professor` confirma e ajusta: a
              coordenação lê. A `key` é a atividade. */}
          {habilidades?.temFicha ? (
            <div className="flex flex-col gap-3" data-habilidades-da-selecao>
              <PainelDeHabilidades
                key={detalhe.id}
                turmaId={turma}
                expId={EXP_ID}
                atividadeId={detalhe.id}
                inicial={habilidades}
                podeEditar={session?.usuario.papel === "professor"}
                rodadaEmAndamento={emAndamento ? (detalhe.rodada ?? null) : null}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
