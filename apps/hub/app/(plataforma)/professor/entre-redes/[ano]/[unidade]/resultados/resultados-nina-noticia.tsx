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
import type { MembroNoPainel } from "@/lib/equipe-no-painel";
import { equipesDaMissao } from "@/lib/equipes-servidor";
import { painelDeHabilidades } from "@/lib/evidencias-servidor";
import {
  ROTULO_DO_SUPORTE,
  SUPORTE_OMITIDO,
  caminhoDaTurma,
  caminhoDoPacote,
  rotuloDaDisciplina,
  textoDaFicha,
  type PacoteDetalhe,
  type PacotesDaTurmaNina,
  type PainelDaTurma,
} from "@/lib/nina-noticia-tipos";
import { comTurma, rotaDoGuiaDaMissao } from "@/lib/rotas-da-missao";
import { salaDaTurma } from "@/lib/salas";
import { normalizarSerie } from "@/lib/series";
import { minhasTurmas } from "@/lib/turmas";

import { EscolhaDeTurma } from "./escolha-de-turma";
import { ImagensDaNina } from "./imagens-da-nina";
import { PainelDaAulaNinaNoticia } from "./painel-da-aula-nina-noticia";
import { ZerarTurmaNinaNoticia } from "./zerar-turma-nina-noticia";

const EXP_ID = "exp03ef1b";
const ROTULO_DA_ORIGEM = { ia: "Gerada com IA e aprovada", padrao: "Banco padrão da Unooria" } as const;

/**
 * A PÁGINA DE UMA ATIVIDADE de NINA E A NOTÍCIA QUE DESAPARECEU (ADR-197,
 * ADR-130), nas abas do template (ADR-182): a aula ao vivo (os dois portões, a
 * pausa, os cartões e a folha) e o "Zerar Turma" só no em andamento; o
 * conteúdo (as três notícias com a ficha e as imagens — a aprovação delas,
 * quando a atividade está EM PREPARO); as equipes; e as habilidades. Sem
 * podcast nesta frente (spec §0.9). Molde: as do Júri e do Enigma.
 *
 * O que lê (`apps/api/src/nina-noticia/contrato-de-rotas.ts`):
 * - **daqui (servidor)**: `GET …/pacotes` (a em andamento e o histórico que
 *   valida o `?pacote=`), `GET …/pacotes/:pacoteId` e, só em andamento,
 *   `GET …/painel`; as equipes desta atividade e o painel de habilidades com
 *   `atividadeId = pacoteId`;
 * - **do navegador, pelo BFF**: pôr em andamento, as imagens, o gate, o zerar e
 *   o `GET …/painel` do polling.
 *
 * Painel, gate e zerar são da TURMA (operam no pacote em andamento): com uma
 * atividade PRONTA na tela, mostrá-los conduziria a outra.
 */
