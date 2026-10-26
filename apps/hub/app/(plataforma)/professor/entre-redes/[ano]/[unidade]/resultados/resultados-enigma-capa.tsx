import Link from "next/link";

import { dataHora } from "@edu/sdk";
import { Badge, Card, EmptyState, FeedbackAlert, SectionHeader, Tag } from "@edu/ui/ds";
import { AbasDaAtividade } from "@/components/atividades/abas-da-atividade";
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
import { podcastDaAtividade } from "@/lib/podcast-servidor";
import { baseDoBundleDaExperiencia } from "@/lib/bundle-da-experiencia";
import {
  caminhoDaTurma,
  marcasDoConteudo,
  rotuloDaDisciplina,
  type PacoteDetalhe,
  type PacotesDaTurmaEnigma,
  type PainelDaTurma,
} from "@/lib/enigma-capa-tipos";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { salaDaTurma } from "@/lib/salas";
import { normalizarSerie } from "@/lib/series";
import { minhasTurmas } from "@/lib/turmas";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { CenaDoEnigma } from "./cena-do-enigma";
import { PainelDaAulaEnigmaCapa } from "./painel-da-aula-enigma-capa";
import { CartaoDoPodcast } from "./podcast-da-aula";
import { ZerarTurmaEnigmaCapa } from "./zerar-turma-enigma-capa";

const EXP_ID = "exp02ef1b";
const ROTULO_DA_ORIGEM = { ia: "Gerada com IA e aprovada por você", padrao: "Pacote pronto da Unooria" } as const;

/**
 * A PÁGINA DE UMA ATIVIDADE de O ENIGMA DA CAPA DA RÁDIO (ADR-184, ADR-130) —
 * o pacote aprovado, com tudo o que se faz com ele, nas cinco abas do template
 * (ADR-182): pô-lo no ar (se está pronto), a aula ao vivo (LIBERAR VIRADA e a
 * folha) e o "Zerar" só no em andamento, a cena com o gabarito, as equipes, o
 * podcast fixo e o painel de habilidades (EF02CO05 e EF02CO01). Molde: a de O
 * Efeito Amplificador.
 *
 * Painel, botão e "Zerar" operam SEMPRE no pacote em andamento (a api não
 * recebe o pacote neles): por isso só aparecem quando a atividade da página É
 * a em andamento.
 */
