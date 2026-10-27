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
import {
  CRITERIOS_INICIAIS,
  ITENS_DO_PACOTE,
  ROTAS_DA_CURADORIA,
  ROTULO_DO_ITEM,
  caminhoDaTurma,
  codigoDosCriterios,
  rotuloDaDisciplina,
  textoDoItem,
  type PacoteDaTurma,
  type PacoteDoProfessor,
  type PacotesDaTurmaAssistente,
  type PainelDaTurma,
} from "@/lib/assistente-invisivel-tipos";
import { ROTULO_DO_ESTADO, textoDasRodadas } from "@/lib/entre-redes/atividades";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import { painelDeHabilidades } from "@/lib/evidencias-servidor";
import { podcastDaAtividade } from "@/lib/podcast-servidor";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { salaDaTurma } from "@/lib/salas";
import { normalizarSerie } from "@/lib/series";
import { minhasTurmas } from "@/lib/turmas";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { PainelDaAulaAssistenteInvisivel } from "./painel-da-aula-assistente-invisivel";
import { CartaoDoPodcast } from "./podcast-da-aula";
import { ZerarTurmaAssistenteInvisivel } from "./zerar-turma-assistente-invisivel";

const EXP_ID = "exp01em1b";
const ROTULO_DA_ORIGEM = { ia: "Gerada com IA e aprovada por você", padrao: "Banco padrão da rede" } as const;
/** O recado do podcast (one-pager §11, literal): ele revela os bastidores da inferência. */
const AVISO_DO_PODCAST =
  "Este podcast recapitula a vivência e revela os bastidores da inferência algorítmica. Deve ser ouvido preferencialmente após a realização da missão.";

/**
 * A PÁGINA DE UMA ATIVIDADE de O ASSISTENTE INVISÍVEL (ADR-185, ADR-130) — o
 * pacote homologado, nas cinco abas do template (ADR-182): pô-lo no ar (se
 * está pronto), a aula ao vivo (as cinco liberações, as duas pausas, a folha e
 * o relatório final) e o "Zerar" só no em andamento, o pacote, as equipes, o
 * podcast fixo (Alex e Sam) e o painel de habilidades (EM13CO20, EM13CO01,
 * EM13CO18, EM13CO03). Molde: a do Enigma da Capa da Rádio.
 *
 * Painel, botões e "Zerar" operam SEMPRE no pacote em andamento (a api não
 * recebe o pacote neles): por isso só aparecem quando a atividade da página É
 * a em andamento.
 */
