import Link from "next/link";
import { Badge, Card, EmptyState, FeedbackAlert, Tag } from "@edu/ui/ds";
import { UsarEstaAtividade } from "@/components/atividades/usar-esta-atividade";
import { EquipesDaAtividade } from "@/components/equipes/equipes-da-ficha";
import { PainelDeHabilidades } from "@/components/evidencias/painel-de-habilidades";
import { LinkButton } from "@/components/link-button";
import { RotuloDaTrilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { ROTULO_DO_ESTADO, textoDasRodadas } from "@/lib/entre-redes/atividades";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import type { MembroNoPainel } from "@/lib/equipe-no-painel";
import { equipesDaMissao } from "@/lib/equipes-servidor";
import { painelDeHabilidades } from "@/lib/evidencias-servidor";
import { podcastDaAtividade } from "@/lib/podcast-servidor";
import {
  CAMINHO_DAS_TURMAS,
  CAMINHO_DO_MATERIAL,
  EXP_ID,
  ROTULO_DA_ORIGEM,
  avisoDoPodcast,
  caminhoDaTurma,
  estandesPorArea,
  rotuloCurtoDaArea,
  rotuloDaDisciplina,
  type MaterialDoJuri,
  type PacoteDetalhe,
  type PacotesDoJuri,
  type PainelDoJuri,
  type TurmaDoJuri,
} from "@/lib/juri-estadual-tipos";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { normalizarSerie } from "@/lib/series";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { CartaoDoEstande } from "./estande-do-preparo";
import { ImagensDoJuri } from "./imagens-do-juri";
import { PainelDaAulaJuriEstadual } from "./painel-da-aula-juri-estadual";
import { CartaoDoPodcast } from "./podcast-da-aula";
import { ZerarTurmaJuriEstadual } from "./zerar-turma-juri-estadual";

/**
 * A PÁGINA DE UMA ATIVIDADE do JÚRI ESTADUAL DE PROJETOS (ADR-130) — o pacote
 * de estandes que o professor criou, com tudo o que se faz com ele, nesta
 * ordem: pô-lo no ar (se está pronto), as equipes, as imagens, os estandes, a
 * aula ao vivo com o botão único e a lousa do pico, a folha por computador, o
 * zerar (só o em andamento), o podcast de recapitulação e o painel de
 * habilidades. Molde:
 * `resultados-jornal-escola.tsx` (exp04ef1b).
 *
 * A atividade vem de `?pacote=` — o card da lista de atividades da ficha —, e
 * sem ele é a em andamento. A CRIAÇÃO não mora aqui: é o "Nova atividade" da
 * ficha (`atividades/nova`, `criar-juri-estadual.tsx`). Sem atividade, a turma
 * vê a missão fechada: não há acervo padrão.
 *
 * Como cada rota da api é consumida (o contrato é
 * `apps/api/src/juri-estadual/contrato-de-rotas.ts`):
 *
 * - **daqui (servidor, `apiDoServidor`)**: `GET /juri-estadual/turmas`, `GET
 *   .../pacotes` (qual está em andamento, e o histórico que valida o
 *   `?pacote=`), `GET .../pacotes/:pacoteId` (a atividade, com os estandes e as
 *   imagens), e — só com ela em andamento — `GET .../painel` e `GET
 *   /juri-estadual/professor/material` (as perguntas da plenária, ao lado do
 *   botão); as equipes DESTA atividade e o painel de habilidades com
 *   `atividadeId = pacoteId`;
 * - **do navegador, pelo BFF** (`/api/plataforma/juri-estadual/...`): pôr em
 *   andamento, as imagens (`gerar-midia?pacoteId=`, `…/imagens/:projetoId/refazer`
 *   e `…/aprovar-imagens` — a segunda fase da aprovação), o gate, o zerar e o
 *   `GET .../painel` do polling.
 *
 * O painel, o gate e o zerar são da turma, não do pacote: com uma atividade
 * PRONTA na tela, mostrá-los conduziria a outra. Por isso só aparecem quando a
 * desta página é a em andamento.
 *
 * **Missão com ficha pedagógica (E14)**: a atividade é o PACOTE e a rodada é o
 * "Zerar". A REGRA QUE ESTA TELA APLICA: nenhum voto, taxa ou nível por
 * criança na folha (`PROIBIDO_NA_LINHA_DO_PAINEL`, na api). Os votos existem
 * só no agregado por área; o nível mora no painel de habilidades.
 */
export async function ResultadosJuriEstadual({
  missao,
  turma,
  pacote,
  separar,
}: {
  missao: Missao;
  turma: string;
  /** `?pacote=` — a atividade desta página. Vazio = a em andamento. */
  pacote: string;
  /** `?separar=N` — vindo da criação com "Eu separo": as N equipes vazias já abrem. */
  separar: number | null;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;
  const ficha = turma ? `${rotaDaMissao(missao)}?turmaId=${encodeURIComponent(turma)}` : rotaDaMissao(missao);
  const guia = missao.expId ? rotaDoGuiaDaMissao(missao.expId) : null;

  const lista = await apiDoServidor<{ turmas: TurmaDoJuri[] }>(CAMINHO_DAS_TURMAS);
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. */
  const turmas = (lista?.turmas ?? [])
    .filter((t) => normalizarSerie(t.serie) === "6EF")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 6º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const base = caminhoDaTurma(turma);
  const pacotes = turma ? await apiDoServidor<PacotesDoJuri>(`${base}/pacotes`) : null;
  /* A atividade da página: a pedida, se ela é DESTA turma, e senão a em
     andamento. Um id de outra turma (link velho, colado à mão) não chega à api
     como se fosse desta. */
  const historico = pacotes?.historico ?? [];
  const atividadeId = historico.find((h) => h.id === pacote)?.id ?? pacotes?.ativo?.id ?? null;
  const detalhe = atividadeId
    ? await apiDoServidor<PacoteDetalhe>(`${base}/pacotes/${encodeURIComponent(atividadeId)}`)
    : null;
  const emAndamento = detalhe?.ativo === true;

  const [painel, material, equipes, session, habilidades, podcast] =
    detalhe && atividadeId
      ? await Promise.all([
          emAndamento ? apiDoServidor<PainelDoJuri>(`${base}/painel`) : Promise.resolve(null),
          /* As perguntas da plenária moram na api, junto do guia: a frase que
             o professor projeta muda sem republicar o hub. */
          emAndamento ? apiDoServidor<MaterialDoJuri>(CAMINHO_DO_MATERIAL) : Promise.resolve(null),
          /* A linha desta api traz só o NOME da equipe; os membros vêm das
             equipes DESTA atividade, para a primeira célula dizer quem senta ali. */
          equipesDaMissao(turma, EXP_ID, atividadeId),
          auth(),
          /* Pacote que nunca rodou não tem o que mostrar no painel de
             habilidades — e a leitura dele custaria uma chamada à toa. */
          detalhe.rodadas > 0 || emAndamento ? painelDeHabilidades(turma, EXP_ID, atividadeId) : Promise.resolve(null),
          podcastDaAtividade(EXP_ID, turma, atividadeId),
        ])
      : [null, null, null, null, null, null];

  const membros: Record<string, MembroNoPainel[]> = Object.fromEntries(
    (equipes?.equipes ?? []).map((e) => [e.id, e.membros]),
  );
  /* Sem as imagens aprovadas (a segunda fase, o pedido do PO), a atividade não
     vai ao ar: "Em preparo", e o "Usar esta atividade agora" dá lugar à
     aprovação. A que já está no ar continua em andamento. */
  const prontaParaAula = detalhe ? detalhe.imagensAprovadasEm !== null : false;
  const chaveDoEstado = emAndamento ? "em-andamento" : prontaParaAula ? "pronta" : "em-preparo";
  const estado = ROTULO_DO_ESTADO[chaveDoEstado];
  const imagensDoJuri = detalhe ? (
    <ImagensDoJuri
      key={`imagens-${detalhe.id}`}
      turmaId={turma}
      pacoteId={detalhe.id}
      conteudo={detalhe.conteudo}
      imagensIniciais={detalhe.imagens}
      aprovadasEmInicial={detalhe.imagensAprovadasEm}
      podeEditar={session?.usuario.papel === "professor"}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* O rótulo do registro de rotas é o genérico; quem dá o nome próprio é a
          página: o tema da atividade, ou "A aula e os resultados" sem ela. */}
      {detalhe ? <RotuloDaTrilha valor={`“${detalhe.tema}”`} /> : <RotuloDaTrilha valor="A aula e os resultados" />}

      <header className="flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">{missao.titulo}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
            {detalhe ? `“${detalhe.tema}”` : "A aula e os resultados"}
          </h1>
          {detalhe ? (
            <Badge variant={estado.variante} data-estado-da-atividade={chaveDoEstado}>
              {estado.rotulo}
            </Badge>
          ) : null}
        </div>
        {detalhe ? (
          <p className="text-[13px] text-unooria-neutral-600" data-pacote={detalhe.id}>
            {rotuloDaDisciplina(detalhe.disciplina)} · {ROTULO_DA_ORIGEM[detalhe.origem]} · {textoDasRodadas(detalhe.rodadas)}
            {emAndamento && detalhe.rodada ? ` · rodada ${detalhe.rodada} em andamento` : ""}
          </p>
        ) : null}
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          Com a atividade em andamento, é daqui que você libera a Galeria Oculta com o botão da aula e projeta a lousa
          do pico: não quem votou em quê, mas <strong>como os votos da turma se dividiram</strong> entre as áreas, e o
          que mudou depois da galeria. O painel de votação pode ir para o projetor; a folha, não.
        </p>
        <p className="flex flex-wrap gap-4 text-[13px] font-semibold">
          <Link href={ficha} className="text-unooria-navy-900 hover:text-unooria-neutral-950">
            Ver as atividades da turma
          </Link>
          {/* O guia à mão: é aqui que o professor está DURANTE a aula. */}
          {guia ? (
            <Link href={guia} className="text-unooria-navy-900 hover:text-unooria-neutral-950">
              Abrir o guia da aula
            </Link>
          ) : null}
        </p>
      </header>

      <EscolhaDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. As atividades, o botão da aula e a folha são por turma, e valem só para a que você
            escolher.
          </p>
        </Card>
      ) : pacotes === null ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos abrir esta turma"
          description="Confira se a turma é desta escola e tente de novo."
        />
      ) : !atividadeId || !detalhe ? (
        /* A plataforma não cria atividade (ADR-130), e esta missão não tem
           acervo padrão: sem nenhuma em andamento, a turma vê a missão fechada. */
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
          {!emAndamento && !prontaParaAula ? (
            /* A turma não abre com imagem que o professor não viu: a api
               recusaria o "Usar esta atividade agora" com 409
               `imagens-nao-aprovadas`, então ele nem aparece. */
            <Card variant="outlined" title="Aprove as imagens antes de abrir a turma">
              <div className="flex flex-col gap-3" data-atividade-em-preparo>
                <FeedbackAlert
                  type="info"
                  description="As imagens dos estandes são geradas por inteligência artificial. Em “Imagens dos estandes”, logo abaixo, gere as que faltam, confira cada uma junto do estande, gere outra para a que não servir e aprove: só então a atividade pode ir ao ar."
                />
              </div>
            </Card>
          ) : !emAndamento ? (
            <Card variant="outlined">
              <div className="flex flex-col gap-3" data-atividade-pronta>
                <FeedbackAlert
                  type="info"
                  title="Esta atividade está pronta, e a turma ainda não a vê"
                  description={
                    pacotes.ativo
                      ? `A turma está fazendo “${pacotes.ativo.tema}”. Quando for a vez desta, use o botão abaixo: quem estiver jogando passa para ela, numa rodada nova.`
                      : "Nenhuma atividade está em andamento: a turma vê a missão fechada. Prepare as equipes e as imagens, e use o botão abaixo quando a turma for fazer."
                  }
                />
                {session?.usuario.papel === "professor" ? (
                  <UsarEstaAtividade
                    expId={EXP_ID}
                    turmaId={turma}
                    atividadeId={detalhe.id}
                    titulo={detalhe.tema}
                    emAndamentoAgora={pacotes.ativo?.tema ?? null}
                    variante="primary"
                  />
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* Em preparo, as imagens vêm ANTES das equipes: é o passo que falta. */}
          {!emAndamento && !prontaParaAula ? imagensDoJuri : null}

          <EquipesDaAtividade
            key={`equipes-${detalhe.id}`}
            turmaId={turma}
            expId={EXP_ID}
            atividadeId={detalhe.id}
            separarAoAbrir={separar}
          />

          {/* A `key` é a atividade: o laço das imagens vive em `useState`. */}
          {emAndamento || prontaParaAula ? imagensDoJuri : null}

          <EstandesDaAtividade detalhe={detalhe} />

          {emAndamento && painel ? (
            <>
              <PainelDaAulaJuriEstadual
                key={`aula-${turma}-${detalhe.id}`}
                turmaId={turma}
                inicial={painel}
                plenaria={material?.plenaria ?? null}
                membros={membros}
              />
              <ZerarTurmaJuriEstadual turmaId={turma} nomeDaTurma={painel.turma.nome} tema={detalhe.tema} />
            </>
          ) : null}

          {/* Depois da aula: o podcast da plataforma (ADR-150), com as falas que o
              professor revisou na criação. O podcast é do professor e é
              OPCIONAL (decisão do Lucas, 2026-10-07): ele toca na tela dele,
              para a sala, se e quando quiser. O episódio conta a virada da
              missão, então o aviso no topo RECOMENDA a hora — o fechamento,
              depois da Galeria Oculta —, sem travar. A etapa é a do painel (a
              mais fresca), e sem ele a gravada no pacote. */}
          <CartaoDoPodcast
            expId={EXP_ID}
            turmaId={turma}
            atividadeId={detalhe.id}
            podcast={podcast}
            aviso={avisoDoPodcast(emAndamento, painel?.etapa ?? detalhe.etapa)}
          />

          {/* O painel de habilidades (E14) — invisível sem ficha
              (`temFicha: false`), e só o `professor` confirma e ajusta: a
              coordenação lê. A `key` é a atividade. */}
          {habilidades?.temFicha ? (
            <div className="flex flex-col gap-3" data-habilidades-do-juri>
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

/**
 * Os dezesseis estandes da atividade, só leitura, por área — para o professor
 * reconhecer o estande que a criança cita pelo título ou pela escola. Editar
 * é na criação: a atividade gravada é o que a turma viu.
 */
function EstandesDaAtividade({ detalhe }: { detalhe: PacoteDetalhe }) {
  return (
    <Card variant="outlined" title="Os estandes da mostra">
      <div className="flex flex-col gap-6" data-estandes-da-atividade>
        <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
          É o que a turma encontra no feed e na Galeria Oculta. Cada computador vê só uma parte deles antes da galeria
          — qual parte depende do que ele curtiu.
        </p>
        {estandesPorArea(detalhe.conteudo).map(({ categoria, projetos }) => (
          <section key={categoria.area} className="flex flex-col gap-3" data-area={categoria.area}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold text-unooria-neutral-950">
                {rotuloCurtoDaArea(categoria.area)} — {categoria.nome}
              </span>
              <Tag variant="info" size="sm">
                {categoria.hashtag}
              </Tag>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {projetos.map((p) => (
                <CartaoDoEstande key={p.id} projeto={p} imagem={detalhe.imagens[p.id]} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}