export async function ResultadosEnigmaCapa({
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

  const [todas, session, baseDoBundle] = await Promise.all([minhasTurmas(), auth(), baseDoBundleDaExperiencia(EXP_ID)]);
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. Sem
     turma da série, o certo é dizer isso (e não oferecer as outras). */
  const turmas = todas
    .filter((t) => normalizarSerie(t.serie) === "2EF")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 2º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;
  /* Só o professor conduz; a coordenação lê. A api recusaria o resto de qualquer jeito. */
  const podeConduzir = session?.usuario.papel === "professor";

  const base = caminhoDaTurma(turma);
  const pacotes = turma ? await apiDoServidor<PacotesDaTurmaEnigma>(`${base}/pacotes`) : null;
  /* A atividade da página: a pedida, se ela é DESTA turma, e senão a em
     andamento. Um id de outra turma (link velho, colado à mão) não chega à api
     como se fosse desta. */
  const historico = pacotes?.historico ?? [];
  const atividadeId = historico.find((h) => h.id === pacote)?.id ?? pacotes?.emAndamento?.pacoteId ?? null;
  const detalhe = atividadeId
    ? await apiDoServidor<PacoteDetalhe>(`${base}/pacotes/${encodeURIComponent(atividadeId)}`)
    : null;
  const emAndamento = detalhe?.ativo === true;
  const tituloDoEmAndamento = historico.find((h) => h.ativo)?.tema ?? null;

  const [painel, sala, habilidades, podcast] =
    detalhe && atividadeId
      ? await Promise.all([
          emAndamento ? apiDoServidor<PainelDaTurma>(`${base}/painel`) : Promise.resolve(null),
          podeConduzir ? salaDaTurma(turma) : Promise.resolve(null),
          detalhe.rodadas > 0 || emAndamento ? painelDeHabilidades(turma, EXP_ID, atividadeId) : Promise.resolve(null),
          podcastDaAtividade(EXP_ID, turma, atividadeId),
        ])
      : [null, null, null, null];

  /* A atividade que o painel conta é a EM ANDAMENTO da turma; se outra aba trocou entre as duas leituras, ele não aparece. */
  const atividadeDoPainel = painel?.atividade && painel.atividade.pacoteId === detalhe?.id ? painel.atividade : null;
  /* A SALA (ADR-69) é a outra porta, e é da TURMA, não da atividade: sem a
     missão liberada na sala, o cartão fica com cadeado para as crianças, esteja
     a atividade em andamento ou não. A liberação acontece na sala — daqui, o
     atalho para lá. */
  const naSala = sala?.missoes.find((m) => m.expId === EXP_ID) ?? null;
  const liberadaEm = naSala ? (naSala.estado === "encerrada" ? naSala.encerradaEm : naSala.liberadaEm) : null;
  const rotaDaSala = `/professor/turmas/${encodeURIComponent(turma)}?aba=missoes`;
  const disciplina = detalhe ? rotuloDaDisciplina(detalhe.disciplina) : null;
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
            Daqui você acompanha quem aguarda a virada e toca em LIBERAR VIRADA, uma vez, para a turma toda.{" "}
            <strong>A folha da turma, com os nomes, é só para a sua tela</strong>.
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
            Escolha a turma acima. As atividades, o botão da virada e a folha são por turma, e valem só para a que
            você escolher.
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

          {/* A outra porta da aula, a liberação na sala, fica FORA das abas: sem
              ela o cartão tem cadeado para as crianças, e o aviso não pode
              depender de abrir a aba do conteúdo. */}
          {naSala && naSala.estado !== "liberada" ? (
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

          {/* O resto é o template da página da atividade (ADR-182): cinco abas
              com o mesmo nome em toda missão. */}
          <AbasDaAtividade
            estado={emAndamento ? "em-andamento" : "pronta"}
            aula={
              /* As `key` NÃO são otimização: o painel guarda estado em
                 `useState(inicial)`, e trocar de turma ou de atividade pela URL sem
                 remontar mostraria a aula de uma na outra. */
              emAndamento && painel ? (
                <>
                  <PainelDaAulaEnigmaCapa key={`aula-${turma}-${detalhe.id}`} turmaId={turma} inicial={painel} podeConduzir={podeConduzir} />
                  {podeConduzir && atividadeDoPainel ? (
                    <ZerarTurmaEnigmaCapa
                      key={`zerar-${turma}-${atividadeDoPainel.pacoteId}-${atividadeDoPainel.rodada}`}
                      turmaId={turma}
                      nomeDaTurma={painel.turma.nome}
                      rodada={atividadeDoPainel.rodada}
                    />
                  ) : null}
                </>
              ) : null
            }
            conteudo={
              /* O pacote, com o gabarito (só o professor e a coordenação chegam aqui). */
              <Card variant="elevated">
                <div className="flex flex-col gap-4" data-pacote-da-atividade={detalhe.id}>
                  <SectionHeader title={`A cena — ${detalhe.conteudo.cena.espaco}`} description={`Tema: ${detalhe.tema}`} />
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
                        ? "A turma já pode entrar na missão."
                        : "Quando esta atividade estiver em andamento, a turma já entra nela."}
                    </p>
                  ) : null}

                  <CenaDaAtividade pacote={detalhe} baseDoBundle={baseDoBundle} />
                </div>
              </Card>
            }
            equipes={
              <EquipesDaAtividade
                key={`equipes-${detalhe.id}`}
                turmaId={turma}
                expId={EXP_ID}
                atividadeId={detalhe.id}
                separarAoAbrir={separar}
              />
            }
            podcast={
              /* Depois da aula: o podcast da plataforma (ADR-150) — fixo, o roteiro do §11 do one-pager (Iara e Bento). */
              <CartaoDoPodcast expId={EXP_ID} turmaId={turma} atividadeId={detalhe.id} podcast={podcast} />
            }
            habilidades={
              /* EVIDÊNCIA (E14): a atividade é o PACOTE (`atividadeId = pacoteId`);
                 a rodada é a reaplicação, e o próprio painel mostra as rodadas e o
                 resultado. Invisível sem ficha (`temFicha: false`), e só o
                 `professor` confirma e ajusta: a coordenação lê. */
              habilidades?.temFicha ? (
                <div className="flex flex-col gap-3" data-habilidades-enigma-capa>
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
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}

/**
 * A cena da atividade COM o gabarito — só professor e coordenação chegam aqui:
 * a panorâmica com as duas molduras e os dois objetos iguais, o que a
 * visitante diz para cada foto, os selos e o que pode ficar "fora da foto".
 */
function CenaDaAtividade({ pacote, baseDoBundle }: { pacote: PacoteDetalhe; baseDoBundle: string | null }) {
  const cena = pacote.conteudo.cena;
  return (
    <div className="flex flex-col gap-4 text-[13px] text-unooria-neutral-800">
      <CenaDoEnigma conteudo={pacote.conteudo} baseDoBundle={baseDoBundle} marcas={marcasDoConteudo(pacote.conteudo)} />
      <div className="grid gap-3 lg:grid-cols-2">
        {cena.fotos.map((foto, i) => {
          const selo = cena.selos.find((s) => s.id === foto.seloCoerente);
          return (
            <div key={foto.id} className="flex flex-col gap-1 rounded-lg border border-unooria-neutral-200 p-3" data-foto={foto.id}>
              <strong className="text-[14px] text-unooria-neutral-950">{`FOTO ${i + 1} — ${foto.acao}`}</strong>
              <span>{`A visitante: “${foto.visitante}”`}</span>
              <span className="text-unooria-neutral-600">{`O selo que combina: ${selo ? `${selo.emoji} ${selo.texto}` : "—"}`}</span>
            </div>
          );
        })}
      </div>
      <p>
        <strong>Os dois objetos iguais do fundo:</strong> {cena.invariantes.map((i) => i.nome).join(" e ")}.
      </p>
      <p>
        <strong>O que pode ficar fora da foto:</strong> {[...new Set(cena.marcaveis.map((m) => m.nome))].join(", ")}.
      </p>
    </div>
  );
}