export async function ResultadosAssistenteInvisivel({
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
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. */
  const turmas = todas
    .filter((t) => normalizarSerie(t.serie) === "1EM")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 1ª série do Ensino Médio, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;
  /* Só o professor conduz; a coordenação lê. A api recusaria o resto de qualquer jeito. */
  const podeConduzir = session?.usuario.papel === "professor";

  const base = caminhoDaTurma(turma);
  /* A lista das atividades é `GET /historico`; `GET /pacotes` é o preparo, com o pacote EM ANDAMENTO
     inteiro. O texto de uma atividade FORA do ar vem de `GET /pacotes/:pacoteId`. */
  const [pacotes, preparo] = turma
    ? await Promise.all([
        apiDoServidor<PacotesDaTurmaAssistente>(`${base}${ROTAS_DA_CURADORIA.historico}`),
        apiDoServidor<PacoteDaTurma>(`${base}${ROTAS_DA_CURADORIA.pacote}`),
      ])
    : [null, null];
  /* A atividade da página: a pedida, se ela é DESTA turma, e senão a em andamento. */
  const historico = pacotes?.historico ?? [];
  const atividadeId = historico.find((h) => h.id === pacote)?.id ?? pacotes?.emAndamento?.pacoteId ?? null;
  const entrada = historico.find((h) => h.id === atividadeId) ?? null;
  const conteudoNoAr =
    preparo?.ativo && preparo.ativo.id === atividadeId
      ? preparo.ativo
      : atividadeId && turma
        ? await apiDoServidor<PacoteDoProfessor>(`${base}/pacotes/${encodeURIComponent(atividadeId)}`)
        : null;
  const detalhe = entrada
    ? {
        id: entrada.id,
        tema: entrada.tema,
        disciplina: entrada.disciplina,
        origem: entrada.origem,
        aprovadoEm: entrada.aprovadoEm,
        ativo: entrada.ativo,
        rodadaAtual: conteudoNoAr?.rodadaAtual ?? pacotes?.emAndamento?.rodada ?? entrada.rodadas,
      }
    : null;
  const rodadas = entrada?.rodadas ?? 0;
  const emAndamento = detalhe?.ativo === true;
  const tituloDoEmAndamento = historico.find((h) => h.ativo)?.tema ?? null;

  const [painel, sala, habilidades, podcast] =
    detalhe && atividadeId
      ? await Promise.all([
          emAndamento ? apiDoServidor<PainelDaTurma>(`${base}/painel`) : Promise.resolve(null),
          podeConduzir ? salaDaTurma(turma) : Promise.resolve(null),
          rodadas > 0 || emAndamento ? painelDeHabilidades(turma, EXP_ID, atividadeId) : Promise.resolve(null),
          podcastDaAtividade(EXP_ID, turma, atividadeId),
        ])
      : [null, null, null, null];

  /* A atividade que o painel conta é a EM ANDAMENTO da turma; se outra aba trocou entre as duas leituras, ele não aparece. */
  const atividadeDoPainel = painel?.atividade && painel.atividade.pacoteId === detalhe?.id ? painel.atividade : null;
  const naSala = sala?.missoes.find((m) => m.expId === EXP_ID) ?? null;
  const liberadaEm = naSala ? (naSala.estado === "encerrada" ? naSala.encerradaEm : naSala.liberadaEm) : null;
  const rotaDaSala = `/professor/turmas/${encodeURIComponent(turma)}?aba=missoes`;
  const estado = ROTULO_DO_ESTADO[emAndamento ? "em-andamento" : "pronta"];

  return (
    <div className="flex flex-col gap-6">
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
            {textoDasRodadas(rodadas)}
            {emAndamento ? ` · rodada ${detalhe.rodadaAtual} em andamento` : ""}
          </p>
        ) : null}
        {emAndamento ? (
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            Daqui você libera cada etapa para a turma, acompanha as apostas e os critérios e, no fim, exporta o relatório
            de homologação. <strong>A folha da turma, com os nomes, é só para a sua tela</strong>.
          </p>
        ) : null}
        <p className="flex flex-wrap gap-4 text-[13px] font-semibold">
          <Link href={ficha} className="text-unooria-navy-900 hover:text-unooria-neutral-950">
            Ver as atividades da turma
          </Link>
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
            Escolha a turma acima. As atividades, os botões da aula e a folha são por turma, e valem só para a que você
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
          description="Confira se a turma é sua e desta escola, e tente de novo."
        />
      ) : !atividadeId || !detalhe ? (
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

          {naSala && naSala.estado !== "liberada" ? (
            <div data-liberacao-na-sala={naSala.estado}>
              <FeedbackAlert
                type="warning"
                title={
                  naSala.estado === "encerrada"
                    ? "A missão está encerrada na sala desta turma"
                    : "A missão ainda não está liberada para esta turma"
                }
                description="Sem a liberação na sala de aula, o cartão fica com cadeado para os estudantes — a atividade em andamento não basta."
                action={
                  <LinkButton href={rotaDaSala} size="sm">
                    Liberar Missão para a Turma
                  </LinkButton>
                }
              />
            </div>
          ) : null}

          <AbasDaAtividade
            estado={emAndamento ? "em-andamento" : "pronta"}
            aula={
              /* As `key` NÃO são otimização: o painel guarda estado em `useState(inicial)`. */
              emAndamento && painel ? (
                <>
                  <PainelDaAulaAssistenteInvisivel key={`aula-${turma}-${detalhe.id}`} turmaId={turma} inicial={painel} podeConduzir={podeConduzir} />
                  {podeConduzir && atividadeDoPainel ? (
                    <ZerarTurmaAssistenteInvisivel
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
              <Card variant="elevated">
                <div className="flex flex-col gap-4" data-pacote-da-atividade={detalhe.id}>
                  <SectionHeader title="O pacote temático" description={`Tema: ${detalhe.tema}`} />
                  <dl className="grid gap-x-6 gap-y-1 text-[13px] text-unooria-neutral-700 sm:grid-cols-[max-content_1fr]">
                    <dt className="font-semibold text-unooria-neutral-500">Disciplina</dt>
                    <dd>{rotuloDaDisciplina(detalhe.disciplina)}</dd>
                    {conteudoNoAr ? (
                      <>
                        <dt className="font-semibold text-unooria-neutral-500">Tópicos</dt>
                        <dd>{conteudoNoAr.topicos.join(", ") || "—"}</dd>
                      </>
                    ) : null}
                    {conteudoNoAr?.contexto ? (
                      <>
                        <dt className="font-semibold text-unooria-neutral-500">Contexto</dt>
                        <dd>{conteudoNoAr.contexto}</dd>
                      </>
                    ) : null}
                    <dt className="font-semibold text-unooria-neutral-500">Origem</dt>
                    <dd>{ROTULO_DA_ORIGEM[detalhe.origem]}</dd>
                    <dt className="font-semibold text-unooria-neutral-500">Criada em</dt>
                    <dd>{detalhe.aprovadoEm ? dataHora(detalhe.aprovadoEm) : "—"}</dd>
                    <dt className="font-semibold text-unooria-neutral-500">Assistente</dt>
                    <dd>{`Configuração ativa inicial: ${codigoDosCriterios(CRITERIOS_INICIAIS)} (Restritiva)`}</dd>
                  </dl>

                  {naSala?.estado === "liberada" ? (
                    <p className="text-[13px] text-unooria-neutral-700" data-liberacao-na-sala="liberada">
                      <Tag variant="success" size="sm">
                        Liberada na sala
                      </Tag>{" "}
                      {liberadaEm ? `desde ${dataHora(liberadaEm)}. ` : ""}
                      {emAndamento ? "A turma já pode entrar na missão." : "Quando esta atividade estiver em andamento, a turma já entra nela."}
                    </p>
                  ) : null}

                  {conteudoNoAr ? (
                    <ul className="flex flex-col gap-3">
                      {ITENS_DO_PACOTE.map((item) => {
                        const { titulo, texto } = textoDoItem(conteudoNoAr.conteudo, item);
                        return (
                          <li key={item} className="flex flex-col gap-1 rounded-lg border border-unooria-neutral-200 p-3" data-item={item}>
                            <span className="flex flex-wrap items-center gap-2">
                              <strong className="text-[14px] text-unooria-neutral-950">{titulo ?? ROTULO_DO_ITEM[item]}</strong>
                              {conteudoNoAr.editados.includes(item) ? (
                                <Badge variant="info" size="sm">
                                  Editado pelo professor
                                </Badge>
                              ) : null}
                            </span>
                            <span className="text-[13px] leading-relaxed text-unooria-neutral-800">{texto}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-unooria-neutral-600" data-conteudo-indisponivel>
                      Não foi possível carregar o texto do pacote agora. Recarregue a página.
                    </p>
                  )}
                </div>
              </Card>
            }
            equipes={
              <EquipesDaAtividade key={`equipes-${detalhe.id}`} turmaId={turma} expId={EXP_ID} atividadeId={detalhe.id} separarAoAbrir={separar} />
            }
            podcast={
              /* Depois da aula: o podcast da plataforma (ADR-150) — fixo, o roteiro do §11 do one-pager (Alex e Sam). */
              <CartaoDoPodcast expId={EXP_ID} turmaId={turma} atividadeId={detalhe.id} podcast={podcast} aviso={AVISO_DO_PODCAST} />
            }
            habilidades={
              habilidades?.temFicha ? (
                <div className="flex flex-col gap-3" data-habilidades-assistente-invisivel>
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