export async function ResultadosNinaNoticia({
  missao,
  turma,
  pacote,
  separar,
}: {
  missao: Missao;
  turma: string;
  /** `?pacote=` — a atividade desta página. Vazio = a em andamento. */
  pacote: string;
  /** `?separar=N` — vindo da criação com "Eu separo". */
  separar: number | null;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;
  const ficha = comTurma(rotaDaMissao(missao), turma);
  const guia = rotaDoGuiaDaMissao(EXP_ID);

  const [todas, session] = await Promise.all([minhasTurmas(), auth()]);
  const turmas = todas
    .filter((t) => normalizarSerie(t.serie) === "3EF")
    .map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes }));
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 3º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;
  /* Só o professor conduz; a coordenação lê. A api recusaria o resto de qualquer jeito. */
  const podeConduzir = session?.usuario.papel === "professor";

  const base = caminhoDaTurma(turma);
  const pacotes = turma ? await apiDoServidor<PacotesDaTurmaNina>(`${base}/pacotes`) : null;
  const historico = pacotes?.historico ?? [];
  const atividadeId = historico.find((h) => h.id === pacote)?.id ?? pacotes?.ativo?.id ?? null;
  const detalhe = atividadeId ? await apiDoServidor<PacoteDetalhe>(caminhoDoPacote(turma, atividadeId)) : null;
  const emAndamento = detalhe?.ativo === true;
  const tituloDoEmAndamento = pacotes?.ativo?.tema ?? null;

  const [painel, equipes, sala, habilidades] =
    detalhe && atividadeId
      ? await Promise.all([
          emAndamento ? apiDoServidor<PainelDaTurma>(`${base}/painel`) : Promise.resolve(null),
          equipesDaMissao(turma, EXP_ID, atividadeId),
          podeConduzir ? salaDaTurma(turma) : Promise.resolve(null),
          detalhe.rodadas > 0 || emAndamento ? painelDeHabilidades(turma, EXP_ID, atividadeId) : Promise.resolve(null),
        ])
      : [null, null, null, null];

  const membros: Record<string, MembroNoPainel[]> = Object.fromEntries(
    (equipes?.equipes ?? []).map((e) => [e.id, e.membros]),
  );
  /* Sem as imagens aprovadas (a segunda fase), a atividade não vai ao ar: "Em
     preparo", e o "Usar esta atividade agora" dá lugar à aprovação. */
  const prontaParaAula = detalhe ? detalhe.imagensAprovadasEm !== null : false;
  const chaveDoEstado = emAndamento ? "em-andamento" : prontaParaAula ? "pronta" : "em-preparo";
  const estado = ROTULO_DO_ESTADO[chaveDoEstado];
  const naSala = sala?.missoes.find((m) => m.expId === EXP_ID) ?? null;
  const liberadaEm = naSala ? (naSala.estado === "encerrada" ? naSala.encerradaEm : naSala.liberadaEm) : null;
  const rotaDaSala = `/professor/turmas/${encodeURIComponent(turma)}?aba=missoes`;

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
        {emAndamento ? (
          <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
            Daqui você libera o filtro e a inspeção, pausa a turma para a conversa e acompanha onde cada computador está.{" "}
            <strong>Os cartões da sala podem ir para o projetor; a folha, com os nomes, é só para a sua tela.</strong>
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
            Escolha a turma acima. As atividades, os portões da aula e a folha são por turma, e valem só para a que você
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
            description="A turma vê a missão fechada até você criar uma atividade e liberá-la."
          />
          <div>
            <LinkButton href={ficha}>Ver as atividades da turma</LinkButton>
          </div>
        </div>
      ) : (
        <>
          {!emAndamento && !prontaParaAula ? (
            <Card variant="outlined" title="Aprove as imagens antes de liberar a turma">
              <div className="flex flex-col gap-3" data-atividade-em-preparo>
                <FeedbackAlert
                  type="info"
                  description="As imagens das notícias são geradas por inteligência artificial. Na aba Conteúdo, confira cada uma — a do telão precisa mostrar o pátio sem dúvida —, refaça a que não servir e aprove: só então a atividade pode ir ao ar."
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

          {/* A outra porta da aula, a liberação na sala, fica FORA das abas. */}
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

          <AbasDaAtividade
            estado={chaveDoEstado}
            aula={
              emAndamento && painel ? (
                <>
                  <PainelDaAulaNinaNoticia
                    key={`aula-${turma}-${detalhe.id}`}
                    turmaId={turma}
                    inicial={painel}
                    membros={membros}
                    podeConduzir={podeConduzir}
                  />
                  {podeConduzir ? (
                    <ZerarTurmaNinaNoticia
                      key={`zerar-${turma}-${detalhe.id}-${painel.rodada}`}
                      turmaId={turma}
                      nomeDaTurma={painel.turma.nome}
                      tema={detalhe.tema}
                    />
                  ) : null}
                </>
              ) : null
            }
            conteudo={
              <>
                <ImagensDaNina
                  key={`imagens-${detalhe.id}`}
                  turmaId={turma}
                  pacoteId={detalhe.id}
                  conteudo={detalhe.conteudo}
                  imagensIniciais={detalhe.imagens}
                  aprovadasEmInicial={detalhe.imagensAprovadasEm}
                  podeEditar={podeConduzir}
                />
                <Card variant="elevated">
                  <div className="flex flex-col gap-4" data-pacote-da-atividade={detalhe.id}>
                    <SectionHeader title="As três notícias da feira" description={`Tema: ${detalhe.tema} · Assunto: ${detalhe.assuntos}`} />
                    <dl className="grid gap-x-6 gap-y-1 text-[13px] text-unooria-neutral-700 sm:grid-cols-[max-content_1fr]">
                      <dt className="font-semibold text-unooria-neutral-500">Criada em</dt>
                      <dd>{dataHora(detalhe.criadoEm)}</dd>
                      <dt className="font-semibold text-unooria-neutral-500">Cartaz da feira</dt>
                      <dd>{detalhe.conteudo.cartaz.texto}</dd>
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
                    <ul className="grid gap-3 lg:grid-cols-3">
                      {detalhe.conteudo.reportagens.map((r) => (
                        <li
                          key={r.suporte}
                          className={`flex flex-col gap-1 rounded-lg p-3 text-[13px] ${
                            r.suporte === SUPORTE_OMITIDO
                              ? "border-2 border-dashed border-unooria-neutral-950"
                              : "border border-unooria-neutral-200"
                          }`}
                          data-reportagem={r.suporte}
                        >
                          <span className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-600">
                            {ROTULO_DO_SUPORTE[r.suporte]}
                          </span>
                          <strong className="text-[15px] text-unooria-neutral-950">{r.manchete}</strong>
                          <span className="text-unooria-neutral-700">{r.legenda}</span>
                          <span className="text-[12px] text-unooria-neutral-600">Ficha: {textoDaFicha(r.ficha)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
                      A ficha do telão tem o campo Onde vazio de propósito: é o que faz a busca pelo pátio deixá-la de
                      fora. As fichas e o lugar das fotos são fixos da missão; só os textos e as imagens vêm do pacote.
                    </p>
                  </div>
                </Card>
              </>
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
            habilidades={
              habilidades?.temFicha ? (
                <div className="flex flex-col gap-3" data-habilidades-nina-noticia>
                  <PainelDeHabilidades
                    key={`habilidades-${turma}-${detalhe.id}`}
                    turmaId={turma}
                    expId={EXP_ID}
                    atividadeId={detalhe.id}
                    inicial={habilidades}
                    podeEditar={podeConduzir}
                    rodadaEmAndamento={emAndamento ? (detalhe.rodada ?? null) : null}
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
