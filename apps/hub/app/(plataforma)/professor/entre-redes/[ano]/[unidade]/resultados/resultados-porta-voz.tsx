import Link from "next/link";

import { dataHora } from "@edu/sdk";
import { Badge, Card, EmptyState, FeedbackAlert, SectionHeader, Tag } from "@edu/ui/ds";
import { AbasDaAtividade } from "@/components/atividades/abas-da-atividade";
import { UsarEstaAtividade } from "@/components/atividades/usar-esta-atividade";
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
  EXP_ID,
  NOME_DO_GRUPO,
  ROTAS_DA_TURMA,
  TEXTO_DA_PROJECAO,
  VALORES_DA_SERIE,
  caminhoDaTurma,
  rotuloDaDisciplina,
  type FalaDoGrupo,
  type PacoteDetalhe,
  type PacotesDaTurmaPortaVoz,
  type PainelDaTurma,
} from "@/lib/porta-voz-tipos";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { salaDaTurma } from "@/lib/salas";
import { normalizarSerie } from "@/lib/series";
import { minhasTurmas } from "@/lib/turmas";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { PainelDaAulaPortaVoz } from "./painel-da-aula-porta-voz";
import { CartaoDoPodcast } from "./podcast-da-aula";
import { ZerarTurmaPortaVoz } from "./zerar-turma-porta-voz";

const ROTULO_DA_ORIGEM = { ia: "Gerado com IA e homologado por você", padrao: "Banco padrão da Unooria" } as const;

/**
 * A PÁGINA DE UMA ATIVIDADE de O PORTA-VOZ DOS DADOS (ADR-198; ADR-130) — o
 * pacote homologado, com tudo o que se faz com ele: pô-lo no ar (se está
 * pronto), o conteúdo e a liberação na sala, a aula ao vivo (E4-PROF-01:
 * Pausar para o debate, Liberar Retomada da Turma, a lousa e o zerar) só no em
 * andamento, o podcast (só do professor, decisão 1) e o relatório pós-aula
 * (E6-PROF-01), que é a aba Habilidades: o painel da evidência (E14) já é a
 * matriz estudante × habilidade com os três níveis e a exportação.
 *
 * Sem aba Equipes: a missão é individual (a api recusa montagem).
 *
 * Painel, botões e "Zerar" operam SEMPRE no pacote em andamento (a api não
 * recebe o pacote neles): por isso só aparecem quando a atividade da página É
 * a em andamento.
 */
