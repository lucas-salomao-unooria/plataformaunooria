import Link from "next/link";
import { Badge, Card, EmptyState, FeedbackAlert } from "@edu/ui/ds";
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
import {
  ROTULO_DA_ORIGEM,
  type MaterialDoJornal,
  type PacoteDaAtividade,
  type PacotesDaTurma,
  type PainelDoJornal,
  type TurmaDoJornal,
} from "@/lib/jornal-escola-tipos";
import { rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { normalizarSerie } from "@/lib/series";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { ImagensDoPacote } from "./imagens-do-pacote";
import { PainelDaAulaJornalEscola } from "./painel-da-aula-jornal-escola";
import { ZerarTurmaJornalEscola } from "./zerar-turma-jornal-escola";

const EXP_ID = "exp04ef1b";

/**
 * A PÁGINA DE UMA ATIVIDADE do JORNAL DA ESCOLA (ADR-130) — o pacote de
 * notícias que o professor criou, com tudo o que se faz com ele, nesta ordem:
 * pô-lo no ar (se está pronto), as equipes, as imagens, a aula ao vivo com o
 * botão único, o gráfico para projetar, o radar e a folha por computador, o
 * zerar (só o em andamento) e o painel de habilidades. Molde:
 * `resultados-a-selecao.tsx` (exp07ef1b).
 *
 * A atividade vem de `?pacote=` — o card da lista de atividades da ficha —, e
 * sem ele é a em andamento. A CRIAÇÃO não mora mais aqui: é o "Nova atividade"
 * da ficha (`atividades/nova`, `criar-jornal-escola.tsx`), porque criar não põe
 * no ar e o preparo de uma aula não pode trocar, por engano, a que está
 * rodando. E esta missão deixou de nascer com o banco padrão em andamento: sem
 * atividade, a turma vê a missão fechada.
 *
 * Como cada rota da api é consumida (o contrato é
 * `apps/api/src/jornal-escola/contrato-de-rotas.ts`):
 *
 * - **daqui (servidor, `apiDoServidor`)**: `GET /jornal-escola/turmas`, `GET
 *   .../pacotes` (qual está em andamento, e o histórico que valida o
 *   `?pacote=`), `GET .../pacotes/:pacoteId` (a atividade COM gabarito), e —
 *   só com ela em andamento — `GET .../painel` e `GET
 *   /jornal-escola/professor/material` (o roteiro da mediação que o painel
 *   mostra ao lado do botão); as equipes DESTA atividade e o painel de
 *   habilidades com `atividadeId = pacoteId`;
 * - **do navegador, pelo BFF** (`/api/plataforma/jornal-escola/...`): pôr em
 *   andamento, as imagens (`gerar-midia?pacoteId=`), o gate, o zerar e o `GET
 *   .../painel` do polling.
 *
 * O painel, o gate e o zerar respondem 403 `atividade-nao-preparada` sem nada
 * em andamento — e são da turma, não do pacote: com uma atividade PRONTA na
 * tela, mostrá-los conduziria a outra. Por isso só aparecem quando a desta
 * página é a em andamento.
 *
 * **Missão com ficha pedagógica (E14)**: a atividade é o PACOTE e a rodada é o
 * "Zerar". A REGRA QUE ESTA TELA APLICA: nenhuma coluna de nível, nota ou
 * acerto na folha (`PROIBIDO_NA_LINHA_DO_PAINEL`, na api). Quantas notícias
 * cada um verificou existe só no histograma anônimo; o nível mora no painel de
 * habilidades, com a origem e o ajuste do professor.
 */
export async function ResultadosJornalEscola({
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

  const lista = await apiDoServidor<{ turmas: TurmaDoJornal[] }>("/jornal-escola/turmas");
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. Sem
     turma da série, o certo é dizer isso (e não oferecer as outras). */
  const turmas = (lista?.turmas ?? [])
    .filter((t) => normalizarSerie(t.serie) === "4EF")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 4º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const base = `/jornal-escola/turmas/${encodeURIComponent(turma)}`;
  const pacotes = turma ? await apiDoServidor<PacotesDaTurma>(`${base}/pacotes`) : null;
  /* A atividade da página: a pedida, se ela é DESTA turma, e senão a em
     andamento. Um id de outra turma (link velho, colado à mão) não chega à api
     como se fosse desta. */
  const historico = pacotes?.historico ?? [];
  const atividadeId = historico.find((h) => h.id === pacote)?.id ?? pacotes?.ativo?.id ?? null;
  const detalhe = atividadeId
    ? await apiDoServidor<PacoteDaAtividade>(`${base}/pacotes/${encodeURIComponent(atividadeId)}`)
    : null;
  const emAndamento = detalhe?.ativo === true;

  const [painel, material, equipes, session, habilidades] =
    detalhe && atividadeId
      ? await Promise.all([
          emAndamento ? apiDoServidor<PainelDoJornal>(`${base}/painel`) : Promise.resolve(null),
          /* O roteiro da mediação (copy revisada, §4b) mora na api, junto do
             guia: a frase que o professor diz ao apertar muda sem republicar o hub. */
          emAndamento ? apiDoServidor<MaterialDoJornal>("/jornal-escola/professor/material") : Promise.resolve(null),
          /* A linha desta api traz só o NOME da equipe; os membros vêm das
             equipes DESTA atividade, para a primeira célula dizer quem senta ali. */
          equipesDaMissao(turma, EXP_ID, atividadeId),
          auth(),
          /* Pacote que nunca rodou não tem o que mostrar no painel de
             habilidades — e a leitura dele custaria uma chamada à toa. */
          detalhe.rodadas > 0 || emAndamento ? painelDeHabilidades(turma, EXP_ID, atividadeId) : Promise.resolve(null),
        ])
      : [null, null, null, null, null];

  const membros: Record<string, MembroNoPainel[]> = Object.fromEntries(
    (equipes?.equipes ?? []).map((e) => [e.id, e.membros]),
  );
  const estado = ROTULO_DO_ESTADO[emAndamento ? "em-andamento" : "pronta"];

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
            <Badge variant={estado.variante} data-estado-da-atividade={emAndamento ? "em-andamento" : "pronta"}>
              {estado.rotulo}
            </Badge>
          ) : null}
        </div>
        {detalhe ? (
          <p className="text-[13px] text-unooria-neutral-600" data-pacote={detalhe.id}>
            {detalhe.disciplina} · {ROTULO_DA_ORIGEM[detalhe.origem]} · {textoDasRodadas(detalhe.rodadas)}
            {emAndamento && detalhe.rodada ? ` · rodada ${detalhe.rodada} em andamento` : ""}
          </p>
        ) : null}
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          Com a atividade em andamento, é daqui que você libera o resultado e a revisão com o botão da aula, e lê o
          retrato da turma: não quem acertou, mas <strong>o que cada capa publicou</strong> e o que mudou da 1ª para
          a 2ª edição. O gráfico anônimo pode ir para o projetor; o radar e a folha, não.
        </p>
        <p className="flex flex-wrap gap-4 text-[13px] font-semibold">
          <Link href={ficha} className="text-unooria-navy-900 hover:text-unooria-neutral-950">
            Ver as atividades da turma
          </Link>
          {/* O guia à mão: é aqui que o professor está DURANTE a aula, e é daqui
              que ele relê o roteiro sem perder o painel de vista. */}
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
            Escolha a turma acima. As atividades, os dois portões da aula e a folha são por turma, e valem só para a
            que você escolher.
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
          {!emAndamento ? (
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

          <EquipesDaAtividade
            key={`equipes-${detalhe.id}`}
            turmaId={turma}
            expId={EXP_ID}
            atividadeId={detalhe.id}
            separarAoAbrir={separar}
          />

          {/* A `key` é a atividade: o laço das imagens vive em `useState`. */}
          <ImagensDoPacote key={`imagens-${detalhe.id}`} turmaId={turma} pacoteId={detalhe.id} inicial={detalhe.midia} />

          {emAndamento && painel ? (
            <>
              <PainelDaAulaJornalEscola
                key={`aula-${turma}-${detalhe.id}`}
                turmaId={turma}
                inicial={painel}
                roteiro={material?.roteiro ?? null}
                membros={membros}
              />
              <ZerarTurmaJornalEscola turmaId={turma} nomeDaTurma={painel.turma.nome} tema={detalhe.tema} />
            </>
          ) : null}

          {/* O painel de habilidades (E14) — invisível sem ficha
              (`temFicha: false`), e só o `professor` confirma e ajusta: a
              coordenação lê. A `key` é a atividade: trocar de pacote recomeça o
              recorte e a seleção dele. */}
          {habilidades?.temFicha ? (
            <div className="flex flex-col gap-3" data-habilidades-do-jornal>
              <PainelDeHabilidades
                key={detalhe.id}
                turmaId={turma}
                expId={EXP_ID}
                atividadeId={detalhe.id}
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
