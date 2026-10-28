import Link from "next/link";

import { dataHora } from "@edu/sdk";
import { Badge, Card, Collapse, EmptyState, FeedbackAlert, SectionHeader, Tag } from "@edu/ui/ds";
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
import {
  CHAVES_DAS_REACOES,
  ROTULO_DA_MANCHETE,
  ROTULO_DA_ORIGEM_DA_DEVOLUTIVA,
  ROTULO_DA_REACAO,
  ROTULO_DO_NO,
  ROTULO_DO_TIPO,
  MANCHETES,
  caminhoDaTurma,
  reage,
  rotuloDaDisciplina,
  type DevolutivasDaAtividade,
  type PacoteDetalhe,
  type PacotesDaTurmaEfeito,
  type PainelDaTurma,
} from "@/lib/efeito-amplificador-tipos";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { salaDaTurma } from "@/lib/salas";
import { normalizarSerie } from "@/lib/series";
import { minhasTurmas } from "@/lib/turmas";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { PainelDaAulaEfeitoAmplificador } from "./painel-da-aula-efeito-amplificador";
import { CartaoDoPodcast } from "./podcast-da-aula";
import { ZerarTurmaEfeitoAmplificador } from "./zerar-turma-efeito-amplificador";

const EXP_ID = "exp02em1b";
const ROTULO_DA_ORIGEM = { ia: "Gerado com IA e homologado por você", padrao: "Pacote padrão oficial da Unooria" } as const;

/**
 * A PÁGINA DE UMA ATIVIDADE de O EFEITO AMPLIFICADOR (2.1.0, ADR-191; ADR-130) —
 * o pacote homologado, com tudo o que se faz com ele: pô-lo no ar (se está
 * pronto), o pacote com o gabarito e a liberação na sala, as equipes, a
 * condução ao vivo (E4-PROF-01: Pausar Telas para Debate, Avançar Turma para
 * Explicar) só no em andamento, o "Zerar", o podcast e o relatório pós-aula
 * (E6-PROF-01), que é a aba Habilidades: o painel da evidência (F14.7) já é a
 * matriz estudante × habilidade com os três níveis, e não se duplica; abaixo
 * dele, a devolutiva que cada estudante leu ao concluir (2.2.0, ADR-192). Sem
 * reflexão: a transferência da Etapa 6 está fora desta versão.
 *
 * Painel, botões e "Zerar" operam SEMPRE no pacote em andamento (a api não
 * recebe o pacote neles): por isso só aparecem quando a atividade da página É
 * a em andamento.
 */