export async function ResultadosPortaVoz({
  missao,
  turma,
  pacote,
}: {
  missao: Missao;
  turma: string;
  /** `?pacote=` — a atividade desta página. Vazio = a em andamento. */
  pacote: string;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;
  const ficha = comTurma(rotaDaMissao(missao), turma);
  const guia = rotaDoGuiaDaMissao(EXP_ID);

  const [todas, session] = await Promise.all([minhasTurmas(), auth()]);
  /* O filtro por série FICA — ele diz quais salas podem rodar esta missão. */
  const turmas = todas
    .filter((t) => normalizarSerie(t.serie) === "3EM")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 3ª série do Ensino Médio, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;
  /* Só o professor conduz; a coordenação lê. A api recusaria o resto de qualquer jeito. */
  const podeConduzir = session?.usuario.papel === "professor";

  const base = caminhoDaTurma(turma);
  const pacotes = turma ? await apiDoServidor<PacotesDaTurmaPortaVoz>(`${base}${ROTAS_DA_TURMA.pacotes}`) : null;
  /* Só os HOMOLOGADOS são atividade: o rascunho da curadoria não abre aqui. Um id
     de outra turma (link velho, colado à mão) não chega à api como se fosse desta. */
  const homologados = (pacotes?.pacotes ?? []).filter((p) => p.aprovadoEm !== null);
  const atividadeId = homologados.find((h) => h.id === pacote)?.id ?? pacotes?.emAndamento?.pacoteId ?? null;
  const detalhe = atividadeId ? await apiDoServidor<PacoteDetalhe>(`${base}${ROTAS_DA_TURMA.pacote(atividadeId)}`) : null;
  const emAndamento = detalhe?.ativo === true;
  const tituloDoEmAndamento = homologados.find((h) => h.ativo)?.tema ?? null;

  const jogada = detalhe ? detalhe.rodadas > 0 || emAndamento : false;
  const [painel, sala, habilidades, podcast] =
    detalhe && atividadeId
      ? await Promise.all([
          emAndamento ? apiDoServidor<PainelDaTurma>(`${base}${ROTAS_DA_TURMA.painel}`) : Promise.resolve(null),
          podeConduzir ? salaDaTurma(turma) : Promise.resolve(null),
          jogada ? painelDeHabilidades(turma, EXP_ID, atividadeId) : Promise.resolve(null),
          podcastDaAtividade(EXP_ID, turma, atividadeId),
        ])
      : [null, null, null, null];

  /* A atividade que o painel conta é a EM ANDAMENTO da turma; se outra aba trocou entre as duas leituras, ele não aparece. */
  const atividadeDoPainel = painel?.atividade && painel.atividade.pacoteId === detalhe?.id ? painel.atividade : null;
  /* A SALA (ADR-69) é a outra porta, e é da TURMA: sem a missão liberada na sala o cartão fica com cadeado. */
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
            {textoDasRodadas(detalhe.rodadas)}
            {emAndamento ? ` · rodada ${detalhe.rodadaAtual} em andamento` : ""}
          </p>
        ) : null}
        {emAndamento ? (
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            Daqui você pausa as telas para o debate e libera a retomada da turma. As contagens não têm nomes e podem ir
            ao projetor; <strong>o ritmo da turma, com os nomes, é só para a sua tela</strong>.
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
            Escolha a turma acima. As atividades, os dois botões da aula e a lousa são por turma, e valem só para a que
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
        <div className="flex flex-col gap-3" data-sem-atividade>
          <EmptyState
            variant="no-data"
            size="lg"
            bordered
            fullWidth
            title="Nenhuma atividade em andamento nesta turma"
            description="A turma vê uma tela de espera até você criar uma atividade e liberá-la."
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
                      : "Nenhuma atividade está em andamento: a turma vê uma tela de espera. Use o botão abaixo quando a turma for fazer."
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
                description="Sem a liberação na sala de aula, o cartão fica com cadeado para a turma — a atividade em andamento não basta."
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
                  <PainelDaAulaPortaVoz key={`aula-${turma}-${detalhe.id}`} turmaId={turma} inicial={painel} podeConduzir={podeConduzir} />
                  {podeConduzir && atividadeDoPainel ? (
                    <ZerarTurmaPortaVoz
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
                  <SectionHeader title="O pacote de conteúdo" description={`Tema: ${detalhe.tema}`} />
                  <dl className="grid gap-x-6 gap-y-1 text-[13px] text-unooria-neutral-700 sm:grid-cols-[max-content_1fr]">
                    <dt className="font-semibold text-unooria-neutral-500">Componente</dt>
                    <dd>{rotuloDaDisciplina(detalhe.disciplina)}</dd>
                    <dt className="font-semibold text-unooria-neutral-500">Origem</dt>
                    <dd>{ROTULO_DA_ORIGEM[detalhe.origem]}</dd>
                    <dt className="font-semibold text-unooria-neutral-500">Homologado em</dt>
                    <dd>{detalhe.aprovadoEm ? dataHora(detalhe.aprovadoEm) : "—"}</dd>
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

                  <PacoteDoPortaVoz pacote={detalhe} />
                </div>
              </Card>
            }
            podcast={
              /* Depois da aula: o podcast da plataforma (ADR-150) — fixo, e só do professor (decisão 1). */
              <CartaoDoPodcast expId={EXP_ID} turmaId={turma} atividadeId={detalhe.id} podcast={podcast} />
            }
            habilidades={
              /* E6-PROF-01, o relatório pós-aula: a EVIDÊNCIA (E14) é a matriz estudante × habilidade
                 com os três níveis. A atividade é o PACOTE; invisível sem ficha; só o professor ajusta. */
              habilidades?.temFicha ? (
                <div className="flex flex-col gap-3" data-habilidades-porta-voz>
                  <SectionHeader
                    title="Relatório Final de Proficiência e Evidências BNCC"
                    description="O nível de cada estudante nas seis habilidades da missão, registrado pelo que ele fez."
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
                </div>
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}

/** O pacote como a turma o vê, com os números fixos ao lado — só professor e coordenação chegam aqui. */
function PacoteDoPortaVoz({ pacote }: { pacote: PacoteDetalhe }) {
  const c = pacote.conteudo;
  const fala = (f: FalaDoGrupo) => (
    <li key={`${f.autor}-${f.texto}`} className="flex flex-col gap-0.5">
      <strong>{`${f.autor} · ${f.perfil}`}</strong>
      <span>{f.texto}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-4 text-[13px] text-unooria-neutral-800">
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold text-unooria-neutral-950">O grupo da cidade</h3>
        <p>{`${NOME_DO_GRUPO} — ${c.grupo}`}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold text-unooria-neutral-950">{`A tabela: ${c.servico.indicador}`}</h3>
        <p className="text-unooria-neutral-600">{`${c.servico.orgao} · ${c.servico.unidade} · ${c.servico.abrangencia} · ${c.servico.periodicidade}`}</p>
        <ul className="flex flex-col gap-1">
          {VALORES_DA_SERIE.map((valor, i) => (
            <li key={i}>
              <strong>{`${c.servico.periodos[i] ?? `Período ${i + 1}`}: ${valor}%`}</strong> {c.servico.situacoes[i] ? `— ${c.servico.situacoes[i]}` : ""}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold text-unooria-neutral-950">{`A nota técnica anexa: ${c.notaTecnica.titulo}`}</h3>
        <p className="text-unooria-neutral-600">{`${c.notaTecnica.arquivo} · ${c.notaTecnica.orgao}`}</p>
        <p>{c.notaTecnica.resumo}</p>
        {c.notaTecnica.secoes.map((s) => (
          <p key={s.titulo}>
            <strong>{s.titulo}:</strong> {s.texto}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold text-unooria-neutral-950">As quatro informações do compositor</h3>
        <ul className="flex flex-col gap-1">
          <li>
            <strong>Explicação da escala (eixo em 0%):</strong> {c.camadas.explicacao.zero}
          </li>
          <li>
            <strong>Explicação da escala (eixo em 80%):</strong> {c.camadas.explicacao.oitenta}
          </li>
          <li>
            <strong>Fonte dos dados:</strong> {c.camadas.fonte}
          </li>
          <li>
            <strong>Contexto da queda:</strong> {c.camadas.contexto}
          </li>
          {/* ADR-203: a 4ª, incorreta de propósito, fixa em toda turma. Aparece embaralhada entre as outras. */}
          <li>
            <strong>Projeção da tendência (incorreta de propósito, a nota técnica a desmente):</strong> {TEXTO_DA_PROJECAO}
          </li>
        </ul>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-[14px] font-semibold text-unooria-neutral-950">Reações a quem publicou com o eixo em 0%</h3>
          <ul className="flex flex-col gap-2">{c.reacoes.zero.map(fala)}</ul>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-[14px] font-semibold text-unooria-neutral-950">Reações a quem publicou com o eixo em 80%</h3>
          <ul className="flex flex-col gap-2">{c.reacoes.oitenta.map(fala)}</ul>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold text-unooria-neutral-950">Depois da publicação da escola rival</h3>
        <ul className="flex flex-col gap-2">{[c.posAha.conflito, c.posAha.coordenador].map(fala)}</ul>
      </div>
    </div>
  );
}
