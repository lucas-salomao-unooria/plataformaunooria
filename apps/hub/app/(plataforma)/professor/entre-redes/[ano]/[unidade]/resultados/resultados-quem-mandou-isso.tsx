import Link from "next/link";

import { dataHora } from "@edu/sdk";
import { Badge, Card, EmptyState, FeedbackAlert, SectionHeader, Tag } from "@edu/ui/ds";
import { UsarEstaAtividade } from "@/components/atividades/usar-esta-atividade";
import { EquipesDaAtividade } from "@/components/equipes/equipes-da-ficha";
import { PainelDeHabilidades } from "@/components/evidencias/painel-de-habilidades";
import { LinkButton } from "@/components/link-button";
import { RotuloDaTrilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { ROTULO_DO_ESTADO, textoDasRodadas } from "@/lib/entre-redes/atividades";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import { painelDeHabilidades } from "@/lib/evidencias-servidor";
import { rubricaDaRodada } from "@/lib/quem-mandou-regras";
import {
  ROTULO_DA_ORIGEM,
  type MaterialDoProfessor,
  type PacoteDaAtividadeQuemMandou,
  type PacoteDaTurma,
  type PacotesDaTurmaQuemMandou,
  type PainelDaTurma,
} from "@/lib/quem-mandou-tipos";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { salaDaTurma } from "@/lib/salas";
import { normalizarSerie } from "@/lib/series";
import { minhasTurmas } from "@/lib/turmas";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { MensagensDoPacote } from "./matriz-do-pacote-quem-mandou";
import { PainelDaAulaQuemMandou } from "./painel-da-aula-quem-mandou";
import { ZerarTurmaQuemMandou } from "./zerar-turma-quem-mandou";

const EXP_ID = "exp05ef1b";

/**
 * A PÁGINA DE UMA ATIVIDADE de QUEM MANDOU ISSO? (ADR-130) — o pacote de
 * mensagens que a professora criou, com tudo o que se faz com ele, nesta
 * ordem: pô-lo no ar (se está pronto), o pacote e a liberação na sala, as
 * equipes, a aula ao vivo com os três botões e o Termômetro (só o em
 * andamento), o "Zerar" e o painel de habilidades.
 *
 * A atividade vem de `?pacote=` — o card da lista de atividades da ficha —, e
 * sem ele é a em andamento. A CRIAÇÃO não mora mais aqui: é o "Nova atividade"
 * da ficha (`atividades/nova`), porque aprovar um pacote não põe no ar, e o
 * preparo da próxima aula não pode trocar, por engano, a que está rodando.
 *
 * Como cada rota da api é consumida (o contrato é
 * `apps/api/src/quem-mandou-isso/contrato-de-rotas.ts`):
 *
 * - **daqui (servidor, `apiDoServidor`)**: `GET .../pacotes` (as atividades e a
 *   em andamento), `GET .../pacotes/:pacoteId` (a desta página, com o
 *   gabarito), `GET .../pacote` (só pelo rótulo das disciplinas), e — só com a
 *   atividade em andamento — `GET .../painel` e `GET
 *   /quem-mandou-isso/professor/material` (os rótulos da enquete e do `Se`,
 *   que a folha e o Termômetro mostram como a criança leu); mais a sala da
 *   turma (a liberação, ADR-69) e o painel de habilidades da E14 com
 *   `atividadeId = pacoteId`;
 * - **do navegador, pelo BFF** (`/api/plataforma/quem-mandou-isso/...`):
 *   `POST .../pacotes/:id/em-andamento` (o "Usar esta atividade agora"),
 *   `POST /gate`, `POST /nova-rodada` e o `GET /painel` do polling — a
 *   professora aperta na frente da sala.
 *
 * Painel e "Zerar" operam SEMPRE no pacote em andamento (a api não recebe o
 * pacote neles): por isso só aparecem quando a atividade da página É a em
 * andamento. Numa pronta, eles mexeriam na aula de outra.
 *
 * A turma vem da lista do professor (`GET /turmas/minhas`) filtrada pela série
 * da missão: a api desta missão não tem rota de lista, e as turmas de outra
 * série não são ruído, são o convite a abrir a turma errada.
 */
export async function ResultadosQuemMandouIsso({
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
  const ficha = comTurma(rotaDaMissao(missao), turma);
  const guia = rotaDoGuiaDaMissao(EXP_ID);

  const [todas, session] = await Promise.all([minhasTurmas(), auth()]);
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. Sem
     turma da série, o certo é dizer isso (e não oferecer as outras). */
  const turmas = todas
    .filter((t) => normalizarSerie(t.serie) === "5EF")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 5º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;
  /* Só o professor conduz; a coordenação lê. A api recusaria o resto de qualquer jeito. */
  const podeConduzir = session?.usuario.papel === "professor";

  const base = `/quem-mandou-isso/turmas/${encodeURIComponent(turma)}`;
  const pacotes = turma ? await apiDoServidor<PacotesDaTurmaQuemMandou>(`${base}/pacotes`) : null;
  /* A atividade da página: a pedida, se ela é DESTA turma, e senão a em
     andamento. Um id de outra turma (link velho, colado à mão) não chega à api
     como se fosse desta. */
  const historico = pacotes?.historico ?? [];
  const atividadeId = historico.find((h) => h.id === pacote)?.id ?? pacotes?.emAndamento?.pacoteId ?? null;
  const detalhe = atividadeId
    ? await apiDoServidor<PacoteDaAtividadeQuemMandou>(`${base}/pacotes/${encodeURIComponent(atividadeId)}`)
    : null;
  const emAndamento = detalhe?.ativo === true;
  const tituloDoEmAndamento = historico.find((h) => h.ativo)?.tema ?? null;

  const [painel, material, preparo, sala, habilidades] =
    detalhe && atividadeId
      ? await Promise.all([
          emAndamento ? apiDoServidor<PainelDaTurma>(`${base}/painel`) : Promise.resolve(null),
          emAndamento ? apiDoServidor<MaterialDoProfessor>("/quem-mandou-isso/professor/material") : Promise.resolve(null),
          apiDoServidor<PacoteDaTurma>(`${base}/pacote`),
          podeConduzir ? salaDaTurma(turma) : Promise.resolve(null),
          detalhe.rodadas > 0 || emAndamento ? painelDeHabilidades(turma, EXP_ID, atividadeId) : Promise.resolve(null),
        ])
      : [null, null, null, null, null];

  /* A atividade que o painel conta é a EM ANDAMENTO da turma; se ela não for a
     desta página (outra aba trocou entre as duas leituras), a folha não nomeia
     as escolhas com mensagens de outro pacote. */
  const atividadeDoPainel = painel?.atividade && painel.atividade.pacoteId === detalhe?.id ? painel.atividade : null;
  const mensagens = atividadeDoPainel && detalhe ? detalhe.mensagens : [];
  const opcoes = material?.opcoes ?? { motivos: [], condicoes: [] };
  /* A rubrica do Se/Então (ADR-120): o que o professor já classificou NESTA rodada. */
  const rubrica =
    podeConduzir && atividadeDoPainel && habilidades?.temFicha
      ? rubricaDaRodada(habilidades.estudantes, atividadeDoPainel)
      : null;

  /* A SALA (ADR-69) é a outra porta, e é da TURMA, não da atividade: sem a
     missão liberada na sala, o card fica com cadeado para as crianças, esteja
     a atividade em andamento ou não. A liberação acontece na sala — daqui, o
     atalho para lá. */
  const naSala = sala?.missoes.find((m) => m.expId === EXP_ID) ?? null;
  const liberadaEm = naSala ? (naSala.estado === "encerrada" ? naSala.encerradaEm : naSala.liberadaEm) : null;
  const rotaDaSala = `/professor/turmas/${encodeURIComponent(turma)}?aba=missoes`;
  const disciplina = detalhe
    ? (preparo?.disciplinas.find((d) => d.slug === detalhe.disciplina)?.rotulo ?? detalhe.disciplina)
    : null;
  const estado = ROTULO_DO_ESTADO[emAndamento ? "em-andamento" : "pronta"];

  return (
    <div className="flex flex-col gap-6">
      {/* Sem atividade, esta missão chama a tela de "A aula e os resultados" (o
          rótulo do registro de rotas é o genérico, e quem o corrige é a página);
          com ela, a trilha diz qual atividade é. */}
      <RotuloDaTrilha valor={detalhe ? `“${detalhe.tema}”` : "A aula e os resultados"} />

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
            {emAndamento ? ` · rodada ${detalhe.rodadaAtual} em andamento` : ""}
          </p>
        ) : null}
        {emAndamento ? (
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            Daqui você libera a revelação, a síntese e a reflexão, e acompanha o que cada estudante escolheu. Os
            selos das mensagens e a folha com nomes são só para a sua tela:{" "}
            <strong>para o telão, use Projetar o Termômetro</strong>.
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

      <EscolhaDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {turma === "" ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a turma acima. As atividades, os três botões da aula e a folha são por turma, e valem só para a
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
          description="Confira se a turma é sua e desta escola, e tente de novo."
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
                    tituloDoEmAndamento
                      ? `A turma está fazendo “${tituloDoEmAndamento}”. Quando for a vez desta, use o botão abaixo: quem estiver jogando passa para ela, numa rodada nova.`
                      : "Nenhuma atividade está em andamento: a turma vê a missão fechada. Prepare as equipes e use o botão abaixo quando a turma for fazer."
                  }
                />
                {podeConduzir ? (
                  <UsarEstaAtividade
                    expId={EXP_ID}
                    turmaId={turma}
                    atividadeId={detalhe.id}
                    titulo={detalhe.tema}
                    emAndamentoAgora={tituloDoEmAndamento}
                    variante="primary"
                  />
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* O pacote, com o gabarito (só o professor e a coordenação chegam
              aqui), e a outra porta da aula: a liberação na sala. */}
          <Card variant="elevated">
            <div className="flex flex-col gap-4" data-pacote-da-atividade={detalhe.id}>
              <SectionHeader
                title="O pacote de mensagens"
                description={`Tema: ${detalhe.tema} • ${detalhe.mensagens.length} mensagens validadas`}
              />
              <dl className="grid gap-x-6 gap-y-1 text-[13px] text-unooria-neutral-700 sm:grid-cols-[max-content_1fr]">
                <dt className="font-semibold text-unooria-neutral-500">Componente</dt>
                <dd>{disciplina}</dd>
                <dt className="font-semibold text-unooria-neutral-500">Origem</dt>
                <dd>{ROTULO_DA_ORIGEM[detalhe.origem]}</dd>
                <dt className="font-semibold text-unooria-neutral-500">Criada em</dt>
                <dd>{detalhe.aprovadoEm ? dataHora(detalhe.aprovadoEm) : "—"}</dd>
              </dl>

              {naSala?.estado === "liberada" ? (
                <p className="text-[13px] text-unooria-neutral-700" data-liberacao-na-sala="liberada">
                  <Tag variant="success" size="sm">
                    Liberada na sala
                  </Tag>{" "}
                  {liberadaEm ? `desde ${dataHora(liberadaEm)}. ` : ""}
                  {emAndamento
                    ? "A turma já pode entrar no grupo."
                    : "Quando esta atividade estiver em andamento, a turma já entra nela."}
                </p>
              ) : naSala ? (
                <div data-liberacao-na-sala={naSala.estado}>
                  <FeedbackAlert
                    type="warning"
                    title={
                      naSala.estado === "encerrada"
                        ? "A missão está encerrada na sala desta turma"
                        : "A missão ainda não está liberada para esta turma"
                    }
                    description="Sem a liberação na sala de aula, o cartão fica com cadeado para as crianças — a atividade em andamento não basta."
                    action={
                      <LinkButton href={rotaDaSala} size="sm">
                        Liberar Missão para a Turma
                      </LinkButton>
                    }
                  />
                </div>
              ) : null}

              <MensagensDoPacote mensagens={detalhe.mensagens} />
            </div>
          </Card>

          <EquipesDaAtividade
            key={`equipes-${detalhe.id}`}
            turmaId={turma}
            expId={EXP_ID}
            atividadeId={detalhe.id}
            separarAoAbrir={separar}
          />

          {/* As `key` NÃO são otimização: o painel guarda estado em
              `useState(inicial)`, e trocar de turma ou de atividade pela URL sem
              remontar mostraria a aula de uma na outra. */}
          {emAndamento && painel ? (
            <>
              <PainelDaAulaQuemMandou
                key={`aula-${turma}-${detalhe.id}`}
                turmaId={turma}
                inicial={painel}
                mensagens={mensagens}
                opcoes={opcoes}
                podeConduzir={podeConduzir}
                rubrica={rubrica}
              />
              {podeConduzir && atividadeDoPainel ? (
                <ZerarTurmaQuemMandou
                  key={`zerar-${turma}-${atividadeDoPainel.pacoteId}-${atividadeDoPainel.rodada}`}
                  turmaId={turma}
                  nomeDaTurma={painel.turma.nome}
                  rodada={atividadeDoPainel.rodada}
                />
              ) : null}
            </>
          ) : null}

          {/* EVIDÊNCIA (E14): a atividade é o PACOTE (`atividadeId = pacoteId`);
              a rodada é a reaplicação, e o próprio painel mostra as rodadas e o
              resultado. Invisível sem ficha (`temFicha: false`), e só o
              `professor` confirma e ajusta: a coordenação lê. */}
          {habilidades?.temFicha ? (
            <div className="flex flex-col gap-3" data-habilidades-quem-mandou>
              <PainelDeHabilidades
                key={`habilidades-${turma}-${detalhe.id}`}
                turmaId={turma}
                expId={EXP_ID}
                atividadeId={detalhe.id}
                inicial={habilidades}
                podeEditar={podeConduzir}
                rodadaEmAndamento={emAndamento ? detalhe.rodadaAtual : null}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