export async function ResultadosEfeitoAmplificador({
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
    .filter((t) => normalizarSerie(t.serie) === "2EM")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 2ª série do Ensino Médio, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;
  /* Só o professor conduz; a coordenação lê. A api recusaria o resto de qualquer jeito. */
  const podeConduzir = session?.usuario.papel === "professor";

  const base = caminhoDaTurma(turma);
  const pacotes = turma ? await apiDoServidor<PacotesDaTurmaEfeito>(`${base}/pacotes`) : null;
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

  const jogada = detalhe ? detalhe.rodadas > 0 || emAndamento : false;
  const [painel, sala, habilidades, podcast, devolutivas] =
    detalhe && atividadeId
      ? await Promise.all([
          emAndamento ? apiDoServidor<PainelDaTurma>(`${base}/painel`) : Promise.resolve(null),
          podeConduzir ? salaDaTurma(turma) : Promise.resolve(null),
          jogada ? painelDeHabilidades(turma, EXP_ID, atividadeId) : Promise.resolve(null),
          podcastDaAtividade(EXP_ID, turma, atividadeId),
          /* A devolutiva de cada estudante (ADR-192). Falha = `null`, e a seção some sem derrubar a aba. */
          jogada
            ? apiDoServidor<DevolutivasDaAtividade>(`${base}/pacotes/${encodeURIComponent(atividadeId)}/devolutivas`)
            : Promise.resolve(null),
        ])
      : [null, null, null, null, null];

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
            Daqui você pausa as telas para o debate e avança a turma para o Explicar. O Balanço Editorial, a
            Distribuição Horária Coletiva e a Matriz Consolidada não têm nomes, e podem ir ao projetor;{" "}
            <strong>o Monitor de Ritmo e Inatividade, com os nomes, é só para a sua tela</strong>.
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
            Escolha a turma acima. As atividades, os dois botões da aula e a folha são por turma, e valem só para a
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
                  <PainelDaAulaEfeitoAmplificador key={`aula-${turma}-${detalhe.id}`} turmaId={turma} inicial={painel} podeConduzir={podeConduzir} />
                  {podeConduzir && atividadeDoPainel ? (
                    <ZerarTurmaEfeitoAmplificador
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
                  <SectionHeader title="O pacote da campanha" description={`Tema: ${detalhe.tema}`} />
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
                        ? "A turma já pode entrar na campanha."
                        : "Quando esta atividade estiver em andamento, a turma já entra nela."}
                    </p>
                  ) : null}

                  <PacoteDaCampanha pacote={detalhe} />
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
              /* Depois da aula: o podcast da plataforma (ADR-150) — fixo, o roteiro do one-pager. */
              <CartaoDoPodcast expId={EXP_ID} turmaId={turma} atividadeId={detalhe.id} podcast={podcast} />
            }
            habilidades={
              /* E6-PROF-01, o relatório pós-aula: a EVIDÊNCIA (E14) já é a matriz
                 estudante × habilidade com os três níveis. A atividade é o PACOTE
                 (`atividadeId = pacoteId`); a rodada é a reaplicação, e o próprio
                 painel mostra as rodadas e o resultado. Invisível sem ficha
                 (`temFicha: false`), e só o `professor` confirma e ajusta: a
                 coordenação lê. */
              habilidades?.temFicha || devolutivas ? (
                <div className="flex flex-col gap-3" data-habilidades-efeito-amplificador>
                  {habilidades?.temFicha ? (
                    <>
                      <SectionHeader
                        title="Matriz Consolidada de Evidências (CO24, CO14, CO26, CO08)"
                        description="O relatório da turma: o nível de cada estudante nas quatro habilidades da missão, registrado pelo que ele fez."
                      />
                      <PainelDeHabilidades
                        key={`habilidades-${turma}-${detalhe.id}`}
                        turmaId={turma}
                        expId={EXP_ID}
                        atividadeId={detalhe.id}
                        inicial={habilidades}
                        podeEditar={podeConduzir}
                        rodadaEmAndamento={emAndamento ? detalhe.rodadaAtual : null}
                      />
                    </>
                  ) : null}
                  {/* No MESMO painel dos critérios: o professor lê o nível e o que o estudante leu sobre ele. */}
                  {devolutivas ? <DevolutivasDosEstudantes dados={devolutivas} /> : null}
                </div>
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}

/** O pacote com o gabarito — só professor e coordenação chegam aqui. */
function PacoteDaCampanha({ pacote }: { pacote: PacoteDetalhe }) {
  const c = pacote.conteudo;
  return (
    <div className="flex flex-col gap-4 text-[13px] text-unooria-neutral-800">
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold text-unooria-neutral-950">A pauta do grêmio</h3>
        <p>
          <strong>{c.pauta.titulo}</strong>
        </p>
        <p>{c.pauta.descricao}</p>
        <ul className="list-disc pl-5">
          {c.pauta.orientacoes.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-[14px] font-semibold text-unooria-neutral-950">O rascunho do UnooriaAI</h3>
        {c.rascunho.map((p) => (
          <div key={p.id} className="flex flex-col gap-1 rounded-lg border border-unooria-neutral-200 p-3">
            {p.no ? (
              <Tag variant="warning" size="sm" pill>
                {ROTULO_DO_NO[p.no]}
              </Tag>
            ) : null}
            <p>{p.texto}</p>
            {p.corrigido ? <p className="text-unooria-neutral-600">{`Corrigido: ${p.corrigido}`}</p> : null}
          </div>
        ))}
        <p className="text-unooria-neutral-600">{`A frase que o algoritmo destaca no feed: “${c.recorte}”`}</p>
        <p className="text-unooria-neutral-600">{`Fonte inventada: ${c.fonteInventada} · Colega exposto: ${c.colega} · Autoria do trecho copiado: ${c.fonteOriginal}`}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold text-unooria-neutral-950">As manchetes</h3>
        <ul className="flex flex-col gap-1">
          {MANCHETES.map((m) => (
            <li key={m}>
              <strong>{ROTULO_DA_MANCHETE[m]}:</strong> {c.manchetes[m]}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold text-unooria-neutral-950">Os comentários da madrugada</h3>
        <ul className="flex flex-col gap-2">
          {c.comentarios.map((com) => (
            <li key={com.id} className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong>{`${com.autor} · ${com.horario}`}</strong>
                <Tag variant="neutral" size="sm" pill>
                  {ROTULO_DO_TIPO[com.tipo]}
                </Tag>
              </span>
              <span>{com.texto}</span>
              {/* As reações ao post (ADR-192): só nos pacotes gerados na 2.2.0 em diante, e só nas vozes que amplificam. */}
              {c.reacoes && reage(com.tipo) ? (
                <Collapse title="As seis reações ao post" size="sm" variant="bordered">
                  <div className="flex flex-col gap-2 pt-1" data-reacoes-do-comentario={com.id}>
                    <p className="text-[12px] text-unooria-neutral-600">
                      Este comentário muda conforme a manchete e o trecho que viralizaram no post de cada estudante. Sem
                      texto numa variante, vale o de cima.
                    </p>
                    <dl className="flex flex-col gap-2">
                      {CHAVES_DAS_REACOES.map((chave) => (
                        <div key={chave} className="flex flex-col gap-0.5">
                          <dt className="text-[12px] font-semibold text-unooria-neutral-500">{ROTULO_DA_REACAO[chave]}</dt>
                          <dd>{c.reacoes?.[chave]?.[com.id]?.trim() || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </Collapse>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * A DEVOLUTIVA de cada estudante (ADR-192): o parágrafo por habilidade que ele
 * leu ao concluir. Nominal, como o resto da aba. Um `Collapse` por estudante,
 * fechado: são quatro parágrafos cada, e a turma inteira aberta empurraria a
 * aba para longe. O corpo é só texto — nada focável dentro do `aria-hidden`
 * do `Collapse` fechado (a lacuna do DS que a curadoria compensa).
 */
function DevolutivasDosEstudantes({ dados }: { dados: DevolutivasDaAtividade }) {
  const variasRodadas = new Set(dados.devolutivas.map((d) => d.rodada)).size > 1;
  return (
    <div className="mt-4 flex flex-col gap-3" data-devolutivas>
      <SectionHeader
        title="Devolutiva de cada estudante"
        description="A devolutiva que o estudante leu ao concluir, escrita a partir do que ele fez. Quem concluiu sem ela vê a do modelo da Unooria."
      />
      {dados.devolutivas.length === 0 ? (
        <EmptyState
          variant="no-data"
          size="md"
          bordered
          fullWidth
          title="Ninguém concluiu ainda"
          description="A devolutiva de cada estudante aparece aqui quando ele concluir a missão."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {dados.devolutivas.map((d) => {
            const detalhes = [
              d.equipe ? `Equipe ${d.equipe}` : null,
              variasRodadas ? `Rodada ${d.rodada}` : null,
              d.concluidoEm ? `concluiu em ${dataHora(d.concluidoEm)}` : null,
            ].filter(Boolean);
            return (
              <li key={`${d.estudanteId}-${d.rodada}`} data-devolutiva-do-estudante={d.estudanteId}>
                <Collapse
                  title={d.nome}
                  description={detalhes.length > 0 ? detalhes.join(" · ") : undefined}
                  headerExtra={
                    <Tag variant={d.origem === "ia" ? "info" : "neutral"} size="sm" pill>
                      {ROTULO_DA_ORIGEM_DA_DEVOLUTIVA[d.origem]}
                    </Tag>
                  }
                  size="sm"
                  variant="bordered"
                >
                  <div className="flex flex-col gap-3 pt-1 text-[13px] leading-relaxed text-unooria-neutral-800">
                    {dados.habilidades.map((h) => (
                      <div key={h} className="flex flex-col gap-0.5">
                        <p className="flex flex-wrap items-baseline gap-2">
                          <strong className="text-unooria-neutral-950">{dados.titulos[h] ?? h}</strong>
                          <span className="text-[12px] text-unooria-neutral-500">{h}</span>
                        </p>
                        <p>{d.habilidades[h]?.trim() || "—"}</p>
                      </div>
                    ))}
                  </div>
                </Collapse>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
